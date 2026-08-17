import { applyLicenseUpdate, readPublicLicense } from "../../license-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  return Response.json(await readPublicLicense(), { headers: NO_STORE });
}

export async function PUT(request: Request) {
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
