'use strict';

/**
 * build-icons.js — converts a single source image into the icons the desktop
 * app needs.
 *
 *   assets/icon.png  →  assets/icon.ico  (multi-resolution Windows icon)
 *
 * Why hand-rolled instead of an image library? The packaged app has to be
 * reproducible offline, so this does its own PNG decode/encode (via Node's
 * built-in zlib) and ICO assembly rather than adding native or network-fetched
 * dependencies to an otherwise dependency-free build.
 *
 * The generated .ico bundles 16/24/32/48/64/128/256 px images. Entries up to
 * 128 px use the classic 32-bit BMP form and the 256 px entry is PNG-compressed,
 * which is the layout Windows and NSIS handle most predictably.
 *
 * Usage:
 *   node scripts/build-icons.js [--src assets/icon.png] [--out assets/icon.ico]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROJECT_DIR = path.join(__dirname, '..');
const DEFAULT_SRC = path.join(PROJECT_DIR, 'assets', 'icon.png');
const DEFAULT_OUT = path.join(PROJECT_DIR, 'assets', 'icon.ico');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

// ---------------------------------------------------------------------------
// PNG decoding
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Decodes a non-interlaced 8- or 16-bit PNG into an RGBA8 bitmap.
 * Returns { width, height, data } where data is width*height*4 bytes.
 */
function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('input is not a PNG file');
  }

  let offset = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IEND') break;
    offset += 12 + length;
  }

  if (!ihdr) throw new Error('PNG is missing its IHDR header');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];

  if (interlace !== 0) {
    throw new Error('interlaced PNGs are not supported; re-save the image without interlacing');
  }
  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new Error(`unsupported PNG bit depth ${bitDepth}; re-save the image as 8-bit RGBA`);
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  if (colorType === 3 && !palette) throw new Error('palette PNG is missing its PLTE chunk');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const sampleBytes = bitDepth / 8;
  const bpp = channels * sampleBytes;
  const stride = width * bpp;
  const unfiltered = Buffer.alloc(height * stride);

  // Reverse the per-scanline PNG filters (spec section 9.2).
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const src = raw.subarray(pos, pos + stride);
    pos += stride;
    const row = unfiltered.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? unfiltered.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      switch (filter) {
        case 0:
          break;
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`unknown PNG filter type ${filter}`);
      }
      row[x] = v;
    }
  }

  // Expand the decoded samples into straight (non-premultiplied) RGBA8.
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = y * stride + x * channels * sampleBytes;
      const d = (y * width + x) * 4;
      let r;
      let g;
      let b;
      let a = 255;
      switch (colorType) {
        case 0:
          r = g = b = unfiltered[s];
          break;
        case 2:
          r = unfiltered[s];
          g = unfiltered[s + sampleBytes];
          b = unfiltered[s + 2 * sampleBytes];
          break;
        case 3: {
          const index = unfiltered[s];
          r = palette[index * 3];
          g = palette[index * 3 + 1];
          b = palette[index * 3 + 2];
          if (transparency && index < transparency.length) a = transparency[index];
          break;
        }
        case 4:
          r = g = b = unfiltered[s];
          a = unfiltered[s + sampleBytes];
          break;
        default:
          r = unfiltered[s];
          g = unfiltered[s + sampleBytes];
          b = unfiltered[s + 2 * sampleBytes];
          a = unfiltered[s + 3 * sampleBytes];
      }
      rgba[d] = r;
      rgba[d + 1] = g;
      rgba[d + 2] = b;
      rgba[d + 3] = a;
    }
  }

  return { width, height, data: rgba };
}

// ---------------------------------------------------------------------------
// Resampling
// ---------------------------------------------------------------------------

/**
 * Area-average resample. Each destination pixel integrates the exact source
 * region that maps onto it, which is the right filter for downscaling large
 * artwork. Source colors are alpha-weighted so transparent edges do not pull
 * dark fringes into the result.
 */
function resample(img, targetW, targetH) {
  const { width: srcW, height: srcH, data } = img;
  const out = Buffer.alloc(targetW * targetH * 4);
  const scaleX = srcW / targetW;
  const scaleY = srcH / targetH;

  for (let ty = 0; ty < targetH; ty++) {
    const y0 = ty * scaleY;
    const y1 = Math.min(srcH, y0 + scaleY);
    for (let tx = 0; tx < targetW; tx++) {
      const x0 = tx * scaleX;
      const x1 = Math.min(srcW, x0 + scaleX);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;

      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const o = (sy * srcW + sx) * 4;
          const alpha = data[o + 3] / 255;
          r += data[o] * alpha * w;
          g += data[o + 1] * alpha * w;
          b += data[o + 2] * alpha * w;
          a += data[o + 3] * w;
          weight += w;
        }
      }

      const d = (ty * targetW + tx) * 4;
      if (weight > 0) {
        const alphaAvg = a / weight;
        const alphaNorm = alphaAvg / 255;
        const unPremultiply = alphaNorm > 0 ? 1 / alphaNorm : 0;
        out[d] = clampByte((r / weight) * unPremultiply);
        out[d + 1] = clampByte((g / weight) * unPremultiply);
        out[d + 2] = clampByte((b / weight) * unPremultiply);
        out[d + 3] = clampByte(alphaAvg);
      }
    }
  }
  return { width: targetW, height: targetH, data: out };
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Scales the image to fit inside a transparent square, preserving aspect. */
function fitSquare(img, size) {
  const scale = Math.min(size / img.width, size / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const scaled = w === img.width && h === img.height ? img : resample(img, w, h);

  const canvas = Buffer.alloc(size * size * 4);
  const dx = Math.floor((size - w) / 2);
  const dy = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) {
    scaled.data.copy(canvas, ((y + dy) * size + dx) * 4, y * w * 4, (y + 1) * w * 4);
  }
  return { width: size, height: size, data: canvas };
}

// ---------------------------------------------------------------------------
// ICO encoding
// ---------------------------------------------------------------------------

/** Encodes an RGBA bitmap as an uncompressed 32-bit PNG. */
function encodePng(img) {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Encodes an RGBA bitmap as an ICO-style 32-bit DIB (BITMAPINFOHEADER + BGRA + AND mask). */
function encodeDib(img) {
  const { width, height, data } = img;

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(width, 4);
  header.writeInt32LE(height * 2, 8); // doubled: XOR image plus AND mask
  header.writeUInt16LE(1, 12); // planes
  header.writeUInt16LE(32, 14); // bits per pixel
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(width * height * 4, 20); // XOR image size

  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4; // DIB rows are bottom-up
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      pixels[d] = data[s + 2]; // blue
      pixels[d + 1] = data[s + 1]; // green
      pixels[d + 2] = data[s]; // red
      pixels[d + 3] = data[s + 3]; // alpha
    }
  }

  // The 1-bit AND mask is a legacy transparency channel; set bits mean transparent.
  const maskRowBytes = Math.ceil(width / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * height);
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[srcRow + x * 4 + 3] < 128) mask[y * maskRowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  return Buffer.concat([header, pixels, mask]);
}

function buildIco(images) {
  const payloads = images.map((img) => (img.width >= 256 ? encodePng(img) : encodeDib(img)));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let dataOffset = 6 + directory.length;
  images.forEach((img, i) => {
    const o = i * 16;
    directory[o] = img.width >= 256 ? 0 : img.width; // 0 means 256
    directory[o + 1] = img.height >= 256 ? 0 : img.height;
    directory[o + 2] = 0; // palette size
    directory[o + 3] = 0; // reserved
    directory.writeUInt16LE(1, o + 4); // planes
    directory.writeUInt16LE(32, o + 6); // bits per pixel
    directory.writeUInt32LE(payloads[i].length, o + 8);
    directory.writeUInt32LE(dataOffset, o + 12);
    dataOffset += payloads[i].length;
  });

  return Buffer.concat([header, directory, ...payloads]);
}

// ---------------------------------------------------------------------------

function main() {
  const srcPath = path.resolve(arg('--src', DEFAULT_SRC));
  const outPath = path.resolve(arg('--out', DEFAULT_OUT));

  if (!fs.existsSync(srcPath)) {
    console.error(`Source image not found: ${srcPath}`);
    console.error('Add a square PNG (1024x1024 recommended) at assets/icon.png, then re-run.');
    process.exit(1);
  }

  const source = decodePng(fs.readFileSync(srcPath));
  if (source.width !== source.height) {
    console.warn(`  note: source is ${source.width}x${source.height}; fitting it into a square canvas.`);
  }

  const images = SIZES.map((size) => fitSquare(source, size));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buildIco(images));

  console.log(`✅ Wrote ${path.relative(PROJECT_DIR, outPath)} (${SIZES.join(', ')} px) from ${path.relative(PROJECT_DIR, srcPath)}`);
}

if (require.main === module) main();

module.exports = { decodePng, buildIco, fitSquare };
