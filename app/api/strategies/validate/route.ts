import { handleStrategyValidate } from "../../../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/strategies/validate — same rules as the client validator. */
export async function POST(request: Request) {
  return handleStrategyValidate(request);
}
