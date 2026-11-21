import { ICourseService } from '../services/ICourseService';

export interface IAssuranceLearningCalendarProps {
  /** Where the classes come from (local sample data or the SharePoint list). */
  dataService: ICourseService;
  /** Changing this key forces a reload (e.g. data source / list name changed). */
  dataKey: string;
  title: string;
  questionsLinkText: string;
  questionsLinkUrl: string;
  contactEmail: string;
  heroImageUrl?: string;
  /** Height of the scrolling course table, px. */
  tableHeight: number;
  /**
   * Keep the same look on every screen resolution (default true): the page is laid out at a fixed width
   * and scaled to the screen width. Browser zoom still makes it smaller or bigger.
   */
  fitToWidth?: boolean;
  /** Side bar on each side at 100% zoom, % of the screen width (0–20, default 6; 0 = full width at any zoom). */
  sideGutter?: number;
  /** Colour of the side bars, any CSS colour. Empty = transparent (the page background shows). */
  gutterColor?: string;
  /** Override "today" (testing). */
  today?: Date;
}
