"""
Draws the play page's app icons (public/icons/icon-192.png, icon-512.png):
a rounded blue square with a white play triangle. Pure Python (zlib), so
the icons can be made again without an image library. Run from frontend/:

    python3 scripts/make_icons.py
"""
import struct
import zlib
from pathlib import Path


def png(size: int) -> bytes:
    rows = []
    r = size * 0.18  # corner radius
    for y in range(size):
        row = bytearray([0])  # filter: none
        for x in range(size):
            # Inside the rounded square?
            dx = max(r - x, 0, x - (size - 1 - r))
            dy = max(r - y, 0, y - (size - 1 - r))
            inside = dx * dx + dy * dy <= r * r
            # The play triangle: points at (0.38,0.28), (0.38,0.72), (0.74,0.5).
            u, v = x / size, y / size
            tri = u >= 0.38 and abs(v - 0.5) <= (0.74 - u) * (0.22 / 0.36)
            if not inside:
                row += bytes([0, 0, 0, 0])
            elif tri:
                row += bytes([255, 255, 255, 255])
            else:
                t = y / size  # a gentle top-to-bottom gradient
                row += bytes([int(79 - 30 * t), int(140 - 40 * t), 255, 255])
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


for size in (192, 512):
    Path(f"public/icons/icon-{size}.png").write_bytes(png(size))
    print(f"public/icons/icon-{size}.png")
