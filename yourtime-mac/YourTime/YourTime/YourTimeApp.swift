import SwiftUI
import ServiceManagement

@main
struct WindowMonitorApp: App {
    // Use only AppDelegate to manage the entire lifecycle
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // Settings is required for windowless apps, but no logic is needed here
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    var statusItem: NSStatusItem?
    // The ONLY instance of the monitor must be here
    let monitor = WindowMonitor()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Configure the icon in the Menu Bar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            button.image = createCompositeIcon()
            button.image?.isTemplate = true // Supports Dark/Light mode automatically
        }

        // 2. Configure the Menu
        setupMenu()

        // 3. Check for first run and show welcome message
        checkFirstRun()

        // 4. Start monitoring ONLY now that the app is ready
        // Use a small delay to avoid conflicts with the permission system at launch
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.monitor.startMonitoring()
        }
    }

    private func checkFirstRun() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let setupFile = homeDir.appendingPathComponent(".yourtime/setup_done")
        
        if !FileManager.default.fileExists(atPath: setupFile.path) {
            showWelcomeMessage()
            
            // Create the directory if it doesn't exist
            let yourtimeDir = homeDir.appendingPathComponent(".yourtime")
            if !FileManager.default.fileExists(atPath: yourtimeDir.path) {
                try? FileManager.default.createDirectory(at: yourtimeDir, withIntermediateDirectories: true)
            }
            
            // Create the setup_done file
            try? "done".write(to: setupFile, atomically: true, encoding: .utf8)
            
            // Register to launch at login
            if #available(macOS 13.0, *) {
                try? SMAppService.mainApp.register()
            }
            
            // Trigger accessibility permissions prompt after they clicked 'Got it'
            monitor.requestAccessibilityPermissions()
        }
    }
    
    private func showWelcomeMessage() {
        let alert = NSAlert()
        alert.messageText = "Welcome to YourTime!"
        alert.informativeText = "To function correctly, this app requires Accessibility permissions to track active windows.\n\nNote: The application is configured to automatically run at every login so you don't have to start it manually.\n\nClick 'Got it' below, and you will be prompted to grant Accessibility access in System Settings."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Got it")
        
        // Ensure alert is shown on top
        alert.runModal()
    }


    // Creates a custom icon by combining a "macwindow" and "waveform.path.ecg" (vitals-like)
    func createCompositeIcon() -> NSImage {
        // Standard menu bar icon size
        let size = NSSize(width: 22, height: 22)
        let compositeImage = NSImage(size: size)
        
        guard let windowImage = NSImage(systemSymbolName: "macwindow", accessibilityDescription: nil),
              let ecgImage = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: nil) else {
            // Fallback if symbols are missing
            return NSImage(systemSymbolName: "chart.bar.xaxis", accessibilityDescription: "YourTime")!
        }
        
        compositeImage.lockFocus()
        
        // Draw the window filling most of the space
        let windowRect = NSRect(x: 1, y: 2, width: 20, height: 16)
        windowImage.draw(in: windowRect)
        
        // Draw the "ECG waveform" inside the window area
        // We center it and make it slightly wider to show the waveform clearly
        let ecgRect = NSRect(x: 4, y: 5, width: 14, height: 10)
        
        ecgImage.draw(in: ecgRect, from: NSRect.zero, operation: .sourceOver, fraction: 1.0)
        
        compositeImage.unlockFocus()
        compositeImage.isTemplate = true
        
        return compositeImage
    }

    func setupMenu() {
        let menu = NSMenu()
        menu.delegate = self
        statusItem?.menu = menu
    }
    
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        
        if !monitor.hasAccessibilityPermissions() {
            let permItem = NSMenuItem(title: "⚠️ Accessibility permissions missing", action: #selector(requestPermissions), keyEquivalent: "")
            permItem.target = self
            menu.addItem(permItem)
            menu.addItem(NSMenuItem.separator())
        }
        
        menu.addItem(NSMenuItem(title: "Monitoring in progress...", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        
//        let openLogItem = NSMenuItem(title: "Open Log File (CSV)", action: #selector(openLog), keyEquivalent: "l")
//        openLogItem.target = self // Important for the selector to work
//        menu.addItem(openLogItem)
//        
        menu.addItem(NSMenuItem.separator())
        
        let quitItem = NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quitItem)
    }

    @objc func requestPermissions() {
        monitor.requestAccessibilityPermissions()
    }

    @objc func openLog() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let dataDir = homeDir.appendingPathComponent(".yourtime/data")
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: Date())
        let todayCSVPath = dataDir.appendingPathComponent("\(dateString).csv")
        
        if FileManager.default.fileExists(atPath: todayCSVPath.path) {
            NSWorkspace.shared.open(todayCSVPath)
        } else if FileManager.default.fileExists(atPath: dataDir.path) {
            NSWorkspace.shared.open(dataDir)
        } else {
            // If the folder doesn't exist yet, open the Home directory as fallback
            NSWorkspace.shared.open(homeDir)
        }
    }
}
