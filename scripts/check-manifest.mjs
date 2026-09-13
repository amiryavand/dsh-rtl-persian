#!/usr/bin/env node
/**
 * Guard the one contract that can take down every chat.
 *
 * The DeepSeek request-extension inventory resolves this plugin's owning
 * manifest by walking up from the plugin directory and requires a non-empty
 * `name` *and* `version`. A manifest missing either one makes every model
 * request fail with "DeepSeek request extension preparation failed".
 *
 * This check fails the build before that can ship, and also verifies that the
 * two runtime assets `plugin.mjs` resolves at apply time are present.
 *
 * @module scripts/check-manifest
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

/** Record a failed assertion. */
function fail(message) {
  failures.push(message)
}

const manifestPath = join(ROOT, 'package.json')
if (!existsSync(manifestPath)) {
  fail('package.json is missing — the request-extension inventory cannot resolve this plugin')
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const field of ['name', 'version']) {
    const value = manifest[field]
    if (typeof value !== 'string' || value.length === 0) {
      fail(`package.json must declare a non-empty "${field}" (found ${JSON.stringify(value)})`)
    }
  }
  if (manifest.type !== 'module') {
    fail('package.json must set "type": "module" — plugin.mjs is an ES module')
  }
}

for (const asset of ['plugin.mjs', 'rtl.js', 'vazirmatn-extralight.woff2']) {
  if (!existsSync(join(ROOT, asset))) fail(`missing runtime asset: ${asset}`)
}

if (failures.length > 0) {
  console.error('check-manifest: FAILED')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('check-manifest: ok (manifest identity and runtime assets present)')
