/**
 * Криптография для edge-версии (Cloudflare Workers).
 *
 * Чем это отличается от Node-бэкенда (backend/src/lib):
 *  - Workers работает на Web Crypto API (crypto.subtle), а не на Node-модуле
 *    crypto. Здесь нет bcrypt: он намеренно «медленный», а на Workers есть
 *    жёсткий лимит CPU на запрос. Поэтому пароли хэшируются через PBKDF2 —
 *    алгоритм из стандарта Web Crypto, быстрый в нативном коде и достаточно
 *    стойкий с большим числом итераций.
 *  - JWT подписывается HS256 (HMAC-SHA256) средствами Web Crypto.
 *
 * Формат хранения пароля: `pbkdf2$<итерации>$<saltBase64>$<hashBase64>`.
 * Соль уникальна для каждого пароля — одинаковые пароли дают разные хэши.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return base64ToBytes(padded + pad);
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Хэширует пароль и возвращает строку для хранения в БД. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

/**
 * Сверяет пароль с сохранённым хэшем.
 * Сравнение побайтовое с накоплением разницы (constant-time по духу), чтобы
 * не давать подсказок по времени ответа.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = base64ToBytes(parts[2] as string);
  const expected = base64ToBytes(parts[3] as string);
  const actual = await deriveBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= (actual[i] as number) ^ (expected[i] as number);
  return diff === 0;
}

/** SHA-256 в hex — для хэша refresh-токена перед сохранением в БД. */
export async function sha256hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Случайный непредсказуемый токен (для refresh-токенов). */
export function randomToken(bytes = 48): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Парсит TTL вида "15m"/"7d"/"30s" в секунды. */
export function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 604_800;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
  return value * (multipliers[unit as string] ?? 1);
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Подписывает JWT (HS256). */
export async function signJwt(
  payload: { sub: number; email: string; role: string },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Проверяет JWT и возвращает payload. Бросает Error при любой проблеме. */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new Error('Invalid signature');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}
