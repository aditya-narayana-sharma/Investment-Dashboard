import AppKit

enum StratjiMenuBuilder {
    static let logOutItemTag = 7101
    static let logOutSeparatorTag = 7102

    static func install(on app: NSApplication) {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Stratji", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let settingsItem = appMenu.addItem(withTitle: "Settings…", action: #selector(StratjiAppDelegate.showSettings(_:)), keyEquivalent: ",")
        settingsItem.target = nil
        appMenu.addItem(.separator())
        let logOutItem = appMenu.addItem(withTitle: "Lock", action: #selector(StratjiAppDelegate.lockSession(_:)), keyEquivalent: "")
        logOutItem.tag = logOutItemTag
        let logOutSeparator = NSMenuItem.separator()
        logOutSeparator.tag = logOutSeparatorTag
        appMenu.addItem(logOutSeparator)
        appMenu.addItem(withTitle: "Hide Stratji", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Stratji", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        for workspace in StratjiWorkspace.allCases {
            let item = viewMenu.addItem(withTitle: workspace.title, action: #selector(StratjiAppDelegate.showWorkspace(_:)), keyEquivalent: "")
            item.representedObject = workspace.rawValue
        }
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        let refreshMenuItem = NSMenuItem()
        let refreshMenu = NSMenu(title: "Refresh")
        let reloadItem = refreshMenu.addItem(withTitle: "Reload All", action: #selector(StratjiAppDelegate.reloadDashboard(_:)), keyEquivalent: "r")
        reloadItem.target = nil
        refreshMenu.addItem(.separator())
        refreshMenu.addItem(withTitle: "Inspect Data Plane", action: #selector(StratjiAppDelegate.inspectDataPlane(_:)), keyEquivalent: "")
        refreshMenuItem.submenu = refreshMenu
        mainMenu.addItem(refreshMenuItem)

        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        let helpMenuItem = NSMenuItem()
        let helpMenu = NSMenu(title: "Help")
        helpMenu.addItem(withTitle: "Stratji Help", action: #selector(NSApplication.showHelp(_:)), keyEquivalent: "?")
        helpMenuItem.submenu = helpMenu
        mainMenu.addItem(helpMenuItem)

        app.mainMenu = mainMenu
        app.windowsMenu = windowMenu
        app.helpMenu = helpMenu
    }
}
