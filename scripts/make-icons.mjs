// Renders the toolbar/store icons as PNGs with no dependencies: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OUT_DIR = fileURLToPath(new URL('../extension/icons/', import.meta.url));
const SIZES = [16, 32, 48, 128];

// Shapes on a 24-unit grid, matching the sparkle icon in the assistant UI.
const BIG_STAR = [[12, 3.6], [13.8, 8.4], [18.6, 10.2], [13.8, 12], [12, 16.8], [10.2, 12], [5.4, 10.2], [10.2, 8.4]];
const SMALL_STAR = [[18.4, 14.6], [19.1, 16.3], [20.8, 17], [19.1, 17.7], [18.4, 19.4], [17.7, 17.7], [16, 17], [17.7, 16.3]];
const FROM = [99, 102, 241];
const TO = [139, 92, 246];

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedSquare(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 24 - radius);
  const cy = Math.min(Math.max(y, radius), 24 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function render(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let star = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = ((px + (sx + 0.5) / samples) / size) * 24;
          const y = ((py + (sy + 0.5) / samples) / size) * 24;
          if (!inRoundedSquare(x, y, 5.5)) continue;
          bg++;
          if (inPolygon(x, y, BIG_STAR) || (size >= 32 && inPolygon(x, y, SMALL_STAR))) star++;
        }
      }
      const total = samples * samples;
      const t = (px + py) / (2 * size);
      const base = FROM.map((c, i) => c + (TO[i] - c) * t);
      const mix = bg ? star / bg : 0;
      const o = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) pixels[o + i] = Math.round(base[i] + (255 - base[i]) * mix);
      pixels[o + 3] = Math.round((bg / total) * 255);
    }
  }
  return encodePng(size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) writeFileSync(join(OUT_DIR, `icon-${size}.png`), render(size));
console.log(`Wrote ${SIZES.length} icons to extension/icons/`);
