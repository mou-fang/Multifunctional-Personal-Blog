# Color Thief 3.5.0

- Upstream: https://github.com/lokesh/color-thief
- Documentation: https://lokeshdhakar.com/projects/color-thief/
- Vendored browser bundle: https://unpkg.com/colorthief@3.5.0/dist/umd/color-thief.global.js
- License: MIT, retained in `LICENSE`.
- Bundle SHA-256: `684177eb7002af0a7de708f3c0f02790d213694bdfd9ced3dfee325da9ebae7c`

Used inside `js/color-tools-worker.js` for representative colors from a locally
decoded and downsampled image region. The browser bundle is served locally; no
remote image or extraction service is involved. This versioned directory avoids
the site's immutable library cache serving an old version after future upgrades.

Interaction references (no UI code or assets copied):

- Chromapicker (MIT): https://github.com/mthcht/chromapicker
- ColorPalette Pro (MIT): https://github.com/royalfig/color-palette-generator

Independent color-tool calculations reference:

- Screen eyedropper: https://developer.chrome.com/docs/capabilities/web-apis/eyedropper
- WCAG 2.2 contrast: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Machado, Oliveira and Fernandes, 2009, color-vision simulation (severity 1.0,
  linear sRGB): https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
- Author-hosted paper: https://profs.ic.uff.br/~laffernandes/content/publications/journal/2009_tvcg_15(6)/machado_oliveira_fernandes-tvcg-15(6)-2009-corrected.pdf

The color-vision previews illustrate a model; they are approximate design aids.
Color harmonies use HSL hue relationships and lightness variants. Display RGB
values are not physical paint mixing formulas or manufacturer paint codes.
