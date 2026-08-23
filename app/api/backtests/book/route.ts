import { handleBacktestBook } from "../../../strategy/strategy-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleBacktestBook(request);
}
