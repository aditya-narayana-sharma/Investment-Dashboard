import { applyLicenseUpdate } from "../../../license-server";
import { isLocalOperatorRequest } from "../../../local-llm-secrets";
import { verifyLicenseJwt } from "../../../license-jwt";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function POST(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return Response.json({ error: "License JWT activate is Mac-operator only." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await request.json() as { token?: string };
    const claims = typeof body.token === "string" ? verifyLicenseJwt(body.token) : null;
    if (!claims) {
      return Response.json({ error: "Invalid or expired Stratji license JWT." }, { status: 400, headers: NO_STORE });
    }
    const saved = await applyLicenseUpdate({
      key: `stratji-jwt-${claims.tier}-${claims.sub}`,
      tier: claims.tier,
    });
    return Response.json(saved, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not activate license JWT." },
      { status: 400, headers: NO_STORE },
    );
  }
}
