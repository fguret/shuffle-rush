import * as React from 'react';
import styles from './DateRangePicker.module.scss';
import { Icon } from '../Icons/Icon';
import {
  MONTH_SHORT,
  addMonths,
  formatShortDate,
  isSameMonth,
  parseIsoDate,
  startOfMonth,
  toIsoDate
} from '../../utils/dateUtils';

export interface IDateRangePickerProps {
  id: string;
  placeholder: string;
  /** ISO date or '' */
  start: string;
  /** ISO date or '' */
  end: string;
  /** Today's date; injectable for testing. */
  today?: Date;
  className?: string;
  onChange: (start: string, end: string) => void;
}

type PickerView = 'month' | 'year';

const WEEKDAY_LETTERS: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** The month label sits in the first row when the month starts at least this many days in. */
const LABEL_MIN_CELLS: number = 3;
const MONTH_ROWS: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11]
];

interface IDayCell {
  iso: string;
  day: number;
}

/** Material-style date range picker: the first click sets the start, the second click the end. */
export const DateRangePicker = React.memo(function DateRangePicker({
  id,
  placeholder,
  start,
  end,
  today,
  className,
  onChange
}: IDateRangePickerProps): React.ReactElement {
  const rootRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState<boolean>(false);
  /** Day grid ('month') or month grid ('year'). */
  const [view, setView] = React.useState<PickerView>('month');
  /** First day of the month (or year) the popup is showing. */
  const [viewDate, setViewDate] = React.useState<Date>(() =>
    startOfMonth(start ? parseIsoDate(start) : today || new Date())
  );
  /** Day under the mouse, used to preview the range before the end is picked. */
  const [hoverIso, setHoverIso] = React.useState<string>('');

  /** Closes the popup. A half-picked range becomes a single-day range. */
  const close = React.useCallback((): void => {
    setOpen(false);
    if (start && !end) {
      onChange(start, start);
    }
  }, [start, end, onChange]);

  // While the popup is open, a click outside it or the Escape key closes it.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentMouseDown = (event: MouseEvent): void => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        close();
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open, close]);

  const toggle = (): void => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setView('month');
    setViewDate(startOfMonth(start ? parseIsoDate(start) : today || new Date()));
    setHoverIso('');
  };

  const pick = (iso: string): void => {
    if (!start || end || iso < start) {
      onChange(iso, '');
      return;
    }
    onChange(start, iso);
    setOpen(false);
  };

  const step = (direction: 1 | -1): void => {
    setViewDate(addMonths(viewDate, view === 'month' ? direction : direction * 12));
  };

  const onIconClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
    toggle();
  };

  const onInputKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        toggle();
      }
    }
  };

  const text: string = start ? `${formatShortDate(start)} – ${end ? formatShortDate(end) : ''}` : '';
  const headerLabel: string =
    view === 'month' ? `${MONTH_SHORT[viewDate.getMonth()]} ${viewDate.getFullYear()}` : `${viewDate.getFullYear()}`;

  return (
    <div ref={rootRef} className={[styles.picker, open ? styles.isOpen : '', className || ''].join(' ')}>
      <div className={styles.field} onClick={toggle}>
        <input
          id={id}
          className={styles.input}
          type="text"
          readOnly
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          onKeyDown={onInputKeyDown}
        />
        <button type="button" className={styles.iconButton} aria-label="Open calendar" onClick={onIconClick}>
          <Icon name="calendar" size={30} strokeWidth={1.8} />
        </button>
      </div>

      {open && (
        <div className={styles.popup} role="dialog" aria-label="Choose a date range">
          <div className={styles.header}>
            <button
              type="button"
              className={styles.periodButton}
              onClick={() => setView(view === 'month' ? 'year' : 'month')}
              aria-label="Choose month and year"
            >
              {headerLabel}
              <Icon name="caretDown" size={20} className={view === 'year' ? styles.caretUp : undefined} />
            </button>
            <div className={styles.navs}>
              <button type="button" className={styles.navButton} onClick={() => step(-1)} aria-label="Previous">
                <Icon name="chevronLeft" size={20} />
              </button>
              <button type="button" className={styles.navButton} onClick={() => step(1)} aria-label="Next">
                <Icon name="chevronRight" size={20} />
              </button>
            </div>
          </div>

          {view === 'month' ? (
            <MonthGrid
              viewDate={viewDate}
              start={start}
              end={end}
              hoverIso={hoverIso}
              todayIso={toIsoDate(today || new Date())}
              onPick={pick}
              onHover={setHoverIso}
            />
          ) : (
            <YearGrid
              viewDate={viewDate}
              today={today || new Date()}
              onPickMonth={(month: Date) => {
                setViewDate(month);
                setView('month');
              }}
            />
          )}

          {start && (
            <div className={styles.footer}>
              <button type="button" className={styles.clearButton} onClick={() => onChange('', '')}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface IMonthGridProps {
  viewDate: Date;
  start: string;
  end: string;
  hoverIso: string;
  todayIso: string;
  onPick: (iso: string) => void;
  onHover: (iso: string) => void;
}

/** The days of one month, with the selected range (or the hover preview) highlighted. */
function MonthGrid({ viewDate, start, end, hoverIso, todayIso, onPick, onHover }: IMonthGridProps): React.ReactElement {
  const offset: number = viewDate.getDay();
  const daysInMonth: number = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const previewEnd: string = start && !end && hoverIso && hoverIso >= start ? hoverIso : '';
  const rangeEnd: string = end || previewEnd;

  // Blank cells before day 1 and after the last day fill out whole weeks.
  const cells: Array<IDayCell | undefined> = [];
  for (let i: number = 0; i < offset; i++) {
    cells.push(undefined);
  }
  for (let d: number = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), d)), day: d });
  }
  while (cells.length % 7 !== 0) {
    cells.push(undefined);
  }
  const rows: Array<Array<IDayCell | undefined>> = [];
  for (let i: number = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  const monthLabel: string = MONTH_SHORT[viewDate.getMonth()];
  const labelInFirstRow: boolean = offset >= LABEL_MIN_CELLS;

  const renderDay = (cell: IDayCell, key: number): React.ReactElement => {
    const isStart: boolean = cell.iso === start;
    const isEnd: boolean = !!rangeEnd && cell.iso === rangeEnd;
    const inRange: boolean = !!start && !!rangeEnd && cell.iso > start && cell.iso < rangeEnd;
    const classes: string[] = [styles.dayCell];
    if (inRange) {
      classes.push(end ? styles.inRange : styles.inPreview);
    }
    if (isStart && rangeEnd && rangeEnd !== start) {
      classes.push(end ? styles.rangeStart : styles.previewStart);
    }
    if (isEnd && rangeEnd !== start) {
      classes.push(end ? styles.rangeEnd : styles.previewEnd);
    }
    return (
      <td key={key} className={classes.join(' ')}>
        <button
          type="button"
          className={[
            styles.day,
            isStart || (isEnd && !!end) ? styles.selected : '',
            cell.iso === todayIso ? styles.today : ''
          ].join(' ')}
          aria-label={cell.iso}
          aria-pressed={isStart || isEnd}
          onClick={() => onPick(cell.iso)}
          onMouseEnter={() => onHover(cell.iso)}
        >
          {cell.day}
        </button>
      </td>
    );
  };

  return (
    <table className={styles.grid} role="grid">
      <thead>
        <tr>
          {WEEKDAY_LETTERS.map((w, i) => (
            <th key={i} scope="col" className={styles.weekday}>
              {w}
            </th>
          ))}
        </tr>
        <tr>
          <th colSpan={7} className={styles.divider} aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {!labelInFirstRow && (
          <tr>
            <td colSpan={7} className={styles.monthLabel}>
              {monthLabel}
            </td>
          </tr>
        )}
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              if (cell) {
                return renderDay(cell, c);
              }
              // In the first row the leading blanks merge into one cell holding the month label.
              if (r === 0 && labelInFirstRow) {
                return c === 0 ? (
                  <td key={c} colSpan={offset} className={styles.monthLabel}>
                    {monthLabel}
                  </td>
                ) : null;
              }
              return <td key={c} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface IYearGridProps {
  viewDate: Date;
  today: Date;
  onPickMonth: (month: Date) => void;
}

/** The twelve months of the shown year. */
function YearGrid({ viewDate, today, onPickMonth }: IYearGridProps): React.ReactElement {
  return (
    <table className={styles.yearGrid} role="grid">
      <tbody>
        {MONTH_ROWS.map((row, r) => (
          <tr key={r}>
            {row.map((m) => {
              const date: Date = new Date(viewDate.getFullYear(), m, 1);
              return (
                <td key={m}>
                  <button
                    type="button"
                    className={[
                      styles.monthButton,
                      isSameMonth(date, viewDate) ? styles.selected : '',
                      isSameMonth(date, today) ? styles.today : ''
                    ].join(' ')}
                    onClick={() => onPickMonth(date)}
                  >
                    {MONTH_SHORT[m]}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
