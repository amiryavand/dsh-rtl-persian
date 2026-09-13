#!/usr/bin/env node
/**
 * Generate `docs/demo.html` — a self-contained rendering harness.
 *
 * The page is built from the plugin's *real* stylesheet rather than a copy, so
 * it can never drift: `apply()` is run against a stub context, the tapped
 * `<head>` is read back, and the emitted CSS is extracted. The font is inlined
 * as a data URI and `rtl.js` is inlined verbatim, which makes the result openable
 * straight from disk with no server and no network.
 *
 * It exists to produce the README preview image and to check direction,
 * alignment, and font scoping without booting the GUI.
 *
 * @module scripts/build-demo
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as plugin from '../plugin.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'demo.html')

/** Collect the stylesheet and script the plugin would inject into the index. */
function collectInjection() {
  const taps = []
  const ctx = {
    effect: (callback) => {
      const dispose = callback()
      if (typeof dispose !== 'function') throw new Error('effect did not return a disposer')
    },
    webServer: {
      tapIndex: (transform) => {
        taps.push(transform)
        return () => {}
      },
      register: () => () => {},
    },
  }
  plugin.apply(ctx, plugin.Config({}))

  const index = taps.reduce(
    (html, transform) => transform(html),
    '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>',
  )
  const css = index.match(/<style data-dsh-rtl>([\s\S]*?)<\/style>/)
  if (css === null) throw new Error('the plugin emitted no stylesheet')
  return css[1]
}

/** Inline the bundled font so the page needs no server. */
function inlineFont(css) {
  const font = readFileSync(join(ROOT, 'vazirmatn-extralight.woff2')).toString('base64')
  return css.replace(/url\("[^"]*"\)/, `url(data:font/woff2;base64,${font})`)
}

/**
 * Content that exercises every rule the plugin ships: per-block direction,
 * mirrored list and blockquote sides, a table, Persian emphasis, and the
 * code paths that must stay LTR.
 *
 * The `.bubble` cases mirror the real chat surface exactly, because that shape
 * is what the structural rule in `rtl.js` exists for: a block box whose only
 * child is an inline run. Annotating the inline `span` instead of the `div`
 * leaves the message left-aligned, which is the bug the demo now guards.
 */
const SAMPLE = `
<div class="_markdown _demo-content" id="root">
  <h1 id="h-fa">پیام آزمایشی فارسی</h1>
  <p id="fa">سلام، این یک پیام آزمایشی فارسی است که باید از راست به چپ نمایش داده شود.</p>
  <p id="en">Hello, this is an English sentence that must stay left to right.</p>
  <p id="mixed">این پاراگراف با فارسی شروع می‌شود و شامل English words هم هست.</p>
  <p id="strong-fa">این متن <strong>تأکید شدهٔ فارسی</strong> است.</p>
  <h2 id="h2-fa">عنوان دوم فارسی</h2>
  <ul id="ul-fa"><li id="li-fa">مورد اول فهرست فارسی</li><li>مورد دوم فهرست فارسی</li></ul>
  <ul id="ul-en"><li>An English list item</li><li>Second English item</li></ul>
  <blockquote id="bq-fa"><p>نقل قول فارسی برای بررسی جای خط کناری</p></blockquote>
  <blockquote id="bq-en"><p>An English quote block.</p></blockquote>
  <table><tr><th id="th-fa">سرستون</th><th>Header</th></tr><tr><td>خانه یک</td><td>Cell one</td></tr></table>
  <pre id="code">const greeting = 'سلام دنیا'; // یادداشت فارسی</pre>
  <p id="codeish">Inline <code>npm run build</code> inside a Persian جمله.</p>
  <div class="bubble" id="bubble-fa"><span class="plainRun">پیام کاربر: متن داخل یک جعبهٔ بلوکی است و جهت از همان جعبه خوانده می‌شود.</span></div>
  <div class="bubble" id="bubble-en"><span class="plainRun">A user message whose direction comes from the block box.</span></div>
</div>`

const css = inlineFont(collectInjection())
const script = readFileSync(join(ROOT, 'rtl.js'), 'utf8')

const page = `<!doctype html>
<html lang="fa" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dsh-rtl-persian — rendering demo</title>
<style>
/* Stand-ins for the surface's own stylesheet, so the demo exercises the same
   physical-side rules the plugin has to override. */
:root{--dsw-alias-label-caption:#b3b3b3;--dsw-alias-label-primary:#1a1a1a;--dsw-alias-link:#3b6fd4;--ds-font-family-code:"SF Mono",Menlo,monospace}
body{margin:0;padding:40px 32px;background:#fff;max-width:820px;font-size:15px;line-height:26px;
     font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--dsw-alias-label-primary)}
._demo-content{min-width:0;overflow-wrap:anywhere}
._demo-content strong{font-weight:600}
._demo-content h1{font-size:22px;line-height:30px;margin:0 0 16px}
._demo-content h2{font-size:18px;line-height:26px;margin:24px 0 12px}
._demo-content p{margin:0 0 12px}
._demo-content :where(ul,ol){margin:16px 0;padding-left:18px}
._demo-content blockquote{border-left:2px solid var(--dsw-alias-label-caption);margin:16px 0 0;padding-left:14px}
._demo-content pre{font-family:var(--ds-font-family-code);background:#f4f4f4;padding:10px 12px;border-radius:6px;margin:16px 0;overflow:auto}
._demo-content code{font-family:var(--ds-font-family-code);background:#f4f4f4;padding:2px 5px;border-radius:4px}
._demo-content table{border-collapse:collapse;margin:16px 0}
._demo-content td,._demo-content th{border:1px solid #ddd;padding:6px 10px;text-align:start}
/* The real chat bubble: a block box whose only child is an inline run. */
.bubble{display:block;background:#f0f2f5;border-radius:14px;padding:8px 14px;margin:16px 0 8px;max-width:80%}
.bubble .plainRun{display:inline}
#bubble-fa{margin-left:auto}
#bubble-en{margin-right:auto}
</style>
<style data-dsh-rtl>${css}</style>
</head>
<body>
${SAMPLE.trim()}
<script>${script}</script>
</body>
</html>
`

writeFileSync(OUT, page)
console.log(`build-demo: wrote ${OUT} (${page.length} bytes)`)
