import Foundation
import ApplicationServices
import AppKit
import IOKit.pwr_mgt

class WindowMonitor {
    private var timer: Timer?
    private let workQueue = DispatchQueue(label: "com.yourtime.monitor")
    private var isProcessing = false
    private var lastWindowInfo: String = ""
    private var currentDateString: String = ""
    private var csvFilePath: String = ""
    private var lastIdleTime: TimeInterval = 0
    private let idleThreshold: TimeInterval = 60
    private var lastCSVLine: String = ""
    private var fileHandle: FileHandle?
    private let isVerbose = true
    
    init() {
        updateCSVFilePathAndHandle()
    }
    
    private func logConsole(_ message: String) {
        if isVerbose {
            Swift.print(message)
        }
    }
    
    private func updateCSVFilePathAndHandle() {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let newDateString = dateFormatter.string(from: Date())
        
        if newDateString == currentDateString && fileHandle != nil {
            return
        }
        
        currentDateString = newDateString
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let folderPath = homeDir.appendingPathComponent(".yourtime/data")
        
        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: folderPath.path) {
            try? fileManager.createDirectory(at: folderPath, withIntermediateDirectories: true, attributes: nil)
        }
        
        csvFilePath = folderPath.appendingPathComponent("\(currentDateString).csv").path
        
        fileHandle?.closeFile()
        
        if !fileManager.fileExists(atPath: csvFilePath) {
            let header = "timestamp,app_name,details,extra_details\n"
            do {
                try header.write(toFile: csvFilePath, atomically: true, encoding: .utf8)
                logConsole("📄 CSV created: \(csvFilePath)")
            } catch {
                logConsole("⚠️  Error: \(error)")
            }
        } else {
            logConsole("📄 Using existing file: \(csvFilePath)")
        }
        
        // Open file handle for continuous writing to avoid repetitive open/close disk I/O
        fileHandle = FileHandle(forWritingAtPath: csvFilePath)
        fileHandle?.seekToEndOfFile()
    }
    

    
    func startMonitoring() {
        setupSystemEventObservers()
        
        logConsole("🚀 Monitoring active...")
        
        // Timer for checking title changes within the same app and idle state.
        // Increased interval to 3 seconds for better performance.
        timer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            guard let self = self, !self.isProcessing else { return }
            self.isProcessing = true
            self.workQueue.async {
                defer { self.isProcessing = false }
                self.checkActiveWindow()
                self.checkIdleState()
            }
        }
    }
    
    func hasAccessibilityPermissions() -> Bool {
        return AXIsProcessTrusted()
    }
    
    func requestAccessibilityPermissions() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }
    
    private func setupSystemEventObservers() {
        let workspace = NSWorkspace.shared
        let notificationCenter = workspace.notificationCenter
        
        // Listen for application activation to instantly record the new app.
        notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            // When an app activates, trigger a check immediately on the workQueue
            self?.workQueue.async {
                self?.checkActiveWindow()
            }
        }
        
        notificationCenter.addObserver(
            forName: NSWorkspace.willSleepNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "SLEEP", details: "Computer going to sleep")
        }
        
        notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "WAKE", details: "Computer woke up")
        }
        
        notificationCenter.addObserver(
            forName: NSWorkspace.screensDidSleepNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "SCREEN_SLEEP", details: "Screen turned off")
        }
        
        notificationCenter.addObserver(
            forName: NSWorkspace.screensDidWakeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "SCREEN_WAKE", details: "Screen turned on")
        }
        
        let distNotificationCenter = DistributedNotificationCenter.default()
        
        distNotificationCenter.addObserver(
            forName: NSNotification.Name("com.apple.screensaver.didstart"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "SCREENSAVER_START", details: "Screensaver started")
        }
        
        distNotificationCenter.addObserver(
            forName: NSNotification.Name("com.apple.screensaver.didstop"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logSystemEvent(event: "SCREENSAVER_STOP", details: "Screensaver stopped")
        }
    }
    

    private func getActiveApplicationPID() -> pid_t? {
        guard let activeApp = NSWorkspace.shared.frontmostApplication else {
            return nil
        }
        
        return activeApp.processIdentifier
    }
    
    private func getAppAndWindowInfo(for pid: pid_t) -> (appName: String, windowTitle: String) {
        let app = AXUIElementCreateApplication(pid)
        
        // App Name
        var appNameRef: CFTypeRef?
        AXUIElementCopyAttributeValue(app, kAXTitleAttribute as CFString, &appNameRef)
        let appName = (appNameRef as? String) ?? "Unknown"
        
        // Window Title
        var windowTitle = "No Window"
        var focusedWindowRef: CFTypeRef?
        
        let result = AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &focusedWindowRef)
        
        if result == .success, let window = focusedWindowRef {
            var titleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &titleRef)
            windowTitle = (titleRef as? String) ?? "Untitled"
        }
        
        return (appName, windowTitle)
    }
    
    // Detect if a window is private/incognito using keywords in the window title
    private func isPrivateKeyword(_ text: String) -> Bool {
        let lower = text.lowercased()
        let keywords = [
            "incognito",
            "in incognito",
            "private",
            "privata",
            "navigazione privata",
            "navigazione in incognito",
            "anonima",
            "navigazione anonima",
            "private browsing",
            "private window"
        ]
        return keywords.contains { lower.contains($0) }
    }

    // For Chrome/Brave try to detect incognito via AppleScript window mode
    private func chromeLikeWindowIsIncognito(appName: String) -> Bool? {
        let targetApp = appName.contains("Brave") ? "Brave Browser" : "Google Chrome"
        let script = """
        tell application (\"\(targetApp)\")
            if (count of windows) > 0 then
                try
                    return mode of front window as string
                on error
                    return \"unknown\"
                end try
            else
                return \"unknown\"
            end if
        end tell
        """
        var error: NSDictionary?
        guard let appleScript = NSAppleScript(source: script) else {
            return nil
        }
        let output = appleScript.executeAndReturnError(&error)
        if error != nil { return nil }
        guard let resultString = output.stringValue?.lowercased() else { return nil }
        if resultString.contains("incognito") { return true }
        if resultString.contains("normal") { return false }
        return nil
    }
    
    private func checkActiveWindow() {
        guard let pid = getActiveApplicationPID() else {
            return
        }
        
        let info = getAppAndWindowInfo(for: pid)
        let appName = info.appName
        var windowTitle = info.windowTitle
        var extraDetails = ""
        
        // Detect Private/Incognito mode to avoid logging domain or page title
        var isPrivate = false
        if appName.contains("Chrome") || appName.contains("Brave") {
            if let incognito = chromeLikeWindowIsIncognito(appName: appName) {
                isPrivate = incognito
            } else {
                isPrivate = isPrivateKeyword(windowTitle)
            }
        } else if appName.contains("Safari") || appName.contains("Firefox") {
            isPrivate = isPrivateKeyword(windowTitle)
        }
        
        // Firefox exposes tab titles reliably via Accessibility API without AppleScript.
        // If private/incognito, skip URL and use a generic title.
        if appName.contains("Firefox") {
            if isPrivate {
                windowTitle = "Private/Incognito"
                extraDetails = ""
            } else if let url = getFirefoxURL(pid: pid) {
                extraDetails = url
            }
        } else if appName.contains("Chrome") || appName.contains("Safari") || appName.contains("Brave") {
            if isPrivate {
                windowTitle = "Private/Incognito"
                extraDetails = ""
            } else if let result = getBrowserTabTitle(appName: appName) {
                windowTitle = result.title
                if let urlString = result.url {
                    extraDetails = urlString
                }
            }
        }
        
        let currentInfo = "\(appName) - \(windowTitle) - \(extraDetails)"
        
        if currentInfo != lastWindowInfo {
            lastWindowInfo = currentInfo
            logWindowInfo(appName: appName, windowTitle: windowTitle, extraDetails: extraDetails)
        }
    }
    
    private func getBrowserTabTitle(appName: String) -> (title: String, url: String?)? {
        var script = ""
        
        if appName.contains("Chrome") || appName.contains("Brave") {
            let targetApp = appName.contains("Brave") ? "Brave Browser" : "Google Chrome"
            script = """
            tell application "\(targetApp)"
                if (count of windows) > 0 then
                    set activeTab to active tab of front window
                    return (URL of activeTab as string) & "|" & (title of activeTab as string)
                end if
            end tell
            """
        } else if appName.contains("Safari") {
            script = """
            tell application "Safari"
                if (count of windows) > 0 then
                    return (URL of front document as string) & "|" & (name of front document as string)
                end if
            end tell
            """
        } else {
            return nil
        }
        
        var error: NSDictionary?
        guard let appleScript = NSAppleScript(source: script) else {
            return nil
        }
        
        let output = appleScript.executeAndReturnError(&error)
        
        if error != nil {
            return nil
        }
        
        guard let resultString = output.stringValue else {
            return nil
        }
        
        let components = resultString.split(separator: "|", maxSplits: 1)
        if components.count == 2 {
            let urlString = String(components[0])
            let title = String(components[1])
            return (title, urlString)
        }
        
        return (resultString, nil)
    }
    
    /// Specifically for Firefox which doesn't support AppleScript for URL retrieval.
    /// We traverse the Accessibility tree to find the address bar.
    private func getFirefoxURL(pid: pid_t) -> String? {
        let appRef = AXUIElementCreateApplication(pid)
        
        // Firefox needs this to expose the full UI tree in some versions
        let enhancedAttr = "AXEnhancedUserInterface" as CFString
        AXUIElementSetAttributeValue(appRef, enhancedAttr, kCFBooleanTrue)
        
        var windowRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appRef, kAXFocusedWindowAttribute as CFString, &windowRef)
        
        if result == .success, let window = windowRef {
            return findURLInUIElement(window as! AXUIElement, depth: 0)
        }
        
        return nil
    }
    
    private func findURLInUIElement(_ element: AXUIElement, depth: Int) -> String? {
        // Limit depth to avoid performance issues with Firefox's massive UI tree
        if depth > 20 { return nil }
        
        var value: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value) == .success,
           let urlString = value as? String,
           urlString.starts(with: "http") {
            return urlString
        }
        
        var children: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children) == .success,
           let childrenArray = children as? [AXUIElement] {
            for child in childrenArray {
                if let found = findURLInUIElement(child, depth: depth + 1) {
                    return found
                }
            }
        }
        
        return nil
    }
    
    private func escapeCSV(_ text: String) -> String {
        if text.contains(",") || text.contains("\"") || text.contains("\n") {
            return "\"\(text.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return text
    }
    
    private func writeToCSV(timestamp: String, appName: String, details: String, extraDetails: String = "") {
        updateCSVFilePathAndHandle()
        let line = "\(escapeCSV(timestamp)),\(escapeCSV(appName)),\(escapeCSV(details)),\(escapeCSV(extraDetails))\n"
        
        if line == lastCSVLine {
            return
        }
        
        if let data = line.data(using: .utf8) {
            fileHandle?.write(data)
            lastCSVLine = line
        }
    }
    
    private func getIdleTime() -> TimeInterval {
        var iterator: io_iterator_t = 0
        defer { IOObjectRelease(iterator) }
        
        let result = IOServiceGetMatchingServices(
            kIOMainPortDefault,
            IOServiceMatching("IOHIDSystem"),
            &iterator
        )
        
        guard result == kIOReturnSuccess else {
            return 0
        }
        
        let entry = IOIteratorNext(iterator)
        defer { IOObjectRelease(entry) }
        
        guard entry != 0 else {
            return 0
        }
        
        var dict: Unmanaged<CFMutableDictionary>?
        let dictResult = IORegistryEntryCreateCFProperties(
            entry,
            &dict,
            kCFAllocatorDefault,
            0
        )
        
        guard dictResult == kIOReturnSuccess,
              let properties = dict?.takeRetainedValue() as? [String: Any],
              let hidIdleTime = properties["HIDIdleTime"] as? Int64 else {
            return 0
        }
        
        return TimeInterval(hidIdleTime) / TimeInterval(NSEC_PER_SEC)
    }
    
    private func checkIdleState() {
        return
//        let currentIdleTime = getIdleTime()
//
//        if currentIdleTime > idleThreshold && lastIdleTime <= idleThreshold {
//            logSystemEvent(event: "IDLE_START", details: "User became idle (no activity for \(Int(idleThreshold))s)")
//        } else if currentIdleTime <= idleThreshold && lastIdleTime > idleThreshold {
//            logSystemEvent(event: "IDLE_END", details: "User became active again")
//        }
//
//        lastIdleTime = currentIdleTime
    }
    
    private func logSystemEvent(event: String, details: String) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        
        writeToCSV(timestamp: timestamp, appName: "SYSTEM_EVENT:\(event)", details: details)
        
        logConsole("⚡️ [\(timestamp)] SYSTEM: \(event)  ℹ️  \(details)")
    }
    
    private func logWindowInfo(appName: String, windowTitle: String, extraDetails: String = "") {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        
        writeToCSV(timestamp: timestamp, appName: appName, details: windowTitle, extraDetails: extraDetails)
        
        if appName.contains("Chrome") || appName.contains("Safari") || appName.contains("Brave") || appName.contains("Firefox") {
            logConsole("🌐 [\(timestamp)] \(appName)")
            logConsole("   📑 Tab: \(windowTitle)")
            if !extraDetails.isEmpty {
                logConsole("   🔗 URL: \(extraDetails)")
            }
        } else {
            logConsole("🪟 [\(timestamp)] \(appName)")
            logConsole("   📄 Window: \(windowTitle)")
        }
        logConsole("-----------------------------------")
    }
    
    func stopMonitoring() {
        timer?.invalidate()
        timer = nil
        fileHandle?.closeFile()
        fileHandle = nil
        logConsole("⏹️  Monitoring stopped")
    }
    
    deinit {
        fileHandle?.closeFile()
    }
}

