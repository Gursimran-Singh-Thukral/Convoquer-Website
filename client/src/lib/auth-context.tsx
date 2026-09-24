'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiAuthedGet } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  profilePhotoUrl?: string | null;
  userRoles?: { role: { name: string; description?: string | null } }[];
}

export interface EffectivePermissionEntry {
  action: string;
  isGlobal: boolean;
  sportIds: string[];
  eventIds: string[];
  departmentIds: string[];
  grants?: PermissionScope[];
}

export interface EffectiveAuth {
  userId: string;
  roles: string[];
  permissions: Record<string, EffectivePermissionEntry>;
  /** Whether this user is a MatchOfficial (e.g. a scorekeeper) on at least one match. */
  hasOfficialAssignments: boolean;
}

export interface PermissionScope {
  sportId?: string;
  eventId?: string;
  departmentId?: string;
}

interface AuthState {
  canAccessOrganizer: boolean;
  isLoading: boolean;
  authenticated: boolean;
  user: CurrentUser | null;
  auth: EffectiveAuth | null;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (action: string, scope?: PermissionScope) => boolean;
  hasOfficialAssignments: boolean;
  /**
   * The single sport this user is scoped to for the given action(s) (checked in
   * order, first match wins), or undefined if they hold a global grant (no
   * filter needed) or are scoped to more than one sport. Used to default a
   * list page's sportId filter to "just my sport" for a Sports Coordinator
   * instead of showing every sport's data.
   */
  myScopedSportId: (...actions: string[]) => string | undefined;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [auth, setAuth] = useState<EffectiveAuth | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await apiAuthedGet<{ authenticated: boolean; user: CurrentUser | null }>(
        '/auth/me',
      );
      setAuthenticated(!!me.authenticated);
      setUser(me.user ?? null);

      if (me.authenticated) {
        try {
          const effective = await apiAuthedGet<EffectiveAuth>('/users/me/permissions');
          setAuth(effective);
        } catch {
          setAuth(null);
        }
      } else {
        setAuth(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
      setAuth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const hasRole = useCallback(
    (...roles: string[]) => !!auth && roles.some((r) => auth.roles.includes(r)),
    [auth],
  );

  const hasPermission = useCallback(
    (action: string, scope?: PermissionScope) => {
      if (!auth) return false;
      const entry = auth.permissions[action];
      if (!entry) return false;
      if (entry.isGlobal) return true;
      // Without a resource this is a navigation/capability check only.
      if (!scope)
        return (
          !!entry.grants?.length ||
          !!entry.sportIds.length ||
          !!entry.eventIds.length ||
          !!entry.departmentIds.length
        );
      if (entry.grants)
        return entry.grants.some((grant) =>
          Object.entries(grant).every(
            ([key, value]) => !value || scope?.[key as keyof PermissionScope] === value,
          ),
        );
      if (scope?.sportId && entry.sportIds.includes(scope.sportId)) return true;
      if (scope?.eventId && entry.eventIds.includes(scope.eventId)) return true;
      if (scope?.departmentId && entry.departmentIds.includes(scope.departmentId)) return true;
      return false;
    },
    [auth],
  );

  const myScopedSportId = useCallback(
    (...actions: string[]): string | undefined => {
      if (!auth) return undefined;
      for (const action of actions) {
        const entry = auth.permissions[action];
        if (!entry || entry.isGlobal) continue;
        if (entry.sportIds.length === 1) return entry.sportIds[0];
      }
      return undefined;
    },
    [auth],
  );

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        authenticated,
        user,
        auth,
        canAccessOrganizer: !!auth?.roles.length && Object.keys(auth.permissions).length > 0,
        hasRole,
        hasPermission,
        hasOfficialAssignments: !!auth?.hasOfficialAssignments,
        myScopedSportId,
        refresh: load,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
