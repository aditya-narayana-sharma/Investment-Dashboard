import { handleStrategyList, handleStrategyUpsert } from "../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleStrategyList(request);
}

export async function POST(request: Request) {
  return handleStrategyUpsert(request);
}
