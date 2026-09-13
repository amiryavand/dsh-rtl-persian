/**
 * dsh-rtl-persian — right-to-left presentation for the dsh Web GUI.
 *
 * The GUI is an LTR surface, so Persian (and other Arabic-script) text is laid
 * out left-to-right: paragraphs sit on the wrong edge, list markers and
 * blockquote rules land on the wrong side, and the script falls back to a Latin
 * face. This plugin makes the surface *bidirectional* instead of flipping it:
 * every text block keeps its own direction, so a conversation that mixes
 * Persian and English renders both correctly.
 *
 * It contributes three things to the Web composition:
 *
 *   1. A `Vazirmatn` webfont restricted by `unicode-range` to Arabic-script
 *      codepoints. Latin letters and digits are outside that range, so they
 *      keep the surface's own sans stack; only Persian text is retyped. The
 *      face is pinned to a single weight (see {@link FONT_WEIGHT}), so Persian
 *      renders in that cut regardless of the weight the surrounding component
 *      asked for.
 *   2. An override of the `--dsw-font-family` design token. Every font-family
 *      in the client consumes that token (directly or through inheritance), so
 *      one declaration retypes the whole surface without touching component
 *      stylesheets.
 *   3. `unicode-bidi: plaintext` on text blocks — the CSS half of `dir="auto"`,
 *      which makes each block take its direction from its own first strong
 *      character. The browser script served alongside this file then sets the
 *      real `dir="auto"` attribute, which additionally moves list markers,
 *      blockquote borders, and the `text-align: start` edge.
 *
 * The stylesheet is appended to the end of `<head>` through the webserver's raw
 * index tap, so it lands *after* the surface's own stylesheets and after the
 * theme stylesheet that declares `--dsw-font-family`. The token override also
 * outranks that declaration on specificity (`html:root` beats `:root`), which
 * matters because the theme's stylesheet is injected at runtime, later in
 * document order.
 *
 * Everything this plugin owns is registered through `ctx.effect`, so stopping
 * or reloading the row removes both routes and the index tap together.
 *
 * @module dsh-rtl-persian
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import z from '@deepseek-ai/schemastery'

/** Stable Cordis plugin name. */
export const name = 'dsh-rtl-persian'

/** The one host service this row needs: routes plus the index render hook. */
export const inject = ['webServer']

/** Config. `dir="auto"` markup and the webfont are on by default; both are toggleable. */
const Config = z.object({
  enabled: z.boolean().default(true),
  /** Retype Arabic-script runs in the bundled Vazirmatn cut. */
  font: z.boolean().default(true),
  /** Mark text blocks with `dir="auto"` so each block resolves its own direction. */
  direction: z.boolean().default(true),
})

/** This plugin's own directory — the font and the browser script ship beside it. */
const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Weight of the bundled Vazirmatn cut. The file and this constant move
 * together: Vazirmatn ships one static file per weight, so raising or lowering
 * the Persian text weight means swapping `vazirmatn-*.woff2` for the matching
 * cut and updating this number. Current cut: 200 ExtraLight.
 */
const FONT_WEIGHT = 200

const FONT_FILE = join(HERE, 'vazirmatn-extralight.woff2')
const SCRIPT_FILE = join(HERE, 'rtl.js')

const FONT_ROUTE = '/dsh-rtl/vazirmatn-extralight.woff2'
const SCRIPT_ROUTE = '/dsh-rtl/dsh-rtl.js'

/** Family name of the injected face. Namespaced so it can never collide. */
const FAMILY = 'Vazirmatn DSH'

/**
 * Codepoints the Vazirmatn face claims. Everything outside this set — Latin
 * letters, Latin digits, punctuation, symbols, CJK — falls through to the next
 * family in the stack, which is what keeps the face Persian-only.
 */
const ARABIC_RANGE = [
  'U+0600-06FF', // Arabic
  'U+0750-077F', // Arabic Supplement
  'U+0870-088E', // Arabic Extended-B
  'U+0890-0891',
  'U+0898-08E1',
  'U+08E3-08FF', // Arabic Extended-A
  'U+200C-200D', // ZWNJ / ZWJ, which join Persian letterforms
  'U+FB50-FDFF', // Arabic Presentation Forms-A
  'U+FE70-FEFF', // Arabic Presentation Forms-B
].join(',')

/** The surface's own sans stack, restated after the injected face. */
const SANS_STACK = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Helvetica Neue"',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',')

/** Text blocks that take their direction from their own content. */
const TEXT_BLOCKS = [
  'p', 'li', 'dt', 'dd', 'blockquote', 'figcaption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'td', 'th', 'caption', 'summary',
].join(',')

/**
 * Build the stylesheet. `font` and `direction` are independent so either half
 * can be turned off without the other.
 * @param font - emit the `@font-face` and the `--dsw-font-family` override.
 * @param direction - emit the per-block `unicode-bidi: plaintext` rule.
 * @returns CSS text, appended to `<head>`.
 */
function buildCss(font, direction) {
  const parts = []

  if (font) {
    parts.push(
      `@font-face{font-family:"${FAMILY}";`
      + `src:url("${FONT_ROUTE}") format("woff2");`
      // Pinned to a single weight: the bundled file is one static cut, and a
      // heavier requested weight (a heading, <strong>) matches this only face
      // rather than pulling in a different Vazirmatn cut.
      + `font-weight:${FONT_WEIGHT};font-style:normal;font-display:swap;`
      + `unicode-range:${ARABIC_RANGE}}`,
      // One token retypes the whole surface: `body` reads it and every
      // component either reads it or inherits the result.
      `html:root{--dsw-font-family:"${FAMILY}",${SANS_STACK}}`,
    )
  }

  if (direction) {
    // `:where()` keeps the selector's specificity at zero so component rules
    // still win wherever they express an intent of their own. `:not([dir])`
    // defers to explicitly-directed markup (code blocks, RTL-aware
    // components) and to the `dir="auto"` the browser script sets.
    parts.push(
      `html:root :where(${TEXT_BLOCKS}):not([dir]){`
      + 'unicode-bidi:plaintext;text-align:start}',
      // The markdown sheet hardcodes physical sides — `blockquote` carries
      // `border-left` + `padding-left:14px` and `:where(ul,ol)` carries
      // `padding-left:18px` — so an RTL block would keep its rule and indent
      // on the far side from its text. `:dir()` reads the *resolved*
      // direction rather than the attribute text, so it is true for exactly
      // the elements the browser script annotated with `dir="auto"`.
      //
      // The containers themselves cannot be annotated: `dir="auto"` skips text
      // inside a descendant that carries its own `dir`, so a list of annotated
      // items would resolve LTR. `:has(…:dir(rtl))` asks the same question from
      // the container without depending on its own direction. The values
      // restate the markdown sheet's own; a browser without `:has()` or
      // `:dir()` drops these rules and simply keeps the unmirrored surface.
      `html:root :where(ul,ol):has(li:dir(rtl)){padding-left:0;padding-right:18px}`,
      'html:root blockquote:has(:dir(rtl)){border-left:0;'
      + 'border-right:2px solid var(--dsw-alias-label-caption,currentColor);'
      + 'padding-left:0;padding-right:14px}',
    )
  }

  return parts.join('\n')
}

/**
 * Read a file, returning `undefined` instead of throwing so a missing asset
 * degrades the feature rather than failing the boot.
 * @param file - absolute path to read.
 * @returns file contents, or `undefined` when unreadable.
 */
function readOrWarn(file) {
  try {
    return readFileSync(file)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`dsh-rtl-persian: cannot read ${file} (${reason}); that asset will not be served`)
    return undefined
  }
}

/**
 * Send one in-memory body with the given content type.
 * @param req - node:http request, read only for its method.
 * @param res - node:http response to complete.
 * @param body - bytes to send.
 * @param contentType - response content type.
 * @param cacheControl - response cache directive.
 */
function send(req, res, body, contentType, cacheControl) {
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': String(body.length),
    'cache-control': cacheControl,
  })
  if (req.method === 'HEAD') res.end()
  else res.end(body)
}

/**
 * Mount the two asset routes and the index tap.
 * @param ctx - the plugin's Cordis context.
 * @param config - the validated {@link Config}.
 */
export function apply(ctx, config) {
  if (!config.enabled) return

  const font = config.font ? readOrWarn(FONT_FILE) : undefined
  const css = buildCss(font !== undefined, config.direction)

  if (css !== '') {
    const sheet = `<style data-dsh-rtl>${css}</style>`
    ctx.effect(
      () => ctx.webServer.tapIndex((html) => (
        /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${sheet}</head>`) : `${html}${sheet}`
      )),
      'dsh-rtl: index stylesheet',
    )
  }

  if (font !== undefined) {
    ctx.effect(
      () => ctx.webServer.register({
        kind: 'exact',
        path: FONT_ROUTE,
        handler: (req, res) => send(req, res, font, 'font/woff2', 'public, max-age=31536000, immutable'),
      }),
      'dsh-rtl: webfont route',
    )
  }

  if (config.direction) {
    ctx.effect(
      () => ctx.webServer.register({
        kind: 'exact',
        path: SCRIPT_ROUTE,
        // Read per request so the browser script stays editable without a boot.
        handler: (req, res) => {
          const body = readOrWarn(SCRIPT_FILE)
          if (body === undefined) {
            res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('dsh-rtl: rtl.js is missing')
            return
          }
          send(req, res, body, 'text/javascript; charset=utf-8', 'no-cache')
        },
      }),
      'dsh-rtl: direction script route',
    )

    const tag = `<script defer src="${SCRIPT_ROUTE}"></script>`
    ctx.effect(
      () => ctx.webServer.tapIndex((html) => (
        /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tag}</head>`) : `${html}${tag}`
      )),
      'dsh-rtl: index script',
    )
  }
}

export { Config }
