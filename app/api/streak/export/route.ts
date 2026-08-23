import { compileStreakScanner } from "../../../streak-export";
import { isLocalOperatorRequest } from "../../../local-llm-secrets";
import { readPublicLicense } from "../../../license-server";
import { tierAllows } from "../../../license";
import type { StrategyTreeV1 } from "../../../strategy/graph-types";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function POST(request: Request) {
  if (!isLocalOperatorRequest(request)) {
    return Response.json({ error: "Streak export is Mac-operator only." }, { status: 403, headers: NO_STORE });
  }
  const license = await readPublicLicense();
  if (!tierAllows(license.tier, "streak")) {
    return Response.json({ error: "Streak export requires Ultra." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await request.json() as { tree?: StrategyTreeV1 };
    if (!body.tree || body.tree.treeVersion !== "1") {
      return Response.json({ error: "Provide a StrategyTreeV1." }, { status: 400, headers: NO_STORE });
    }
    const exported = compileStreakScanner(body.tree);
    return Response.json(exported, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not compile Streak export." },
      { status: 400, headers: NO_STORE },
    );
  }
}
