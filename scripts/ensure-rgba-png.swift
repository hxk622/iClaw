#!/usr/bin/env swift
import AppKit
import Foundation

if CommandLine.arguments.count != 3 {
  fputs("usage: ensure-rgba-png.swift <input> <output>\n", stderr)
  exit(1)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])

guard let image = NSImage(contentsOf: input) else {
  fputs("failed to load image: \(input.path)\n", stderr)
  exit(1)
}

let width = max(Int(image.size.width.rounded()), 1)
let height = max(Int(image.size.height.rounded()), 1)

guard
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  )
else {
  fputs("failed to allocate RGBA bitmap: \(input.path)\n", stderr)
  exit(1)
}

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("failed to create graphics context: \(input.path)\n", stderr)
  exit(1)
}

NSGraphicsContext.current = context
NSColor.clear.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
image.draw(
  in: NSRect(x: 0, y: 0, width: width, height: height),
  from: .zero,
  operation: .sourceOver,
  fraction: 1.0
)
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("failed to encode RGBA png: \(input.path)\n", stderr)
  exit(1)
}

try png.write(to: output)
