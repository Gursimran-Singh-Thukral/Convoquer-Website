import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';

// Any ciphertext produced by encryptField() matches this shape, which lets
// the response-decryption interceptor find and decrypt encrypted fields
// anywhere in an API response without every read call site knowing which
// columns are encrypted.
const CIPHERTEXT_PATTERN =
  /^v1:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FIELD_ENCRYPTION_KEY is required in production to encrypt PII at rest',
      );
    }
    // Deterministic dev-only fallback so local dev/tests work with zero setup.
    // Never reached in production (guarded above).
    cachedKey = createHmac('sha256', 'convoquer-dev-only-insecure-key')
      .update('convoquer-field-encryption')
      .digest();
    return cachedKey;
  }

  const key = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
  if (key.length !== 32) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars or 44 base64 chars)',
    );
  }
  cachedKey = key;
  return cachedKey;
}

export function isEncryptedPayload(value: unknown): value is string {
  return typeof value === 'string' && CIPHERTEXT_PATTERN.test(value);
}

/** Encrypts a plaintext string for storage. Idempotent-safe: null/undefined pass through. */
export function encryptField(
  plaintext: string | null | undefined,
): string | null | undefined {
  if (plaintext === null || plaintext === undefined) return plaintext;

  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/** Decrypts a value produced by encryptField(). Non-ciphertext strings pass through unchanged. */
export function decryptField(
  payload: string | null | undefined,
): string | null | undefined {
  if (payload === null || payload === undefined) return payload;
  if (!isEncryptedPayload(payload)) return payload;

  const [, ivB64, tagB64, dataB64] = payload.split(':');
  const key = loadKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * HMAC-SHA256 blind index for exact-match lookups/uniqueness on an encrypted
 * column. Deterministic (same input -> same hash) but does not leak the
 * plaintext, and normalizes case/whitespace so lookups match consistently.
 */
export function blindIndex(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) return value;
  const key = loadKey();
  return createHmac('sha256', key)
    .update(value.trim().toLowerCase())
    .digest('hex');
}

/** Recursively decrypts any encrypted-looking string leaf in an arbitrary JSON-ish value. */
export function deepDecrypt<T>(value: T): T {
  if (isEncryptedPayload(value)) {
    return decryptField(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepDecrypt(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepDecrypt(v);
    }
    return out as T;
  }
  return value;
}
