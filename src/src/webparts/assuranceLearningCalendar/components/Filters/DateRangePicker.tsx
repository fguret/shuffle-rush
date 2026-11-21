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

interface IDateRangePickerState {
  open: boolean;
  view: 'month' | 'year';
  viewDate: Date;
  hoverIso: string;
}

const WEEKDAY_LETTERS: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LABEL_MIN_CELLS: number = 3;

interface IDayCell {
  iso: string;
  day: number;
}

/** Material-style date range picker: first click sets the start, second click the end. */
export class DateRangePicker extends React.PureComponent<IDateRangePickerProps, IDateRangePickerState> {
  private readonly _rootRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

  constructor(props: IDateRangePickerProps) {
    super(props);
    this.state = {
      open: false,
      view: 'month',
      viewDate: startOfMonth(props.start ? parseIsoDate(props.start) : props.today || new Date()),
      hoverIso: ''
    };
  }

  public componentDidUpdate(_prevProps: IDateRangePickerProps, prevState: IDateRangePickerState): void {
    if (this.state.open !== prevState.open) {
      if (this.state.open) {
        document.addEventListener('mousedown', this._onDocumentMouseDown);
        document.addEventListener('keydown', this._onDocumentKeyDown);
      } else {
        this._removeListeners();
      }
    }
  }

  public componentWillUnmount(): void {
    this._removeListeners();
  }

  public render(): React.ReactElement<IDateRangePickerProps> {
    const { id, placeholder, start, end, className } = this.props;
    const { open } = this.state;
    const text: string = start ? `${formatShortDate(start)} – ${end ? formatShortDate(end) : ''}` : '';

    return (
      <div ref={this._rootRef} className={[styles.picker, open ? styles.isOpen : '', className || ''].join(' ')}>
        <div className={styles.field} onClick={this._toggle}>
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
            onKeyDown={this._onInputKeyDown}
          />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open calendar"
            onClick={this._onIconClick}
          >
            <Icon name="calendar" size={30} strokeWidth={1.8} />
          </button>
        </div>
        {open && this._renderPopup()}
      </div>
    );
  }

  private _renderPopup(): React.ReactElement {
    const { view, viewDate } = this.state;
    const headerLabel: string =
      view === 'month' ? `${MONTH_SHORT[viewDate.getMonth()]} ${viewDate.getFullYear()}` : `${viewDate.getFullYear()}`;

    return (
      <div className={styles.popup} role="dialog" aria-label="Choose a date range">
        <div className={styles.header}>
          <button type="button" className={styles.periodButton} onClick={this._toggleView} aria-label="Choose month and year">
            {headerLabel}
            <Icon name="caretDown" size={20} className={view === 'year' ? styles.caretUp : undefined} />
          </button>
          <div className={styles.navs}>
            <button type="button" className={styles.navButton} onClick={this._prev} aria-label="Previous">
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className={styles.navButton} onClick={this._next} aria-label="Next">
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
        </div>
        {view === 'month' ? this._renderMonth() : this._renderYear()}
        {this.props.start && (
          <div className={styles.footer}>
            <button type="button" className={styles.clearButton} onClick={this._clear}>
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  private _renderMonth(): React.ReactElement {
    const { viewDate, hoverIso } = this.state;
    const { start, end } = this.props;
    const todayIso: string = toIsoDate(this.props.today || new Date());
    const offset: number = viewDate.getDay();
    const daysInMonth: number = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const previewEnd: string = start && !end && hoverIso && hoverIso >= start ? hoverIso : '';

    const cells: Array<IDayCell | null> = [];
    for (let i: number = 0; i < offset; i++) {
      cells.push(null);
    }
    for (let d: number = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), d)), day: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    const rows: Array<Array<IDayCell | null>> = [];
    for (let i: number = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    const monthLabel: string = MONTH_SHORT[viewDate.getMonth()];
    const labelInFirstRow: boolean = offset >= LABEL_MIN_CELLS;

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
                if (!cell) {
                  if (r === 0 && labelInFirstRow && c === 0) {
                    return (
                      <td key={c} colSpan={offset} className={styles.monthLabel}>
                        {monthLabel}
                      </td>
                    );
                  }
                  if (r === 0 && labelInFirstRow) {
                    return null;
                  }
                  return <td key={c} />;
                }
                const rangeEnd: string = end || previewEnd;
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
                  <td key={c} className={classes.join(' ')}>
                    <button
                      type="button"
                      className={[
                        styles.day,
                        isStart || (isEnd && !!end) ? styles.selected : '',
                        cell.iso === todayIso ? styles.today : ''
                      ].join(' ')}
                      aria-label={cell.iso}
                      aria-pressed={isStart || isEnd}
                      onClick={() => this._pick(cell.iso)}
                      onMouseEnter={() => this.setState({ hoverIso: cell.iso })}
                    >
                      {cell.day}
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

  private _renderYear(): React.ReactElement {
    const { viewDate } = this.state;
    const today: Date = this.props.today || new Date();
    const rows: number[][] = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]];
    return (
      <table className={styles.yearGrid} role="grid">
        <tbody>
          {rows.map((row, r) => (
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
                      onClick={() => this.setState({ viewDate: date, view: 'month' })}
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

  private _pick(iso: string): void {
    const { start, end, onChange } = this.props;
    if (!start || end || iso < start) {
      onChange(iso, '');
      return;
    }
    onChange(start, iso);
    this.setState({ open: false });
  }

  private _toggle = (): void => {
    if (this.state.open) {
      this._close();
      return;
    }
    const base: Date = this.props.start ? parseIsoDate(this.props.start) : this.props.today || new Date();
    this.setState({ open: true, view: 'month', viewDate: startOfMonth(base), hoverIso: '' });
  };

  private _close = (): void => {
    if (this.state.open) {
      this.setState({ open: false });
      // A half-picked range becomes a single-day range.
      if (this.props.start && !this.props.end) {
        this.props.onChange(this.props.start, this.props.start);
      }
    }
  };

  private _onIconClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
    this._toggle();
  };

  private _onInputKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.state.open) {
        this._toggle();
      }
    }
  };

  private _toggleView = (): void => {
    this.setState({ view: this.state.view === 'month' ? 'year' : 'month' });
  };

  private _prev = (): void => {
    const { view, viewDate } = this.state;
    this.setState({ viewDate: view === 'month' ? addMonths(viewDate, -1) : addMonths(viewDate, -12) });
  };

  private _next = (): void => {
    const { view, viewDate } = this.state;
    this.setState({ viewDate: view === 'month' ? addMonths(viewDate, 1) : addMonths(viewDate, 12) });
  };

  private _clear = (): void => {
    this.props.onChange('', '');
  };

  private _onDocumentMouseDown = (event: MouseEvent): void => {
    const root: HTMLDivElement | null = this._rootRef.current;
    if (root && !root.contains(event.target as Node)) {
      this._close();
    }
  };

  private _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this._close();
    }
  };

  private _removeListeners(): void {
    document.removeEventListener('mousedown', this._onDocumentMouseDown);
    document.removeEventListener('keydown', this._onDocumentKeyDown);
  }
}
