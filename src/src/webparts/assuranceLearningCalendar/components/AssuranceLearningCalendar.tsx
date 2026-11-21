import * as React from 'react';
import styles from './AssuranceLearningCalendar.module.scss';
import { IAssuranceLearningCalendarProps } from './IAssuranceLearningCalendarProps';
import { CourseSortKey, EMPTY_FILTERS, ICourse, IFilterState, ISortState } from '../models/ICourse';
import { HeroBanner } from './HeroBanner/HeroBanner';
import { Filters } from './Filters/Filters';
import { CourseTable } from './CourseTable/CourseTable';
import { MonthCalendar } from './MonthCalendar/MonthCalendar';
import { CourseModal } from './CourseModal/CourseModal';
import { distinctSorted, distinctTitles, filterCourses, sortCourses } from '../utils/courseUtils';
import { addMonths, parseIsoDate, startOfMonth, toIsoDate } from '../utils/dateUtils';
import { exportCoursesToExcel } from '../utils/excelExport';

export interface IAssuranceLearningCalendarState {
  loading: boolean;
  error: string;
  courses: ICourse[];
  courseNames: string[];
  regions: string[];
  offerings: string[];
  draft: IFilterState;
  applied: IFilterState;
  filtered: ICourse[];
  sorted: ICourse[];
  sort: ISortState;
  expandedId: string;
  selectedCourse: ICourse | undefined;
  calendarMonth: Date;
}

const DEFAULT_SORT: ISortState = { key: 'startDate', direction: 'asc' };

let idCounter: number = 0;

export default class AssuranceLearningCalendar extends React.PureComponent<
  IAssuranceLearningCalendarProps,
  IAssuranceLearningCalendarState
> {
  private readonly _idPrefix: string = `alc${++idCounter}`;
  private readonly _todayDate: Date;
  private _loadToken: number = 0;
  private _unmounted: boolean = false;

  constructor(props: IAssuranceLearningCalendarProps) {
    super(props);
    this._todayDate = props.today || new Date();
    this.state = {
      loading: true,
      error: '',
      courses: [],
      courseNames: [],
      regions: [],
      offerings: [],
      draft: EMPTY_FILTERS,
      applied: EMPTY_FILTERS,
      filtered: [],
      sorted: [],
      sort: DEFAULT_SORT,
      expandedId: '',
      selectedCourse: undefined,
      calendarMonth: startOfMonth(this._today())
    };
  }

  public componentDidMount(): void {
    void this._load();
  }

  public componentDidUpdate(prevProps: IAssuranceLearningCalendarProps): void {
    if (prevProps.dataKey !== this.props.dataKey || prevProps.dataService !== this.props.dataService) {
      void this._load();
    }
  }

  public componentWillUnmount(): void {
    this._unmounted = true;
  }

  public render(): React.ReactElement<IAssuranceLearningCalendarProps> {
    const { title, questionsLinkText, questionsLinkUrl, contactEmail, heroImageUrl, tableHeight } = this.props;
    const s: IAssuranceLearningCalendarState = this.state;

    return (
      <div className={styles.root}>
        <div className={styles.page}>
          <HeroBanner
            title={title}
            questionsLinkText={questionsLinkText}
            questionsLinkUrl={questionsLinkUrl}
            imageUrl={heroImageUrl}
          />

          <Filters
            idPrefix={this._idPrefix}
            courseNames={s.courseNames}
            regions={s.regions}
            offerings={s.offerings}
            filters={s.draft}
            today={this.props.today}
            exportDisabled={s.loading || s.sorted.length === 0}
            onCourseNameChange={this._onCourseNameChange}
            onRegionChange={this._onRegionChange}
            onOfferingChange={this._onOfferingChange}
            onDateRangeChange={this._onDateRangeChange}
            onApply={this._onApply}
            onReset={this._onReset}
            onExport={this._onExport}
          />

          <CourseTable
            courses={s.sorted}
            sort={s.sort}
            expandedId={s.expandedId}
            loading={s.loading}
            error={s.error}
            maxHeight={tableHeight}
            onSort={this._onSort}
            onToggle={this._onToggleRow}
          />

          <MonthCalendar
            month={s.calendarMonth}
            courses={s.filtered}
            today={this._today()}
            onPrev={this._onPrevMonth}
            onNext={this._onNextMonth}
            onCurrent={this._onCurrentMonth}
            onSelectCourse={this._onSelectCourse}
          />
        </div>

        <CourseModal course={s.selectedCourse} contactEmail={contactEmail} onClose={this._onCloseModal} />
      </div>
    );
  }

  /* ---------- data ---------- */

  private async _load(): Promise<void> {
    const token: number = ++this._loadToken;
    this.setState({ loading: true, error: '' });
    try {
      const courses: ICourse[] = await this.props.dataService.getCourses();
      if (this._unmounted || token !== this._loadToken) {
        return;
      }
      const ordered: ICourse[] = sortCourses(courses, DEFAULT_SORT);
      const filtered: ICourse[] = filterCourses(ordered, this.state.applied);
      this.setState({
        loading: false,
        courses: ordered,
        courseNames: distinctTitles(ordered),
        regions: distinctSorted(ordered, 'region'),
        offerings: distinctSorted(ordered, 'offering'),
        filtered,
        sorted: sortCourses(filtered, this.state.sort)
      });
    } catch (e) {
      if (this._unmounted || token !== this._loadToken) {
        return;
      }
      const message: string = e instanceof Error ? e.message : String(e);
      this.setState({
        loading: false,
        error: `The learning calendar could not be loaded. ${message}`,
        courses: [],
        filtered: [],
        sorted: []
      });
    }
  }

  private _today(): Date {
    return this._todayDate;
  }

  private _applyFilters(applied: IFilterState, jumpCalendar: boolean): void {
    const filtered: ICourse[] = filterCourses(this.state.courses, applied);
    const next: Partial<IAssuranceLearningCalendarState> = {
      applied,
      filtered,
      sorted: sortCourses(filtered, this.state.sort),
      expandedId: ''
    };
    if (jumpCalendar) {
      if (applied.rangeStart) {
        next.calendarMonth = startOfMonth(parseIsoDate(applied.rangeStart));
      } else if (filtered.length && (applied.courseName || applied.region || applied.offering)) {
        // Show the month of the next matching class (or the last one if all are past).
        const todayIso: string = this._isoToday();
        const upcoming: ICourse | undefined = filtered.filter((c) => c.endDate >= todayIso)[0];
        const target: ICourse = upcoming || filtered[filtered.length - 1];
        next.calendarMonth = startOfMonth(parseIsoDate(target.startDate));
      } else {
        next.calendarMonth = startOfMonth(this._today());
      }
    }
    this.setState(next as IAssuranceLearningCalendarState);
  }

  private _isoToday(): string {
    const t: Date = this._today();
    return toIsoDate(t);
  }

  /* ---------- filter handlers ---------- */

  private _onCourseNameChange = (courseName: string): void => {
    this.setState({ draft: { ...this.state.draft, courseName } });
  };

  private _onRegionChange = (region: string): void => {
    this.setState({ draft: { ...this.state.draft, region } });
  };

  private _onOfferingChange = (offering: string): void => {
    this.setState({ draft: { ...this.state.draft, offering } });
  };

  private _onDateRangeChange = (rangeStart: string, rangeEnd: string): void => {
    this.setState({ draft: { ...this.state.draft, rangeStart, rangeEnd } });
  };

  private _onApply = (): void => {
    this._applyFilters({ ...this.state.draft }, true);
  };

  private _onReset = (): void => {
    this.setState({ draft: EMPTY_FILTERS, sort: DEFAULT_SORT }, () => this._applyFilters(EMPTY_FILTERS, true));
  };

  private _onExport = (): void => {
    exportCoursesToExcel(this.state.sorted);
  };

  /* ---------- table ---------- */

  private _onSort = (key: CourseSortKey): void => {
    const current: ISortState = this.state.sort;
    const sort: ISortState =
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' };
    this.setState({ sort, sorted: sortCourses(this.state.filtered, sort) });
  };

  private _onToggleRow = (id: string): void => {
    this.setState({ expandedId: this.state.expandedId === id ? '' : id });
  };

  /* ---------- calendar ---------- */

  private _onPrevMonth = (): void => {
    this.setState({ calendarMonth: addMonths(this.state.calendarMonth, -1) });
  };

  private _onNextMonth = (): void => {
    this.setState({ calendarMonth: addMonths(this.state.calendarMonth, 1) });
  };

  private _onCurrentMonth = (): void => {
    this.setState({ calendarMonth: startOfMonth(this._today()) });
  };

  private _onSelectCourse = (course: ICourse): void => {
    this.setState({ selectedCourse: course });
  };

  private _onCloseModal = (): void => {
    this.setState({ selectedCourse: undefined });
  };
}
