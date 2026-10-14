# ForgeIMG Design System

Brand: **ForgeIMG** — on-device image tools by RAMANAPRIYAN M R V.
Source of truth: Figma [Expense / forge image](https://www.figma.com/design/MRW0BAeQ0ONjoz8jVi76PP/Expense?node-id=1817-48) (Home, Compress, Convert, Resize, Crop, Lottie fallback frames at 1440px).

## Principles

1. **Grand but neat** — 64px gradient headline on Home, 48px titles on tools, calm 13–16px UI.
2. **Consistent chrome** — every page shares the header, footer, panels, and workspace rail.
3. **Black, white, red** — black canvas, white working panels, red only for primary actions, the active nav link, selected choices, and the active step.
4. **On-device trust** — the shield indicator, panel assurance, and rail privacy card always say files stay in the browser.
5. **No one-off styles** — pages use tokens and components only.

## Layers

| File | Role |
|------|------|
| `assets/css/tokens.css` | Primitives, roles, type scale, spacing, sizing, motion, network tokens |
| `assets/css/components.css` | Reusable components (buttons, panels, fields, rail, home blocks) |
| `assets/css/site.css` | Page layout: shell bands, header, footer, home sections, tool grid, responsive |
| `assets/js/chrome.js` | Header and footer markup |
| `assets/js/tool-shell.js` | Shared three-panel tool workspace and rail |
| `assets/js/network.js` | Network background and custom cursor |
| `assets/icons/` | Figma-exported SVG icons (white for dark surfaces, `-dark` for white surfaces) |

## Tokens

| Token | Value / role |
|-------|------|
| `--bg-deep` | `#000000` page canvas |
| `--surface-dark` / `--line-on-dark` | `#111111` dark cards / `#222222` borders and hairlines |
| `--surface` / `--surface-muted` | `#FFFFFF` panels / `#F5F5F5` inputs, choices, dropzone |
| `--ink` / `--ink-subtle` / `--ink-disabled` | `#111111` / `#666666` / `#A3A3A3` on white |
| `--ink-on-dark` / `--ink-dark-muted` | `#FFFFFF` / `#A3A3A3` on black |
| `--accent` / `--accent-border` / `--accent-hover` | `#E42527` / `#FF5448` / `#C3191B` primary button |
| `--active` | `#FB4446` active nav, selected choice, active step marker, `::selection` |
| `--fs-12 … --fs-64` | Type scale: 12 eyebrow, 13 meta, 15 labels, 16 body, 20 titles, 24 brand, 40 section, 48 tool title, 64 hero |
| `--space-1 … --space-7` | 4, 8, 16, 24, 32, 48, 64 |
| `--radius` / `--radius-sm` | 14px cards and panels / 9px controls |
| `--control-h` | 48px buttons, inputs, choices |
| `--panel-pad` / `--rail-w` | 32px / 304px |
| `--max` | 1120px content width (160px gutters at 1440) |
| `--ease`, `--dur-*` | Motion curve and durations |
| `--net-*` | Network dot color, line RGB, line and cursor alpha, density, link distance |

## Typography

Inter throughout. Weights: 400 body, 600 headings, labels, and buttons, 700 panel and card titles.
Eyebrows are 12px, 600, uppercase, `#A3A3A3`.

## Components

- **Header:** wordmark left, centered tool nav (active in `--active`), shield + "On-device only" right; 88px tall with hairline.
- **Footer:** brand statement + tool links, hairline, two notes.
- **Buttons:** `.btn` 48px, radius 9, 14px/600. Variants `.btn-primary`, `.btn-secondary` (white, gray border), `.btn-dark` (on black). Disabled = "Unavailable action" (`#F5F5F5`, gray border, gray text). Widths `.btn-wide` 224, `.btn-md` 190.
- **Panel:** white, radius 14, 32px padding, 24px gap, `.panel-title` 20/700.
- **Dropzone:** `#F5F5F5`, dashed gray border, icon, title, hint, primary + two secondary actions.
- **Fields:** `.field-label` 15/600; inputs and selects 48px on `#F5F5F5`; `.segmented` + `.mode-tab` choices (selected = `--active`); `.chip` presets (selected = ink border).
- **Rail:** `.rail-card` dark with numbered `.rail-step` markers (idle `#222`, active `--active`, done white), current state, and `.privacy-card`.
- **Home blocks:** `.index-entry`, `.tool-row`, `.workflow-step`, `.input-card`, `.format-row`, `.privacy-promise`, `.faq-item`.

## Tool workspace

Three stacked panels — 1. Add your files, 2. Adjust settings, 3. Download your output — beside the rail. All panels stay visible; the process and download buttons are disabled until they can act. The rail tracks progress (files added, then results ready) and clicking a step scrolls to its panel.

## Network animation

`network.js` mounts a fixed full-page canvas behind content: drifting dots with dashed links, plus links to the cursor on dark areas. Colors, density, and link distance come from `--net-*` tokens. It fades in once ready, pauses when off screen, runs only on desktop widths, and shows a still frame under `prefers-reduced-motion`. The custom cursor hides over white surfaces (`.panel`, `.privacy-promise`).

## Motion

- Entrance rise (~0.65s, `--ease`) for hero, tool intro, panels, and rail.
- Hover: tool rows lift 2px; links shift to white or red.
- No glow or looping motion besides the network background.

## Accessibility

- Focus rings: white on black, ink inside white panels.
- Icons are decorative (`alt=""`); every control has a text label.
- Respect `prefers-reduced-motion` everywhere.
