#!/usr/bin/env python3
import struct
import sys
from pathlib import Path


def read_png_size(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a png: {path}")
    width = struct.unpack(">I", data[16:20])[0]
    height = struct.unpack(">I", data[20:24])[0]
    return width, height, data


def main():
    if len(sys.argv) < 3:
      raise SystemExit("usage: build-ico.py <output.ico> <image1.png> [image2.png ...]")

    output = Path(sys.argv[1])
    images = [Path(arg) for arg in sys.argv[2:]]
    payloads = []
    for image in images:
        width, height, data = read_png_size(image)
        payloads.append((width, height, data))

    header = struct.pack("<HHH", 0, 1, len(payloads))
    entries = []
    offset = 6 + 16 * len(payloads)

    for width, height, data in payloads:
        entry = struct.pack(
            "<BBBBHHII",
            0 if width >= 256 else width,
            0 if height >= 256 else height,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        entries.append(entry)
        offset += len(data)

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as handle:
        handle.write(header)
        for entry in entries:
            handle.write(entry)
        for _, _, data in payloads:
            handle.write(data)


if __name__ == "__main__":
    main()
