import { AdminUserInput, IAdminUser, ICurrentUser, IVisitRecord } from '../models/IAdmin';

/** The admin access list (who sees the Admin panel). */
export interface IAdminService {
  /** Name of the list, shown in messages. */
  readonly listName: string;
  getAdmins(): Promise<IAdminUser[]>;
  addAdmin(user: AdminUserInput): Promise<IAdminUser>;
  updateAdmin(user: IAdminUser): Promise<void>;
  deleteAdmin(id: string): Promise<void>;
  /**
   * Creates the list and any missing columns (SharePoint only; needs Manage Lists permission),
   * then adds `owner` as the first active Super Admin.
   */
  createList?(owner: ICurrentUser): Promise<void>;
}

/** The error says the list or one of its columns is missing (so it can be created). */
export function isMissingListError(e: unknown): boolean {
  const text: string = e instanceof Error ? e.message : String(e);
  return /^404\b/.test(text) || /does not exist/i.test(text);
}

/** Calendar visit tracking (one record per user). */
export interface IVisitService {
  getVisits(): Promise<IVisitRecord[]>;
  /**
   * Adds `seconds` of viewing time to the user's record and sets Last Visited to now.
   * `newVisit` also counts one more visit (the first call of a page view).
   * `keepalive` lets the request finish while the page is closing.
   */
  recordVisit(user: ICurrentUser, seconds: number, newVisit: boolean, keepalive?: boolean): Promise<void>;
}

export const DEFAULT_ADMIN_LIST_NAME: string = 'AssuranceLearningCalendarAdmins';
export const DEFAULT_VISITS_LIST_NAME: string = 'AssuranceLearningCalendarVisits';
