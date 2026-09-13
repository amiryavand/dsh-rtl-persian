/**
 * dsh-rtl browser half — marks the box that decides a paragraph's direction
 * with `dir="auto"`.
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
 * ## Which element gets the attribute
 *
 * Only the *block box* that owns a run of text, never an inline box inside it.
 * Two consequences drive the whole design, and both came from inspecting the
 * real GUI rather than a fixture:
 *
 *   - **Inline boxes must stay unannotated.** The HTML `auto` algorithm ignores
 *     text inside any descendant that carries its own `dir`. A chat bubble is
 *     `<div class="…bubble"><span class="…plainRun">متن</span></div>`: putting
 *     `dir` on the `span` hides that text from the `div`, so the `div` resolves
 *     LTR and the message stays left-aligned even though the `span` itself
 *     computed as RTL.
 *   - **The box is not always the text node's parent.** That same bubble is a
 *     block `div` whose only child is the inline `span`, so the direction has to
 *     be read from the `div`. A rule keyed on a tag allow-list (`p`, `li`,
 *     `h2`, …) misses it entirely, which is why this runs on structure — "does
 *     this box own a run of text?" — and not on element names.
 *
 * Explicitly-directed markup is never touched, and anything inside `pre`,
 * `code`, `kbd`, or `samp` is skipped, so source code stays LTR.
 */
(() => {
  'use strict'

  /** Subtrees whose text must keep its own direction. */
  const SKIP_INSIDE = 'pre,code,kbd,samp'

  /**
   * Form fields carry their value out of band, so a text-node test never sees
   * it. They honour `dir="auto"` natively and re-resolve it while typing, which
   * is what a Persian-speaking user wants from the composer.
   */
  const FIELDS = [
    'textarea',
    'input:not([type=checkbox]):not([type=radio]):not([type=range])',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(',')

  /**
   * Whether `element` is the box a run of text belongs to: it holds text
   * directly, or every child it has is inline, so the text is this box's own
   * paragraph rather than a block child's.
   *
   * `element.textContent` is only consulted after the inline-only test, so it
   * never walks a large subtree.
   * @param element - candidate element.
   * @returns true when the element owns a paragraph of text.
   */
  function isTextHost(element) {
    if (element.matches(FIELDS)) return true
    for (const node of element.childNodes) {
      if (node.nodeType === 3 && node.nodeValue.trim() !== '') return true
    }
    if (element.children.length === 0) return false
    for (const child of element.children) {
      if (getComputedStyle(child).display !== 'inline') return false
    }
    return /[^\s]/.test(element.textContent)
  }

  /**
   * Annotate one element, or leave it alone.
   * @param element - candidate element.
   */
  function annotate(element) {
    if (element.nodeType !== 1) return
    if (element.hasAttribute('dir')) return
    if (element.closest(SKIP_INSIDE) !== null) return
    if (!isTextHost(element)) return
    // Checked last, and only for candidates: an inline box must never carry
    // `dir`, for the reason in this file's header.
    if (getComputedStyle(element).display === 'inline') return
    element.setAttribute('dir', 'auto')
  }

  /**
   * Annotate `root` and its descendants.
   * @param root - element to scan.
   */
  function scan(root) {
    if (root.nodeType !== 1) return
    annotate(root)
    const found = root.querySelectorAll('*')
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
