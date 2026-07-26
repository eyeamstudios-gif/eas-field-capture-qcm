import { createClient } from '@supabase/supabase-js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const options = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};

export function receiverEnvironment() {
  return {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    webhookSecret:
      process.env.CLIENTFLOW_HANDOFF_SECRET?.trim() || required('CLIENTFLOW_WEBHOOK_SECRET'),
  };
}

export function syncEnvironment() {
  return {
    url: required('SUPABASE_URL'),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || required('SUPABASE_ANON_KEY'),
  };
}

export function serviceClient({ url, serviceRoleKey }) {
  return createClient(url, serviceRoleKey, options);
}

export async function authenticatedClient(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) return { error: 'missing_bearer_token' };

  const env = syncEnvironment();
  const verifier = createClient(env.url, env.publishableKey, options);
  const { data, error } = await verifier.auth.getUser(match[1]);
  if (error || !data.user) return { error: 'invalid_bearer_token' };

  const client = createClient(env.url, env.publishableKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  return { client, user: data.user };
}
