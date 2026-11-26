/**
 * A single scheduled class on the Assurance learning calendar.
 * Dates are stored as ISO calendar dates (YYYY-MM-DD) so they never shift with the browser time zone.
 */
export interface ICourse {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD */
  startDate: string;
  /** ISO date, YYYY-MM-DD */
  endDate: string;
  /** e.g. "01:00 PM" */
  startTime: string;
  /** e.g. "02:15 PM" */
  endTime: string;
  /** e.g. "ET", "IST" */
  timeZone: string;
  cpeCredits: number;
  /** Duration in hours */
  duration: number;
  /** e.g. "Virtual" */
  trainingType: string;
  /** e.g. "Virtual Live" */
  deliveryType: string;
  registrationLink: string;
  aboutCourse: string;
  objectives: string;
  recordedLink: string;
  offering: string;
  /** e.g. "US", "USI", "US, USI" */
  region: string;
  /**
   * true = deleted by an Admin: hidden from the calendar and from Admins, kept in the list until a
   * Super Admin restores it or deletes it permanently. Missing = not deleted.
   */
  isDeleted?: boolean;
  /** Who deleted it (display name); set while isDeleted. */
  deletedBy?: string;
  /** When it was deleted (ISO date and time); set while isDeleted. */
  deletedOn?: string;
}

export type CourseSortKey = 'title' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'cpeCredits' | 'duration';

export type SortDirection = 'asc' | 'desc';

export interface ISortState {
  key: CourseSortKey;
  direction: SortDirection;
}

export interface IFilterState {
  courseName: string;
  region: string;
  offering: string;
  /** ISO date or empty */
  rangeStart: string;
  /** ISO date or empty */
  rangeEnd: string;
}

export const EMPTY_FILTERS: IFilterState = {
  courseName: '',
  region: '',
  offering: '',
  rangeStart: '',
  rangeEnd: ''
};

/** Default table order: earliest class first. */
export const DEFAULT_SORT: ISortState = { key: 'startDate', direction: 'asc' };
