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
  /** Override "today" (testing). */
  today?: Date;
}
