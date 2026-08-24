import AppKit
import SwiftUI

struct StratjiSettingsView: View {
    @ObservedObject var session: StratjiSessionModel

    var body: some View {
        StratjiNativeSettingsForm(session: session)
    }
}

private struct StratjiNativeSettingsForm: View {
    @ObservedObject var session: StratjiSessionModel
    @AppStorage(StratjiAppearanceStore.defaultsKey) private var appearanceRaw = StratjiAppearanceStore.defaultValue
    @AppStorage(StratjiAppearanceStore.healthIncognitoKey) private var healthIncognito = false

    @State private var licenseKey = ""
    @State private var licenseTier: StratjiLicenseTier = .ultra
    @State private var licenseMessage = ""
    @State private var licenseAuthor = false
    @State private var kiteMcpProjectDir = ""
    @State private var newslettersMailbox = "Newsletters"
    @State private var researchMailbox = "Axis Research"
    @State private var reminderLists = "Job 🔍, Earnings"
    @State private var calendarNames = "Apple Calendar"
    @State private var podcastsLibrary = "Apple Podcasts"
    @State private var pythonPath = ""
    @State private var nodePath = ""
    @State private var npmPath = ""
    @State private var yfinanceNotes = "yfinance (free, no API key). Used for Sectoral Analytics."
    @State private var openaiKey = ""
    @State private var claudeKey = ""
    @State private var geminiKey = ""
    @State private var cursorKey = ""
    @State private var openaiConfigured = false
    @State private var claudeConfigured = false
    @State private var geminiConfigured = false
    @State private var cursorConfigured = false
    @State private var statusMessage = ""
    @State private var isSaving = false
    @State private var didLoad = false
    @State private var appleRows: [StratjiApplePermissionState] = StratjiApplePermissions.snapshot()
    @State private var busyAppleSource: StratjiAppleSource?

    private let client = StratjiAPIClient()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                safetyBanner
                Form {
                    freshnessSection
                    licenseSection
                    appearanceSection
                    kiteSection
                    mailboxSection
                    calendarsSection
                    brokerNotesSection
                    llmSection
                    skillsSection
                    permissionsSection
                    if !statusMessage.isEmpty {
                        Section {
                            Text(statusMessage)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .formStyle(.grouped)
                .scrollContentBackground(.hidden)
            }
            .background(StratjiAppearance(rawValue: appearanceRaw)?.prefersDarkChrome == false
                ? Color(red: 0.98, green: 0.97, blue: 0.95)
                : Color.black)
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task { await saveAll() }
                    }
                    .disabled(isSaving)
                }
            }
        }
        .frame(minWidth: 640, minHeight: 720)
            .preferredColorScheme(StratjiAppearance(rawValue: appearanceRaw)?.colorScheme ?? .dark)
            .onChange(of: appearanceRaw) { _, _ in
                applyDashboardPreferences()
            }
            .onChange(of: healthIncognito) { _, _ in
                applyDashboardPreferences()
            }
            .onAppear {
                if !didLoad {
                    didLoad = true
                    bootstrap()
                }
                appleRows = StratjiApplePermissions.snapshot()
                applyDashboardPreferences()
                Task { await StratjiApplePermissionActions.persist(session: session) }
            }
    }

    private var safetyBanner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.shield.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(red: 0.96, green: 0.76, blue: 0.18))
            VStack(alignment: .leading, spacing: 6) {
                Text("SAFETY")
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                Text("Connect / test / disconnect write gitignored local config only. They do not place Kite orders. Confirmed BUY/SELL and GTT from reviewed tickets ARE live Kite orders after you type confirmation. Optional LLM keys stay on-device. Label that output machine-drafted. Stratji never silently auto-trades.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(red: 0.99, green: 0.90, blue: 0.54))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.27, green: 0.10, blue: 0.01))
        .overlay(alignment: .leading) {
            Rectangle().fill(Color(red: 0.96, green: 0.76, blue: 0.18)).frame(width: 6)
        }
    }

    private var freshnessSection: some View {
        Section {
            StratjiFreshnessChipStrip(sources: session.liveFeedSources)
                .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
        } header: {
            Text("Source freshness")
        } footer: {
          Text("Source freshness for the complete dashboard. The main canvas does not duplicate this strip. Failures also stay in ~/Library/Logs/PortfolioIntelligence/startup-refresh.log.")
        }
    }

    private var licenseSection: some View {
        Section("License") {
            LabeledContent("Operator tier") {
                Text(licenseAuthor ? "Ultra · author Mac" : licenseTier.title)
                    .foregroundStyle(licenseAuthor ? Color.green : Color.primary)
            }
            TextField("Master key", text: $licenseKey)
                .textFieldStyle(.roundedBorder)
                .font(.system(.body, design: .monospaced))
            Text("This Mac is the author clone. Downstream GitHub users stay Basic until they paste a paid key. v1 is an honor + key file — not Stripe.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Picker("Tier", selection: $licenseTier) {
                ForEach(StratjiLicenseTier.allCases) { tier in
                    Text(tier.title).tag(tier)
                }
            }
            .pickerStyle(.segmented)
            if !licenseMessage.isEmpty {
                Text(licenseMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            Text("Stored at ~/Library/Application Support/Stratji/license.json")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
    }

    private var appearanceSection: some View {
        Section("Appearance") {
            Picker("Theme", selection: $appearanceRaw) {
                ForEach(StratjiAppearance.allCases) { option in
                    Text(option.title).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)
            Toggle("Health Incognito", isOn: $healthIncognito)
            Text("Hides Health statistics, drill-downs, and source metadata until you turn this off.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var kiteSection: some View {
        Section("Kite") {
            LabeledContent("Auth status") {
                Text(kiteStatusLabel)
                    .foregroundStyle(.secondary)
            }
            if let asOf = session.kite?.asOf, !asOf.isEmpty {
                LabeledContent("As of") {
                    Text(asOf).foregroundStyle(.secondary)
                }
            }
            TextField("Kite MCP project dir", text: $kiteMcpProjectDir)
            Button(kiteNeedsAuth ? "Authenticate Kite" : "Re-authenticate Kite") {
                authenticateKite()
            }
            Text("Opens Zerodha login in Safari. Complete login there, return here, then Refresh all. This does not place orders.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Read-only from the data plane. Writes that place orders still need an explicit ticket and confirmation.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var mailboxSection: some View {
        Section("Mailboxes") {
            TextField("Newsletters", text: $newslettersMailbox)
            TextField("Axis Research", text: $researchMailbox)
            Text("Apple Mail: only iCloud → Newsletters for the digest and only iCloud → Axis Research for Axis.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var calendarsSection: some View {
        Section("Calendars, Reminders, Podcasts") {
            TextField("Calendars", text: $calendarNames)
            TextField("Reminders lists", text: $reminderLists)
            TextField("Podcasts", text: $podcastsLibrary)
            Text("Reminders: exact Job 🔍 and Earnings lists. Calendar earnings rows are scheduling evidence only.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var brokerNotesSection: some View {
        Section("Zerodha Kite / Streak") {
            Text("Kite tickets (orders, GTT/TSL, alerts) require an explicit reviewed ticket and typed confirmation. Confirmed BUY/SELL and GTT are live Kite orders. Stratji never silently auto-trades.")
            Text("Streak is the live venue. Export from Algorithm Canvas / Strategies is copy-only. Deploy and confirm inside Zerodha Streak.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var llmSection: some View {
        Section("LLM APIs") {
            SecureField(claudeConfigured || !claudeKey.isEmpty ? "Claude API key" : "Claude API key (optional)", text: $claudeKey)
            SecureField(openaiConfigured || !openaiKey.isEmpty ? "OpenAI API key" : "OpenAI API key (optional)", text: $openaiKey)
            SecureField(geminiConfigured || !geminiKey.isEmpty ? "Gemini API key" : "Gemini API key (optional)", text: $geminiKey)
            SecureField(cursorConfigured || !cursorKey.isEmpty ? "Cursor API key" : "Cursor API key (optional)", text: $cursorKey)
            Text("Paste keys locally. Summaries, composite commentary, S-3 framework, Algorithm Canvas, and Strategies assist use Claude first, then OpenAI, then Gemini. Empty keys disable those features — they never invent analysis. Cursor is stored only. Output is labelled machine-drafted. Keys stay in .env.local and gitignored config.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var skillsSection: some View {
        Section("Skills / libraries") {
            TextField("yfinance notes", text: $yfinanceNotes)
            TextField("python path", text: $pythonPath)
            TextField("node path", text: $nodePath)
            TextField("npm path", text: $npmPath)
        }
    }

    private var permissionsSection: some View {
        Section("Apple apps") {
            Text("Connect asks macOS for permission. After full access, Stratji keeps using the same Mail, Calendar, Reminders, and Podcasts refresh pipelines as today.")
                .font(.caption)
                .foregroundStyle(.secondary)
            ForEach(appleRows) { row in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(row.source.title)
                            .font(.headline)
                        Spacer()
                        Text(row.status.label)
                            .font(.caption.weight(.heavy).monospaced())
                            .textCase(.uppercase)
                            .foregroundStyle(permissionColor(row.status))
                    }
                    Text(row.notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack {
                        Button(busyAppleSource == row.source ? "Asking…" : "Connect") {
                            Task { await connectApple(row.source) }
                        }
                        .disabled(busyAppleSource != nil)
                        if row.status == .denied {
                            Button("Open Privacy Settings") {
                                StratjiApplePermissions.openPrivacySettings(for: row.source)
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            Text("Grant Full Disk Access once so macOS stops asking for the Documents checkout, ~/Library/Logs/PortfolioIntelligence, and artifacts/private. Calendar / Podcasts / Reminders group-container SQLite and Health ZIP import also use that grant until those reads are fully EventKit-backed. After a new ad-hoc signature, Allow Documents once or re-enable Full Disk Access for apple-app/build/Stratji.app.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Open Full Disk Access") {
                session.openFullDiskAccess()
            }
        }
    }

    private func permissionColor(_ status: StratjiApplePermissionStatus) -> Color {
        switch status {
        case .connected: Color.green
        case .permissionRequired: Color.yellow
        case .denied: Color.red
        }
    }

    private func connectApple(_ source: StratjiAppleSource) async {
        busyAppleSource = source
        defer { busyAppleSource = nil }
        await StratjiApplePermissionActions.connect(source, session: session)
        appleRows = StratjiApplePermissions.snapshot()
        switch appleRows.first(where: { $0.source == source })?.status {
        case .connected:
            statusMessage = "\(source.title) connected. Dashboard refresh uses the existing pipeline."
        case .denied:
            statusMessage = "\(source.title) was denied. Open Privacy Settings to allow Stratji."
        default:
            statusMessage = "\(source.title) still needs permission."
        }
    }

    private var kiteStatusLabel: String {
        let status = session.kite?.authStatus ?? session.kite?.status ?? "unknown"
        switch status {
        case "authenticated", "live": return "Authenticated (data plane)"
        case "partial": return "Partial (session valid, some sections failed)"
        case "auth_required", "unauthenticated": return "Authentication required"
        case "snapshot": return "Cached snapshot"
        case "expired": return "Expired — re-auth"
        default: return status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private var kiteNeedsAuth: Bool {
        let status = session.kite?.authStatus ?? session.kite?.status ?? "unavailable"
        switch status {
        case "authenticated", "live", "partial": return false
        default: return true
        }
    }

    private func authenticateKite() {
        Task {
            await StratjiKiteAuth.openFromDashboard(StratjiKiteAuth.loginURL(baseURL: session.baseURL))
        }
        statusMessage = "Complete Zerodha login in Safari, then Refresh all on the dashboard."
    }

    private func bootstrap() {
        let seeded = StratjiLicenseStore.ensureAuthorLicense()
        licenseKey = seeded.key
        licenseTier = seeded.tier
        licenseAuthor = seeded.author
        licenseMessage = seeded.author
            ? "Author Mac — Ultra is unlocked. Other people must buy a key."
            : "Paste a paid key such as stratji-pro-xxxx or stratji-ultra-xxxx."
        pythonPath = which("python3")
        nodePath = which("node")
        npmPath = which("npm")
        applyLocalSecrets(StratjiLocalSecrets.llmKeys())
        Task { await loadRemote() }
    }

    private func loadRemote() async {
        if let remote = try? await client.license(baseURL: session.baseURL) {
            if let key = remote.key, !key.isEmpty { licenseKey = key }
            if let tier = StratjiLicenseTier(rawValue: remote.tier ?? "") { licenseTier = tier }
            licenseAuthor = remote.author == true || StratjiLicenseStore.isMasterKey(licenseKey)
            if let message = remote.message, !message.isEmpty { licenseMessage = message }
        }
        if let config = try? await client.integrations(baseURL: session.baseURL, includeSecrets: true) {
            apply(config)
        } else if let config = session.integrations {
            apply(config)
        }
    }

    private func apply(_ config: IntegrationsConfigDTO) {
        if UserDefaults.standard.object(forKey: StratjiAppearanceStore.defaultsKey) == nil,
           let appearance = config.appearance,
           StratjiAppearance(rawValue: appearance) != nil {
            appearanceRaw = appearance
        }
        if let incognito = config.healthIncognito {
            healthIncognito = incognito
        }
        openaiConfigured = config.llm?.openaiKeyConfigured == true || !(config.llm?.openaiApiKey ?? "").isEmpty
        claudeConfigured = config.llm?.anthropicKeyConfigured == true || !(config.llm?.anthropicApiKey ?? "").isEmpty
        geminiConfigured = config.llm?.geminiKeyConfigured == true || !(config.llm?.geminiApiKey ?? "").isEmpty
        cursorConfigured = config.llm?.cursorKeyConfigured == true || !(config.llm?.cursorApiKey ?? "").isEmpty
        if let value = config.llm?.openaiApiKey, !value.isEmpty { openaiKey = value }
        if let value = config.llm?.anthropicApiKey, !value.isEmpty { claudeKey = value }
        if let value = config.llm?.geminiApiKey, !value.isEmpty { geminiKey = value }
        if let value = config.llm?.cursorApiKey, !value.isEmpty { cursorKey = value }
        applyLocalSecrets(StratjiLocalSecrets.llmKeys())
        guard let wizard = config.wizard else { return }
        if let value = wizard.kiteMcpProjectDir { kiteMcpProjectDir = value }
        if let value = wizard.newslettersMailbox { newslettersMailbox = value }
        if let value = wizard.researchMailbox { researchMailbox = value }
        if let lists = wizard.reminderListNames { reminderLists = lists.joined(separator: ", ") }
        if let value = wizard.calendarNames { calendarNames = value }
        if let value = wizard.podcastsLibrary { podcastsLibrary = value }
        if let value = wizard.pythonPath, !value.isEmpty { pythonPath = value }
        if let value = wizard.nodePath, !value.isEmpty { nodePath = value }
        if let value = wizard.npmPath, !value.isEmpty { npmPath = value }
        if let value = wizard.yfinanceNotes { yfinanceNotes = value }
    }

    private func applyLocalSecrets(_ keys: StratjiLocalSecrets.LLMKeys) {
        if openaiKey.isEmpty { openaiKey = keys.openai }
        if claudeKey.isEmpty { claudeKey = keys.claude }
        if geminiKey.isEmpty { geminiKey = keys.gemini }
        if cursorKey.isEmpty { cursorKey = keys.cursor }
        openaiConfigured = openaiConfigured || !openaiKey.isEmpty
        claudeConfigured = claudeConfigured || !claudeKey.isEmpty
        geminiConfigured = geminiConfigured || !geminiKey.isEmpty
        cursorConfigured = cursorConfigured || !cursorKey.isEmpty
    }

    private func saveAll() async {
        isSaving = true
        defer { isSaving = false }
        let trimmedKey = licenseKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let snapshot = StratjiLicenseSnapshot(
            tier: licenseAuthor || StratjiLicenseStore.isMasterKey(trimmedKey) ? .ultra : licenseTier,
            key: trimmedKey,
            operatorOverride: trimmedKey.isEmpty,
            author: licenseAuthor || StratjiLicenseStore.isMasterKey(trimmedKey) || licenseTier == .ultra && trimmedKey.hasPrefix("stratji-ultra-master-"),
            operatorTier: licenseAuthor ? .ultra : licenseTier,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        do {
            try StratjiLicenseStore.save(snapshot)
        } catch {
            statusMessage = "Could not write license.json."
            return
        }
        do {
            let savedLicense = try await client.saveLicense(
                baseURL: session.baseURL,
                body: LicenseUpdateBody(
                    key: trimmedKey,
                    tier: snapshot.tier.rawValue,
                    operatorOverride: snapshot.operatorOverride,
                    author: snapshot.author,
                    operatorTier: snapshot.operatorTier?.rawValue
                )
            )
            licenseAuthor = savedLicense.author == true || snapshot.author
            licenseTier = StratjiLicenseTier(rawValue: savedLicense.tier ?? snapshot.tier.rawValue) ?? snapshot.tier
            if let key = savedLicense.key, !key.isEmpty { licenseKey = key }
            licenseMessage = savedLicense.message ?? licenseMessage
        } catch {
            licenseMessage = "Saved license.json on this Mac. The data plane will pick it up on the next refresh."
        }

        var llm: IntegrationsLlmSecretsDTO?
        if !openaiKey.isEmpty || !claudeKey.isEmpty || !geminiKey.isEmpty || !cursorKey.isEmpty {
            llm = IntegrationsLlmSecretsDTO(
                anthropicApiKey: claudeKey.isEmpty ? nil : claudeKey,
                openaiApiKey: openaiKey.isEmpty ? nil : openaiKey,
                geminiApiKey: geminiKey.isEmpty ? nil : geminiKey,
                cursorApiKey: cursorKey.isEmpty ? nil : cursorKey
            )
        }
        let wizard = IntegrationsWizardDTO(
            kiteMcpProjectDir: kiteMcpProjectDir,
            newslettersMailbox: newslettersMailbox,
            researchMailbox: researchMailbox,
            reminderListNames: reminderLists
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty },
            calendarNames: calendarNames,
            podcastsLibrary: podcastsLibrary,
            pythonPath: pythonPath,
            nodePath: nodePath,
            npmPath: npmPath,
            yfinanceNotes: yfinanceNotes
        )
        do {
            let saved = try await client.saveIntegrations(
                baseURL: session.baseURL,
                body: IntegrationsSettingsUpdate(
                    wizardComplete: true,
                    wizard: wizard,
                    appearance: appearanceRaw,
                    healthIncognito: healthIncognito,
                    llm: llm
                )
            )
            session.integrations = saved
            openaiKey = ""
            claudeKey = ""
            geminiKey = ""
            cursorKey = ""
            apply(saved)
        } catch {
            statusMessage = "License saved. Integrations save failed — retry after the data plane is live."
        }
        applyDashboardPreferences()
        statusMessage = "Saved."
    }

    private func applyDashboardPreferences() {
        session.document.applyPreferences()
    }

    private func which(_ command: String) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = [command]
        process.environment = [
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        ]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()
        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        } catch {
            return ""
        }
    }
}

/// Dashboard `PulseConstellation` chips, wrapping so they stay inside Settings instead of clipping.
private struct StratjiFreshnessChipStrip: View {
    let sources: [SourceFreshnessDTO]

    var body: some View {
        Group {
            if sources.isEmpty {
                Text("Waiting for the dashboard refresh payload. Chips bind to live source rows and are not hardcoded.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                StratjiFlowLayout(spacing: 8) {
                    ForEach(sources) { source in
                        StratjiFreshnessChip(source: source)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Source freshness")
    }
}

private struct StratjiFreshnessChip: View {
    let source: SourceFreshnessDTO
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(alignment: .center, spacing: 9) {
            StratjiFreshnessDot(state: source.state)
            VStack(alignment: .leading, spacing: 1) {
                Text(source.chipTitle)
                    .font(.system(size: 14, weight: .heavy, design: .monospaced))
                    .foregroundStyle(titleColor)
                    .lineLimit(1)
                Text(source.chipSubtitle)
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundStyle(subtitleColor)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(chipFill, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(chipBorder, lineWidth: 1.5)
        }
        .fixedSize()
        .help(source.message ?? source.chipSubtitle)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(source.source), \(source.chipSubtitle)")
    }

    private var chipFill: Color {
        colorScheme == .dark
            ? Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
            : Color(red: 1, green: 253 / 255, blue: 249 / 255)
    }

    private var chipBorder: Color {
        colorScheme == .dark
            ? Color(red: 39 / 255, green: 39 / 255, blue: 42 / 255)
            : Color.black.opacity(0.22)
    }

    private var titleColor: Color {
        colorScheme == .dark ? Color(red: 250 / 255, green: 250 / 255, blue: 250 / 255) : .black
    }

    private var subtitleColor: Color {
        colorScheme == .dark ? Color(red: 161 / 255, green: 161 / 255, blue: 170 / 255) : Color.black.opacity(0.72)
    }
}

private struct StratjiFreshnessDot: View {
    let state: StratjiSourceState

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(state.freshnessDotColor.opacity(0.35), lineWidth: 1)
                .frame(width: 16, height: 16)
            Circle()
                .fill(state.freshnessDotColor)
                .frame(width: 8, height: 8)
        }
        .accessibilityHidden(true)
    }
}

/// Intrinsic-size wrapping row. Caps infinite Form proposals so chips wrap instead of overflowing.
private struct StratjiFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).container
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for index in subviews.indices {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + result.origins[index].x, y: bounds.minY + result.origins[index].y),
                proposal: ProposedViewSize(result.sizes[index])
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (origins: [CGPoint], sizes: [CGSize], container: CGSize) {
        let maxWidth = wrappingWidth(from: proposal)
        var origins: [CGPoint] = []
        var sizes: [CGSize] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            sizes.append(size)
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        let height = subviews.isEmpty ? 0 : y + rowHeight
        return (origins, sizes, CGSize(width: maxWidth, height: height))
    }

    private func wrappingWidth(from proposal: ProposedViewSize) -> CGFloat {
        if let width = proposal.width, width.isFinite, width > 32, width < 4000 {
            return width
        }
        return 600
    }
}
