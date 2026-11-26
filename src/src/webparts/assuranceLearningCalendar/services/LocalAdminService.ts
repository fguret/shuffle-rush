import { AdminUserInput, IAdminUser, ICurrentUser, IVisitRecord, sameEmail } from '../models/IAdmin';
import { IAdminService, IVisitService } from './IAdminService';
import { newLocalId, readStored, writeStored } from '../utils/localStore';

/** Test user of the local harness. */
export const LOCAL_TEST_USER: ICurrentUser = {
  displayName: 'Local Tester',
  email: 'alex.morgan@example.com',
  isSiteAdmin: false
};

const SAMPLE_ADMINS: IAdminUser[] = [
  { id: '1', title: 'Local Tester', email: 'local.tester@example.com', isActive: true, superAdmin: true },
  { id: '2', title: 'Alex Morgan', email: 'alex.morgan@example.com', isActive: true, superAdmin: false },
  { id: '3', title: 'Sam Lee', email: 'sam.lee@example.com', isActive: true, superAdmin: false },
  { id: '4', title: 'Jordan Patel', email: 'jordan.patel@example.com', isActive: false, superAdmin: false }
];

const SAMPLE_VISITS: IVisitRecord[] = [
  {
    id: '1',
    userName: 'Morgan, Alex',
    email: 'alex.morgan@example.com',
    lastVisited: '2026-11-18T07:05:11Z',
    location: 'US - Mumbai',
    visits: 3,
    timeSpentSeconds: 95
  },
  {
    id: '2',
    userName: 'Lee, Sam',
    email: 'sam.lee@example.com',
    lastVisited: '2026-11-03T07:49:48Z',
    location: 'US - Bengaluru',
    visits: 1,
    timeSpentSeconds: 8
  }
];

/** Resolves with the result of `work` after a short delay, like a network call. */
function later<T>(work: () => T, delayMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(work());
      } catch (e) {
        reject(e);
      }
    }, delayMs);
  });
}

/**
 * Admin access list kept in memory (local testing), or with a `storageKey` in this browser (every tab).
 * `owner` (the signed-in SharePoint user when the web part uses the Local data source) replaces
 * the Local Tester row as the Super Admin, so the Admin button shows for them.
 */
export class LocalAdminService implements IAdminService {
  public readonly listName: string = 'local admin list';
  private _admins: IAdminUser[];
  private readonly _delayMs: number;
  private readonly _storageKey: string | undefined;

  constructor(owner?: ICurrentUser, delayMs: number = 400, storageKey?: string) {
    this._delayMs = delayMs;
    this._storageKey = storageKey;
    const duplicate = (a: IAdminUser): boolean =>
      !!owner && a.email !== LOCAL_TEST_USER.email && sameEmail(a.email, owner.email);
    this._admins =
      readStored<IAdminUser[]>(storageKey) ||
      SAMPLE_ADMINS.filter((a) => !duplicate(a)).map((a) =>
        owner && owner.email && a.email === LOCAL_TEST_USER.email
          ? { ...a, title: owner.displayName || owner.email, email: owner.email }
          : { ...a }
      );
  }

  public getAdmins(): Promise<IAdminUser[]> {
    return this._run(() => this._admins.map((a) => ({ ...a })));
  }

  public addAdmin(user: AdminUserInput): Promise<IAdminUser> {
    return this._run(() => {
      const created: IAdminUser = { ...user, id: newLocalId() };
      this._admins.push(created);
      this._save();
      return { ...created };
    });
  }

  public updateAdmin(user: IAdminUser): Promise<void> {
    return this._run(() => {
      this._admins = this._admins.map((a) => (a.id === user.id ? { ...user } : a));
      this._save();
    });
  }

  public deleteAdmin(id: string): Promise<void> {
    return this._run(() => {
      this._admins = this._admins.filter((a) => a.id !== id);
      this._save();
    });
  }

  private _save(): void {
    writeStored(this._storageKey, this._admins);
  }

  /** Reads the stored copy (other tabs' changes), then runs the work after the delay. */
  private _run<T>(work: () => T): Promise<T> {
    return later(() => {
      this._admins = readStored<IAdminUser[]>(this._storageKey) || this._admins;
      return work();
    }, this._delayMs);
  }
}

/** Visit records kept in memory (local testing), or with a `storageKey` in this browser (every tab). */
export class LocalVisitService implements IVisitService {
  private readonly _storageKey: string | undefined;
  private _visits: IVisitRecord[];

  constructor(storageKey?: string) {
    this._storageKey = storageKey;
    this._visits = readStored<IVisitRecord[]>(storageKey) || SAMPLE_VISITS.map((v) => ({ ...v }));
  }

  public getVisits(): Promise<IVisitRecord[]> {
    return later(() => {
      this._visits = readStored<IVisitRecord[]>(this._storageKey) || this._visits;
      return this._visits.map((v) => ({ ...v }));
    }, 300);
  }

  public recordVisit(user: ICurrentUser, seconds: number, newVisit: boolean): Promise<void> {
    this._visits = readStored<IVisitRecord[]>(this._storageKey) || this._visits;
    const now: string = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const own: IVisitRecord[] = this._visits.filter((v) => sameEmail(v.email, user.email));
    if (own.length) {
      own[0].lastVisited = now;
      own[0].timeSpentSeconds += Math.round(seconds);
      own[0].visits += newVisit ? 1 : 0;
    } else {
      this._visits.push({
        id: String(this._visits.length + 1),
        userName: user.displayName,
        email: user.email,
        lastVisited: now,
        location: 'Local test',
        visits: 1,
        timeSpentSeconds: Math.round(seconds)
      });
    }
    writeStored(this._storageKey, this._visits);
    return Promise.resolve();
  }
}
