import AppKit
import Combine
import SwiftUI
import WebKit

final class StratjiDashboardViewController: NSViewController {
    let session: StratjiSessionModel

    private let webHostView = NSView()
    private var glassHosting: NSHostingView<StratjiWorkspaceGlassBar>?
    private var loadingHosting: NSHostingView<StratjiLoadingView>?
    private var offlineHosting: NSHostingView<StratjiOfflineView>?
    private var cancellables = Set<AnyCancellable>()
    private var didStartBootstrap = false
    private var didConfigure = false
    private var lastLoadedDestinationID: String?
    private var didPersistApplePermissions = false

    init(session: StratjiSessionModel) {
        self.session = session
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor
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

        let glass = NSHostingView(rootView: StratjiWorkspaceGlassBar(session: session))
        glass.wantsLayer = true
        glass.layer?.isOpaque = false
        glass.layer?.backgroundColor = NSColor.clear.cgColor
        glass.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(glass)
        glassHosting = glass

        NSLayoutConstraint.activate([
            webHostView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webHostView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webHostView.topAnchor.constraint(equalTo: glass.bottomAnchor),
            webHostView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            glass.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            glass.topAnchor.constraint(equalTo: view.topAnchor),
            glass.heightAnchor.constraint(equalToConstant: StratjiWorkspaceChromeMetrics.barHostHeight),
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
}
