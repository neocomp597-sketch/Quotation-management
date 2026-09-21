import React from 'react';

const SiteLogo = ({ className = "w-10 h-10", style = {} }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', shrink: 0, ...style }}
      aria-label="ARCRM Logo"
    >
      <defs>
        <linearGradient id="siteLogoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="35%" stopColor="#3B82F6" />
          <stop offset="65%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        <linearGradient id="siteBarGloss" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
        </linearGradient>

        <filter id="siteSubtleShadow" x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1E1B4B" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Baseline Bar */}
      <rect x="36" y="432" width="440" height="16" rx="8" fill="#1E1B4B" />

      {/* Bar 1 (Left) */}
      <rect x="52" y="350" width="68" height="82" rx="4" fill="url(#siteLogoGradient)" />
      <rect x="52" y="350" width="68" height="82" rx="4" fill="url(#siteBarGloss)" />

      {/* Bar 2 */}
      <rect x="156" y="270" width="68" height="162" rx="4" fill="url(#siteLogoGradient)" />
      <rect x="156" y="270" width="68" height="162" rx="4" fill="url(#siteBarGloss)" />

      {/* Bar 3 */}
      <rect x="260" y="190" width="68" height="242" rx="4" fill="url(#siteLogoGradient)" />
      <rect x="260" y="190" width="68" height="242" rx="4" fill="url(#siteBarGloss)" />

      {/* Bar 4 (Right) */}
      <rect x="364" y="235" width="68" height="197" rx="4" fill="url(#siteLogoGradient)" />
      <rect x="364" y="235" width="68" height="197" rx="4" fill="url(#siteBarGloss)" />

      {/* White Cutout / Gap for Arrow Trendline */}
      <path
        d="M 75 352 L 195 208 L 295 282 L 440 102"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M 370 148 L 478 80 L 418 200 Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrow Trendline Path */}
      <path
        d="M 75 352 L 195 208 L 295 282 L 435 108"
        fill="none"
        stroke="url(#siteLogoGradient)"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#siteSubtleShadow)"
      />

      {/* Arrow Head */}
      <path
        d="M 370 148 L 472 84 L 414 194 Z"
        fill="url(#siteLogoGradient)"
        stroke="url(#siteLogoGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#siteSubtleShadow)"
      />
    </svg>
  );
};

export default SiteLogo;
