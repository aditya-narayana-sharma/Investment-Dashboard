import AppKit
import SwiftUI

@main
enum StratjiMain {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = StratjiAppDelegate()
        StratjiAppDelegate.retained = delegate
        app.delegate = delegate
        StratjiMenuBuilder.install(on: app)
        app.activate(ignoringOtherApps: true)
        app.run()
    }
}

final class StratjiAppDelegate: NSObject, NSApplicationDelegate {
    static var retained: StratjiAppDelegate?
    private var windowController: StratjiWindowController?
    private var loginWindow: NSWindow?
    private var settingsWindow: NSWindow?
    private var inspectorWindow: NSWindow?
    private var session: StratjiSessionModel?
    private let auth = AuthenticationService()
    private var isStoppingDataPlane = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        StratjiConfiguration.persistRepoRoot()
        Task(priority: .userInitiated) {
            await FlaskServiceSupervisor.kickoffAtLaunch()
            await MainActor.run {
                self.finishLaunchingOnMain()
            }
        }
    }

    @MainActor
    private func finishLaunchingOnMain() {
        StratjiLicenseStore.ensureAuthorLicense()
        applyAuthMenuVisibility()
        if auth.isAuthenticated {
            presentDashboard()
        } else {
            presentUnlock()
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    @MainActor
    private func applyAuthMenuVisibility() {
        guard let appMenu = NSApp.mainMenu?.items.first?.submenu else { return }
        for item in appMenu.items where item.tag == StratjiMenuBuilder.logOutItemTag
            || item.tag == StratjiMenuBuilder.logOutSeparatorTag {
            item.isHidden = false
            if item.tag == StratjiMenuBuilder.logOutItemTag {
                item.title = "Lock"
            }
        }
    }

    @MainActor
    private func presentUnlock() {
        let hosting = NSHostingController(rootView: MacUnlockView(auth: auth) { [weak self] in
            Task { @MainActor in
                self?.presentDashboard()
            }
        })
        let window = NSWindow(contentViewController: hosting)
        window.title = "Stratji"
        window.styleMask = [.titled, .closable, .miniaturizable]
        window.setContentSize(NSSize(width: 560, height: 640))
        window.center()
        window.isReleasedWhenClosed = false
        loginWindow = window
        window.makeKeyAndOrderFront(nil)
        windowController?.close()
        windowController = nil
        session = nil
        settingsWindow?.close()
        inspectorWindow?.close()
    }

    @MainActor
    private func presentDashboard() {
        let existingLogin = loginWindow
        loginWindow = nil
        guard windowController == nil else {
            existingLogin?.close()
            windowController?.showWindow(nil)
            return
        }
        let session = StratjiSessionModel(baseURL: StratjiConfiguration.dashboardURL)
        session.startDataPlane = { [session] recycle in
            await FlaskServiceSupervisor.ensureRunning(recycle: recycle) {
                session.noteLogTick()
            }
        }
        session.logProvider = {
            FlaskServiceSupervisor.logExcerpt()
        }
        self.session = session
        let controller = StratjiWindowController(session: session)
        controller.showWindow(nil)
        windowController = controller
        existingLogin?.close()
        Task {
            await self.auth.establishWebSession(baseURL: StratjiConfiguration.dashboardURL)
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        Task { @MainActor in
            // Incremental ticks after splash (gated by startupRefreshCompleted); do not run another complete audit on focus.
            await self.session?.refreshOnForeground()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if isStoppingDataPlane {
            return .terminateNow
        }
        isStoppingDataPlane = true
        Task.detached(priority: .userInitiated) {
            FlaskServiceSupervisor.stopDataPlane()
            await MainActor.run {
                NSApp.reply(toApplicationShouldTerminate: true)
            }
        }
        return .terminateLater
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            if auth.isAuthenticated {
                windowController?.showWindow(nil)
            } else {
                loginWindow?.makeKeyAndOrderFront(nil)
            }
        }
        return true
    }

    @objc func reloadDashboard(_ sender: Any?) {
        Task { @MainActor in
            await self.session?.reload(keepDocument: true)
        }
    }

    @objc func showSettings(_ sender: Any?) {
        guard let session else { return }
        if settingsWindow == nil {
            let hosting = NSHostingController(rootView: StratjiSettingsView(session: session))
            let window = NSWindow(contentViewController: hosting)
            window.title = "Settings"
            window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
            window.setContentSize(NSSize(width: 720, height: 820))
            window.center()
            window.isReleasedWhenClosed = false
            settingsWindow = window
        }
        settingsWindow?.makeKeyAndOrderFront(sender)
        Task { @MainActor in
            StratjiPermissionsOnboardingPresenter.presentIfNeeded(session: session, on: self.settingsWindow)
        }
    }

    @objc func inspectDataPlane(_ sender: Any?) {
        if inspectorWindow == nil {
            let hosting = NSHostingController(rootView: StratjiInspectorView(url: StratjiConfiguration.dashboardURL))
            let window = NSWindow(contentViewController: hosting)
            window.title = "Inspect Data Plane"
            window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
            window.setContentSize(NSSize(width: 1100, height: 740))
            window.center()
            window.isReleasedWhenClosed = false
            inspectorWindow = window
        }
        inspectorWindow?.makeKeyAndOrderFront(sender)
    }

    @objc func showWorkspace(_ sender: Any?) {
        guard let item = sender as? NSMenuItem,
              let raw = item.representedObject as? String,
              let workspace = StratjiWorkspace(rawValue: raw) else {
            return
        }
        windowController?.dashboardController?.showWorkspace(workspace)
        windowController?.showWindow(nil)
    }

    @objc func lockSession(_ sender: Any?) {
        Task { @MainActor in
            await self.auth.logout()
            self.settingsWindow?.close()
            self.inspectorWindow?.close()
            self.presentUnlock()
        }
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(lockSession(_:)) {
            menuItem.title = "Lock"
            menuItem.isHidden = false
            return auth.isAuthenticated
        }
        if menuItem.action == #selector(reloadDashboard(_:))
            || menuItem.action == #selector(showSettings(_:))
            || menuItem.action == #selector(inspectDataPlane(_:))
            || menuItem.action == #selector(showWorkspace(_:)) {
            return auth.isAuthenticated
        }
        return true
    }
}
