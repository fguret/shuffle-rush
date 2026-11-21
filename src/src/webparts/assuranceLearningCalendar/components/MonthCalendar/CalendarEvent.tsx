import * as React from 'react';
import styles from './MonthCalendar.module.scss';
import { ICalendarSegment } from '../../utils/calendarLayout';
import { ICourse } from '../../models/ICourse';
import { programLabel } from '../../utils/courseUtils';

export interface ICalendarEventProps {
  segment: ICalendarSegment;
  onSelect: (course: ICourse) => void;
}

const TIP_FALLBACK_WIDTH: number = 440;
/** Minimum gap between the tooltip and the window edge, px. */
const EDGE: number = 8;

/** Event bar inside a week row, with a hover tooltip like the reference calendar. */
export const CalendarEvent = React.memo(function CalendarEvent({
  segment,
  onSelect
}: ICalendarEventProps): React.ReactElement {
  const { course } = segment;
  const barRef = React.useRef<HTMLButtonElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);

  const [hover, setHover] = React.useState<boolean>(false);
  /** Tooltip position relative to the bar's left edge, px. */
  const [tipLeft, setTipLeft] = React.useState<number>(0);

  /** Centres the tooltip on clientX, kept inside the window. */
  const showTipAt = (clientX: number): void => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }
    const rect: DOMRect = bar.getBoundingClientRect();
    const tipWidth: number = tipRef.current ? tipRef.current.offsetWidth : TIP_FALLBACK_WIDTH;
    const viewport: number = document.documentElement.clientWidth || window.innerWidth;
    let left: number = clientX - tipWidth / 2;
    left = Math.max(EDGE, Math.min(left, viewport - tipWidth - EDGE));
    setTipLeft(Math.round(left - rect.left));
    setHover(true);
  };

  const onMouseMove = (event: React.MouseEvent<HTMLButtonElement>): void => {
    showTipAt(event.clientX);
  };

  // Keyboard users get the tooltip centred on the bar.
  const onFocus = (): void => {
    const bar = barRef.current;
    if (bar) {
      const rect: DOMRect = bar.getBoundingClientRect();
      showTipAt(rect.left + rect.width / 2);
    }
  };

  const hideTip = (): void => {
    setHover(false);
  };

  const select = (): void => {
    setHover(false);
    onSelect(course);
  };

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
        ref={barRef}
        type="button"
        className={classes.join(' ')}
        aria-label={`${course.title}. ${programLabel(course)}. ${timing}`}
        onClick={select}
        onMouseEnter={onMouseMove}
        onMouseMove={onMouseMove}
        onMouseLeave={hideTip}
        onFocus={onFocus}
        onBlur={hideTip}
      >
        <span className={styles.eventLabel}>{course.title}</span>
      </button>
      {hover && (
        <div ref={tipRef} className={styles.tooltip} style={{ left: tipLeft }} role="tooltip">
          <div>{course.title}</div>
          <div>{programLabel(course)}</div>
          <div>{timing}</div>
        </div>
      )}
    </div>
  );
});
