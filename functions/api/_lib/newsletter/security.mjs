/* ============================================================================
 * Newsletter — tokens (HMAC) and simple guards.
 * ----------------------------------------------------------------------------
 * Signed, stateless tokens for confirm/unsubscribe/approve links: no session,
 * no extra DB lookup to validate a link — the signature + embedded expiry are
 * enough. Uses Web Crypto (available in Workers), same technique as the rest
 * of this project's hand-rolled integrations (see _lib/smtp.mjs).
 * ==========================================================================*/

const enc = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function signToken(secret, purpose, value, ttlSeconds = 60 * 60 * 24 * 7) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${purpose}:${value}:${exp}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${btoa(payload)}.${b64url(sig)}`;
}

export async function verifyToken(secret, purpose, token) {
  try {
    const [p64, sig] = String(token).split('.');
    const payload = atob(p64);
    const [tPurpose, value, exp] = payload.split(':');
    if (tPurpose !== purpose || Number(exp) < Date.now() / 1000) return null;
    const expected = b64url(
      await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload))
    );
    if (!constantTimeEqual(expected, sig)) return null;
    return value;
  } catch {
    return null;
  }
}

// Constant-time string comparison — same technique used for token signatures
// below, also used for the admin bearer token so a network-timing attack
// can't shave characters off ADMIN_TOKEN one at a time.
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const isValidEmail = (e) =>
  typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export function checkAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const expected = `Bearer ${env.ADMIN_TOKEN || ''}`;
  return Boolean(env.ADMIN_TOKEN) && constantTimeEqual(auth, expected);
}
