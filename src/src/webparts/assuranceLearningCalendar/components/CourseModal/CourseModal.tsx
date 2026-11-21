import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styles from './CourseModal.module.scss';
import { ICourse } from '../../models/ICourse';
import { formatLongDate } from '../../utils/dateUtils';
import { splitBullets, zoneLongName } from '../../utils/courseUtils';
import { Icon } from '../Icons/Icon';
import { PillButton } from '../Filters/PillButton';

export interface ICourseModalProps {
  course: ICourse | undefined;
  contactEmail: string;
  onClose: () => void;
}

/** Session details dialog opened from a calendar event. */
export class CourseModal extends React.PureComponent<ICourseModalProps> {
  private readonly _closeRef: React.RefObject<HTMLButtonElement> = React.createRef<HTMLButtonElement>();
  private _previousOverflow: string = '';
  private _previousFocus: Element | null = null;
  private _isOpen: boolean = false;

  public componentDidMount(): void {
    this._sync();
  }

  public componentDidUpdate(): void {
    this._sync();
  }

  public componentWillUnmount(): void {
    if (this._isOpen) {
      this._teardown();
    }
  }

  public render(): React.ReactElement<ICourseModalProps> | null {
    const { course, contactEmail } = this.props;
    if (!course || typeof document === 'undefined') {
      return null;
    }
    const titleId: string = `alc-modal-title-${course.id}`;
    const zone: string = zoneLongName(course.timeZone);
    const objectives: string[] = splitBullets(course.objectives);

    const dialog: React.ReactElement = (
      <div className={styles.backdrop} onMouseDown={this._onBackdropMouseDown}>
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {course.title}
            </h2>
            <button
              ref={this._closeRef}
              type="button"
              className={styles.close}
              onClick={this.props.onClose}
              aria-label="Close"
            >
              <Icon name="close" size={26} strokeWidth={1.8} />
            </button>
            <svg className={styles.wave} viewBox="0 0 1300 70" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.waveBand} d="M0,8 C180,50 360,64 620,58 C880,52 1080,30 1300,22 L1300,70 L0,70 Z" />
              <path className={styles.waveFill} d="M0,40 C220,66 520,60 760,46 C980,34 1140,26 1300,30 L1300,70 L0,70 Z" />
            </svg>
          </div>

          <div className={styles.body}>
            <div className={styles.session}>
              <h3 className={styles.sectionTitle}>Session Details:</h3>
              <dl className={styles.facts}>
                <dt>Start Date:</dt>
                <dd>{formatLongDate(course.startDate)}</dd>
                <dt>End Date:</dt>
                <dd>{formatLongDate(course.endDate)}</dd>
                <dt>Time:</dt>
                <dd>
                  {course.startTime}–{course.endTime}
                  {zone ? ` (${zone})` : ''}
                </dd>
                <dt>Duration:</dt>
                <dd>
                  {course.duration} {course.duration === 1 ? 'hour' : 'hours'}
                </dd>
                <dt>CPE Credits:</dt>
                <dd>{course.cpeCredits}</dd>
                <dt>Delivery Type:</dt>
                <dd>{course.deliveryType}</dd>
                <dt>Region:</dt>
                <dd>{course.region}</dd>
              </dl>
            </div>

            <div className={styles.about}>
              <h3 className={styles.sectionTitle}>About the Course:</h3>
              <div className={styles.aboutScroll} tabIndex={0}>
                <p>{course.aboutCourse || 'Details will be published soon.'}</p>
                {objectives.length > 0 && (
                  <>
                    <h4 className={styles.subTitle}>Objectives:</h4>
                    <ul>
                      {objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <p className={styles.contact}>
              Trouble in registering? Contact:{' '}
              <a href={`mailto:${contactEmail}`} className={styles.contactLink}>
                {contactEmail}
              </a>
            </p>
            {course.registrationLink && (
              <PillButton label="More Information" icon="arrowUp" href={course.registrationLink} />
            )}
          </div>
        </div>
      </div>
    );

    return ReactDOM.createPortal(dialog, document.body);
  }

  private _sync(): void {
    const shouldBeOpen: boolean = !!this.props.course;
    if (shouldBeOpen && !this._isOpen) {
      this._isOpen = true;
      this._previousFocus = document.activeElement;
      this._previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this._onKeyDown);
      if (this._closeRef.current) {
        this._closeRef.current.focus();
      }
    } else if (!shouldBeOpen && this._isOpen) {
      this._teardown();
    }
  }

  private _teardown(): void {
    this._isOpen = false;
    document.body.style.overflow = this._previousOverflow;
    document.removeEventListener('keydown', this._onKeyDown);
    const previous: Element | null = this._previousFocus;
    if (previous && (previous as HTMLElement).focus) {
      (previous as HTMLElement).focus();
    }
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.props.onClose();
    }
  };

  private _onBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      this.props.onClose();
    }
  };
}
