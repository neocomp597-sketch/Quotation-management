---
name: Emerald Enterprise
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#0db6a4'
  on-tertiary-container: '#004139'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  emerald-deep: '#059669'
  slate-muted: '#64748B'
  glass-border: rgba(255, 255, 255, 0.4)
  surface-card: '#FFFFFF'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  gutter: 24px
  container-max: 1280px
---

## Brand & Style
The design system is engineered for a premium enterprise SaaS experience that balances the power of legacy CRM platforms with the refined, modern aesthetic of high-end developer tools. The brand personality is authoritative yet approachable, focusing on clarity, efficiency, and high-conversion workflows.

The visual style is a sophisticated blend of **Minimalism** and **Glassmorphism**. It utilizes a clean "Stripe-inspired" layout—heavy on whitespace and precise typography—enhanced by subtle teal gradients and translucent surface layers. This creates a tactile, layered depth that guides the user’s eye toward primary actions without overwhelming the interface with unnecessary decoration.

## Colors
The palette is rooted in a "Clean Corporate" aesthetic. The primary Emerald (`#10B981`) serves as the core action color, symbolizing growth and success. It is frequently paired with a Tertiary Teal (`#14B8A6`) to create professional gradients.

**Dark Slate** is reserved for high-level information architecture, including headings and primary navigation labels, ensuring maximum legibility. **Muted Blue-Grey** provides a softer contrast for long-form body text, reducing visual fatigue. The background uses a near-white **Neutral** to maintain a fresh, spacious feel, while pure white is reserved for elevated card surfaces to create "pop."

## Typography
This design system utilizes **Inter** for its systematic, utilitarian precision. The typographic scale is optimized for data-dense CRM environments where information hierarchy is paramount. 

Headlines utilize tighter letter spacing and heavier weights to feel "anchored" and authoritative. Body text uses a standard 14px base to maximize screen real estate, while a 16px variant is used for marketing-focused pages or introductory sections. Labels utilize a slightly higher weight and optional uppercase styling for metadata and tags to distinguish them from interactive body text.

## Layout & Spacing
The layout follows a **Fixed-Fluid hybrid grid**. The core application interface uses a fluid model to maximize data visibility, while marketing and high-level dashboard views conform to a 1280px centered container.

A strict 4px/8px baseline grid is used to maintain vertical rhythm. Margins are generous—standard page padding is set to 32px or 48px to evoke a premium, "breathable" feel. For enterprise density, gutters between data columns are kept at a consistent 24px. On mobile, margins compress to 16px, and multi-column layouts reflow into a single vertical stack.

## Elevation & Depth
Depth is created through **Glassmorphism and Tonal Layers**. Instead of heavy shadows, the system uses "Ambient Depth":
- **Level 0 (Surface):** The neutral background (`#F8FAFC`).
- **Level 1 (Cards):** Pure white surfaces with a 1px soft stroke (`#E2E8F0`) and a very diffuse 20px blur shadow at 4% opacity.
- **Level 2 (Overlays/Modals):** Glassmorphic surfaces using a semi-transparent white backdrop (80% opacity) with a 12px background blur and a subtle inner glow.

Gradients (Emerald to Teal) should be used sparingly on the highest elevation elements—such as primary CTA buttons—to pull them forward in the 3D space.

## Shapes
The shape language is defined by significant **Roundedness**. To achieve the "Modern SaaS" look, standard components like input fields and small buttons use a 0.5rem (8px) radius, while larger containers like Cards, Modals, and high-impact Dashboard sections use a more pronounced 1.25rem to 1.5rem (20-24px) radius. This softening of the enterprise interface makes complex CRM data feel more accessible and user-friendly.

## Components
- **Buttons:** Primary buttons use a linear gradient from Emerald to Teal with white text and a subtle drop shadow. Secondary buttons use a white background with a Slate border.
- **Inputs:** High-affordance fields with a 20px corner radius on specific "Search" or "Lead Entry" components, and 8px for standard data forms. Focus states use a 2px Emerald glow.
- **Cards:** Defined by a 24px corner radius, white background, and a "Glass" header for internal sectioning.
- **Chips/Badges:** Small, pill-shaped elements with low-saturation backgrounds (e.g., 10% Emerald background with 100% Emerald text) for status indicators.
- **Iconography:** Use **Lucide** or **Heroicons** with a "Medium" stroke weight (2px). Icons should be monochromatic Slate for navigation and Primary Emerald for active states or success indicators.
- **Data Tables:** Row-based layouts with no vertical borders; use subtle horizontal dividers and a highlight state on hover to maintain a "Stripe" level of cleanliness.