# Porthole brand

Source of truth: the Claude Design project (screen 2e). SVG is the canonical format; export PNGs from these at build time for store assets.

## The mark

A ring, a lit half, an aperture at the centre. A porthole and a lens read the same way, so it works at 16px in a menu bar and at 512px in a store listing.

| File | Use |
|---|---|
| `mark.svg` | Light backgrounds. Teal `#1B5E5A`, aperture white |
| `mark-dark.svg` | Dark backgrounds. Muted teal `#7FB8B2`, aperture ink |
| `mark-mono.svg` | Single-colour contexts (uses `currentColor`) |
| `wordmark.svg` / `wordmark-dark.svg` | Mark + "Porthole" in Archivo 700 |
| `icon.svg` | App icon source, teal tile, white mark (1024×1024) |
| `icon-adaptive-foreground.svg` | Android adaptive foreground, transparent, mark in safe zone |

The store listing adds "for Frigate" in regular weight next to the wordmark. The app itself never does.

## Palette

| Hex | Role |
|---|---|
| `#1B5E5A` | accent (teal) · person events |
| `#E6F0EE` | accent soft (selected states, chips) |
| `#0F1719` | ink |
| `#F7F8FA` | paper |
| `#C2410C` | car events · recording |
| `#8B5CF6` | animal events |
| `#4ADE80` | live indicator |

## Type

- **Archivo** — everything that is words. 700 titles, 600 labels, 400/500 body.
- **JetBrains Mono** — anything numeric: clocks, URLs, resolutions, ids, latency.
