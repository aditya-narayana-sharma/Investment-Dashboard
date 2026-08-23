import Foundation

enum StratjiActionCatalog {
    static func items(for workspace: StratjiWorkspace) -> [StratjiActionItem] {
        switch workspace {
        case .investment:
            [
                .init(id: "inv-kite", title: "Refresh Kite and validate holdings", detail: "Reconcile holdings, positions, orders and GTTs before acting on allocation.", numericAdvantage: "100% live-position coverage", strategicAdvantage: "Prevents stale portfolio decisions", lane: "today", tone: "blue"),
                .init(id: "inv-concentration", title: "Review top-two concentration", detail: "Use new capital to dilute concentration before adding to the largest positions.", numericAdvantage: "Target <65% top-two weight", strategicAdvantage: "Improves shock resilience", lane: "today", tone: "amber"),
                .init(id: "inv-macro", title: "Monitor oil, INR and institutional flows", detail: "Apply the macro triggers before increasing high-beta exposure.", numericAdvantage: "5 regime signals", strategicAdvantage: "Links macro evidence to action", lane: "monitor", tone: "red"),
                .init(id: "inv-earnings", title: "Update post-result theses", detail: "Replace pending KPI fields only after official results are published.", numericAdvantage: "4 KPIs per event", strategicAdvantage: "Reduces narrative bias", lane: "monitor", tone: "green"),
            ]
        case .sectors:
            [
                .init(id: "sec-breadth", title: "Refresh sector breadth and rankings", detail: "Validate prices, horizons and constituent coverage across all tracked sectors.", numericAdvantage: "11 sector universes", strategicAdvantage: "Separates broad leadership from single-stock moves", lane: "today", tone: "blue"),
                .init(id: "sec-kpis", title: "Check sector KPI freshness", detail: "Review each metric's source date before using it in allocation decisions.", numericAdvantage: "30 numeric KPI cards", strategicAdvantage: "Makes stale evidence visible", lane: "today", tone: "green"),
                .init(id: "sec-framework", title: "Run the selected sector through frameworks", detail: "Use PESTEL, Porter, life-cycle and market-structure evidence together before forming a sector stance.", numericAdvantage: "4 independent lenses", strategicAdvantage: "Reduces one-factor conclusions", lane: "monitor", tone: "amber"),
                .init(id: "sec-earnings", title: "Fill pending earnings KPIs", detail: "Keep unpublished values blank and populate only from official releases.", numericAdvantage: "0 fabricated values", strategicAdvantage: "Preserves research integrity", lane: "monitor", tone: "red"),
            ]
        case .intelligence:
            [
                .init(id: "intel-mail", title: "Refresh Satya corpus sources", detail: "Index iCloud Newsletters and Axis Research into the Satya corpus. Chat stays on the Mac.", numericAdvantage: "2 exact mailbox scopes", strategicAdvantage: "Prevents misfiled evidence", lane: "today", tone: "blue"),
                .init(id: "intel-satya", title: "Ask Satya on the Mac briefing", detail: "Open M-2 on the author Mac. This phone shows chips and earnings only.", numericAdvantage: "operator-Mac chat", strategicAdvantage: "LAN clients cannot POST chat", lane: "today", tone: "green"),
                .init(id: "intel-earnings", title: "Monitor reported earnings evidence", detail: "Promote KPI rows only after company, exchange, or validated research evidence is available.", numericAdvantage: "0 inferred result fields", strategicAdvantage: "Protects decision quality", lane: "monitor", tone: "amber"),
                .init(id: "intel-podcasts", title: "Index podcast summaries into Satya", detail: "Use local transcripts when available and label description-only summaries explicitly.", numericAdvantage: "corpus as-of", strategicAdvantage: "Keeps evidence provenance clear", lane: "monitor", tone: "red"),
            ]
        case .health:
            [
                .init(id: "health-sync", title: "Verify the operational Health target", detail: "After the 8 PM cutoff, confirm the newest archive advances the target date.", numericAdvantage: "8 PM date roll", strategicAdvantage: "Keeps the wellness record auditable", lane: "today", tone: "blue"),
                .init(id: "health-averages", title: "Reconcile weekly and monthly averages", detail: "Show trends only where a complete comparison window is available.", numericAdvantage: "7-day + 30-day baselines", strategicAdvantage: "Avoids overreading one day", lane: "today", tone: "green"),
                .init(id: "health-sleep", title: "Resolve cross-app sleep variance", detail: "Keep Apple Health primary and retain Guava as a separate comparison.", numericAdvantage: "2-source reconciliation", strategicAdvantage: "Prevents incompatible totals being merged", lane: "monitor", tone: "amber"),
                .init(id: "health-diary", title: "Complete nutrition diary", detail: "Treat logged intake as incomplete until all meals and portions are entered.", numericAdvantage: "100% meal coverage target", strategicAdvantage: "Improves nutrition signal quality", lane: "monitor", tone: "red"),
            ]
        case .builder:
            [
                .init(id: "builder-validate", title: "Validate the strategy tree", detail: "Confirm Weight percents, If/Else operands and compiled StrategyGraphV2 before paper or broker preview.", numericAdvantage: "0 invalid trees", strategicAdvantage: "Blocks broken logic from leaving the canvas", lane: "today", tone: "blue"),
                .init(id: "builder-asset", title: "Add Indian assets on the tree", detail: "Resolve symbols against live Kite holdings and watchlist, not a static US list.", numericAdvantage: "Holdings ∪ watchlist", strategicAdvantage: "Keeps the sleeve on real NSE instruments", lane: "today", tone: "green"),
                .init(id: "builder-export", title: "Export the tree plus compiled graph", detail: "Save StrategyTreeV1 with compiled schemaVersion 2 before switching machines.", numericAdvantage: "Round-trip identical tree", strategicAdvantage: "Protects canvas work from session loss", lane: "monitor", tone: "amber"),
                .init(id: "builder-else", title: "Fill or accept an empty ELSE", detail: "If/Else THEN can hold assets; empty ELSE is allowed and warned.", numericAdvantage: "THEN / ELSE wells", strategicAdvantage: "Completes the condition without a flowchart", lane: "monitor", tone: "red"),
            ]
        case .strategies:
            [
                .init(id: "strat-review", title: "Review the nine NSE library trees", detail: "Open a card to read the full vertical tree before sending it to Algorithm Builder.", numericAdvantage: "9 NSE ETF trees", strategicAdvantage: "Keeps research scoped to Indian-listed sleeves", lane: "today", tone: "blue"),
                .init(id: "strat-stats", title: "Do not treat empty OOS tiles as live alpha", detail: "Library KPIs stay em dash until an Indian-market engine run exists.", numericAdvantage: "— until ran", strategicAdvantage: "Prevents fabricated performance", lane: "today", tone: "green"),
                .init(id: "strat-market", title: "Confirm every leaf is a Nifty 500 name", detail: "Sleeves use official NSE constituent names. No SPY/TQQQ/SOXL.", numericAdvantage: "NSE only", strategicAdvantage: "Keeps Stratji on Indian markets", lane: "monitor", tone: "amber"),
                .init(id: "strat-open", title: "Open one tree in Algorithm Builder", detail: "Deep-link a reconstruction into the tree editor when you want to edit.", numericAdvantage: "Algorithm Builder", strategicAdvantage: "Edits stay on the canvas", lane: "monitor", tone: "red"),
            ]
        }
    }
}
