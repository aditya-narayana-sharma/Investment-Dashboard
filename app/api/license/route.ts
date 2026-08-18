import { applyLicenseUpdate, readPublicLicense } from "../../license-server";
import { isLocalOperatorRequest } from "../../local-llm-secrets";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  return Response.json(await readPublicLicense(), { headers: NO_STORE });
}

export async function PUT(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return Response.json(
      { error: "License writes are only available on the author Mac." },
      { status: 403, headers: NO_STORE },
    );
  }
  try {
    const body = await request.json() as {
      key?: string;
      tier?: string;
      operatorOverride?: boolean;
      author?: boolean;
      operatorTier?: string;
      clearKey?: boolean;
    };
    const saved = await applyLicenseUpdate(body);
    return Response.json(saved, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save license." },
      { status: 400, headers: NO_STORE },
    );
  }
}
