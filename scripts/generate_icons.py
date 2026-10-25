import os
import struct
import zlib

def create_png(width, height, color_bg=(11, 14, 20), color_accent=(0, 240, 255)):
    # Create raw RGBA image data
    raw_data = bytearray()
    center_x = width // 2
    center_y = height // 2
    radius = min(width, height) // 2 - 2

    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            dx = x - center_x
            dy = y - center_y
            dist_sq = dx * dx + dy * dy

            # Tactical stylized icon: glowing circle border with central crosshair bars
            is_border = abs(dist_sq - (radius * 0.75) ** 2) < (radius * 3)
            is_cross_h = abs(dy) < (height // 12) and abs(dx) < (width * 0.6)
            is_cross_v = abs(dx) < (width // 12) and abs(dy) < (height * 0.6)

            if is_border or is_cross_h or is_cross_v:
                raw_data.extend([color_accent[0], color_accent[1], color_accent[2], 255])
            else:
                raw_data.extend([color_bg[0], color_bg[1], color_bg[2], 255])

    # PNG chunks
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw_data), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def create_ico(png_data):
    # Standard Windows Vista+ PNG-embedded ICO header
    # 2 bytes reserved, 2 bytes type (1=ICO), 2 bytes image count (1)
    ico_header = struct.pack('<HHH', 0, 1, 1)
    # Entry: width (0=256), height (0=256), colors (0), reserved (0), planes (1), bpp (32), size, offset
    png_size = len(png_data)
    offset = 6 + 16
    entry = struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, png_size, offset)
    return ico_header + entry + png_data

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    png32 = create_png(32, 32)
    with open(os.path.join(icons_dir, '32x32.png'), 'wb') as f:
        f.write(png32)

    png128 = create_png(128, 128)
    with open(os.path.join(icons_dir, '128x128.png'), 'wb') as f:
        f.write(png128)

    png256 = create_png(256, 256)
    with open(os.path.join(icons_dir, '128x128@2x.png'), 'wb') as f:
        f.write(png256)

    ico = create_ico(png256)
    with open(os.path.join(icons_dir, 'icon.ico'), 'wb') as f:
        f.write(ico)

    # Dummy ICNS file container (Tauri requires it if listed, even on Windows builds)
    icns_header = b'icns' + struct.pack('>I', 8 + len(png256) + 8) + b'ic08' + struct.pack('>I', len(png256) + 8) + png256
    with open(os.path.join(icons_dir, 'icon.icns'), 'wb') as f:
        f.write(icns_header)

    print("Icons successfully generated in src-tauri/icons/")

if __name__ == '__main__':
    main()
