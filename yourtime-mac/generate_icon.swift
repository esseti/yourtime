import Cocoa

func generateAppIcon(at path: String) {
    let size = NSSize(width: 1024, height: 1024)
    let image = NSImage(size: size)
    
    image.lockFocus()
    
    // 1. Background (macOS squircle shape)
    let backgroundPath = NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: 1024, height: 1024), xRadius: 225, yRadius: 225)
    
    // Draw gradient
    if let gradient = NSGradient(starting: NSColor(red: 0.15, green: 0.18, blue: 0.25, alpha: 1.0),
                                 ending: NSColor(red: 0.05, green: 0.07, blue: 0.12, alpha: 1.0)) {
        gradient.draw(in: backgroundPath, angle: -90)
    }
    
    // 2. Draw Window Outline
    let windowRect = NSRect(x: 162, y: 262, width: 700, height: 500)
    let windowPath = NSBezierPath(roundedRect: windowRect, xRadius: 20, yRadius: 20)
    windowPath.lineWidth = 16
    NSColor.white.setStroke()
    windowPath.stroke()
    
    // Window Title Bar
    let titleBarPath = NSBezierPath()
    titleBarPath.move(to: NSPoint(x: 162, y: 680))
    titleBarPath.line(to: NSPoint(x: 862, y: 680))
    titleBarPath.lineWidth = 16
    titleBarPath.stroke()
    
    // Window Buttons
    let colors: [NSColor] = [.systemRed, .systemYellow, .systemGreen]
    for (i, color) in colors.enumerated() {
        let buttonRect = NSRect(x: 192 + (i * 35), y: 705, width: 16, height: 16)
        let buttonPath = NSBezierPath(ovalIn: buttonRect)
        color.setFill()
        buttonPath.fill()
    }
    
    // 3. Draw ECG Waveform
    if let ecgSymbol = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: nil) {
        // Draw the symbol
        let ecgRect = NSRect(x: 212, y: 312, width: 600, height: 320)
        
        // Draw image, tinted with a nice vibrant tech green
        if let tintedImage = ecgSymbol.copy() as? NSImage {
            tintedImage.lockFocus()
            NSColor(red: 0.1, green: 0.85, blue: 0.55, alpha: 1.0).set()
            NSRect(origin: .zero, size: tintedImage.size).fill(using: .sourceAtop)
            tintedImage.unlockFocus()
            
            tintedImage.draw(in: ecgRect, from: .zero, operation: .sourceOver, fraction: 1.0)
        }
    }
    
    image.unlockFocus()
    
    guard let tiffData = image.tiffRepresentation,
          let bitmapImage = NSBitmapImageRep(data: tiffData),
          let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
        print("Failed to generate PNG data")
        return
    }
    
    do {
        try pngData.write(to: URL(fileURLWithPath: path))
        print("Successfully wrote icon to \(path)")
    } catch {
        print("Error writing file: \(error)")
    }
}

let args = CommandLine.arguments
if args.count > 1 {
    generateAppIcon(at: args[1])
} else {
    print("Please provide output path")
}
