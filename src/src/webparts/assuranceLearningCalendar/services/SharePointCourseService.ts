import { ICourse } from '../models/ICourse';
import { ICourseService } from './ICourseService';
import { splitTimeAndZone } from '../utils/courseUtils';

/** Performs an authenticated GET against SharePoint and returns the parsed JSON body. */
export type SPJsonFetcher = (url: string) => Promise<unknown>;

/** Default SharePoint list title. */
export const DEFAULT_LIST_NAME: string = 'AssuranceLearningCalendar';

/** Internal names of the list columns (see scripts/Provision-AssuranceLearningCalendarList.ps1). */
export const LIST_FIELDS: string[] = [
  'Id',
  'Title',
  'StartDate',
  'EndDate',
  'StartTime',
  'EndTime',
  'TimeZone',
  'CPECredits',
  'Duration',
  'TrainingType',
  'DeliveryType',
  'RegistrationLink',
  'AboutCourse',
  'Objectives',
  'RecordedLink',
  'Offering',
  'Region'
];

interface ISPUrlValue {
  Url?: string;
  Description?: string;
}

type SPItem = Record<string, unknown>;

interface ISPCollection {
  value?: SPItem[];
  d?: { results?: SPItem[]; __next?: string };
  '@odata.nextLink'?: string;
  'odata.nextLink'?: string;
}

const DAY_MS: number = 24 * 60 * 60 * 1000;

/**
 * Reads courses from the "AssuranceLearningCalendar" SharePoint list.
 * It takes a plain fetcher (supplied by the web part through SPHttpClient)
 * so this file has no SPFx dependency and stays testable.
 */
export class SharePointCourseService implements ICourseService {
  private readonly _fetchJson: SPJsonFetcher;
  private readonly _webUrl: string;
  private readonly _listName: string;

  constructor(fetchJson: SPJsonFetcher, webUrl: string, listName: string = DEFAULT_LIST_NAME) {
    this._fetchJson = fetchJson;
    this._webUrl = webUrl.replace(/\/+$/, '');
    this._listName = listName || DEFAULT_LIST_NAME;
  }

  public async getCourses(): Promise<ICourse[]> {
    const biasMinutes: number | undefined = await this._getSiteTimeZoneBias();
    const listTitle: string = encodeURIComponent(this._listName.replace(/'/g, "''"));
    let url: string | undefined =
      `${this._webUrl}/_api/web/lists/getbytitle('${listTitle}')/items` +
      `?$select=${LIST_FIELDS.join(',')}&$orderby=StartDate asc&$top=5000`;

    const items: SPItem[] = [];
    while (url) {
      const page: ISPCollection = (await this._fetchJson(url)) as ISPCollection;
      const rows: SPItem[] = page.value || (page.d && page.d.results) || [];
      items.push(...rows);
      url = page['@odata.nextLink'] || page['odata.nextLink'] || (page.d && page.d.__next) || undefined;
    }

    return items.map((item) => this._mapItem(item, biasMinutes));
  }

  /** Site regional bias in minutes (UTC = local + bias). Used to read date-only columns without day shifts. */
  private async _getSiteTimeZoneBias(): Promise<number | undefined> {
    try {
      const tz = (await this._fetchJson(
        `${this._webUrl}/_api/web/RegionalSettings/TimeZone?$select=Information`
      )) as { Information?: { Bias?: number }; d?: { Information?: { Bias?: number } } };
      const info = tz.Information || (tz.d && tz.d.Information);
      return info && typeof info.Bias === 'number' ? info.Bias : undefined;
    } catch {
      return undefined;
    }
  }

  private _mapItem(item: SPItem, biasMinutes: number | undefined): ICourse {
    const start: string = toIsoDate(item.StartDate, biasMinutes);
    const end: string = toIsoDate(item.EndDate, biasMinutes) || start;
    const startParts = splitTimeAndZone(asText(item.StartTime));
    const endParts = splitTimeAndZone(asText(item.EndTime));
    const recorded: string = asUrl(item.RecordedLink);

    return {
      id: String(item.Id),
      title: asText(item.Title),
      startDate: start,
      endDate: end,
      startTime: startParts.time,
      endTime: endParts.time,
      timeZone: asText(item.TimeZone) || startParts.zone,
      cpeCredits: asNumber(item.CPECredits),
      duration: asNumber(item.Duration),
      trainingType: asText(item.TrainingType) || 'Virtual',
      deliveryType: asText(item.DeliveryType) || 'Virtual Live',
      registrationLink: asUrl(item.RegistrationLink),
      aboutCourse: asText(item.AboutCourse),
      objectives: asText(item.Objectives),
      recordedLink: recorded.toUpperCase() === 'NA' ? '' : recorded,
      offering: asText(item.Offering),
      region: asText(item.Region)
    };
  }
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const n: number = typeof value === 'number' ? value : parseFloat(asText(value));
  return isNaN(n) ? 0 : n;
}

function asUrl(value: unknown): string {
  if (value && typeof value === 'object') {
    return asText((value as ISPUrlValue).Url);
  }
  return asText(value);
}

/**
 * SharePoint returns date-only values as UTC instants of local midnight on the site.
 * Shift by the site bias and round to the nearest day, so daylight saving never moves the date.
 */
function toIsoDate(value: unknown, biasMinutes: number | undefined): string {
  const raw: string = asText(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const ms: number = Date.parse(raw);
  if (isNaN(ms)) {
    return '';
  }
  const localMs: number = biasMinutes === undefined ? ms : ms - biasMinutes * 60000;
  const day: Date = new Date(Math.round(localMs / DAY_MS) * DAY_MS);
  const y: number = day.getUTCFullYear();
  const m: string = String(day.getUTCMonth() + 1).padStart(2, '0');
  const d: string = String(day.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
