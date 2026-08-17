import AppKit

final class StratjiWindowController: NSWindowController, NSWindowDelegate {
    let session: StratjiSessionModel

    init(session: StratjiSessionModel) {
        self.session = session
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1360, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Stratji"
        window.minSize = NSSize(width: 1180, height: 720)
        window.appearance = NSAppearance(named: .darkAqua)
        window.titlebarAppearsTransparent = false
        window.setFrameAutosaveName("StratjiMainWindow.v7")
        window.center()
        window.isReleasedWhenClosed = false
        super.init(window: window)
        window.delegate = self
        contentViewController = StratjiDashboardViewController(session: session)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    var dashboardController: StratjiDashboardViewController? {
        contentViewController as? StratjiDashboardViewController
    }

    func windowDidBecomeKey(_ notification: Notification) {
        Task { await session.refreshIfStale() }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        true
    }
}
