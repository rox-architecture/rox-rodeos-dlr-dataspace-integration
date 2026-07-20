# RoX Design System

> **RoX** — *Digital Ecosystem for AI-based Robotics*  
> *Enabling AI Robotics*

A German publicly-funded research consortium project. The visual identity centers on a **network/node** metaphor (literally rendered as connected dots forming a graph) and a signature **blue → magenta** gradient.

## What is RoX?

RoX is the project name for a multi-partner consortium building a "Digital Ecosystem for AI-based Robotics." Materials are bilingual (German primary, English secondary), academic in tone, and produced for formal consortium meetings ("Konsortialtreffen") and project deliverables. The brand surfaces in this project are PowerPoint decks for consortium meetings.

Funded by the **European Union — NextGenerationEU** and the **German Federal Ministry for Economic Affairs and Climate Action (BMWK)** via a decision of the German Bundestag. These funding marks must appear in colophon / Impressum.

## Source materials

| Source | Notes |
|---|---|
| `uploads/RoX_4.Konsortialtreffen_PPT_Template_Folien.potx.pptx` | 16-slide PowerPoint template, the only artifact provided. Authored by Anna Alexandra Sorokina (last modified 2026-02-18). Original template name in metadata: `RoX_2.Konsortialtreffen_PPT_Vorlage`. |

Slide inventory: Title cover · Section divider · Work-package summary (DE) · Work-package summary (EN) · Body-text variants · Section header with sub-title · Closing slide · Impressum (colophon) · Additional templates note · 5-column comparison · Bar chart · Color reference · Footer-only slide. No icon assets, no codebase, no Figma file were provided.

## Index — what's in this folder

```
README.md                  → this file
SKILL.md                   → Claude-Code-compatible skill manifest
colors_and_type.css        → CSS variables for color + type tokens
assets/                    → logos, funding marks, brand backgrounds, key photos
  logo-rox.png             → primary wordmark (cropped from template cover)
  logo-rox-white.jpg       → wordmark on gradient (for dark surfaces)
  bg-title-light.jpg       → full-bleed cover background, white + corner network
  bg-section-gradient.jpg  → full-bleed gradient section divider
  bg-content-corner.jpg    → content background, network only bottom-left
  photo-robot-arm.jpg      → example brand photo (industrial robot + scanner)
  funding-eu-ngeu.png      → "Finanziert von der Europäischen Union" mark
  funding-bmwk-small.png   → BMWK ministry mark (legacy "Wirtschaft und Energie")
  funding-combined.png     → EU + BMWK combined Impressum mark
preview/                   → small HTML cards rendered in the Design System tab
slides/                    → reusable slide templates
  index.html               → 16:9 deck demonstrating all slide types
```

---

## CONTENT FUNDAMENTALS — how RoX writes

**Tone.** Formal, academic, project-management oriented. Reads like a consortium report, not a marketing site. The reader is treated as a peer researcher / work-package lead, never a customer. Imperative or directive voice is rare; descriptive and structural voice dominates.

**Language.** Bilingual. German is the primary language for internal slides ("Zusammenfassung", "Konsortialtreffen", "Weitere Vorlagen", "Impressum"); an English mirror slide is provided where the audience may be international ("TP XY – Summary"). When unsure, prefer **German** for chrome (status labels, navigation, dates), **English** for technical content shared externally.

**Casing.** Sentence case for body. Title Case for slide titles in English. German nouns capitalize normally. **All-caps is reserved for the wordmark "ROX" only** — never use all-caps for headings or labels.

**Pronouns.** Third-person and impersonal. "Das Konsortium…", "The work package…", "Results, events, presentations…". No "wir/we" marketing voice. No "du/Sie" address to the reader.

**Emoji.** Never. The template contains zero emoji and zero emoji-like glyphs. Do not introduce any.

**Punctuation.** German typographic conventions where appropriate: en-dash with spaces ( – ) for parentheticals; ISO date format `2026-05-18` (year-month-day) shown in Impressum. Section labels use a hyphen: `TP XY - Zusammenfassung`.

**Specific patterns observed (verbatim from the template):**

- Cover line 1: `RoX` (brand) → line 2: meeting name (`4. Konsortialtreffen`) → line 3: ISO date range (`18. und 19.05.2026`) → line 4: host institution full legal name (`Deutsches Zentrum für Luft- und Raumfahrt e. V. (DLR), Ulm`)
- Section divider just states the tagline broken into phrases: `Digital` / `Ecosystem` / `for` / `Ai-` / `based` / `Robotics`
- Work-package slide title: `TP XY - Zusammenfassung` (TP = *Teilprojekt*). Section heads inside: `Wichtige aktuelle Themen:`, `Abhängigkeiten zu anderen Arbeitspaketen:`, `TP-Verzögerung (in Monaten)`, `TP-Gesamtstatus`
- Delay scale labels: `> 3M`, `3M`, `2M`, `1M`, `0M`, `voraus` (= ahead of schedule)
- Impressum keys: `Thema:`, `Datum:`, `Autor:`, `Bildquellen:` followed by tab indent
- Image credit default: `Alle Bilder „(CC BY-NC-ND 3.0)", sofern nicht anders angegeben`
- Footer / draft text: `Fußzeile`, `© Musterfirma` are placeholders to be replaced
- Lorem variant used: "Liciissuntio. Abo. Ebitatur Feris in re con ped magnim quos…" (a non-standard Lorem; preserve flavor if generating filler)

**Do / Don't.**

| Do | Don't |
|---|---|
| Use German abbreviations: TP (Teilprojekt), AP (Arbeitspaket), JJJJ-MM-TT | Translate "Konsortialtreffen" → "consortium meeting" on German slides |
| Spell DLR / BMWK / EU on first use; abbreviate after | Use emoji, exclamation marks, marketing superlatives |
| Keep titles short, 2–4 words | Add subtitles longer than the title |
| Treat color as semantic (pink=on-track-pink-bar-of-status; etc.) | Mix random brand colors decoratively |

---

## VISUAL FOUNDATIONS

### Colors

The brand palette has **two primaries (magenta + blue)** and **two secondaries (gold + teal)**. Everything else is neutral.

| Token | Hex | Role |
|---|---|---|
| `--rox-pink` | `#E61971` | Primary accent. Headlines, hero gradient, status "risk". |
| `--rox-pink-deep` | `#A2195B` | Gradient dark stop, hover state for pink. |
| `--rox-pink-soft` | `#F190B2` | Tinted backgrounds, chart series 2. |
| `--rox-blue` | `#006EB7` | Primary brand blue. Links, wordmark. |
| `--rox-blue-deep` | `#2B418C` | Headlines, wordmark variant, deep navy. |
| `--rox-blue-soft` | `#6FB0E1` | Tinted backgrounds, visited links. |
| `--rox-gold` | `#FDC300` | Status "warn", chart accent. |
| `--rox-teal` | `#00AFA5` | Status "ok / ahead", chart accent. |
| `--rox-ink` | `#000000` | Body text on light. |
| `--rox-paper` | `#FFFFFF` | Page. |
| `--rox-paper-2` | `#E8E8E8` | Dividers / surface. |

The **signature gradient** is `blue #006EB7 → deep blue #2B418C → deep pink #A2195B → pink #E61971`, swept on a ~95° angle. Used for cover hero, section dividers, and emphasis bars — never for body text on cards. Optional "text gradient" runs the simpler `#006EB7 → #E61971` for inline display headlines.

### Typography

- **Family.** Original template uses **Aptos / Aptos Display** (Microsoft 365 default). Aptos is not on Google Fonts, so this system substitutes **Hanken Grotesk** (similar humanist proportions, neutral terminals, full weight range). ⚠️ **Substitution flagged** — see *Known caveats* below.
- **Weights used.** Light 300 for display, Regular 400 for body, Semibold 600 for UI / labels, Bold 700 for emphasis.
- **Pairing rule.** One family only. Weight + size handle hierarchy, never a second typeface.
- **Cover & section titles** are *light weight, large size, tight tracking* — the template sets cover headlines at ~88px Light. Body labels are 16–20px Regular.
- **Numbers.** Lining figures. Large stat numbers ride the gradient or the brand blue.

### Spacing & layout

- Base unit **4px**. Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Slide canvas is **1920 × 1080** (PPT widescreen). Comfortable content margin: **64–96px** horizontal, **64px** top, **80px** bottom (room for the network graphic + page number).
- Decks use **fixed elements**: bottom-right wordmark, bottom-left footer text on every content slide. Content never overlaps the corner network graphic.

### Backgrounds

Three template backgrounds, used like masters:

1. **Light + corner-network** (`bg-title-light.jpg`) — white field, pink→blue node graph wraps top-right + bottom-left. **Cover and content slides.**
2. **Gradient + white network** (`bg-section-gradient.jpg`) — full-bleed blue→pink with white nodes. **Section dividers only.**
3. **Light + small bottom-left network** (`bg-content-corner.jpg`) — quieter version of #1 for text-heavy slides.

No hand-drawn illustrations, no patterns or textures other than the node graph. No grain. Imagery (when present) is **cool, high-key, industrial** — see `photo-robot-arm.jpg` for the reference tone (clean studio lighting, slight orange-on-blue color contrast, no people unless hands-only).

### Borders, radii, shadows

- **Radii** are restrained. Cards `8px`, larger panels `12px`, status pills `999px`. Slide elements often have **no rounding at all** — full-bleed bars, rectangular images. Avoid playful `20px+` rounding outside of pills.
- **Borders.** 1px `#D9D9D9` for dividers; never colored borders on cards (no "rounded card with pink left-stripe" trope).
- **Shadows.** Editorial / flat. Cards rest on `0 2px 6px rgba(15,26,60,.08)`; the brand-tinted `--shadow-brand` (`0 16px 40px rgba(230,25,113,.20)`) is reserved for the single hero element on a slide.

### Animation & states

- The source template is print/PDF-first and contains no animation. For interactive surfaces inheriting from this system, treat motion as **slow and editorial**: 200–250ms ease-out for hover, 350ms ease-in-out for layout transitions. No spring/bounce.
- **Hover.** Links → pink `#E61971`. Buttons → darken to `--rox-pink-deep` or `--rox-blue-deep`. Cards → lift to `--shadow-md`, do not invert colors.
- **Press.** Slight scale `0.98`, no color flash.
- **Focus.** 2px `--rox-blue` ring with 2px offset. Never remove focus rings.

### Transparency & blur

Used sparingly. The network graphic sometimes sits behind content at ~100% opacity — content doesn't dim it. No glassmorphism / backdrop-blur. No protection gradients ("scrim") because text is always placed on opaque or near-opaque areas, not over imagery.

### Cards

A RoX card is: white surface · `8px` radius · `1px #E8E8E8` border *or* `--shadow-sm` (pick one, not both) · `24px` interior padding. Title in `--rox-h4` semibold blue-deep, body in regular `--fg-1`. No accent stripes, no colored headers.

---

## ICONOGRAPHY

**The template contains zero icons.** No icon font, no SVG set, no PNG glyphs. The only repeating visual mark is the **network graph motif** (dots connected by lines), which functions as a brand pattern, not an icon system.

**Approach for this design system:**

- For UI iconography in surfaces inheriting this brand, use **Lucide** ([lucide.dev](https://lucide.dev)) at **1.75px stroke**, default size 20px. Lucide's editorial line-icon style matches RoX's restrained, academic feel and pairs cleanly with Hanken Grotesk. Reference via CDN: `https://unpkg.com/lucide-static@latest/icons/<name>.svg`.
  - ⚠️ **Substitution flagged.** The source has no icon system — this is an added recommendation, not extracted from the brand. The user should approve or override.
- **No emoji**, ever. Confirmed by source.
- **No unicode glyph icons** (✓, →, ★, etc.) inside body text; if a directional cue is needed, use a Lucide `arrow-right` or `chevron-right` SVG.
- The **network/node graph** is the closest thing RoX has to an icon. Reuse it for empty states, loading placeholders, and decorative anchors — *as the bitmap from `assets/`*, not redrawn.

Logos & marks (`assets/`):

- `logo-rox.png` — primary horizontal lockup: blue wordmark "ROX" + pink/blue node mark + "Enabling AI Robotics" descriptor. Use on light backgrounds.
- `logo-rox-white.jpg` — same lockup, white version for use on the brand gradient.
- `funding-eu-ngeu.png`, `funding-bmwk-small.png`, `funding-combined.png` — required funder acknowledgements for any public-facing deliverable. The combined mark is the canonical form for Impressum / colophon.

---

## Known caveats & open questions

1. **Font substitution.** Original is **Aptos / Aptos Display** (Microsoft 365 default). Substituted with **Hanken Grotesk** (Google Fonts) because Aptos isn't redistributable. If you have access to the Aptos font files, drop `.woff2` files into `fonts/aptos/` and update `--font-sans` in `colors_and_type.css` — the substitution is the only thing that needs to change.
2. **Logo is bitmap, not vector.** The wordmark was cropped from a PPTX raster background image; no SVG / EPS source was provided. A vector lockup would be strongly preferable. **Please share the official logo files if available.**
3. **Icon system invented.** Lucide is recommended, not extracted from source. Override if your team has standardized on another set.
4. **No codebase, no Figma, no website.** This system is reverse-engineered from a single PowerPoint template — UI kits for digital products were not built because there are no digital surfaces to model. If RoX has a web presence or product UI, share access and a UI kit can be added.
5. **Color names beyond magenta/blue.** Gold and teal appear on the template's reference palette slide but are not used decoratively in any of the actual content slides. Their semantic role (assigned here to "warn" and "ok") is an inferred best guess.
