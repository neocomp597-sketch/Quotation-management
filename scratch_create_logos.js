const fs = require('fs');
const path = require('path');

// Master SVG design for the site logo and favicon
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="growthGradient" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="35%" stop-color="#3B82F6" />
      <stop offset="65%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>

    <linearGradient id="barGloss" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.3" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.1" />
    </linearGradient>

    <filter id="subtleShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1E1B4B" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Baseline Bar -->
  <rect x="36" y="432" width="440" height="16" rx="8" fill="#1E1B4B" />

  <!-- Bar 1 (Left) -->
  <rect x="52" y="350" width="68" height="82" rx="4" fill="url(#growthGradient)" />
  <rect x="52" y="350" width="68" height="82" rx="4" fill="url(#barGloss)" />

  <!-- Bar 2 -->
  <rect x="156" y="270" width="68" height="162" rx="4" fill="url(#growthGradient)" />
  <rect x="156" y="270" width="68" height="162" rx="4" fill="url(#barGloss)" />

  <!-- Bar 3 -->
  <rect x="260" y="190" width="68" height="242" rx="4" fill="url(#growthGradient)" />
  <rect x="260" y="190" width="68" height="242" rx="4" fill="url(#barGloss)" />

  <!-- Bar 4 (Right) -->
  <rect x="364" y="235" width="68" height="197" rx="4" fill="url(#growthGradient)" />
  <rect x="364" y="235" width="68" height="197" rx="4" fill="url(#barGloss)" />

  <!-- White Cutout / Gap for Arrow Trendline -->
  <path d="M 75 352 L 195 208 L 295 282 L 440 102"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="50"
        stroke-linecap="round"
        stroke-linejoin="round" />

  <path d="M 370 148 L 478 80 L 418 200 Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        stroke-width="20"
        stroke-linecap="round"
        stroke-linejoin="round" />

  <!-- Arrow Trendline Path (Gradient Fill) -->
  <path d="M 75 352 L 195 208 L 295 282 L 435 108"
        fill="none"
        stroke="url(#growthGradient)"
        stroke-width="32"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#subtleShadow)" />

  <!-- Arrow Head (Gradient Fill) -->
  <path d="M 370 148 L 472 84 L 414 194 Z"
        fill="url(#growthGradient)"
        stroke="url(#growthGradient)"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#subtleShadow)" />
</svg>`;

// Favicon SVG (optimized for tiny resolutions like 16x16 / 32x32 / 48x48)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="favGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="50%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
  </defs>
  <!-- Background Container for dark/light browser tabs -->
  <rect width="100" height="100" rx="22" fill="#FFFFFF" />
  <g transform="translate(6, 6) scale(0.88)">
    <!-- Baseline -->
    <rect x="6" y="86" width="88" height="4" rx="2" fill="#1E1B4B" />
    
    <!-- Bars -->
    <rect x="10" y="68" width="14" height="18" rx="2" fill="url(#favGrad)" />
    <rect x="30" y="52" width="14" height="34" rx="2" fill="url(#favGrad)" />
    <rect x="50" y="36" width="14" height="50" rx="2" fill="url(#favGrad)" />
    <rect x="70" y="44" width="14" height="42" rx="2" fill="url(#favGrad)" />

    <!-- Gap Cutout -->
    <path d="M 14 68 L 38 40 L 58 54 L 84 20" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 72 28 L 92 16 L 81 38 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Trend Arrow -->
    <path d="M 14 68 L 38 40 L 58 54 L 83 21" fill="none" stroke="url(#favGrad)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 72 28 L 91 17 L 81 37 Z" fill="url(#favGrad)" stroke="url(#favGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </g>
</svg>`;

const publicDir = path.join(__dirname, '../frontend/public');
const assetsDir = path.join(__dirname, '../frontend/src/assets');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'arcrm-favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(publicDir, 'site-logo.svg'), logoSvg);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(assetsDir, 'logo.svg'), logoSvg);
fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), faviconSvg);

console.log('Successfully created logo and favicon SVGs!');
