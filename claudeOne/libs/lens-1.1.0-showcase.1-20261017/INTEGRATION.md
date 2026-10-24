# Lens source snapshot

- Upstream: https://github.com/ruiqichenbiec/design-systems
- Directory: `lens/lab/design-system/`
- Package version: `1.1.0-showcase.1`
- Commit: `7a424c93b9be13cf835b91ea67495fec2ec0584e`
- Retrieved: 2026-10-17
- License: MIT, copyright DayDreamInAReverie; see `LICENSE`.

This directory is an unmodified portable-package snapshot plus the root upstream license. `UPSTREAM.json` records SHA-256 hashes of those original files. This note and the manifest are first-party provenance files. No runtime dependencies, installation, build step or external CDN are needed.

The isolated `/lens-preview/` imports the public runtime entry point and the shared optical selection helper. Its adapter preserves the original homepage layout; integration code lives outside this directory. The showcase/examples remain source references; they are not extra routes in the personal workspace.

The preview's `renderer-performance.js` adapts framebuffer allocation, regional copies and its procedural grid without changing this snapshot. `lens-preview/lens-shader.js` contains an explicitly attributed derivative of the original `LENS` fragment: subpixel blur uses bilinear sampling; stronger blur and all other optical calculations remain intact. See the preview README for the performance and geometry contract.

Upstream states that it is provided as-is and not actively maintained. Refraction samples the rendered scene, not arbitrary DOM. CSS/SVG fallback, semantic HTML, keyboard access and lifecycle cleanup remain part of the integration contract.
