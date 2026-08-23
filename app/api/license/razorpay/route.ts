import {
  licenseJwtConfigured,
  razorpayConfigured,
  razorpayWebhookConfigured,
  signLicenseJwt,
  verifyRazorpayWebhook,
} from "../../../license-jwt";
import { isLocalOperatorRequest } from "../../../local-llm-secrets";
import { isLicenseTier } from "../../../license";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  return Response.json({
    razorpay: razorpayConfigured(),
    webhook: razorpayWebhookConfigured(),
    jwt: licenseJwtConfigured(),
    checkoutUrl: process.env.STRATJI_CHECKOUT_URL?.trim() || "https://stratji.co.in/pricing",
  }, { headers: NO_STORE });
}

type RazorpayWebhookBody = {
  payload?: { payment?: { entity?: { email?: string; notes?: { tier?: string } } } };
  tier?: string;
  email?: string;
};

/** Razorpay payment.captured → signed license JWT. Remote callers need a valid webhook HMAC. */
export async function POST(request: Request) {
  const raw = await request.text();
  const localOperator = isLocalOperatorRequest(request);
  if (!localOperator && !verifyRazorpayWebhook(raw, request.headers.get("x-razorpay-signature"))) {
    return Response.json({ error: "Razorpay webhook signature is missing or invalid." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = JSON.parse(raw) as RazorpayWebhookBody;
    const tierRaw = body.payload?.payment?.entity?.notes?.tier ?? body.tier ?? "pro";
    const email = body.payload?.payment?.entity?.email ?? body.email ?? "operator";
    const tier = isLicenseTier(String(tierRaw).toLowerCase())
      ? String(tierRaw).toLowerCase() as "basic" | "pro" | "ultra"
      : "pro";
    const token = signLicenseJwt({
      sub: email,
      tier: tier === "basic" ? "pro" : tier,
      exp: Math.floor(Date.now() / 1000) + 366 * 24 * 60 * 60,
    });
    if (!token) {
      return Response.json({ error: "LICENSE_JWT_SECRET is not set (min 16 chars)." }, { status: 503, headers: NO_STORE });
    }
    return Response.json({ token, tier: tier === "basic" ? "pro" : tier }, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not issue license JWT." },
      { status: 400, headers: NO_STORE },
    );
  }
}
