const fs = require('fs');
const path = require('path');

// Minimal valid PNG generator in pure Node without external dependencies
function generateSolidPNG(width, height, r, g, b) {
  const zlib = require('zlib');

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(2, 9); // Truecolor (RGB)
  ihdrData.writeUInt8(0, 10); // Deflate
  ihdrData.writeUInt8(0, 11); // Filter method
  ihdrData.writeUInt8(0, 12); // Interlace: none
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Draw a subtle border or nice blue color
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      rawData[pxOffset] = isBorder ? 30 : r;
      rawData[pxOffset + 1] = isBorder ? 40 : g;
      rawData[pxOffset + 2] = isBorder ? 60 : b;
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatCompressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = crc32(typeAndData);
  chunk.writeUInt32BE(c, 8 + len);
  return chunk;
}

const dir = path.join(__dirname);
fs.writeFileSync(path.join(dir, 'icon16.png'), generateSolidPNG(16, 16, 37, 99, 235));
fs.writeFileSync(path.join(dir, 'icon48.png'), generateSolidPNG(48, 48, 37, 99, 235));
fs.writeFileSync(path.join(dir, 'icon128.png'), generateSolidPNG(128, 128, 37, 99, 235));
console.log('Icons generated successfully.');
