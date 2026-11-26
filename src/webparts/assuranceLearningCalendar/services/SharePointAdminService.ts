import { AdminUserInput, IAdminUser, ICurrentUser, IVisitRecord, sameEmail } from '../models/IAdmin';
import { DEFAULT_ADMIN_LIST_NAME, DEFAULT_VISITS_LIST_NAME, IAdminService, IVisitService } from './IAdminService';
import {
  ISPRest,
  SPItem,
  addItem,
  asBoolean,
  asNumber,
  asText,
  deleteItem,
  getAllItems,
  listUrl,
  odataString,
  updateItem
} from './SPRest';

/** Same columns as scripts/Provision-AssuranceLearningCalendarList.ps1. */
const ADMIN_FIELDS: { name: string; xml: string }[] = [
  {
    name: 'Email',
    xml: '<Field Type="Text" Name="Email" StaticName="Email" DisplayName="Email" MaxLength="255" Required="TRUE" />'
  },
  {
    name: 'IsActive',
    xml: '<Field Type="Boolean" Name="IsActive" StaticName="IsActive" DisplayName="Is Active"><Default>1</Default></Field>'
  },
  {
    name: 'SuperAdmin',
    xml: '<Field Type="Boolean" Name="SuperAdmin" StaticName="SuperAdmin" DisplayName="Super Admin"><Default>0</Default></Field>'
  }
];

/**
 * Admin access list: Title (name), Email, IsActive (Yes/No), SuperAdmin (Yes/No).
 * See scripts/Provision-AssuranceLearningCalendarList.ps1.
 */
export class SharePointAdminService implements IAdminService {
  public readonly listName: string;
  private readonly _rest: ISPRest;
  private readonly _webUrl: string;
  private readonly _list: string;

  constructor(rest: ISPRest, webUrl: string, listName: string = DEFAULT_ADMIN_LIST_NAME) {
    this._rest = rest;
    this._webUrl = webUrl.replace(/\/+$/, '');
    this.listName = listName || DEFAULT_ADMIN_LIST_NAME;
    this._list = listUrl(webUrl, this.listName);
  }

  public async createList(owner: ICurrentUser): Promise<void> {
    const exists: boolean = await this._rest.get(`${this._list}?$select=Id`).then(
      () => true,
      (e: unknown) => {
        if (/^404\b/.test(e instanceof Error ? e.message : String(e))) {
          return false;
        }
        throw e;
      }
    );
    if (!exists) {
      await this._rest.post(`${this._webUrl}/_api/web/lists`, {
        Title: this.listName,
        BaseTemplate: 100,
        Description: 'Who sees the Admin panel of the learning calendar'
      });
      // The Title column holds the person's name.
      await this._rest.post(
        `${this._list}/fields/getbyinternalnameortitle('Title')`,
        { Title: 'Name' },
        { 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' }
      );
    }

    const fields = (await this._rest.get(`${this._list}/fields?$select=InternalName`)) as { value?: SPItem[] };
    const existing: string[] = (fields.value || []).map((f) => asText(f.InternalName));
    // One column at a time. Options 8 = use the Name as the internal name, 16 = add it to the default view.
    await ADMIN_FIELDS.filter((f) => existing.indexOf(f.name) === -1).reduce(
      (chain: Promise<unknown>, f) =>
        chain.then(() =>
          this._rest.post(`${this._list}/fields/createfieldasxml`, {
            parameters: { SchemaXml: f.xml, Options: 8 | 16 }
          })
        ),
      Promise.resolve()
    );

    const admins: IAdminUser[] = await this.getAdmins();
    if (!admins.some((a) => sameEmail(a.email, owner.email))) {
      await this.addAdmin({
        title: owner.displayName || owner.email,
        email: owner.email,
        isActive: true,
        superAdmin: true
      });
    }
  }

  public async getAdmins(): Promise<IAdminUser[]> {
    const items: SPItem[] = await getAllItems(
      this._rest,
      `${this._list}/items?$select=Id,Title,Email,IsActive,SuperAdmin&$orderby=Id asc&$top=5000`
    );
    return items.map((item) => ({
      id: String(item.Id),
      title: asText(item.Title),
      email: asText(item.Email),
      isActive: asBoolean(item.IsActive),
      superAdmin: asBoolean(item.SuperAdmin)
    }));
  }

  public async addAdmin(user: AdminUserInput): Promise<IAdminUser> {
    const id: string = await addItem(this._rest, this._list, toFields(user));
    return { ...user, id };
  }

  public async updateAdmin(user: IAdminUser): Promise<void> {
    await updateItem(this._rest, this._list, user.id, toFields(user));
  }

  public async deleteAdmin(id: string): Promise<void> {
    await deleteItem(this._rest, this._list, id);
  }
}

function toFields(user: AdminUserInput): SPItem {
  return {
    Title: user.title,
    Email: user.email.trim().toLowerCase(),
    IsActive: user.isActive,
    SuperAdmin: user.superAdmin
  };
}

interface IProfileProperty {
  Key?: string;
  Value?: string;
}

/**
 * Visit tracking list, one item per user: Title (user name), Email, LastVisited,
 * Location, VisitCount, TimeSpentSeconds. Every visitor needs permission to add and edit items in it.
 */
export class SharePointVisitService implements IVisitService {
  private readonly _rest: ISPRest;
  private readonly _webUrl: string;
  private readonly _list: string;
  /** The current user's item, once found or created. */
  private _itemId: string | undefined;
  private _visits: number = 0;
  private _seconds: number = 0;
  private _location: Promise<string> | undefined;
  /** Writes run one after another, so a quick second call never creates a second item. */
  private _queue: Promise<void> = Promise.resolve();

  constructor(rest: ISPRest, webUrl: string, listName: string = DEFAULT_VISITS_LIST_NAME) {
    this._rest = rest;
    this._webUrl = webUrl.replace(/\/+$/, '');
    this._list = listUrl(webUrl, listName || DEFAULT_VISITS_LIST_NAME);
  }

  public async getVisits(): Promise<IVisitRecord[]> {
    const items: SPItem[] = await getAllItems(
      this._rest,
      `${this._list}/items?$select=Id,Title,Email,LastVisited,Location,VisitCount,TimeSpentSeconds&$orderby=Id asc&$top=5000`
    );
    return items.map((item) => ({
      id: String(item.Id),
      userName: asText(item.Title),
      email: asText(item.Email),
      lastVisited: asText(item.LastVisited),
      location: asText(item.Location),
      visits: asNumber(item.VisitCount),
      timeSpentSeconds: asNumber(item.TimeSpentSeconds)
    }));
  }

  public recordVisit(user: ICurrentUser, seconds: number, newVisit: boolean, keepalive?: boolean): Promise<void> {
    this._queue = this._queue.then(
      () => this._record(user, Math.max(0, Math.round(seconds)), newVisit, keepalive),
      () => this._record(user, Math.max(0, Math.round(seconds)), newVisit, keepalive)
    );
    return this._queue;
  }

  private async _record(user: ICurrentUser, seconds: number, newVisit: boolean, keepalive?: boolean): Promise<void> {
    if (!user.email) {
      return;
    }
    const email: string = user.email.trim().toLowerCase();
    const now: string = new Date().toISOString();

    if (this._itemId === undefined) {
      const found = (await this._rest.get(
        `${this._list}/items?$select=Id,VisitCount,TimeSpentSeconds&$filter=Email eq ${odataString(email)}&$top=1`
      )) as { value?: SPItem[] };
      const item: SPItem | undefined = found.value && found.value[0];
      if (item) {
        this._itemId = String(item.Id);
        this._visits = asNumber(item.VisitCount);
        this._seconds = asNumber(item.TimeSpentSeconds);
      }
    }

    const location: string = await this._getLocation();
    if (this._itemId === undefined) {
      this._visits = 1;
      this._seconds = seconds;
      this._itemId = await addItem(
        this._rest,
        this._list,
        {
          Title: user.displayName,
          Email: email,
          LastVisited: now,
          Location: location,
          VisitCount: this._visits,
          TimeSpentSeconds: this._seconds
        },
        keepalive
      );
      return;
    }

    this._visits += newVisit ? 1 : 0;
    this._seconds += seconds;
    await updateItem(
      this._rest,
      this._list,
      this._itemId,
      {
        Title: user.displayName,
        LastVisited: now,
        Location: location,
        VisitCount: this._visits,
        TimeSpentSeconds: this._seconds
      },
      keepalive
    );
  }

  /** Office location from the user profile, e.g. "US - Mumbai" ('' if unknown). */
  private _getLocation(): Promise<string> {
    if (!this._location) {
      this._location = this._rest
        .get(`${this._webUrl}/_api/SP.UserProfiles.PeopleManager/GetMyProperties?$select=UserProfileProperties`)
        .then(
          (body) => {
            const raw = (body as { UserProfileProperties?: IProfileProperty[] | { results?: IProfileProperty[] } })
              .UserProfileProperties;
            const props: IProfileProperty[] = (raw && ((raw as { results?: IProfileProperty[] }).results || raw)) as
              IProfileProperty[] | [];
            const read = (key: string): string => {
              const match: IProfileProperty[] = (props || []).filter((p) => p.Key === key);
              return match.length ? asText(match[0].Value) : '';
            };
            return read('Office') || read('SPS-Location');
          },
          () => ''
        );
    }
    return this._location;
  }
}
