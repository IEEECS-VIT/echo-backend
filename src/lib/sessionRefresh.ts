import { createHash } from 'crypto';
import { supabase } from '../client/supabase';

type RefreshSessionResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>;

const inFlightRefreshes = new Map<string, Promise<RefreshSessionResult>>();

const getRefreshKey = (refreshToken: string): string =>
  createHash('sha256').update(refreshToken).digest('hex');

/**
 * Deduplicate concurrent refresh calls for the same refresh token.
 * Supabase rotates refresh tokens — parallel refreshes can invalidate the session.
 */
export const refreshSupabaseSession = (refreshToken: string): Promise<RefreshSessionResult> => {
  const key = getRefreshKey(refreshToken);
  const existing = inFlightRefreshes.get(key);

  if (existing) {
    return existing;
  }

  const pending = supabase.auth
    .refreshSession({ refresh_token: refreshToken })
    .finally(() => {
      inFlightRefreshes.delete(key);
    });

  inFlightRefreshes.set(key, pending);
  return pending;
};
