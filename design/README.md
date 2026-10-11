# Wildflower — design system for a baby shower website

Hand-painted botanicals on ivory paper, in the Zola / Paperless Post idiom. Everything a shower site needs: tokens, type, components, artwork, a page template and a content checklist.

Open `design/index.html` for the living styleguide and `site/index.html` for the finished page template. Both are plain HTML + CSS with no build step: open them in a browser or serve the repo root.

```
design/      tokens.css · base.css · components.css · index.html (styleguide)
site/        index.html — the invitation page, every section wired up
assets/      ornaments/ (3 pieces × 2 colourways) · illustrations/ (venue set)
tools/       the generators that painted the artwork
```

## Principles

1. **Paper and ink carry the page.** Ivory `#FFFCF6`, warm charcoal text, olive ink for headings and buttons. The pinks and yellows live only in the artwork; none of them pass contrast as text.
2. **One motif, repeated.** The section sprig sits above every italic section title. The hero sprig appears once. The stem signs off. Resist adding a different flourish per section.
3. **Script is a word, not a sentence.** Pinyon Script for the name and a signature. Never for a button, a date or a paragraph.
4. **Nothing required of guests.** No account, no app, no password unless a home address is published. A text/email fallback sits under every form.
5. **Over-tall beats clipped.** Sections stack to one column on phones; nothing gets cut.

## Tokens

All in `tokens.css` as CSS custom properties. Three switches:

| Switch | Where | Values |
|---|---|---|
| Ink colour | `data-ink` on `<html>` or a section | `olive` (default) · `charcoal` · `teal` · `raspberry` |
| Ornament colourway | swap the file name | `hero-sprig.png` ↔ `hero-sprig-wallpaper.png` |
| Section banding | `.band` / `.band--alt` | alternate ivory and `paper-2` |

## Type

| Role | Face | Size | Use |
|---|---|---|---|
| Script | Pinyon Script | clamp(56–104px) | The honoree's name, signatures |
| Display | Cormorant Garamond | 56 | Page titles |
| Section title | Cormorant italic | 42 | "The Details", "Kindly Reply" |
| Heading | Cormorant | 34 | Card titles |
| Lead | Cormorant italic | 24 | Dates, the note from the hosts |
| Body | Cormorant | 20 / 1.6 | Everything you read, max 34rem wide |
| Small caps | Jost 500 | 13 / 0.24em | Eyebrows, nav, form labels, timeline times |

Google Fonts link (one line, in `<head>`):
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&family=Pinyon+Script&display=swap`

## Artwork

### Ornaments (`assets/ornaments/`)
Transparent PNGs at 1× and 2×, plus the source SVG. Two colourways: **soft** (the brief's palette) and **wallpaper** (`-wallpaper` suffix, matched to the restaurant's wall: raspberry, marigold, deeper olive).

| File | Size | Class | Where |
|---|---|---|---|
| `hero-sprig` | 1200×400 | `.ornament--hero` | Once, above the name on the cover |
| `section-ornament` | 600×150 | `.ornament--section` | Above every section title; inside `.divider` |
| `single-stem` | 160×400 | `.ornament--stem` | Footer sign-off; card accent |

### Venue illustrations (`assets/illustrations/`)
Ink line + loose watercolour wash, drawn from the restaurant: the brick Presidio building with its white porch, the wildflower wallpaper, the hollyhock mural, and three spots.

| File | Size | Use |
|---|---|---|
| `building` | 1200×700 | Venue card on Details; a "finding us" card |
| `hollyhocks` | 520×860 | Tall accent beside the note or the RSVP |
| `wallpaper-tile-ochre` / `-ivory` | 600 seamless | Backgrounds — faint, hero only (`.cover--papered`) |
| `butterfly`, `hummingbird`, `bud-vase` | small | Callout art, FAQ, confirmation screen |

Regenerate with `node tools/paint.mjs assets/ornaments [soft|wallpaper]` and `node tools/illustrate.mjs assets/illustrations [name…]` (needs Playwright's Chromium). Colours and layout are variables at the top of each script.

## Components (`components.css`)

Nav · Button (primary, ghost, small, link) · Ornament & Divider · Section heading · Cover · Note from the hosts · Detail cards · Venue card · Timeline · Registry links & Callout · FAQ accordion · Form primitives (input, select, textarea, choice pills) · RSVP confirmation · Photo grid · Countdown · Footer · Invitation card.

Each is shown in `design/index.html` with its markup.

## Page order (`site/index.html`)

Cover → A note from the hosts → The Details (when / where / good to know, venue card, run-of-show) → Registry (+ book-instead-of-card callout) → Questions → Kindly Reply → Footer.

This is the wedding-site order with the wedding-only parts removed (wedding party, travel, multi-day schedule). Sections are independent; delete any `<section>` you don't need.

## RSVP

The form asks: name, email (for a reminder), accept/decline, party size and dietary needs (only shown when accepting), and an optional note. Declining goes straight to the note; the decline wording is warm and never buried. A thank-you panel replaces the form on submit, with "Change your reply".

**Collecting RSVPs.** The template's submit handler is a stub (`// TODO` in `site/index.html`). Point it at any of: a Google Form / Sheet via Apps Script, Formspree or Netlify Forms (zero backend), or a small Supabase table. Add the RSVP deadline to the cover button, the section subtitle and the FAQ so nobody misses it.

## Content checklist

Fill the `[brackets]` in `site/index.html`:

- Honoree(s) first, hosts after. Gender-neutral by default: "parents-to-be", "little one", "Baby [Surname]".
- Date, start **and end** time; venue name, address, which door / which room, parking and rideshare drop-off.
- RSVP method and deadline (two–three weeks out is normal for a shower).
- Partners and children: welcome or not, said plainly.
- Food: what's served; how to flag allergies.
- Dress code described, not labelled ("garden-party casual").
- Registry: expected at a shower, phrased as the host's courtesy. Optional traditions: book instead of card, diaper raffle, display shower, "sprinkle — no gifts needed".
- Footer: host contact, "this page is unlisted".

## Accessibility

Body ≥ 16px; every text colour passes 4.5:1 on ivory (ink, ink-soft, accent and the three alternates all do; `ink-mute` only at 14px+). Visible labels, not placeholders. Real `<button>`, `<a href>`, `<details>` — keyboard works everywhere. Ornaments are `alt=""`; illustrations carrying meaning (the building) are described. `prefers-reduced-motion` honoured. Script type is decorative size only.
