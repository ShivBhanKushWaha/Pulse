import crypto from "node:crypto";

/**
 * The dashboard API is protected by one admin token, sent as `Authorization: Bearer <token>`.
 * Production refuses to start without PULSE_ADMIN_TOKEN; in development a random token is made at startup
 * and printed once, so the API is never open by accident.
 */
const MIN_TOKEN_LENGTH = 24;

const resolveAdminToken = (): { token: string; generated: boolean } => {
  const configured = process.env.PULSE_ADMIN_TOKEN;

  if (configured) {
    if (configured.length < MIN_TOKEN_LENGTH || configured.startsWith("change-me")) {
      throw new Error(`PULSE_ADMIN_TOKEN must be a random secret of at least ${MIN_TOKEN_LENGTH} characters.`);
    }
    return { token: configured, generated: false };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("PULSE_ADMIN_TOKEN is required in production.");
  }

  return { token: `pulse_admin_${crypto.randomBytes(24).toString("hex")}`, generated: true };
};

const admin = resolveAdminToken();

if (admin.generated) {
  console.warn(`[pulse] PULSE_ADMIN_TOKEN is not set. Using a temporary token for this run:\n  ${admin.token}`);
}

const digest = (value: string) => crypto.createHash("sha256").update(value).digest();

/** True when the Authorization header carries the admin token (compared in constant time). */
export function isAuthorized(header: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  return crypto.timingSafeEqual(digest(header.slice("Bearer ".length)), digest(admin.token));
}

/** Failed attempts per client, so the token cannot be guessed by hammering the API. */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 20;
const failures = new Map<string, { count: number; resetAt: number }>();

/** Expired entries are dropped periodically, so the map does not grow with every client that ever failed. */
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of failures) if (now > entry.resetAt) failures.delete(id);
}, 60_000).unref();

export function isBlocked(clientId: string): boolean {
  const entry = failures.get(clientId);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(clientId);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(clientId: string): void {
  const entry = failures.get(clientId);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(clientId, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}
