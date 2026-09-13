/**
 * dsh-rtl browser half — marks content blocks with `dir="auto"`.
 *
 * The browser resolves `dir="auto"` from the first strong directional character
 * of the element, so a Persian paragraph becomes RTL (right-aligned, correct
 * list-marker and blockquote sides) while an English one stays LTR. This is the
 * standard HTML mechanism, and it is what makes per-message direction work in a
 * conversation that mixes both languages.
 *
 * The CSS injected alongside this file already handles the common case through
 * `unicode-bidi: plaintext`; this pass exists for the things only a real
 * direction value can move — list markers, blockquote borders, and the
 * `text-align: start` edge of a block.
 *
 * Rules:
 *   - An element that already carries `dir` is left alone. That covers
 *     explicitly-directed markup (code blocks, RTL-aware components) and makes
 *     the pass idempotent across React re-renders.
 *   - Anything inside `pre`, `code`, `kbd`, or `samp` is skipped: source code
 *     stays LTR.
 */
(() => {
  'use strict'

  // Only elements whose *own* text drives their direction are annotated. A
  // container (`ul`, `ol`, `blockquote`) is deliberately left alone: the
  // HTML `auto` algorithm ignores text inside any descendant that carries its
  // own `dir`, so a list whose items are annotated would resolve to LTR and be
  // worse off than an unannotated one. The stylesheet reaches those containers
  // through `:has(…:dir(rtl))` instead.
  const BLOCK_SELECTOR = [
    'p', 'li', 'dt', 'dd', 'figcaption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'td', 'th', 'caption', 'summary',
  ].join(',')

  // Form fields honour `dir="auto"` natively and re-resolve it while typing,
  // which is what a Persian-speaking user wants from the composer.
  const FIELD_SELECTOR = [
    'textarea',
    'input:not([type])',
    'input[type="text"]',
    'input[type="search"]',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(',')

  const SELECTOR = `${BLOCK_SELECTOR},${FIELD_SELECTOR}`
  const SKIP_INSIDE = 'pre,code,kbd,samp'

  function annotate(element) {
    if (element.nodeType !== 1) return
    if (element.hasAttribute('dir')) return
    if (!element.matches(SELECTOR)) return
    if (element.closest(SKIP_INSIDE) !== null) return
    element.setAttribute('dir', 'auto')
  }

  function scan(root) {
    if (root.nodeType !== 1) return
    annotate(root)
    const found = root.querySelectorAll(SELECTOR)
    for (let index = 0; index < found.length; index += 1) annotate(found[index])
  }

  // Streaming assistant output mutates the tree hundreds of times per second, so
  // added nodes are coalesced into the next animation frame and each node is
  // visited at most once per frame.
  const pending = new Set()
  let scheduled = false

  function flush() {
    scheduled = false
    for (const node of pending) scan(node)
    pending.clear()
  }

  function schedule(node) {
    pending.add(node)
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(flush)
  }

  function start() {
    scan(document.body)
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) schedule(node)
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})()
