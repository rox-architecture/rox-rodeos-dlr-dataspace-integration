# Missing assets — manual download required

Diese Dateien sind Teil des Claude-Design-Projekts „RoX Design System"
(https://claude.ai/design/p/019e1aa7-59dd-71cc-8e9c-6a46f603831a), konnten aber
nicht automatisch importiert werden: Die Design-API (`get_file`) liefert maximal
256 KiB pro Datei, größere Dateien kommen nur abgeschnitten an und wurden daher
bewusst NICHT gespeichert.

| Datei | Zweck |
|---|---|
| `assets/bg-title-light.jpg` | Cover-/Content-Hintergrund (weiß + Netzwerk-Grafik in den Ecken) |
| `assets/bg-section-gradient.jpg` | Vollflächiger Gradient-Hintergrund für Section-Divider |
| `assets/funding-eu-ngeu.png` | EU-„NextGenerationEU"-Fördermittel-Logo (Pflicht im Impressum) |
| `uploads/RoX_4.Konsortialtreffen_PPT_Template_Folien.potx.pptx` | Original-PPT-Template (16 Folien, einzige Primärquelle) |

**So ergänzen:** Dateien aus dem Design-Projekt im Browser herunterladen (oder aus
dem Original-PPT-Template extrahieren) und unter den obigen Pfaden in `design/`
ablegen. Referenzen darauf existieren in `preview/brand-bg-*.html`,
`preview/brand-funding.html` und `slides/index.html`.

**Workarounds bis dahin:**
- Statt `bg-section-gradient.jpg` kann der CSS-Token `--rox-gradient-brand`
  aus `colors_and_type.css` verwendet werden (ohne Netzwerk-Grafik).
- `bg-content-corner.jpg` (vorhanden) ist die ruhigere Variante von
  `bg-title-light.jpg` und kann als Ersatz dienen.
- `funding-combined.png` (vorhanden) enthält die EU+BMWK-Kombimarke und deckt
  die Impressumspflicht ab.
