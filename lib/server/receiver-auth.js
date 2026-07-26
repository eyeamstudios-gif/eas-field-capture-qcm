import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_REPLAY_WINDOW_SECONDS = 300;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createSignature(secret, timestamp, rawBody) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

function safeHexEqual(actual, expected) {
  if (!/^[0-9a-f]{64}$/i.test(actual) || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function verifyReceiverAuth({
  rawBody,
  secret,
  signature,
  timestamp,
  payloadHash,
  nowMs = Date.now(),
  replayWindowSeconds = DEFAULT_REPLAY_WINDOW_SECONDS,
}) {
  if (!secret || !signature || !timestamp || !payloadHash) {
    return { ok: false, code: 'missing_authentication' };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) {
    return { ok: false, code: 'invalid_timestamp' };
  }
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - timestampSeconds);
  if (ageSeconds > replayWindowSeconds) {
    return { ok: false, code: 'timestamp_outside_replay_window' };
  }

  const actualHash = sha256(rawBody);
  if (!safeHexEqual(actualHash, payloadHash)) {
    return { ok: false, code: 'payload_hash_mismatch' };
  }

  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = createSignature(secret, timestamp, rawBody);
  if (!safeHexEqual(provided, expected)) {
    return { ok: false, code: 'invalid_signature' };
  }

  return { ok: true, payloadHash: actualHash, signatureDigest: sha256(provided.toLowerCase()) };
}

export function classifyIdempotency(existing, incoming) {
  if (!existing) return 'new';
  return existing.payloadHash === incoming.payloadHash && existing.eventType === incoming.eventType
    ? 'replay'
    : 'conflict';
}
