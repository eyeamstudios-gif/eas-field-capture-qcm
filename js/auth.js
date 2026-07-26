/**
 * Offline-tolerant Supabase Auth session management.
 * Authorization is always enforced server-side/RLS; cached identity only isolates local data.
 */

import { clearAuthSession, getAuthSession, saveAuthSession } from './storage.js';

let runtimeConfig = null;

function assertConfig(config) {
  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    throw new Error('Secure sync is not configured.');
  }
  return config;
}

export async function getRuntimeConfig() {
  if (runtimeConfig) return runtimeConfig;
  const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Secure sync is not configured on the server yet.');
    }
    throw new Error('Could not load secure sync configuration.');
  }
  runtimeConfig = assertConfig(await response.json());
  return runtimeConfig;
}

async function authRequest(path, { body, token } = {}) {
  const config = await getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || payload.message || 'Authentication failed.');
  }
  return payload;
}

function normalizeSession(payload) {
  const expiresIn = Number(payload.expires_in || 3600);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || 'bearer',
    expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + expiresIn,
    user: payload.user,
    account_id: payload.user?.id,
  };
}

export async function signInWithPassword(email, password) {
  if (!navigator.onLine) throw new Error('First-time sign-in requires connectivity.');
  const payload = await authRequest('token?grant_type=password', { body: { email, password } });
  const session = normalizeSession(payload);
  await saveAuthSession(session);
  return session;
}

export async function refreshSession(session) {
  if (!navigator.onLine || !session?.refresh_token) return session;
  const payload = await authRequest('token?grant_type=refresh_token', {
    body: { refresh_token: session.refresh_token },
  });
  const refreshed = normalizeSession(payload);
  await saveAuthSession(refreshed);
  return refreshed;
}

export async function getUsableSession({ allowExpiredOffline = true } = {}) {
  const session = await getAuthSession();
  if (!session?.account_id) return null;
  const expiresSoon = Number(session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60;
  if (!expiresSoon) return session;
  if (navigator.onLine) {
    try {
      return await refreshSession(session);
    } catch {
      return allowExpiredOffline ? { ...session, offline_only: true } : null;
    }
  }
  return allowExpiredOffline ? { ...session, offline_only: true } : null;
}

export async function signOut() {
  const session = await getAuthSession();
  if (navigator.onLine && session?.access_token) {
    await authRequest('logout', { token: session.access_token }).catch(() => {});
  }
  await clearAuthSession();
}

export function resetRuntimeConfigForTests() {
  runtimeConfig = null;
}
