import React from 'react';

/**
 * ARCRM app mark. This is the same artwork as the browser favicon
 * (public/favicon.svg and public/arcrm-favicon.svg), drawn inline so it
 * always renders without depending on a static file request.
 */
const SiteLogo = ({ className = "w-10 h-10", style = {} }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      role="img"
      aria-label="ARCRM Logo"
    >
      <defs>
        <linearGradient id="siteLogoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>

      <g transform="translate(4, 4) scale(0.92)">
        {/* Baseline */}
        <rect x="6" y="86" width="88" height="4" rx="2" fill="#1E1B4B" />

        {/* Bars */}
        <rect x="10" y="68" width="14" height="18" rx="2" fill="url(#siteLogoGradient)" />
        <rect x="30" y="52" width="14" height="34" rx="2" fill="url(#siteLogoGradient)" />
        <rect x="50" y="36" width="14" height="50" rx="2" fill="url(#siteLogoGradient)" />
        <rect x="70" y="44" width="14" height="42" rx="2" fill="url(#siteLogoGradient)" />

        {/* White cutout behind the trendline */}
        <path d="M 14 68 L 38 40 L 58 54 L 84 20" fill="none" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 72 28 L 92 16 L 81 38 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Trendline and arrow head */}
        <path d="M 14 68 L 38 40 L 58 54 L 83 21" fill="none" stroke="url(#siteLogoGradient)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 72 28 L 91 17 L 81 37 Z" fill="url(#siteLogoGradient)" stroke="url(#siteLogoGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

export default SiteLogo;
