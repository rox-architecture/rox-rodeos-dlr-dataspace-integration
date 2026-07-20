---
name: rox-design
description: Use this skill to generate well-branded interfaces and assets for RoX (Digital Ecosystem for AI-based Robotics — a German EU/BMWK-funded research consortium), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and slide templates for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and create static HTML files for the user to view. Use `colors_and_type.css` directly — it defines all color and type tokens as CSS variables and pulls Hanken Grotesk from Google Fonts.

If working on production code, copy assets and read the rules in `README.md` to become an expert in designing with this brand.

Key things to remember about RoX:

- The brand is **bilingual** — German primary, English secondary. Materials are written in an academic / consortium-report tone, not a marketing tone. Third person, no "wir/we", no emoji, no exclamation marks.
- Two primary colors: magenta `#E61971` and blue `#006EB7`, often joined in a 95° gradient (`blue → deep blue → deep pink → pink`). Two secondaries: gold `#FDC300` (warn) and teal `#00AFA5` (ok). Everything else is neutral.
- The signature visual motif is a **network / node graph** rendered as connected dots — already provided as background images in `assets/bg-*.jpg`. Reuse the bitmaps; do not redraw the network in SVG.
- Original font is **Aptos / Aptos Display**. This skill substitutes **Hanken Grotesk** from Google Fonts. Flag the substitution if it matters.
- The funding marks (`assets/funding-*.png`) must appear in any colophon / Impressum.
- See `slides/index.html` for a working 1920×1080 deck with the canonical slide types: cover, section divider on gradient, work-package summary, comparison, big quote, image+text, chart, Impressum.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask a few focused questions about format (slide deck? web page? print PDF?), language (German / English / both), and which slide types they need — then act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.
