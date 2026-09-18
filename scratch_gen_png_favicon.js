const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table & function for PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Function to encode RGBA buffer to valid PNG Buffer
function createPNG(width, height, rgbaBuffer) {
  // Add filter byte (0 = None) at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0; // Filter: None
    const srcStart = y * width * 4;
    const destStart = y * scanlineLength + 1;
    rgbaBuffer.copy(rawData, destStart, srcStart, srcStart + width * 4);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const typeBuf = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(4 + 4 + length + 4);

  chunk.writeUInt32BE(length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);

  const crcBuf = Buffer.concat([typeBuf, data]);
  const checksum = crc32(crcBuf);
  chunk.writeUInt32BE(checksum, 8 + length);

  return chunk;
}

// Function to combine PNG buffers into standard multi-resolution ICO file
function createICO(pngBuffers) {
  const count = pngBuffers.length;
  const headerLength = 6 + count * 16;
  let dataOffset = headerLength;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4);

  const entries = [];

  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i].buffer;
    const w = pngBuffers[i].width;
    const h = pngBuffers[i].height;

    const entry = Buffer.alloc(16);
    entry[0] = w >= 256 ? 0 : w;
    entry[1] = h >= 256 ? 0 : h;
    entry[2] = 0; // Palette
    entry[3] = 0; // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(png.length, 8); // Image size
    entry.writeUInt32LE(dataOffset, 12); // Offset

    dataOffset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(p => p.buffer)]);
}

// Color interpolator (Blue -> Indigo -> Purple -> Magenta)
function getGradientColor(t) {
  // t: 0.0 to 1.0
  const c1 = [0x25, 0x63, 0xeb]; // Blue #2563EB
  const c2 = [0x7c, 0x3a, 0xed]; // Purple #7C3AED
  const c3 = [0xa8, 0x55, 0xf7]; // Magenta #A855F7

  let r, g, b;
  if (t <= 0.5) {
    const factor = t / 0.5;
    r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
    g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
    b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
  } else {
    const factor = (t - 0.5) / 0.5;
    r = Math.round(c2[0] + (c3[0] - c2[0]) * factor);
    g = Math.round(c2[1] + (c3[1] - c2[1]) * factor);
    b = Math.round(c2[2] + (c3[2] - c2[2]) * factor);
  }
  return [r, g, b, 255];
}

// Draw Favicon Graphic to RGBA Buffer
function drawFavicon(width, height, options = {}) {
  const buffer = Buffer.alloc(width * height * 4); // All zeros (transparent)

  function setPixel(x, y, color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    const srcA = color[3] / 255;
    if (srcA <= 0) return;

    if (srcA >= 0.99) {
      buffer[idx] = color[0];
      buffer[idx + 1] = color[1];
      buffer[idx + 2] = color[2];
      buffer[idx + 3] = 255;
    } else {
      const destA = buffer[idx + 3] / 255;
      const outA = srcA + destA * (1 - srcA);
      if (outA > 0) {
        buffer[idx] = Math.round((color[0] * srcA + buffer[idx] * destA * (1 - srcA)) / outA);
        buffer[idx + 1] = Math.round((color[1] * srcA + buffer[idx + 1] * destA * (1 - srcA)) / outA);
        buffer[idx + 2] = Math.round((color[2] * srcA + buffer[idx + 2] * destA * (1 - srcA)) / outA);
        buffer[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  function drawRect(rx, ry, rw, rh, color) {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        setPixel(x, y, color);
      }
    }
  }

  function drawThickLine(x1, y1, x2, y2, thickness, color) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(Math.ceil(dist * 2), 1);
    const r = thickness / 2;

    for (let i = 0; i <= steps; i++) {
      const cx = x1 + (x2 - x1) * (i / steps);
      const cy = y1 + (y2 - y1) * (i / steps);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            setPixel(cx + dx, cy + dy, color);
          }
        }
      }
    }
  }

  function drawTriangle(p1, p2, p3, color) {
    const minX = Math.floor(Math.min(p1[0], p2[0], p3[0]));
    const maxX = Math.ceil(Math.max(p1[0], p2[0], p3[0]));
    const minY = Math.floor(Math.min(p1[1], p2[1], p3[1]));
    const maxY = Math.ceil(Math.max(p1[1], p2[1], p3[1]));

    function sign(p, a, b) {
      return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const pt = [x + 0.5, y + 0.5];
        const d1 = sign(pt, p1, p2);
        const d2 = sign(pt, p2, p3);
        const d3 = sign(pt, p3, p1);

        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        if (!(hasNeg && hasPos)) {
          setPixel(x, y, color);
        }
      }
    }
  }

  // Optional background container for standard app icon
  if (options.roundedContainer) {
    const bgCol = options.bgColor || [255, 255, 255, 255];
    const rx = Math.round(width * 0.18);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let inside = true;
        if (x < rx && y < rx) inside = Math.hypot(x - rx, y - rx) <= rx;
        else if (x > width - rx && y < rx) inside = Math.hypot(x - (width - rx), y - rx) <= rx;
        else if (x < rx && y > height - rx) inside = Math.hypot(x - rx, y - (height - rx)) <= rx;
        else if (x > width - rx && y > height - rx) inside = Math.hypot(x - (width - rx), y - (height - rx)) <= rx;

        if (inside) setPixel(x, y, bgCol);
      }
    }
  }

  // Padding inside canvas
  const pad = width * (options.roundedContainer ? 0.12 : 0.05);
  const w = width - pad * 2;
  const h = height - pad * 2;
  const ox = pad;
  const oy = pad;

  // Baseline
  const baseH = Math.max(Math.round(h * 0.04), 2);
  const baseY = oy + h - baseH;
  const darkNavy = [30, 27, 75, 255]; // #1E1B4B
  drawRect(ox, baseY, w, baseH, darkNavy);

  // 4 Vertical Bars
  const barW = Math.round(w * 0.15);
  const gap = Math.round(w * 0.08);

  const bars = [
    { x: ox + gap * 0.5, h: h * 0.22, t: 0.1 },
    { x: ox + gap * 0.5 + (barW + gap), h: h * 0.42, t: 0.35 },
    { x: ox + gap * 0.5 + (barW + gap) * 2, h: h * 0.62, t: 0.65 },
    { x: ox + gap * 0.5 + (barW + gap) * 3, h: h * 0.52, t: 0.9 }
  ];

  for (const b of bars) {
    const bx = Math.round(b.x);
    const by = Math.round(baseY - b.h);
    const bh = Math.round(b.h);
    const col = getGradientColor(b.t);
    drawRect(bx, by, barW, bh, col);
  }

  // Arrow Coordinates
  const pts = [
    [ox + w * 0.1, baseY - h * 0.24],
    [ox + w * 0.38, baseY - h * 0.58],
    [ox + w * 0.58, baseY - h * 0.42],
    [ox + w * 0.82, baseY - h * 0.78]
  ];

  const gapThick = Math.max(w * 0.12, 3);
  const arrowThick = Math.max(w * 0.07, 2);

  const white = [255, 255, 255, 255];
  const arrowCol = getGradientColor(0.85);

  // 1. Draw White Gap behind Arrow
  for (let i = 0; i < pts.length - 1; i++) {
    drawThickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], gapThick, white);
  }
  const headGapP1 = [pts[3][0] - w * 0.15, pts[3][1] + h * 0.08];
  const headGapP2 = [pts[3][0] + w * 0.08, pts[3][1] - h * 0.08];
  const headGapP3 = [pts[3][0] - w * 0.06, pts[3][1] + h * 0.22];
  drawTriangle(headGapP1, headGapP2, headGapP3, white);

  // 2. Draw Arrow Line & Arrowhead
  for (let i = 0; i < pts.length - 1; i++) {
    const segmentCol = getGradientColor(0.2 + i * 0.3);
    drawThickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], arrowThick, segmentCol);
  }

  const headP1 = [pts[3][0] - w * 0.12, pts[3][1] + h * 0.06];
  const headP2 = [pts[3][0] + w * 0.05, pts[3][1] - h * 0.05];
  const headP3 = [pts[3][0] - w * 0.04, pts[3][1] + h * 0.18];
  drawTriangle(headP1, headP2, headP3, arrowCol);

  return buffer;
}

// Generate all Favicon sizes
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180, roundedContainer: true },
  { name: 'android-chrome-192x192.png', size: 192, roundedContainer: true },
  { name: 'android-chrome-512x512.png', size: 512, roundedContainer: true },
  { name: 'site-logo.png', size: 512 }
];

const publicDir = path.join(__dirname, 'frontend/public');
const distDir = path.join(__dirname, 'frontend/dist');

fs.mkdirSync(publicDir, { recursive: true });

const pngBuffers = [];

for (const item of sizes) {
  const buf = drawFavicon(item.size, item.size, { roundedContainer: item.roundedContainer });
  const pngBuf = createPNG(item.size, item.size, buf);

  fs.writeFileSync(path.join(publicDir, item.name), pngBuf);
  console.log(`Generated ${item.name} (${item.size}x${item.size})`);

  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, item.name), pngBuf);
  }

  if (item.size <= 48) {
    pngBuffers.push({ width: item.size, height: item.size, buffer: pngBuf });
  }
}

// Write ICO File
const icoBuf = createICO(pngBuffers);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
console.log('Generated favicon.ico with 16x16, 32x32, 48x48 icons');

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'favicon.ico'), icoBuf);
}

// Also update SVG favicons (transparent background for tab bar)
const transparentFaviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="favGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
  </defs>
  <g transform="translate(4, 4) scale(0.92)">
    <rect x="6" y="86" width="88" height="4" rx="2" fill="#1E1B4B" />
    <rect x="10" y="68" width="14" height="18" rx="2" fill="url(#favGrad)" />
    <rect x="30" y="52" width="14" height="34" rx="2" fill="url(#favGrad)" />
    <rect x="50" y="36" width="14" height="50" rx="2" fill="url(#favGrad)" />
    <rect x="70" y="44" width="14" height="42" rx="2" fill="url(#favGrad)" />
    <path d="M 14 68 L 38 40 L 58 54 L 84 20" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 72 28 L 92 16 L 81 38 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 14 68 L 38 40 L 58 54 L 83 21" fill="none" stroke="url(#favGrad)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 72 28 L 91 17 L 81 37 Z" fill="url(#favGrad)" stroke="url(#favGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'arcrm-favicon.svg'), transparentFaviconSvg);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), transparentFaviconSvg);
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'arcrm-favicon.svg'), transparentFaviconSvg);
  fs.writeFileSync(path.join(distDir, 'favicon.svg'), transparentFaviconSvg);
}

// Generate webmanifest for production PWA/browser support
const webManifest = {
  name: "ARCRM",
  short_name: "ARCRM",
  icons: [
    { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
  ],
  theme_color: "#2563eb",
  background_color: "#ffffff",
  display: "standalone"
};

fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(webManifest, null, 2));
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'site.webmanifest'), JSON.stringify(webManifest, null, 2));
}

console.log('All production favicons, ICO, PNGs, and webmanifest generated successfully!');
