import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIdempotency,
  createSignature,
  sha256,
  verifyReceiverAuth,
} from '../lib/server/receiver-auth.js';

const rawBody = '{"schema_version":"clientflow.handoff.v1"}';
const secret = 'test-secret-that-is-not-used-outside-tests';
const timestamp = '1785070800';
const nowMs = 1785070800 * 1000;

test('accepts an authentic body inside the replay window', () => {
  const result = verifyReceiverAuth({
    rawBody,
    secret,
    timestamp,
    nowMs,
    payloadHash: sha256(rawBody),
    signature: `sha256=${createSignature(secret, timestamp, rawBody)}`,
  });
  assert.equal(result.ok, true);
  assert.match(result.signatureDigest, /^[0-9a-f]{64}$/);
});

test('rejects tampering, stale timestamps, and missing authentication', () => {
  const signature = createSignature(secret, timestamp, rawBody);
  assert.equal(verifyReceiverAuth({
    rawBody: `${rawBody} `,
    secret,
    timestamp,
    nowMs,
    payloadHash: sha256(rawBody),
    signature,
  }).code, 'payload_hash_mismatch');
  assert.equal(verifyReceiverAuth({
    rawBody,
    secret,
    timestamp,
    nowMs: nowMs + 301_000,
    payloadHash: sha256(rawBody),
    signature,
  }).code, 'timestamp_outside_replay_window');
  assert.equal(verifyReceiverAuth({ rawBody, secret }).code, 'missing_authentication');
});

test('classifies idempotency replay and conflict', () => {
  const existing = { payloadHash: 'abc', eventType: 'handoff' };
  assert.equal(classifyIdempotency(null, existing), 'new');
  assert.equal(classifyIdempotency(existing, { ...existing }), 'replay');
  assert.equal(classifyIdempotency(existing, { payloadHash: 'def', eventType: 'handoff' }), 'conflict');
  assert.equal(classifyIdempotency(existing, { payloadHash: 'abc', eventType: 'revocation' }), 'conflict');
});
