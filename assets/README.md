# Artwork

All PNGs have fully transparent backgrounds (except the wallpaper tiles), are cut for ivory `#FFFCF6` with no white halos, and ship at 1× and 2×. The `.svg` beside each is the editable source.

## ornaments/
Watercolor wildflower sprays: pink cosmos, coral poppy, buttercups, daisies, pink clusters, sage stems.

- `hero-sprig` 1200×400 — symmetrical, fuller centre, tapering tips
- `section-ornament` 600×150 — one stem, five blooms
- `single-stem` 160×400 — poppy with a bud

`-wallpaper` variants use the restaurant's warmer palette (raspberry, marigold, deep olive).

## illustrations/
Ink-and-wash sketches of the venue.

- `building` 1200×700 — red-brick Presidio building, white porch, dormers, palm, rose hedge
- `hollyhocks` 520×860 — the lounge mural: three hollyhock spikes, a thistle, a rock
- `wallpaper-tile-ochre` / `wallpaper-tile-ivory` 600×600 — seamless repeat of the dining-room wallpaper
- `butterfly` 240×200, `hummingbird` 320×240, `bud-vase` 240×380 — spots

Regenerate: `node tools/paint.mjs assets/ornaments [soft|wallpaper]` · `node tools/illustrate.mjs assets/illustrations [name…]`
