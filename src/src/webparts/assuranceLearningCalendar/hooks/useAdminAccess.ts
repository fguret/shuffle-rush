import * as React from 'react';
import { IAdminAccess, ICurrentUser, NO_ACCESS, accessFor } from '../models/IAdmin';
import { IAdminService } from '../services/IAdminService';

/** Access worked out for one user with one admin list. */
interface IAccessState {
  userKey: string;
  service: IAdminService | undefined;
  access: IAdminAccess;
}

const LOADING: IAdminAccess = { ...NO_ACCESS, loading: true };

/** Identifies the signed-in user (and whether they are a site collection admin). */
function keyOf(user: ICurrentUser | undefined): string {
  return user ? `${user.email.trim().toLowerCase()}|${user.isSiteAdmin ? 1 : 0}` : '';
}

/**
 * What the current user may do in the admin panel, read from the admin access list.
 * Reads again when `refreshKey` changes (after admin users were edited).
 * If the list cannot be read (not created yet, no permission), only site collection admins get access.
 * Access read for a different user or list never applies: until the new user's access is read,
 * they have none (no Admin button, no Super Admin actions under the previous user's role).
 */
export function useAdminAccess(
  service: IAdminService | undefined,
  user: ICurrentUser | undefined,
  refreshKey: number
): IAdminAccess {
  const userKey: string = keyOf(user);
  const [state, setState] = React.useState<IAccessState>({ userKey: '', service: undefined, access: LOADING });

  React.useEffect(() => {
    if (!service || !user) {
      setState({ userKey, service, access: NO_ACCESS });
      return;
    }
    let cancelled: boolean = false;
    service.getAdmins().then(
      (admins) => {
        if (!cancelled) {
          setState({ userKey, service, access: accessFor(user, admins) });
        }
      },
      () => {
        if (!cancelled) {
          setState({ userKey, service, access: accessFor(user, []) });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [service, user, userKey, refreshKey]);

  return state.userKey === userKey && state.service === service ? state.access : LOADING;
}
