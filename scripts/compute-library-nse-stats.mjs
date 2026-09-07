import { computeAndCacheLibraryNseStats } from "../app/strategy/library-nse-stats-server.ts";

const cache = await computeAndCacheLibraryNseStats();
const rows = Object.entries(cache.strategies);
for (const [id, row] of rows) {
  if (row.ran) {
    process.stdout.write(
      `${id}\tran=true\tann=${row.annualizedReturnPct?.toFixed(2) ?? "—"}\tcum=${row.cumulativeReturnPct?.toFixed(2) ?? "—"}\tsharpe=${row.sharpe?.toFixed(2) ?? "—"}\tmaxDD=${row.maxDrawdownPct?.toFixed(2) ?? "—"}\n`,
    );
  } else {
    process.stdout.write(`${id}\tran=false\t${row.message}\n`);
  }
}
process.stdout.write(`${cache.message}\tasOf=${cache.asOf ?? "—"}\n`);
