# Responsive contract

Three widths, the same three already agreed in mynewshub2 and social-command-center.
**Do not invent a fourth set.** Enforced by `npm run audit:responsive` (Order F).

| Name | Target | CSS boundary | Intent |
|---|---|---|---|
| mobile | **390px** | ≤720 fine-tune, ≤1100 structure | One column. Bottom tab bar. Secondary controls move into nav. |
| iPad | **820px** | ≤1024 grid (sidebar from 721) | Sidebar appears, rail moves below. **A thumb device: touch rules still apply.** |
| desktop | **1280px+** | ≥1101 | Sidebar + main + 340px rail (`--rail-width`), capped at `--container-page` (76rem). |

Boundaries sit *above* each target on purpose, so a slightly wider device still gets the
right layout.

## Rules

- **Size layout in CSS, never in JavaScript.** The shell (`.fr-shell / .fr-body /
  .fr-sidebar / .fr-main / .fr-tabbar` in `src/styles/tokens.css`) renders both nav
  surfaces and lets media queries choose. `useViewport()` flags (`isMobile ≤720`,
  `isTablet 721–1100`, `isDesktop ≥1101`) are for *behaviour*, not layout.
- **Page gutters** `--gutter`: 16px phone / 24px desktop. **Module gaps** `--module-gap`:
  32px phone / 40px desktop.
- **44px hit area on every control.** Use the `tap` utility (tokens.css): it adds a
  `::after` hit area of `max(100%, --tap-min)` and leaves the visual size alone.
- Grid tracks holding content use `minmax(0, 1fr)`, never a bare `1fr`.
- Flex / grid children that hold text get `min-width: 0`.
- Tables and code scroll inside their own `overflow-x: auto` frame. The document never
  scrolls horizontally.
- Motion: 150ms colour/border, 200ms fades, all of it off under `prefers-reduced-motion`.

## Breakpoint cheat-sheet

```css
/* mobile is the default — write it first */
@media (min-width: 721px)  { /* iPad: sidebar, grid */ }
@media (min-width: 1101px) { /* desktop: rail, capped page */ }
@media (max-width: 720px)  { /* phone fine-tune only */ }
@media (pointer: coarse)   { /* touch: never shrink hit areas */ }
```

## Verifying

- `/design` → **Tap targets** toggle outlines every hit area; sub-44px controls go red.
- `?debug=1` on any page → overlay with viewport, CLS, controls under 44px, network;
  **Copy report** gives one JSON blob.
- `npm run audit:responsive` → real Chromium at 390 / 820 / 1280 × light / dark.
