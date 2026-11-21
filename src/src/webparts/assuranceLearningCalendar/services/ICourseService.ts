import { ICourse } from '../models/ICourse';

export interface ICourseService {
  getCourses(): Promise<ICourse[]>;
}
