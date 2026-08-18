import AppKit
import Combine
import SwiftUI
import WebKit

final class StratjiDashboardViewController: NSViewController {
    let session: StratjiSessionModel

    private let webHostView = NSView()
    private let glassOverlay = StratjiPassThroughOverlay()
    private var glassHosting: NSHostingView<StratjiWorkspaceGlassBar>?
    private var loadingHosting: NSHostingView<StratjiLoadingView>?
    private var offlineHosting: NSHostingView<StratjiOfflineView>?
    private var cancellables = Set<AnyCancellable>()
    private var didStartBootstrap = false
    private var didConfigure = false
    private var lastLoadedDestinationID: String?
    private var didPersistApplePermissions = false
    private var mouseMonitor: Any?
    private var hideGlassWorkItem: DispatchWorkItem?
    private var isGlassRevealed = false
    private var isPointerInRevealStrip = false
    private var isPointerInsideGlassBar = false
    private var isInteractingWithGlass = false

    init(session: StratjiSessionModel) {
        self.session = session
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        if let mouseMonitor {
            NSEvent.removeMonitor(mouseMonitor)
        }
    }

    override func loadView() {
        let root = StratjiDashboardRootView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor
        root.onPointerLocationChange = { [weak self] location in
            self?.handlePointerLocation(location)
        }
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureIfNeeded()
        bindSession()
        updateOverlays()
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.acceptsMouseMovedEvents = true
        installMouseMonitorIfNeeded()
        installWebView()
        startBootstrapIfNeeded()
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        session.document.webView.frame = webHost.bounds
    }

    func reloadDashboard() {
        Task { await session.reload() }
    }

    func showWorkspace(_ workspace: StratjiWorkspace) {
        session.select(workspace.defaultDestination)
    }

    private var webHost: NSView { webHostView }

    private func configureIfNeeded() {
        guard !didConfigure else { return }
        didConfigure = true

        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.black.cgColor

        webHostView.wantsLayer = true
        webHostView.layer?.backgroundColor = NSColor.black.cgColor
        webHostView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webHostView)

        glassOverlay.wantsLayer = true
        glassOverlay.layer?.isOpaque = false
        glassOverlay.layer?.backgroundColor = NSColor.clear.cgColor
        glassOverlay.layer?.masksToBounds = false
        glassOverlay.translatesAutoresizingMaskIntoConstraints = false
        glassOverlay.ignoresHits = true
        view.addSubview(glassOverlay)

        let glass = NSHostingView(rootView: StratjiWorkspaceGlassBar(
            session: session,
            onPointerInsideChange: { [weak self] inside in
                guard let self, inside else { return }
                self.isPointerInsideGlassBar = true
                self.cancelScheduledHide()
                self.updateGlassReveal()
            }
        ))
        glass.wantsLayer = true
        glass.layer?.isOpaque = false
        glass.layer?.backgroundColor = NSColor.clear.cgColor
        glass.layer?.masksToBounds = false
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.alphaValue = 0
        glassOverlay.addSubview(glass)
        glassHosting = glass

        NSLayoutConstraint.activate([
            webHostView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webHostView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webHostView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webHostView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            glassOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            glassOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            glassOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            glassOverlay.heightAnchor.constraint(equalToConstant: StratjiWorkspaceChromeMetrics.barHostHeight),
            glass.leadingAnchor.constraint(equalTo: glassOverlay.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: glassOverlay.trailingAnchor),
            glass.topAnchor.constraint(equalTo: glassOverlay.topAnchor),
            glass.bottomAnchor.constraint(equalTo: glassOverlay.bottomAnchor),
        ])

        let loading = NSHostingView(rootView: StratjiLoadingView(session: session))
        loading.translatesAutoresizingMaskIntoConstraints = false
        loadingHosting = loading
        view.addSubview(loading)

        let offline = NSHostingView(rootView: StratjiOfflineView(session: session))
        offline.translatesAutoresizingMaskIntoConstraints = false
        offline.isHidden = true
        offlineHosting = offline
        view.addSubview(offline)

        NSLayoutConstraint.activate([
            loading.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loading.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loading.topAnchor.constraint(equalTo: view.topAnchor),
            loading.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offline.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offline.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offline.topAnchor.constraint(equalTo: view.topAnchor),
            offline.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func bindSession() {
        session.$isBootstrapping
            .combineLatest(session.$serviceFailed, session.$stage)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _, _, _ in
                self?.updateOverlays()
                self?.loadDestinationIfReady()
                self?.presentApplePermissionsIfNeeded()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .stratjiConnectAppleSource)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self else { return }
                let raw = (notification.object as? String)
                    ?? (notification.userInfo?["source"] as? String)
                guard let raw, let source = StratjiAppleSource(rawValue: raw) else { return }
                Task { await StratjiApplePermissionActions.connect(source, session: self.session) }
            }
            .store(in: &cancellables)

        session.document.$currentDestinationID
            .receive(on: DispatchQueue.main)
            .sink { [weak self] destinationID in
                guard let self else { return }
                self.lastLoadedDestinationID = destinationID
                if self.session.destinationID != destinationID {
                    self.session.destinationID = destinationID
                }
                if let destination = DashboardOutline.destination(id: destinationID),
                   let workspace = StratjiWorkspace(rawValue: destination.view),
                   self.session.workspace != workspace {
                    self.session.workspace = workspace
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .stratjiAppearanceDidChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.applyNativeAppearance()
            }
            .store(in: &cancellables)

        applyNativeAppearance()
    }

    private func applyNativeAppearance() {
        let dark = StratjiAppearanceStore.current.prefersDarkChrome
        let fill = dark
            ? NSColor.black
            : NSColor(calibratedRed: 0.98, green: 0.97, blue: 0.95, alpha: 1)
        view.layer?.backgroundColor = fill.cgColor
        webHostView.layer?.backgroundColor = fill.cgColor
        view.window?.appearance = StratjiAppearanceStore.current.nsAppearance
    }

    private func startBootstrapIfNeeded() {
        guard !didStartBootstrap else { return }
        didStartBootstrap = true
        Task { await session.bootstrap() }
    }

    private func updateOverlays() {
        let loading = session.isBootstrapping
        let failed = session.serviceFailed && !loading
        loadingHosting?.isHidden = !loading
        offlineHosting?.isHidden = !failed
        if !loading && !failed {
            installWebView()
        }
    }

    private func loadDestinationIfReady(force: Bool = false) {
        guard !session.serviceFailed else { return }
        if session.isBootstrapping {
            if session.stage == .hydrate {
                installWebView()
            }
            return
        }
        let destination = session.currentDestination
        if !force, lastLoadedDestinationID == destination.id, session.document.webView.url != nil { return }
        lastLoadedDestinationID = destination.id
        installWebView()
        session.document.load(baseURL: session.baseURL, destination: destination, force: force)
    }

    private func presentApplePermissionsIfNeeded() {
        guard !session.isBootstrapping, !session.serviceFailed else { return }
        if !didPersistApplePermissions {
            didPersistApplePermissions = true
            Task { await StratjiApplePermissionActions.persist(session: session) }
        }
        StratjiPermissionsOnboardingPresenter.presentIfNeeded(session: session, on: view.window)
    }

    private func installWebView() {
        let webView = session.document.webView
        if webView.superview !== webHost {
            webView.removeFromSuperview()
            webHost.addSubview(webView)
        }
        webView.autoresizingMask = [.width, .height]
        webView.translatesAutoresizingMaskIntoConstraints = true
        webView.frame = webHost.bounds
    }

    private func installMouseMonitorIfNeeded() {
        guard mouseMonitor == nil else { return }
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDown, .leftMouseUp]) { [weak self] event in
            self?.handleChromePointerEvent(event)
            return event
        }
    }

    private func handleChromePointerEvent(_ event: NSEvent) {
        guard event.window == view.window else { return }
        let location = view.convert(event.locationInWindow, from: nil)
        switch event.type {
        case .leftMouseDown:
            if isGlassRevealed, glassOverlay.frame.contains(location) {
                isInteractingWithGlass = true
                cancelScheduledHide()
            }
            handlePointerLocation(location)
        case .leftMouseUp:
            isInteractingWithGlass = false
            handlePointerLocation(location)
        default:
            handlePointerLocation(location)
        }
    }

    private func handlePointerLocation(_ locationInView: NSPoint?) {
        guard let locationInView, view.bounds.contains(locationInView) else {
            isPointerInRevealStrip = false
            if !isInteractingWithGlass {
                isPointerInsideGlassBar = false
            }
            updateGlassReveal()
            return
        }

        let contentTop = view.bounds.maxY - view.safeAreaInsets.top
        let stripMinY = contentTop - StratjiWorkspaceChromeMetrics.hoverRevealStripHeight
        isPointerInRevealStrip = locationInView.y >= stripMinY && locationInView.y <= contentTop + 1
        if isGlassRevealed {
            isPointerInsideGlassBar = glassOverlay.frame.contains(locationInView)
        }
        updateGlassReveal()
    }

    private func updateGlassReveal() {
        let shouldShow = isPointerInRevealStrip || isPointerInsideGlassBar || isInteractingWithGlass
        if shouldShow {
            cancelScheduledHide()
            revealGlass()
            return
        }
        scheduleHide()
    }

    private func revealGlass() {
        guard !isGlassRevealed else { return }
        isGlassRevealed = true
        glassOverlay.ignoresHits = false
        glassHosting?.alphaValue = 0
        NSAnimationContext.runAnimationGroup { context in
            context.duration = StratjiWorkspaceChromeMetrics.revealAnimationDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            glassHosting?.animator().alphaValue = 1
        }
    }

    private func scheduleHide() {
        guard isGlassRevealed, hideGlassWorkItem == nil else { return }
        let work = DispatchWorkItem { [weak self] in
            self?.hideGlass()
        }
        hideGlassWorkItem = work
        DispatchQueue.main.asyncAfter(
            deadline: .now() + StratjiWorkspaceChromeMetrics.hideDelay,
            execute: work
        )
    }

    private func cancelScheduledHide() {
        hideGlassWorkItem?.cancel()
        hideGlassWorkItem = nil
    }

    private func hideGlass() {
        hideGlassWorkItem = nil
        guard isGlassRevealed else { return }
        guard !isPointerInRevealStrip, !isPointerInsideGlassBar, !isInteractingWithGlass else { return }
        isGlassRevealed = false
        NSAnimationContext.runAnimationGroup { [weak self] context in
            context.duration = StratjiWorkspaceChromeMetrics.revealAnimationDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self?.glassHosting?.animator().alphaValue = 0
        } completionHandler: { [weak self] in
            guard let self else { return }
            if !self.isGlassRevealed {
                self.glassOverlay.ignoresHits = true
                self.isPointerInsideGlassBar = false
            }
        }
    }
}

/// Overlay host that lets WKWebView receive clicks while the workspace bar is hidden.
final class StratjiPassThroughOverlay: NSView {
    var ignoresHits = true

    override func hitTest(_ point: NSPoint) -> NSView? {
        ignoresHits ? nil : super.hitTest(point)
    }
}

private final class StratjiDashboardRootView: NSView {
    var onPointerLocationChange: ((NSPoint?) -> Void)?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .mouseMoved, .activeInKeyWindow, .inVisibleRect],
            owner: self,
            userInfo: nil
        ))
    }

    override func mouseMoved(with event: NSEvent) {
        onPointerLocationChange?(convert(event.locationInWindow, from: nil))
    }

    override func mouseEntered(with event: NSEvent) {
        onPointerLocationChange?(convert(event.locationInWindow, from: nil))
    }

    override func mouseExited(with event: NSEvent) {
        onPointerLocationChange?(nil)
    }
}
