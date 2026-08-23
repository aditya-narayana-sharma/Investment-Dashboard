import SwiftUI

struct NativeWorkspacePage: View {
    let workspace: DashboardWorkspace
    var section: String? = nil
    @ObservedObject var session: NativeRefreshCoordinator
    @ObservedObject var actions: NativeActionBoardModel
    var serverURL: URL? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                DashboardAuditFreshnessStrip(session: session)
                NativeActionBoard(workspace: workspace, model: actions)
                workspaceBody
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 24)
        }
        .background(Color(white: 0.07))
    }

    @ViewBuilder
    private var workspaceBody: some View {
        switch workspace {
        case .investment:
            investmentBody
        case .sectors:
            sectorsBody
        case .intelligence:
            intelligenceBody
        case .health:
            healthBody
        case .builder:
            builderBody
        case .strategies:
            strategiesBody
        }
    }

    private var investmentBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Portfolio", status: session.kite?.status ?? "unavailable")
            if let portfolio = session.kite?.portfolio {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    metricTile("Value", NativeFormat.inr(portfolio.value ?? 0))
                    metricTile("Invested", NativeFormat.inr(portfolio.invested ?? 0))
                    metricTile("P&L", NativeFormat.signedInr(portfolio.pnl ?? 0))
                    metricTile("Day P&L", NativeFormat.signedInr(portfolio.dayPnl ?? 0))
                }
            }
            ForEach(session.kite?.holdings ?? []) { holding in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(holding.symbol)
                            .font(.subheadline.bold())
                        Spacer()
                        Text(NativeFormat.inr(holding.value ?? 0))
                            .font(.subheadline.monospacedDigit())
                    }
                    Text(holding.name ?? "")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack {
                        Text("Qty \(holding.qty.map { NativeFormat.plain($0) } ?? "—")")
                        Spacer()
                        Text(NativeFormat.signedInr(holding.dayPnl ?? 0))
                            .foregroundStyle((holding.dayPnl ?? 0) >= 0 ? Color.green : Color.red)
                    }
                    .font(.caption2)
                }
                .padding(10)
                .background(Color.primary.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            if session.kite?.holdings?.isEmpty != false {
                emptyCopy("Holdings appear after a live Kite snapshot from the Mac.")
            }
        }
    }

    private var sectorsBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Sectoral Analytics", status: session.sector?.status ?? "unavailable")
            Picker("Industry", selection: Binding(
                get: { session.selectedSectorId },
                set: { newValue in
                    Task { await session.selectSector(newValue) }
                }
            )) {
                ForEach(NativeSectorCatalog.all, id: \.id) { sector in
                    Text(sector.title).tag(sector.id)
                }
            }
            .pickerStyle(.menu)
            .accessibilityLabel("S-2 industry")
            ForEach(session.sector?.companies ?? []) { company in
                HStack {
                    Text(company.symbol)
                        .font(.subheadline.bold())
                    Spacer()
                    if let price = company.price {
                        Text(NativeFormat.inr(price))
                            .font(.caption.monospacedDigit())
                    }
                }
                .padding(.vertical, 6)
            }
            Text("S-2 industry selection stays in this workspace. Market Intelligence stays complete.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var intelligenceBody: some View {
        let focus = section ?? "m1"
        VStack(alignment: .leading, spacing: 16) {
            if focus == "m2" {
                satyaBody
            } else if focus == "m3" {
                earningsBody
            } else {
                intelBoardNote
            }
        }
    }

    private var intelBoardNote: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Action Board", status: session.refresh?.content?.status ?? "unavailable")
            Text("M-1 cards come from today's Mail, Axis, podcasts, Satya corpus as-of, and verified earnings. Chat stays on the Mac.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var satyaBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Satya", status: session.refresh?.content?.status ?? "unavailable")
            Text("Source chips match the Mac briefing. Chat and push-to-talk run only on the author Mac.")
                .font(.caption)
                .foregroundStyle(.secondary)
            FlowChips(labels: [
                "Axis Research", "Axis Mutual Fund", "Groww", "Flipboard",
                "Other newsletters", "Podcasts", "Earnings KPIs",
            ])
            if let url = macSatyaURL {
                Link("Open Satya briefing on Mac", destination: url)
                    .font(.subheadline.bold())
            } else {
                emptyCopy("Open ?view=intelligence&section=m2 on the paired Mac for chat.")
            }
        }
    }

    private var earningsBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Earnings", status: session.refresh?.earnings?.status ?? "unavailable")
            ForEach(session.refresh?.earnings?.events ?? []) { event in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(event.symbol)
                            .font(.subheadline.bold())
                        Spacer()
                        Text(event.date)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Text(event.name)
                        .font(.caption)
                    if let summary = event.summary, !summary.isEmpty {
                        Text(summary)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Unpublished KPI fields stay blank until IR or NSE verification.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(10)
                .background(Color.primary.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var macSatyaURL: URL? {
        guard var components = serverURL.flatMap({ URLComponents(url: $0, resolvingAgainstBaseURL: false) }) else {
            return nil
        }
        components.queryItems = [
            URLQueryItem(name: "view", value: "intelligence"),
            URLQueryItem(name: "section", value: "m2"),
        ]
        return components.url
    }

    private var healthBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("My Feed", status: session.refresh?.health?.status ?? session.healthFreshness?.status ?? "unavailable")
            if let target = session.refresh?.health?.targetDate {
                Text("Operational target \(target) \(session.refresh?.health?.targetLabel ?? "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ForEach(session.refresh?.health?.categories ?? []) { category in
                VStack(alignment: .leading, spacing: 8) {
                    Text(category.name)
                        .font(.headline)
                    ForEach(category.metrics) { metric in
                        HStack {
                            Text(metric.label)
                            Spacer()
                            Text(metric.value)
                                .font(.body.monospacedDigit())
                        }
                        .font(.subheadline)
                    }
                }
                .padding(10)
                .background(Color.primary.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            if session.refresh?.health?.categories?.isEmpty != false {
                emptyCopy("Health tiles appear after a live Mac snapshot for the operational day.")
            }
        }
    }

    private var builderBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Algorithm Builder", status: session.connection.label)
            Text("The canvas and JSON editor stay on the Mac data plane. This phone client shows the shared action board and connection state, not a second copy of the tree.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var strategiesBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Strategies", status: session.refresh?.status ?? "unavailable")
            ForEach(session.strategies) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(.subheadline.bold())
                    if let updated = item.updatedAt {
                        Text(updated)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.primary.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            if session.strategies.isEmpty {
                emptyCopy("Composer-public reconstructions appear after the Mac library refresh.")
            }
        }
    }

    private func sectionHeader(_ title: String, status: String) -> some View {
        HStack {
            Text(title)
                .font(.title3.bold())
            Spacer()
            NativeStatusChip(state: status)
        }
    }

    private func metricTile(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.monospacedDigit())
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.primary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func emptyCopy(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.vertical, 8)
    }
}

private struct FlowChips: View {
    let labels: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(labels, id: \.self) { label in
                Text(label)
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.primary.opacity(0.08))
                    .clipShape(Capsule())
            }
        }
    }
}

private extension NativeFormat {
    static func plain(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.2f", value)
    }
}
