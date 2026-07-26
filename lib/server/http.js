const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, ...extraHeaders } });
}

export function errorResponse(status, code, details) {
  return json(status, {
    schema_version: 'controlplane.error.v1',
    error: code,
    ...(details ? { details } : {}),
  });
}

export function requireMethod(request, method) {
  if (request.method === method) return null;
  return errorResponse(405, 'method_not_allowed');
}
