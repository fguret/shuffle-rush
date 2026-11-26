import { ICourse } from '../models/ICourse';
import { CourseInput, ICourseService } from './ICourseService';
import { LOCAL_COURSES } from '../data/localCourses';
import { newLocalId, readStored, writeStored } from '../utils/localStore';

/**
 * Serves the bundled sample data (transcribed from the Excel export) so the
 * web part can be tested without a SharePoint list.
 * Changes made in the admin panel are kept in memory until the page is reloaded, or, with a
 * `storageKey`, in this browser (shared by every tab) until the stored copy is cleared.
 */
export class LocalCourseService implements ICourseService {
  private readonly _delayMs: number;
  private readonly _storageKey: string | undefined;
  private _courses: ICourse[];

  constructor(delayMs: number = 150, storageKey?: string) {
    this._delayMs = delayMs;
    this._storageKey = storageKey;
    this._courses = readStored<ICourse[]>(storageKey) || LOCAL_COURSES.map((c) => ({ ...c }));
  }

  public getCourses(): Promise<ICourse[]> {
    return this._later(() => this._courses.map((c) => ({ ...c })));
  }

  public addCourse(course: CourseInput): Promise<ICourse> {
    return this._later(() => {
      const created: ICourse = { ...course, id: newLocalId() };
      this._courses.push(created);
      this._save();
      return { ...created };
    });
  }

  public updateCourse(course: ICourse): Promise<void> {
    return this._later(() => {
      this._courses[this._indexOf(course.id)] = { ...course };
      this._save();
    });
  }

  public deleteCourse(id: string): Promise<void> {
    return this._later(() => {
      this._courses.splice(this._indexOf(id), 1);
      this._save();
    });
  }

  private _indexOf(id: string): number {
    for (let i: number = 0; i < this._courses.length; i++) {
      if (this._courses[i].id === id) {
        return i;
      }
    }
    throw new Error('The item no longer exists.');
  }

  private _save(): void {
    writeStored(this._storageKey, this._courses);
  }

  /** Runs the work after a short delay, like a network call; reads the stored copy first (other tabs' changes). */
  private _later<T>(work: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        try {
          this._courses = readStored<ICourse[]>(this._storageKey) || this._courses;
          resolve(work());
        } catch (e) {
          reject(e);
        }
      }, this._delayMs);
    });
  }
}
