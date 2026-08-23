import { createHmac, timingSafeEqual } from "node:crypto";
import { isLicenseTier, type LicenseTier } from "./license.ts";

export type StratjiLicenseJwt = {
  iss: "stratji.co.in";
  sub: string;
  tier: LicenseTier;
  exp: number;
};

function jwtSecret() {
  return String(process.env.LICENSE_JWT_SECRET ?? "").trim();
}

function b64url(value: Buffer | string) {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buf.toString("base64url");
}

export function licenseJwtConfigured() {
  return jwtSecret().length >= 16;
}

export function signLicenseJwt(payload: Omit<StratjiLicenseJwt, "iss">): string | null {
  const secret = jwtSecret();
  if (secret.length < 16) return null;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: "stratji.co.in", ...payload }));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

export function verifyLicenseJwt(token: string): StratjiLicenseJwt | null {
  const secret = jwtSecret();
  if (secret.length < 16) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (parsed.iss !== "stratji.co.in") return null;
    if (typeof parsed.sub !== "string" || !parsed.sub.trim()) return null;
    if (typeof parsed.tier !== "string" || !isLicenseTier(parsed.tier)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp * 1000 < Date.now()) return null;
    return { iss: "stratji.co.in", sub: parsed.sub.trim(), tier: parsed.tier, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

export function razorpayWebhookConfigured() {
  return String(process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim().length >= 16;
}

/** Razorpay `X-Razorpay-Signature` is HMAC-SHA256 hex of the raw webhook body. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
  if (secret.length < 16 || !signature?.trim()) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(signature.trim(), "utf8");
  const want = Buffer.from(expected, "utf8");
  if (actual.length !== want.length) return false;
  return timingSafeEqual(actual, want);
}
