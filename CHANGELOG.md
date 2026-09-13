# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-13

Initial release.

### Added

- **Per-block text direction.** Text blocks are annotated with `dir="auto"` by a
  `MutationObserver`-driven browser script, with a `unicode-bidi: plaintext`
  stylesheet rule as the no-script fallback. Persian blocks resolve RTL and
  English blocks stay LTR within the same conversation.
- **Mirrored physical sides.** Persian lists and blockquotes move their indent,
  marker, and rule to the right, targeting the markdown stylesheet's hardcoded
  `padding-left` / `border-left` through `:has()` and `:dir()`.
- **Vazirmatn webfont, Arabic-script only.** The face is attached with
  `unicode-range` limited to Arabic-script codepoints and pinned to a single
  weight, so Latin letters and digits keep the surface's own stack.
- **`--dsw-font-family` token override.** One `html:root` declaration retypes the
  whole surface without touching component stylesheets, outranking the theme's
  runtime `:root` declaration on specificity.
- **Index tap injection.** The stylesheet and script are appended to the end of
  `<head>` through `ctx.webServer.tapIndex`, so they land after the surface's own
  linked stylesheet.
- **Asset routes.** `/dsh-rtl/vazirmatn-extralight.woff2` (immutable cache) and
  `/dsh-rtl/dsh-rtl.js`, both registered as reversible `ctx.effect` scopes.
- **Configuration.** `enabled`, `font`, and `direction` toggles, all defaulting
  to on.
- **Plugin manifest.** `package.json` declares `name` and `version`, which
  `@deepseek-ai/dsh-plugin-package-inventory-deepseek` requires for a
  path-addressed Loader entry. Without it, every model request fails with
  `DeepSeek request extension preparation failed`.
- **Rendering demo and checks.** `npm run build:demo` regenerates a
  self-contained `docs/demo.html` from the plugin's real stylesheet;
  `npm run check` validates syntax and the manifest contract.

[1.0.0]: https://github.com/amiryavand/dsh-rtl-persian/releases/tag/v1.0.0
