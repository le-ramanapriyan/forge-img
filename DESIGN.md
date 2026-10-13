# ForgeIMG Design Guidelines

Brand: **ForgeIMG** — on-device image tools by RAMANAPRIYAN M R V.

## Principles

1. **Grand but neat** — large display type on landings; calm, tight UI inside tools.
2. **Consistent chrome** — every page uses the same header, footer, buttons, and right workspace steps.
3. **Black, white, red (Expense 3.0)** — black canvas, white text and workspace surfaces, red `#E42527` only for primary actions, hover, and selection. Never use red as a background area.
4. **On-device trust** — always communicate that files never leave the browser.
5. **No one-off styles** — use tokens and components only.

## Tokens

Defined in `assets/css/tokens.css`:

| Token | Role |
|-------|------|
| `--bg-deep` | Page canvas, `#000000` |
| `--near-black` / `--hairline` | Raised dark panels `#111111`, their borders `#222222` |
| `--accent` / `--accent-hover` | Red CTA `#E42527` / `#C3191B`, link and text hover |
| `--red-selection` | `::selection` highlight `#FB4446` with white text |
| `--surface` / `--surface-muted` | White `#FFFFFF` / off-white `#F5F5F5` |
| `--ink` / `--ink-on-dark` | Text on light `#111111` / on dark `#FFFFFF` |
| `--ink-dark-muted` | Muted text on black `#A3A3A3` |
| `--gradient-text` | Hero headline gradient `#FFFFFF` → `#666666` |
| `--space-*` | 8px scale (1–8) |
| `--radius` / `--radius-sm` | 14px / 9px |
| `--font-display` | Zoho Puvi (headings, 600) |
| `--font-ui` | Zoho Puvi |
| `--max` | Content width 1120px |

## Typography

- **Brand / hero:** Zoho Puvi, large (`clamp(2.5rem, 5vw, 4rem)` for H1), weight 600.
- **UI:** Zoho Puvi, 15–16px body, 700 for titles, 600 for buttons.
- **Eyebrows:** uppercase, tracked, muted gray `#A3A3A3`.

## Layout

- Shell width: `min(1120px, 100% - 2rem)`.
- Home: hero + tool card grid (3 columns, 2 on medium screens, 1 on small screens).
- Tool pages: short intro + primary CTA → modal workspace.

## Components

- **Header:** logo mark, ForgeIMG wordmark, tool nav.
- **Footer:** tool links, privacy line, © year + le-ramanapriyan.
- **Tool card:** icon tile, title, short description, “Open” affordance.
- **Buttons:** `.btn-primary` (red), `.btn-secondary` (white on light), `.btn-ghost` (white-70 outline on dark), `.btn-tertiary` (black), `.btn-lg`.
- **Workspace (right panel):** Upload → Options → Results step rail; shared footer actions.
- **Dropzone / chips / segmented controls:** from `components.css` only.

## Motion

- Hero / workspace rise (~0.6–0.7s) only.
- No continuous animation or glow spam.

## Accessibility

- Focus-visible rings are white on black and `#111111` inside white panels.
- Keep contrast readable on black and white surfaces.
