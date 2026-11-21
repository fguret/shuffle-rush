import * as React from 'react';
import styles from './MonthCalendar.module.scss';
import { ICalendarSegment } from '../../utils/calendarLayout';
import { ICourse } from '../../models/ICourse';
import { programLabel } from '../../utils/courseUtils';

export interface ICalendarEventProps {
  segment: ICalendarSegment;
  onSelect: (course: ICourse) => void;
}

interface ICalendarEventState {
  hover: boolean;
  tipLeft: number;
}

const TIP_FALLBACK_WIDTH: number = 440;
const EDGE: number = 8;

/** Event bar inside a week row, with a hover tooltip like the reference calendar. */
export class CalendarEvent extends React.PureComponent<ICalendarEventProps, ICalendarEventState> {
  private readonly _barRef: React.RefObject<HTMLButtonElement> = React.createRef<HTMLButtonElement>();
  private readonly _tipRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

  constructor(props: ICalendarEventProps) {
    super(props);
    this.state = { hover: false, tipLeft: 0 };
  }

  public render(): React.ReactElement<ICalendarEventProps> {
    const { segment } = this.props;
    const { course } = segment;
    const { hover, tipLeft } = this.state;
    const style: React.CSSProperties = {
      gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
      gridRow: `${segment.lane + 2}`
    };
    const classes: string[] = [styles.event];
    if (segment.continuesBefore) {
      classes.push(styles.eventContinuesBefore);
    }
    if (segment.continuesAfter) {
      classes.push(styles.eventContinuesAfter);
    }
    const timing: string = `Timing: ${course.startTime} to ${course.endTime}`;

    return (
      <div className={styles.eventSlot} style={style}>
        <button
          ref={this._barRef}
          type="button"
          className={classes.join(' ')}
          aria-label={`${course.title}. ${programLabel(course)}. ${timing}`}
          onClick={this._select}
          onMouseEnter={this._onMouseMove}
          onMouseMove={this._onMouseMove}
          onMouseLeave={this._onMouseLeave}
          onFocus={this._onFocus}
          onBlur={this._onMouseLeave}
        >
          <span className={styles.eventLabel}>{course.title}</span>
        </button>
        {hover && (
          <div ref={this._tipRef} className={styles.tooltip} style={{ left: tipLeft }} role="tooltip">
            <div>{course.title}</div>
            <div>{programLabel(course)}</div>
            <div>{timing}</div>
          </div>
        )}
      </div>
    );
  }

  private _select = (): void => {
    this.setState({ hover: false });
    this.props.onSelect(this.props.segment.course);
  };

  private _positionTip(clientX: number): void {
    const bar: HTMLButtonElement | null = this._barRef.current;
    if (!bar) {
      return;
    }
    const rect: DOMRect = bar.getBoundingClientRect();
    const tipWidth: number = this._tipRef.current ? this._tipRef.current.offsetWidth : TIP_FALLBACK_WIDTH;
    const viewport: number = document.documentElement.clientWidth || window.innerWidth;
    let left: number = clientX - tipWidth / 2;
    left = Math.max(EDGE, Math.min(left, viewport - tipWidth - EDGE));
    this.setState({ hover: true, tipLeft: Math.round(left - rect.left) });
  }

  private _onMouseMove = (event: React.MouseEvent<HTMLButtonElement>): void => {
    this._positionTip(event.clientX);
  };

  private _onFocus = (): void => {
    const bar: HTMLButtonElement | null = this._barRef.current;
    if (bar) {
      const rect: DOMRect = bar.getBoundingClientRect();
      this._positionTip(rect.left + rect.width / 2);
    }
  };

  private _onMouseLeave = (): void => {
    this.setState({ hover: false });
  };
}
