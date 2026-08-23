import { COMPOSER_STRATEGIES } from "./composer-strategies";
import { getStrategy } from "./strategy-store";
import type { StrategyTreeV1 } from "../../packages/contracts/src/strategy-tree.ts";

export type ResolvedLibraryTree = {
  id: string;
  name: string;
  tree: StrategyTreeV1;
  source: "composer" | "library";
};

export async function resolveLibraryTree(id: string): Promise<ResolvedLibraryTree | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const composer = COMPOSER_STRATEGIES.find((card) => card.id === trimmed);
  if (composer) {
    return { id: composer.id, name: composer.name, tree: composer.tree, source: "composer" };
  }
  const stored = await getStrategy(trimmed);
  const tree = stored?.graph.tree;
  if (!stored || !tree) return null;
  return { id: stored.id, name: stored.name, tree, source: "library" };
}

export async function resolveLibraryTrees(ids: readonly string[]): Promise<{
  resolved: ResolvedLibraryTree[];
  missing: string[];
}> {
  const resolved: ResolvedLibraryTree[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const row = await resolveLibraryTree(key);
    if (row) resolved.push(row);
    else missing.push(key);
  }
  return { resolved, missing };
}
