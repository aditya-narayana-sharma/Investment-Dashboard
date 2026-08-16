import { handleStrategyValidate } from "../../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStrategyValidate(request);
}
