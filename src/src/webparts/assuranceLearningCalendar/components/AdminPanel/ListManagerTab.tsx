import * as React from 'react';
import styles from './AdminPanel.module.scss';
import { ICourse } from '../../models/ICourse';
import { ICurrentUser } from '../../models/IAdmin';
import { CourseInput, ICourseService } from '../../services/ICourseService';
import { distinctSorted, formatTimeWithZone } from '../../utils/courseUtils';
import { ITaskFailure, errorMessage, runWithLimit } from '../../utils/asyncUtils';
import { Icon } from '../Icons/Icon';
import { EventForm } from './EventForm';
import { ButtonSpinner, IConfirmRequest, IPanelMessage, Loading, Message } from './AdminParts';

export interface IListManagerTabProps {
  idPrefix: string;
  service: ICourseService;
  isSuperAdmin: boolean;
  /** Recorded as "deleted by" when an Admin deletes a class. */
  currentUser: ICurrentUser;
  onChanged: () => void;
  confirm: (request: IConfirmRequest) => void;
}

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; course: ICourse };

/** Bulk change in progress: deleting ticked events, or restoring / deleting ticked deleted events. */
type BulkKind = '' | 'delete' | 'restoreDeleted' | 'deleteDeleted';

/** Parallel requests for bulk changes (keeps SharePoint from throttling). */
const BULK_LIMIT: number = 4;

/** Latest classes first. */
function byStartDesc(a: ICourse, b: ICourse): number {
  return b.startDate.localeCompare(a.startDate) || a.title.localeCompare(b.title);
}

/** Most recently deleted first. */
function byDeletedDesc(a: ICourse, b: ICourse): number {
  return (b.deletedOn || '').localeCompare(a.deletedOn || '') || byStartDesc(a, b);
}

function matches(c: ICourse, text: string): boolean {
  return (
    [c.title, c.offering, c.region, c.trainingType, c.startDate, c.endDate, c.deletedBy || '']
      .join(' ')
      .toLowerCase()
      .indexOf(text) !== -1
  );
}

/** "Nov 26, 2026, 3:04 PM" in the viewer's time zone; '' when missing. */
function formatDateTime(iso: string | undefined): string {
  const ms: number = iso ? Date.parse(iso) : NaN;
  if (isNaN(ms)) {
    return '';
  }
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/** "Deleted by Alex Morgan · Nov 26, 2026, 3:04 PM" */
function deletedInfo(c: ICourse): string {
  const when: string = formatDateTime(c.deletedOn);
  if (!c.deletedBy && !when) {
    return 'Deleted (who and when were not recorded)';
  }
  return ['Deleted by ' + (c.deletedBy || 'unknown'), when].filter((part) => !!part).join(' · ');
}

/**
 * List Manager: search, add, edit and delete classes; tick several to delete them at once.
 * - Admin: Delete hides the class (it is marked as deleted, with who and when, and kept in the list).
 * - Super Admin: Delete removes the class for good. Classes deleted by Admins are listed at the bottom
 *   (greyed, with who deleted them and when); they can be edited, restored or deleted permanently,
 *   one at a time or ticked together. Leaving them as they are keeps them hidden.
 */
export function ListManagerTab({
  idPrefix,
  service,
  isSuperAdmin,
  currentUser,
  onChanged,
  confirm
}: IListManagerTabProps): React.ReactElement {
  const [courses, setCourses] = React.useState<ICourse[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [search, setSearch] = React.useState<string>('');
  const [form, setForm] = React.useState<FormState>({ mode: 'closed' });
  const [saving, setSaving] = React.useState<boolean>(false);
  /** Row with a change in progress. */
  const [busyId, setBusyId] = React.useState<string>('');
  const [bulk, setBulk] = React.useState<BulkKind>('');
  /** Ticked classes (live and deleted). */
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [message, setMessage] = React.useState<IPanelMessage | undefined>(undefined);

  const load = React.useCallback((): Promise<void> => {
    return service.getCourses().then(
      (items) => {
        setCourses(items.slice().sort(byStartDesc));
        // Drop ticks of classes that are gone.
        setSelected((old) => {
          const next: Record<string, boolean> = {};
          items.forEach((c) => {
            if (old[c.id]) {
              next[c.id] = true;
            }
          });
          return next;
        });
        setLoading(false);
      },
      (e: unknown) => {
        setLoading(false);
        setMessage({ kind: 'error', text: `The calendar items could not be loaded. ${errorMessage(e)}` });
      }
    );
  }, [service]);

  React.useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const live: ICourse[] = React.useMemo(() => courses.filter((c) => !c.isDeleted), [courses]);
  /** Deleted by Admins: only Super Admins see them. */
  const deleted: ICourse[] = React.useMemo(
    () => (isSuperAdmin ? courses.filter((c) => !!c.isDeleted).sort(byDeletedDesc) : []),
    [courses, isSuperAdmin]
  );
  const offerings: string[] = React.useMemo(() => distinctSorted(live, 'offering'), [live]);
  const regions: string[] = React.useMemo(() => distinctSorted(live, 'region'), [live]);

  const text: string = search.trim().toLowerCase();
  const visibleLive: ICourse[] = text ? live.filter((c) => matches(c, text)) : live;
  const visibleDeleted: ICourse[] = text ? deleted.filter((c) => matches(c, text)) : deleted;
  const liveTicked: ICourse[] = visibleLive.filter((c) => selected[c.id]);
  const deletedTicked: ICourse[] = visibleDeleted.filter((c) => selected[c.id]);
  const allLiveTicked: boolean = visibleLive.length > 0 && liveTicked.length === visibleLive.length;
  const allDeletedTicked: boolean = visibleDeleted.length > 0 && deletedTicked.length === visibleDeleted.length;
  const working: boolean = !!busyId || !!bulk;

  /** Marks a class as deleted by the current user, now. */
  const markDeleted = (c: ICourse): Promise<void> =>
    service.updateCourse({
      ...c,
      isDeleted: true,
      deletedBy: currentUser.displayName || currentUser.email,
      deletedOn: new Date().toISOString()
    });

  const restoreOne = (c: ICourse): Promise<void> =>
    service.updateCourse({ ...c, isDeleted: false, deletedBy: '', deletedOn: '' });

  const afterChange = (note: IPanelMessage): Promise<void> => {
    setMessage(note);
    onChanged();
    return load();
  };

  const closeFormFor = (ids: string[]): void => {
    if (form.mode === 'edit' && ids.indexOf(form.course.id) !== -1) {
      setForm({ mode: 'closed' });
    }
  };

  const untick = (ids: string[]): void => {
    setSelected((old) => {
      const next: Record<string, boolean> = {};
      Object.keys(old).forEach((id) => {
        if (old[id] && ids.indexOf(id) === -1) {
          next[id] = true;
        }
      });
      return next;
    });
  };

  const save = (input: CourseInput): void => {
    setSaving(true);
    setMessage(undefined);
    const editing: ICourse | undefined = form.mode === 'edit' ? form.course : undefined;
    // Editing a deleted class keeps it deleted (with who and when); Restore shows it again.
    const work: Promise<unknown> = editing
      ? service.updateCourse({
          ...input,
          id: editing.id,
          isDeleted: !!editing.isDeleted,
          deletedBy: editing.deletedBy,
          deletedOn: editing.deletedOn
        })
      : service.addCourse({ ...input, isDeleted: false });
    work
      .then(() => {
        setForm({ mode: 'closed' });
        return afterChange({
          kind: 'success',
          text: editing ? `"${input.title}" was updated.` : `"${input.title}" was added.`
        });
      })
      .catch((e: unknown) => {
        setMessage({ kind: 'error', text: `The event could not be saved. ${errorMessage(e)}` });
      })
      .then(() => setSaving(false))
      .catch(() => undefined);
  };

  /** Runs one change on one row, then reloads. */
  const runOnRow = (course: ICourse, work: () => Promise<unknown>, done: string, failed: string): void => {
    setBusyId(course.id);
    setMessage(undefined);
    closeFormFor([course.id]);
    work()
      .then(() => {
        untick([course.id]);
        return afterChange({ kind: 'success', text: done });
      })
      .catch((e: unknown) => setMessage({ kind: 'error', text: `${failed} ${errorMessage(e)}` }))
      .then(() => setBusyId(''))
      .catch(() => undefined);
  };

  /** Runs one change on every ticked class, then reloads. */
  const runBulk = (kind: BulkKind, targets: ICourse[], work: (c: ICourse) => Promise<unknown>, verb: string): void => {
    if (!targets.length) {
      return;
    }
    const ids: string[] = targets.map((c) => c.id);
    setBulk(kind);
    setMessage(undefined);
    closeFormFor(ids);
    runWithLimit(targets, BULK_LIMIT, work)
      .then((failures: ITaskFailure[]) => {
        const failedIds: string[] = failures.map((f) => targets[f.index].id);
        untick(ids.filter((id) => failedIds.indexOf(id) === -1));
        const ok: number = targets.length - failures.length;
        return afterChange({
          kind: failures.length ? 'error' : 'success',
          text: failures.length
            ? `${ok} of ${targets.length} event(s) were ${verb}. ${failures.length} could not be changed:`
            : `${ok} event(s) were ${verb}.`,
          details: failures.map((f) => `${targets[f.index].title}: ${f.message}`)
        });
      })
      .catch(() => undefined)
      .then(() => setBulk(''))
      .catch(() => undefined);
  };

  const deleteForGood = (course: ICourse): void => {
    confirm({
      title: 'Delete this event permanently?',
      lines: [
        `"${course.title}" (${course.startDate}) will be deleted from the list.`,
        'It goes to the SharePoint recycle bin.'
      ],
      confirmLabel: 'Delete permanently',
      danger: true,
      onConfirm: () =>
        runOnRow(
          course,
          () => service.deleteCourse(course.id),
          `"${course.title}" was deleted permanently.`,
          'The event could not be deleted.'
        )
    });
  };

  /** Delete button on a class: Super Admins delete it for good, Admins mark it as deleted. */
  const deleteEvent = (course: ICourse): void => {
    if (isSuperAdmin) {
      deleteForGood(course);
      return;
    }
    confirm({
      title: 'Delete this event?',
      lines: [`"${course.title}" (${course.startDate}) will be removed from the calendar.`],
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () =>
        runOnRow(course, () => markDeleted(course), `"${course.title}" was deleted.`, 'The event could not be deleted.')
    });
  };

  const restore = (course: ICourse): void => {
    runOnRow(
      course,
      () => restoreOne(course),
      `"${course.title}" was restored and shows on the calendar again.`,
      'The event could not be restored.'
    );
  };

  /** Delete selected (events on the calendar). */
  const deleteTicked = (): void => {
    const targets: ICourse[] = liveTicked;
    const count: number = targets.length;
    if (isSuperAdmin) {
      confirm({
        title: `Delete ${count} event(s) permanently?`,
        lines: ['The selected events will be deleted from the list.', 'They go to the SharePoint recycle bin.'],
        confirmLabel: `Delete ${count} permanently`,
        danger: true,
        onConfirm: () => runBulk('delete', targets, (c) => service.deleteCourse(c.id), 'deleted permanently')
      });
      return;
    }
    confirm({
      title: `Delete ${count} event(s)?`,
      lines: ['The selected events will be removed from the calendar.'],
      confirmLabel: `Delete ${count}`,
      danger: true,
      onConfirm: () => runBulk('delete', targets, markDeleted, 'deleted')
    });
  };

  /** Delete selected (deleted events, Super Admins). */
  const deleteTickedForGood = (): void => {
    const targets: ICourse[] = deletedTicked;
    confirm({
      title: `Delete ${targets.length} event(s) permanently?`,
      lines: ['The selected deleted events will be removed from the list.', 'They go to the SharePoint recycle bin.'],
      confirmLabel: `Delete ${targets.length} permanently`,
      danger: true,
      onConfirm: () => runBulk('deleteDeleted', targets, (c) => service.deleteCourse(c.id), 'deleted permanently')
    });
  };

  const toggle = (id: string, on: boolean): void => {
    setSelected((old) => ({ ...old, [id]: on }));
  };

  const toggleAll = (rows: ICourse[], on: boolean): void => {
    setSelected((old) => {
      const next: Record<string, boolean> = { ...old };
      rows.forEach((c) => {
        next[c.id] = on;
      });
      return next;
    });
  };

  const openEdit = (c: ICourse): void => {
    setMessage(undefined);
    setForm({ mode: 'edit', course: c });
  };

  const tickBox = (c: ICourse): React.ReactElement => (
    <td className={styles.selectCell}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={!!selected[c.id]}
        disabled={working}
        aria-label={`Select ${c.title}`}
        onChange={(e) => toggle(c.id, e.target.checked)}
      />
    </td>
  );

  const cells = (c: ICourse): React.ReactElement => (
    <>
      <td>
        <div className={styles.ellipsis} title={c.title}>
          {c.title}
        </div>
        {c.isDeleted && <div className={styles.deletedInfo}>{deletedInfo(c)}</div>}
      </td>
      <td className={styles.nowrap}>{c.startDate}</td>
      <td className={styles.nowrap}>{c.endDate}</td>
      <td className={styles.nowrap}>
        {c.startTime} - {formatTimeWithZone(c.endTime, c.timeZone)}
      </td>
      <td>{c.offering}</td>
      <td className={styles.nowrap}>{c.region}</td>
    </>
  );

  const editing: ICourse | undefined = form.mode === 'edit' ? form.course : undefined;

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search events..."
          aria-label="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={[styles.button, styles.primary].join(' ')}
          onClick={() => {
            setMessage(undefined);
            setForm({ mode: 'add' });
          }}
        >
          <Icon name="plus" size={18} strokeWidth={2.6} />
          Add New Event
        </button>
      </div>

      <Message message={message} />

      {form.mode !== 'closed' && (
        <EventForm
          idPrefix={idPrefix}
          course={editing}
          offerings={offerings}
          regions={regions}
          saving={saving}
          notice={
            editing && editing.isDeleted
              ? `This event is deleted (${deletedInfo(editing).replace(/^Deleted /, '')}). Saving keeps it hidden from the calendar; use Restore to show it again.`
              : undefined
          }
          onSave={save}
          onCancel={() => setForm({ mode: 'closed' })}
        />
      )}

      {loading ? (
        <Loading text="Loading calendar items..." />
      ) : (
        <>
          {liveTicked.length > 0 && (
            <div className={styles.bulkBar} role="region" aria-label="Selected events">
              <span>{liveTicked.length} event(s) selected</span>
              <button
                type="button"
                className={[styles.button, styles.dangerSolid, styles.small].join(' ')}
                disabled={working}
                onClick={deleteTicked}
              >
                {bulk === 'delete' ? <ButtonSpinner /> : <Icon name="trash" size={16} />}
                {isSuperAdmin ? 'Delete selected permanently' : 'Delete selected'}
              </button>
              <button
                type="button"
                className={[styles.button, styles.outline, styles.small].join(' ')}
                disabled={working}
                onClick={() => toggleAll(liveTicked, false)}
              >
                Clear selection
              </button>
            </div>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.selectCell}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={allLiveTicked}
                      disabled={working || visibleLive.length === 0}
                      aria-label="Select all events"
                      onChange={(e) => toggleAll(visibleLive, e.target.checked)}
                    />
                  </th>
                  <th scope="col">Event Name</th>
                  <th scope="col">Start Date</th>
                  <th scope="col">End Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Offering</th>
                  <th scope="col">Region</th>
                  <th scope="col" className={styles.center}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLive.length === 0 && (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      {live.length ? 'No events match the search.' : 'There are no events yet.'}
                    </td>
                  </tr>
                )}
                {visibleLive.map((c) => (
                  <tr key={c.id}>
                    {tickBox(c)}
                    {cells(c)}
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Edit"
                          aria-label={`Edit ${c.title}`}
                          disabled={working}
                          onClick={() => openEdit(c)}
                        >
                          <Icon name="pencil" size={18} />
                        </button>
                        <button
                          type="button"
                          className={[styles.iconButton, styles.iconDanger].join(' ')}
                          title={isSuperAdmin ? 'Delete permanently' : 'Delete'}
                          aria-label={`Delete ${c.title}`}
                          disabled={working}
                          onClick={() => deleteEvent(c)}
                        >
                          {busyId === c.id ? <ButtonSpinner /> : <Icon name="trash" size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleDeleted.length > 0 && (
                  <tr className={styles.deletedHeading}>
                    <td className={styles.selectCell}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={allDeletedTicked}
                        disabled={working}
                        aria-label="Select all deleted events"
                        onChange={(e) => toggleAll(visibleDeleted, e.target.checked)}
                      />
                    </td>
                    <td colSpan={7}>
                      <div className={styles.deletedBar}>
                        <span>Deleted by Admins ({visibleDeleted.length}): hidden from the calendar</span>
                        <span className={styles.deletedButtons}>
                          <button
                            type="button"
                            className={[styles.button, styles.outline, styles.small].join(' ')}
                            disabled={working || deletedTicked.length === 0}
                            onClick={() => runBulk('restoreDeleted', deletedTicked, restoreOne, 'restored')}
                          >
                            {bulk === 'restoreDeleted' ? <ButtonSpinner /> : <Icon name="restore" size={16} />}
                            Restore selected ({deletedTicked.length})
                          </button>
                          <button
                            type="button"
                            className={[styles.button, styles.dangerSolid, styles.small].join(' ')}
                            disabled={working || deletedTicked.length === 0}
                            onClick={deleteTickedForGood}
                          >
                            {bulk === 'deleteDeleted' ? <ButtonSpinner /> : <Icon name="trash" size={16} />}
                            Delete selected ({deletedTicked.length})
                          </button>
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {visibleDeleted.map((c) => (
                  <tr key={c.id} className={styles.rowDeleted}>
                    {tickBox(c)}
                    {cells(c)}
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Edit (stays deleted)"
                          aria-label={`Edit ${c.title}`}
                          disabled={working}
                          onClick={() => openEdit(c)}
                        >
                          <Icon name="pencil" size={18} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Restore (show on the calendar again)"
                          aria-label={`Restore ${c.title}`}
                          disabled={working}
                          onClick={() => restore(c)}
                        >
                          {busyId === c.id ? <ButtonSpinner /> : <Icon name="restore" size={18} />}
                        </button>
                        <button
                          type="button"
                          className={[styles.iconButton, styles.iconDanger].join(' ')}
                          title="Delete permanently"
                          aria-label={`Delete ${c.title} permanently`}
                          disabled={working}
                          onClick={() => deleteForGood(c)}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.total}>
            Total: <strong>{live.length}</strong> event(s)
            {deleted.length > 0 && ` · ${deleted.length} deleted by Admins`}
            {text ? ` · ${visibleLive.length + visibleDeleted.length} shown` : ''}
          </div>
        </>
      )}
    </div>
  );
}
