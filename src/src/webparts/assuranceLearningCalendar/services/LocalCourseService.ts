import { ICourse } from '../models/ICourse';
import { ICourseService } from './ICourseService';
import { LOCAL_COURSES } from '../data/localCourses';

/**
 * Serves the bundled sample data (transcribed from the Excel export) so the
 * web part can be tested without a SharePoint list.
 */
export class LocalCourseService implements ICourseService {
  private readonly _delayMs: number;

  constructor(delayMs: number = 150) {
    this._delayMs = delayMs;
  }

  public getCourses(): Promise<ICourse[]> {
    return new Promise<ICourse[]>((resolve) => {
      setTimeout(() => resolve(LOCAL_COURSES.map((c) => ({ ...c }))), this._delayMs);
    });
  }
}
