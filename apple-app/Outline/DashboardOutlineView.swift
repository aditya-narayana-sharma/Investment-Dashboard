import SwiftUI

#if os(macOS)
import AppKit

/// Class-backed tree for NSOutlineView identity. `DashboardDestination` is a struct
/// and cannot be used as outline items without unstable boxing.
final class DashboardOutlineNode: NSObject {
    let destination: DashboardDestination
    let children: [DashboardOutlineNode]
    weak var parent: DashboardOutlineNode?

    init(_ destination: DashboardDestination) {
        self.destination = destination
        self.children = destination.children.map { DashboardOutlineNode($0) }
        super.init()
        children.forEach { $0.parent = self }
    }
}

enum DashboardOutlineTree {
    static let roots: [DashboardOutlineNode] = DashboardOutline.workspaces.map { DashboardOutlineNode($0) }

    static let lookup: [String: DashboardOutlineNode] = {
        var map: [String: DashboardOutlineNode] = [:]
        func walk(_ node: DashboardOutlineNode) {
            map[node.destination.id] = node
            node.children.forEach(walk)
        }
        roots.forEach(walk)
        return map
    }()
}

/// AppKit source list. Single-click on any parent or child row calls `onSelect`,
/// which the dashboard controller must turn into `webView.load(URLRequest:)`.
final class DashboardOutlineSidebarView: NSView, NSOutlineViewDataSource, NSOutlineViewDelegate {
    var onSelect: ((DashboardDestination) -> Void)?

    private var selectedID: String = DashboardOutline.defaultDestination.id
    private let scrollView = NSScrollView()
    private let outlineView = NSOutlineView()
    private var applyingSelection = false
    private var lastEmitID: String?
    private var lastEmitAt: TimeInterval = 0

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    override func layout() {
        super.layout()
        scrollView.frame = bounds
    }

    func setSelectedID(_ id: String) {
        selectedID = id
        applySelectionFromID()
    }

    private func setup() {
        wantsLayer = true
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("title"))
        column.resizingMask = .autoresizingMask
        outlineView.addTableColumn(column)
        outlineView.outlineTableColumn = column
        outlineView.headerView = nil
        outlineView.dataSource = self
        outlineView.delegate = self
        outlineView.style = .sourceList
        outlineView.selectionHighlightStyle = .sourceList
        outlineView.allowsMultipleSelection = false
        outlineView.allowsEmptySelection = false
        outlineView.rowHeight = 26
        outlineView.indentationPerLevel = 14
        outlineView.backgroundColor = .clear
        outlineView.focusRingType = .none
        outlineView.target = self
        outlineView.action = #selector(outlineClicked)

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.autoresizingMask = [.width, .height]
        scrollView.frame = bounds
        addSubview(scrollView)

        outlineView.reloadData()
        expandAll()
        applySelectionFromID()
    }

    @objc private func outlineClicked() {
        let row = outlineView.clickedRow
        guard row >= 0, let node = outlineView.item(atRow: row) as? DashboardOutlineNode else { return }
        emitSelection(node)
    }

    func outlineViewSelectionDidChange(_ notification: Notification) {
        guard !applyingSelection else { return }
        // Mouse clicks are handled by `action` so we do not double-load.
        // Keyboard (arrow keys) only change selection.
        if outlineView.clickedRow >= 0 { return }
        guard outlineView.selectedRow >= 0,
              let node = outlineView.item(atRow: outlineView.selectedRow) as? DashboardOutlineNode else { return }
        emitSelection(node)
    }

    private func emitSelection(_ node: DashboardOutlineNode) {
        let now = ProcessInfo.processInfo.systemUptime
        if lastEmitID == node.destination.id, now - lastEmitAt < 0.12 {
            return
        }
        lastEmitID = node.destination.id
        lastEmitAt = now
        selectedID = node.destination.id
        NSLog("[Stratji] outline select %@ → %@", node.destination.id, node.destination.view)
        onSelect?(node.destination)
    }

    private func expandAll() {
        for root in DashboardOutlineTree.roots {
            outlineView.expandItem(root, expandChildren: true)
        }
    }

    private func applySelectionFromID() {
        applyingSelection = true
        defer { applyingSelection = false }
        let targetID = DashboardOutline.destination(id: selectedID)?.clickTarget.id ?? selectedID
        guard let node = DashboardOutlineTree.lookup[targetID] ?? DashboardOutlineTree.lookup[selectedID] else { return }
        var ancestor: DashboardOutlineNode? = node.parent
        while let current = ancestor {
            outlineView.expandItem(current)
            ancestor = current.parent
        }
        let row = outlineView.row(forItem: node)
        guard row >= 0 else { return }
        outlineView.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        outlineView.scrollRowToVisible(row)
    }

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        if item == nil { return DashboardOutlineTree.roots.count }
        return (item as? DashboardOutlineNode)?.children.count ?? 0
    }

    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        if item == nil { return DashboardOutlineTree.roots[index] }
        return (item as? DashboardOutlineNode)?.children[index] ?? DashboardOutlineTree.roots[index]
    }

    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        ((item as? DashboardOutlineNode)?.children.isEmpty ?? true) == false
    }

    func outlineView(_ outlineView: NSOutlineView, shouldSelectItem item: Any) -> Bool {
        item is DashboardOutlineNode
    }

    func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? DashboardOutlineNode else { return nil }
        let identifier = NSUserInterfaceItemIdentifier("OutlineCell")
        let cell: NSTableCellView
        if let reused = outlineView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView {
            cell = reused
        } else {
            cell = makeCell(identifier: identifier)
        }
        cell.textField?.stringValue = node.destination.title
        if let symbol = node.destination.systemImage {
            cell.imageView?.image = NSImage(systemSymbolName: symbol, accessibilityDescription: node.destination.title)
        } else {
            cell.imageView?.image = NSImage(systemSymbolName: "circle", accessibilityDescription: node.destination.title)
        }
        if DashboardOutline.workspaces.contains(where: { $0.id == node.destination.id }) {
            cell.setAccessibilityIdentifier("workspace-tab-\(node.destination.view)")
        } else {
            cell.setAccessibilityIdentifier("outline-\(node.destination.id)")
        }
        return cell
    }

    private func makeCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier
        let image = NSImageView()
        image.translatesAutoresizingMaskIntoConstraints = false
        image.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 12, weight: .medium)
        let text = NSTextField(labelWithString: "")
        text.translatesAutoresizingMaskIntoConstraints = false
        text.lineBreakMode = .byTruncatingTail
        text.font = .systemFont(ofSize: 13)
        cell.addSubview(image)
        cell.addSubview(text)
        cell.imageView = image
        cell.textField = text
        NSLayoutConstraint.activate([
            image.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 2),
            image.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            image.widthAnchor.constraint(equalToConstant: 16),
            image.heightAnchor.constraint(equalToConstant: 16),
            text.leadingAnchor.constraint(equalTo: image.trailingAnchor, constant: 6),
            text.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -4),
            text.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])
        return cell
    }
}

struct DashboardOutlineSidebarRepresentable: NSViewRepresentable {
    var selectedID: String
    var onSelect: (DashboardDestination) -> Void

    func makeNSView(context: Context) -> DashboardOutlineSidebarView {
        let view = DashboardOutlineSidebarView(frame: .zero)
        view.onSelect = onSelect
        view.setSelectedID(selectedID)
        return view
    }

    func updateNSView(_ nsView: DashboardOutlineSidebarView, context: Context) {
        nsView.onSelect = onSelect
        nsView.setSelectedID(selectedID)
    }
}
#endif
