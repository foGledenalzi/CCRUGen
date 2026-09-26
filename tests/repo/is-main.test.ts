import { spawnSync } from 'node:child_process'
import { lstatSync, mkdtempSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { isMain } from '../../scripts/is-main.mjs'
import { ROOT } from '../../scripts/golden-manifest.mjs'

// Review WR-02: the guard scripts only ran their CLI when import.meta.url equalled the URL of the
// absolute (but not symlink-resolved) process.argv[1]. Reached through a symlink or a Windows junction the
// two differ, the CLI silently did nothing and exited 0, so `npm run check:repo` and friends passed
// vacuously. These tests run each script through a real link and expect the same exit code as through the
// real path. The link is created at collection time so the tests can be skipped cleanly when the OS refuses
// (symlinks need a privilege on some Windows setups; a junction does not).

const linkParent = mkdtempSync(path.join(tmpdir(), 'ccrug-link-'))
const linkedRoot = path.join(linkParent, 'checkout')
let linked = false
try {
  symlinkSync(ROOT, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
  linked = true
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'EPERM' && code !== 'EACCES') throw err
}

afterAll(() => {
  // Remove only the link itself (never recursively: that must not be able to reach the real checkout).
  if (linked) {
    try {
      unlinkSync(linkedRoot)
    } catch {
      rmdirSync(linkedRoot)
    }
  }
  rmdirSync(linkParent)
})

const CLI: Array<[string, string[], RegExp]> = [
  ['check-repo.mjs', ['--only', 'no-such-check'], /no-such-check/],
  ['page-weight.mjs', ['bogus-command'], /usage/],
  ['golden-manifest.mjs', ['bogus-command'], /usage/],
]

describe.skipIf(!linked)('guard scripts run their CLI through a symlinked or junctioned checkout (WR-02)', () => {
  it('creates a link that resolves to the real checkout but has a different path', () => {
    expect(lstatSync(linkedRoot).isSymbolicLink()).toBe(true)
    expect(path.resolve(linkedRoot)).not.toBe(path.resolve(ROOT))
  })

  it.each(CLI)('%s exits 1 with its error when started from inside the link', (script, args, message) => {
    const result = spawnSync(process.execPath, [path.join('scripts', script), ...args], { cwd: linkedRoot, encoding: 'utf8' })
    expect(result.stderr).toMatch(message)
    expect(result.status).toBe(1)
  })

  it.each(CLI)('%s exits 1 with its error when the script path itself goes through the link', (script, args, message) => {
    const result = spawnSync(process.execPath, [path.join(linkedRoot, 'scripts', script), ...args], { cwd: ROOT, encoding: 'utf8' })
    expect(result.stderr).toMatch(message)
    expect(result.status).toBe(1)
  })

  it('isMain is true for the same module reached through the link', () => {
    const viaLink = path.join(linkedRoot, 'scripts', 'is-main.mjs')
    expect(isMain(pathToFileURL(path.join(ROOT, 'scripts', 'is-main.mjs')).href, viaLink)).toBe(true)
  })
})

describe('isMain', () => {
  const self = pathToFileURL(path.join(ROOT, 'scripts', 'is-main.mjs')).href

  it('is true when argv[1] is the module itself (absolute or relative)', () => {
    expect(isMain(self, path.join(ROOT, 'scripts', 'is-main.mjs'))).toBe(true)
    expect(isMain(self, path.relative(process.cwd(), path.join(ROOT, 'scripts', 'is-main.mjs')))).toBe(true)
  })

  it('is false for a different module, a missing argv[1] and a path that does not exist', () => {
    expect(isMain(self, path.join(ROOT, 'scripts', 'check-repo.mjs'))).toBe(false)
    expect(isMain(self, undefined)).toBe(false)
    expect(isMain(self, '')).toBe(false)
    expect(isMain(self, path.join(ROOT, 'scripts', 'does-not-exist.mjs'))).toBe(false)
  })
})
