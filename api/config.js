import { errorResponse, json, requireMethod } from '../lib/server/http.js';

export async function GET(request) {
  const methodError = requireMethod(request, 'GET');
  if (methodError) return methodError;

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    return errorResponse(503, 'sync_not_configured');
  }

  return json(200, {
    schema_version: 'fieldcapture.config.v1',
    supabaseUrl,
    supabasePublishableKey,
    offlineFirst: true,
  });
}
