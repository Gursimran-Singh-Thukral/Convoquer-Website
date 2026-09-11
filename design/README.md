# Convoquer'26 — Design Architecture & Wireframe Blueprints

This directory contains the pre-code design system, wireframe blueprints, component compositions, and aesthetic guidelines for the Convoquer'26 platform.

---

## 1. Official Color Identity: "Golden Hour"

Extracted from the official brand artwork:

| Color Token | Hex Code | Purpose & Semantic Role |
| :--- | :--- | :--- |
| **Burgundy** | `#800020` | Primary heritage color, deep card backdrops, collegiate banners, stadium dusk ambiance. |
| **Crimson Carrot** | `#FF4500` | High-voltage athletic energy, active live score glows, primary action buttons, sprint accents. |
| **Gold** | `#FFD700` | Championship triumph, Seed 1 ranking indicators, medals, trophies, metallic typography. |
| **Night Wine** | `#0D0205` / `#180308` | Deep canvas backgrounds, dark mode depth, avoiding washed-out generic black. |

### The Golden Hour Gradient
```css
background: linear-gradient(135deg, #800020 0%, #FF4500 52%, #FFD700 100%);
```

---

## 2. Anti-AI / Anti-Template Design Principles

To ensure Convoquer'26 feels **authentic, bespoke, collegiate, and athletic** rather than a generic AI-generated SaaS dashboard:

1. **No Generic Bento Grids**:
   - Instead of 4 rounded identical square tiles, we use **asymmetric match fixture ticket stubs**, stadium court layouts, and real sports editorial grids.
2. **Physical Sports Artifacts**:
   - **Match Ticket Stubs**: Perforated dividers, barcode/ticket ID numbers, stadium entry gate labels.
   - **Lanyard Badges**: Participant and Security gate passes formatted like physical laminate festival passes.
   - **Scoreboard Monospace**: Numbers that look like physical LED stadium flip scoreboards (`JetBrains Mono`).
3. **Collegiate Athletic Typography**:
   - Heavy uppercase display headings with tight tracking (`tracking-tighter font-extrabold uppercase`).
   - Angled athletic badges (`skew-x-[-6deg]`).
   - High-contrast warm text (`#FFF9F5` on `#180308`) with subtle gold borders.

---

## 3. Interactive Preview & Prototyping

Open [`design/preview.html`](./preview.html) in your browser to inspect the live visual components:
- **Hero Section Preview** with Golden Hour atmosphere.
- **Match Ticket Stub Component** with perforation and live game clock.
- **Top-Seed Separation Knockout Bracket** (proving Seed 1 and Seed 2 meet only in Finals).
- **Security Gate Pass Card** with instant QR verification.
- **On-Spot Audience Pass Modal**.

---

## 4. Directory Structure

```text
/design
├── README.md             # This design architecture guide
├── tokens.css            # CSS Custom Properties for Golden Hour palette
├── preview.html          # Standalone Interactive Design Prototype & Component Showcase
└── wireframes/           # Detailed page blueprints & ASCII wireframes
    ├── HOME_PAGE.md
    ├── SCHEDULE_PAGE.md
    ├── BRACKET_VIEWER.md
    └── SECURITY_DESK.md
```
