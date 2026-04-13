#!/usr/bin/env swift
import AppKit
import Foundation

enum Platform: String {
  case macos
  case windows
}

struct Style {
  let subjectScale: CGFloat
  let subjectXOffset: CGFloat
  let subjectYOffset: CGFloat
  let clipInset: CGFloat
  let clipRadius: CGFloat
}

func makeStyle(for platform: Platform) -> Style {
  switch platform {
  case .macos:
    return Style(
      subjectScale: 1.18,
      subjectXOffset: 0,
      subjectYOffset: 4,
      clipInset: 18,
      clipRadius: 220
    )
  case .windows:
    return Style(
      subjectScale: 1.12,
      subjectXOffset: 0,
      subjectYOffset: 0,
      clipInset: 24,
      clipRadius: 200
    )
  }
}

if CommandLine.arguments.count != 4 {
  fputs("usage: generate-platform-desktop-icon.swift <input> <macos|windows> <output>\n", stderr)
  exit(1)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
guard let platform = Platform(rawValue: CommandLine.arguments[2]) else {
  fputs("platform must be macos or windows\n", stderr)
  exit(1)
}
let output = URL(fileURLWithPath: CommandLine.arguments[3])

guard let subject = NSImage(contentsOf: input) else {
  fputs("failed to load input image: \(input.path)\n", stderr)
  exit(1)
}

let iconStyle = makeStyle(for: platform)
let canvasSize: CGFloat = 1024
let size = Int(canvasSize)

guard
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  )
else {
  fputs("failed to allocate output bitmap\n", stderr)
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("failed to create graphics context\n", stderr)
  exit(1)
}
NSGraphicsContext.current = context

let canvasRect = NSRect(x: 0, y: 0, width: canvasSize, height: canvasSize)
NSColor.clear.setFill()
NSBezierPath(rect: canvasRect).fill()

let clipRect = canvasRect.insetBy(dx: iconStyle.clipInset, dy: iconStyle.clipInset)
let clipPath = NSBezierPath(
  roundedRect: clipRect,
  xRadius: iconStyle.clipRadius,
  yRadius: iconStyle.clipRadius
)
clipPath.addClip()

let subjectWidth = canvasSize * iconStyle.subjectScale
let sourceSize = subject.size
let aspect = max(sourceSize.width, 1) / max(sourceSize.height, 1)
let subjectHeight = subjectWidth / aspect
let subjectRect = NSRect(
  x: canvasRect.midX - subjectWidth / 2 + iconStyle.subjectXOffset,
  y: canvasRect.midY - subjectHeight / 2 + iconStyle.subjectYOffset,
  width: subjectWidth,
  height: subjectHeight
)

subject.draw(
  in: subjectRect,
  from: .zero,
  operation: .sourceOver,
  fraction: 1.0
)

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
  fputs("failed to encode png\n", stderr)
  exit(1)
}

try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
try png.write(to: output)
