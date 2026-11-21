import * as React from 'react';
import styles from './CourseTable.module.scss';
import { ICourse } from '../../models/ICourse';
import { formatLongDate } from '../../utils/dateUtils';
import { formatTimeWithZone, splitBullets } from '../../utils/courseUtils';
import { PillButton } from '../Filters/PillButton';
import { Icon } from '../Icons/Icon';

export interface ICourseRowProps {
  course: ICourse;
  expanded: boolean;
  columnCount: number;
  onToggle: (id: string) => void;
}

export class CourseRow extends React.PureComponent<ICourseRowProps> {
  public render(): React.ReactElement<ICourseRowProps> {
    const { course, expanded, columnCount } = this.props;
    const detailId: string = `alc-course-detail-${course.id}`;

    return (
      <>
        <tr
          className={[styles.row, expanded ? styles.rowExpanded : ''].join(' ')}
          onClick={this._toggle}
          onKeyDown={this._onKeyDown}
          tabIndex={0}
          aria-expanded={expanded}
          aria-controls={detailId}
        >
          <td className={styles.titleCell} data-label="Course Title">
            {course.title}
          </td>
          <td data-label="Start Date">{formatLongDate(course.startDate)}</td>
          <td data-label="End Date">{formatLongDate(course.endDate)}</td>
          <td data-label="Start Timings">{formatTimeWithZone(course.startTime, course.timeZone)}</td>
          <td data-label="End Timings">{formatTimeWithZone(course.endTime, course.timeZone)}</td>
          <td data-label="CPE Credits">{course.cpeCredits}</td>
          <td data-label="Duration">{course.duration}</td>
          <td data-label="Training Type">{course.trainingType}</td>
        </tr>
        {expanded && (
          <tr id={detailId} className={styles.detailRow}>
            <td colSpan={columnCount} className={styles.detailCell}>
              {this._renderDetails()}
            </td>
          </tr>
        )}
      </>
    );
  }

  private _renderDetails(): React.ReactElement {
    const { course } = this.props;
    const objectives: string[] = splitBullets(course.objectives);

    return (
      <div className={styles.details}>
        <div className={styles.detailBlock}>
          <h3 className={styles.detailHeading}>About Course:</h3>
          <p className={styles.detailText}>{course.aboutCourse || 'Details will be published soon.'}</p>
        </div>
        <div className={styles.detailBlock}>
          <h3 className={styles.detailHeading}>Objectives:</h3>
          {objectives.length > 0 ? (
            <ul className={styles.bullets}>
              {objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.detailText}>—</p>
          )}
        </div>
        <div className={styles.detailActions}>
          {course.recordedLink && (
            <a className={styles.recordedLink} href={course.recordedLink} target="_blank" rel="noopener noreferrer">
              View recorded session
              <Icon name="external" size={16} />
            </a>
          )}
          {course.registrationLink && (
            <PillButton label="More Information" icon="arrowUp" href={course.registrationLink} className={styles.moreInfo} />
          )}
        </div>
      </div>
    );
  }

  private _toggle = (): void => {
    this.props.onToggle(this.props.course.id);
  };

  private _onKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._toggle();
    }
  };
}
