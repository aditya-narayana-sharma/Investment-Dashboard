import Combine
import Foundation
import SwiftUI

@MainActor
final class NativeActionBoardModel: ObservableObject {
    @Published private var completedByWorkspace: [String: NativeActionBoardState] = [:]

    init() {
        restore()
    }

    func completedIDs(for workspace: DashboardWorkspace) -> Set<String> {
        let today = Self.localDateKey()
        guard let current = completedByWorkspace[workspace.rawValue], current.date == today else {
            return []
        }
        return Set(current.completed)
    }

    func isCompleted(_ id: String, workspace: DashboardWorkspace) -> Bool {
        completedIDs(for: workspace).contains(id)
    }

    func toggle(_ id: String, workspace: DashboardWorkspace) {
        let today = Self.localDateKey()
        var state = completedByWorkspace[workspace.rawValue]
        if state == nil || state?.date != today {
            state = NativeActionBoardState(date: today, completed: [])
        }
        guard var next = state else { return }
        if next.completed.contains(id) {
            next.completed.removeAll { $0 == id }
        } else {
            next.completed.append(id)
        }
        next.date = today
        completedByWorkspace[workspace.rawValue] = next
        persist()
    }

    func items(for workspace: DashboardWorkspace, lane: NativeActionLane, completedLane: Bool) -> [NativeActionItem] {
        let catalog = NativeActionCatalog.items(for: workspace)
        let completed = completedIDs(for: workspace)
        if completedLane {
            return catalog.filter { completed.contains($0.id) }
        }
        return catalog.filter { $0.lane == lane && !completed.contains($0.id) }
    }

    func resetExpiredLanes() {
        let today = Self.localDateKey()
        var changed = false
        for (key, state) in completedByWorkspace where state.date != today {
            completedByWorkspace[key] = NativeActionBoardState(date: today, completed: [])
            changed = true
        }
        if changed { persist() }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(completedByWorkspace) else { return }
        UserDefaults.standard.set(data, forKey: PortfolioDashboardConfiguration.actionBoardDefaultsKey)
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: PortfolioDashboardConfiguration.actionBoardDefaultsKey),
              let decoded = try? JSONDecoder().decode([String: NativeActionBoardState].self, from: data) else {
            return
        }
        completedByWorkspace = decoded
    }

    static func localDateKey(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

private struct NativeActionBoardState: Codable, Equatable {
    var date: String
    var completed: [String]
}

struct NativeActionBoard: View {
    let workspace: DashboardWorkspace
    @ObservedObject var model: NativeActionBoardModel

    private var items: [NativeActionItem] { NativeActionCatalog.items(for: workspace) }
    private var completedCount: Int { model.completedIDs(for: workspace).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Daily action board")
                        .font(.headline)
                    Text("\(max(items.count - completedCount, 0)) active · \(completedCount) completed · resets at local midnight")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(NativeActionBoardModel.localDateKey())
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }

            HStack(alignment: .top, spacing: 8) {
                lane("To Do Today", items: model.items(for: workspace, lane: .today, completedLane: false))
                lane("Monitor", items: model.items(for: workspace, lane: .monitor, completedLane: false))
                lane("Completed Today", items: model.items(for: workspace, lane: .today, completedLane: true), completedLane: true)
            }
        }
        .padding(12)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Daily action board")
        .onAppear { model.resetExpiredLanes() }
    }

    private func lane(_ title: String, items: [NativeActionItem], completedLane: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.bold())
                Spacer()
                Text("\(items.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            if items.isEmpty {
                Text("Empty")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 64, alignment: .center)
                    .background(Color.primary.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                ForEach(items) { item in
                    Button {
                        model.toggle(item.id, workspace: workspace)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title)
                                .font(.caption.bold())
                                .strikethrough(completedLane)
                                .multilineTextAlignment(.leading)
                            if !completedLane {
                                Text(item.detail)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.leading)
                                Text(item.numericAdvantage)
                                    .font(.caption2.bold())
                                Text(item.strategicAdvantage)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(item.tone.color.opacity(completedLane ? 0.08 : 0.16))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(completedLane ? "Mark incomplete" : "Mark complete"): \(item.title). \(item.detail) \(item.numericAdvantage). \(item.strategicAdvantage)")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
    }
}
