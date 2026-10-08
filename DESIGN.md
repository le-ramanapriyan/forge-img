# ForgeIMG Design Guidelines

Brand: **ForgeIMG** — on-device image tools by RAMANAPRIYAN M R V.

## Principles

1. **Grand but neat** — large display type on landings; calm, tight UI inside tools.
2. **Consistent chrome** — every page uses the same header, footer, buttons, and right workspace steps.
3. **Blue-led atmosphere** — deep navy backgrounds, luminous blue accents, white workspace surfaces.
4. **On-device trust** — always communicate that files never leave the browser.
5. **No one-off styles** — use tokens and components only.

## Tokens

Defined in `assets/css/tokens.css`:

| Token | Role |
|-------|------|
| `--bg-deep` | Page atmosphere |
| `--accent` / `--accent-hot` | Primary actions, links, focus |
| `--surface` | Workspace panels, cards |
| `--ink` / `--ink-on-dark` | Text on light / dark |
| `--space-*` | 8px scale (1–8) |
| `--radius` / `--radius-sm` | 14px / 9px |
| `--font-display` | Instrument Serif |
| `--font-ui` | IBM Plex Sans |
| `--max` | Content width 1120px |

## Typography

- **Brand / hero:** Instrument Serif, large (`clamp(2.5rem, 5vw, 4rem)` for H1).
- **UI:** IBM Plex Sans, 15–16px body, 700 for titles, 600 for buttons.
- **Eyebrows:** uppercase, tracked, accent blue.

## Layout

- Shell width: `min(1120px, 100% - 2rem)`.
- Home: hero + 2×2 tool card grid (1 col on small screens).
- Tool pages: short intro + primary CTA → modal workspace.

## Components

- **Header:** logo mark, ForgeIMG wordmark, tool nav, author.
- **Footer:** tool links, privacy line, © year + author.
- **Tool card:** icon tile, title, short description, “Open” affordance.
- **Buttons:** `.btn-primary`, `.btn-secondary`, `.btn-lg`.
- **Workspace (right panel):** Upload → Options → Results step rail; shared footer actions.
- **Dropzone / chips / segmented controls:** from `components.css` only.

## Motion

- Hero / workspace rise (~0.6–0.7s) only.
- No continuous animation or glow spam.

## Accessibility

- Focus-visible rings use `--accent`.
- Keep contrast readable on navy and white surfaces.
