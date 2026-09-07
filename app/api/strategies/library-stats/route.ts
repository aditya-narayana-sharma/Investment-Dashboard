import { handleLibraryNseStats } from "../../../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleLibraryNseStats(request);
}

export async function POST(request: Request) {
  return handleLibraryNseStats(request);
}
