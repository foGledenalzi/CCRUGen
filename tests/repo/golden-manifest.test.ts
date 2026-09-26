import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ROOT, addSet, emptyManifest, listFiles, sha256, verifyManifest } from '../../scripts/golden-manifest.mjs'

// Golden-manifest freeze/verify tool (FND-02, D-15). Unit tests use an in-memory file system; the CLI
// tests use a scratch directory under node_modules (git-ignored, removed afterwards). No real golden
// file is touched by this suite.

const enc = (s: string) => Buffer.from(s, 'utf8')

function memFs(files: Record<string, string>) {
  return {
    readFile: (p: string) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return enc(v)
    },
    listDir: (dir: string) => Object.keys(files).filter((f) => f.startsWith(`${dir}/`)).sort(),
  }
}

const hashes = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([p, c]) => [p, sha256(enc(c))]))

const GOLDENS = {
  'e2e/__golden__/golden.spec.ts/a--b.txt': 'alpha\nbeta\n',
  'e2e/__golden__/golden.spec.ts/c--d.txt': 'gamma\n',
}
const STRICT = 'e2e/__golden__'
const SET = '2026-09-25-baseline'

function baseline() {
  return addSet(emptyManifest(STRICT), {
    set: SET,
    date: '2026-09-25',
    reason: 'pre-refactor base-10 oracle',
    files: hashes(GOLDENS),
  })
}

describe('sha256', () => {
  it('matches the FIPS 180 test vector for "abc"', () => {
    expect(sha256(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('emptyManifest', () => {
  it('has version 1, no sets, and the given strictDir (null by default)', () => {
    expect(emptyManifest(STRICT)).toEqual({ version: 1, strictDir: STRICT, sets: [] })
    expect(emptyManifest()).toEqual({ version: 1, strictDir: null, sets: [] })
  })
})

describe('addSet', () => {
  it('appends a set and returns a new manifest without mutating the input', () => {
    const m0 = emptyManifest(STRICT)
    const m1 = baseline()
    expect(m0.sets).toHaveLength(0)
    expect(m1).not.toBe(m0)
    expect(m1.strictDir).toBe(STRICT)
    expect(m1.sets).toHaveLength(1)
    expect(m1.sets[0]).toEqual({
      set: SET,
      date: '2026-09-25',
      reason: 'pre-refactor base-10 oracle',
      files: hashes(GOLDENS),
    })
  })

  it('trims the written reason', () => {
    const m = addSet(emptyManifest(), {
      set: SET,
      date: '2026-09-25',
      reason: '  because  \n',
      files: { 'x.txt': sha256(enc('x')) },
    })
    expect(m.sets[0].reason).toBe('because')
  })

  it('accepts a second set with new files', () => {
    const m2 = addSet(baseline(), {
      set: '2026-10-01-new-region-colours',
      date: '2026-10-01',
      reason: 'intentional visual change',
      files: { 'e2e/__golden__/2026-10-01/e--f.txt': sha256(enc('new')) },
    })
    expect(m2.sets.map((s: { set: string }) => s.set)).toEqual([SET, '2026-10-01-new-region-colours'])
  })

  it('throws when the set name already exists', () => {
    expect(() =>
      addSet(baseline(), {
        set: SET,
        date: '2026-09-25',
        reason: 'again',
        files: { 'other.txt': sha256(enc('o')) },
      }),
    ).toThrow(/already exists/)
  })

  it('throws when a file is already frozen by an earlier set (re-freeze under a new set name)', () => {
    expect(() =>
      addSet(baseline(), {
        set: '2026-10-01-regenerated',
        date: '2026-10-01',
        reason: 'attempt to overwrite',
        files: { 'e2e/__golden__/golden.spec.ts/a--b.txt': sha256(enc('different')) },
      }),
    ).toThrow(/already frozen, never overwritten/)
  })

  it('throws when the reason is empty or whitespace', () => {
    for (const reason of ['', '   ', '\n\t']) {
      expect(() =>
        addSet(emptyManifest(), { set: SET, date: '2026-09-25', reason, files: { 'x.txt': sha256(enc('x')) } }),
      ).toThrow(/--reason/)
    }
  })

  it('throws when the set name is not YYYY-MM-DD-slug', () => {
    for (const set of ['baseline', '2026-9-25-baseline', '2026-09-25', '2026-09-25-', '2026-09-25-Baseline', '2026-09-25-a_b']) {
      expect(() =>
        addSet(emptyManifest(), { set, date: '2026-09-25', reason: 'why', files: { 'x.txt': sha256(enc('x')) } }),
      ).toThrow(/YYYY-MM-DD/)
    }
  })

  it('throws when there are no files', () => {
    expect(() => addSet(emptyManifest(), { set: SET, date: '2026-09-25', reason: 'why', files: {} })).toThrow(/no files/)
  })
})

describe('verifyManifest', () => {
  it('returns [] for an intact manifest', () => {
    const { readFile, listDir } = memFs(GOLDENS)
    expect(verifyManifest(baseline(), readFile, listDir)).toEqual([])
  })

  it('returns [] for an empty manifest with no strictDir', () => {
    const { readFile, listDir } = memFs({})
    expect(verifyManifest(emptyManifest(), readFile, listDir)).toEqual([])
  })

  it('reports changed: for a hash mismatch, naming the file and set', () => {
    const { readFile, listDir } = memFs({ ...GOLDENS, 'e2e/__golden__/golden.spec.ts/a--b.txt': 'alpha\nBETA\n' })
    expect(verifyManifest(baseline(), readFile, listDir)).toEqual([
      `changed: e2e/__golden__/golden.spec.ts/a--b.txt (set ${SET})`,
    ])
  })

  it('reports missing: for an unreadable file', () => {
    const rest = { 'e2e/__golden__/golden.spec.ts/c--d.txt': GOLDENS['e2e/__golden__/golden.spec.ts/c--d.txt'] }
    const { readFile, listDir } = memFs(rest)
    expect(verifyManifest(baseline(), readFile, listDir)).toEqual([
      `missing: e2e/__golden__/golden.spec.ts/a--b.txt (set ${SET})`,
    ])
  })

  it('reports CR in <file> for a frozen file that contains a carriage return', () => {
    const crFile = { 'e2e/__golden__/golden.spec.ts/a--b.txt': 'alpha\r\nbeta\r\n' }
    const m = addSet(emptyManifest(STRICT), {
      set: SET,
      date: '2026-09-25',
      reason: 'hand-edited manifest with a CR file',
      files: hashes({ ...crFile }),
    })
    const { readFile, listDir } = memFs(crFile)
    const problems = verifyManifest(m, readFile, listDir)
    expect(problems).toEqual(['CR in e2e/__golden__/golden.spec.ts/a--b.txt'])
  })

  it('reports unfrozen file in <strictDir>: for a file no set covers', () => {
    const { readFile, listDir } = memFs({ ...GOLDENS, 'e2e/__golden__/golden.spec.ts/sneaky.txt': 'extra\n' })
    expect(verifyManifest(baseline(), readFile, listDir)).toEqual([
      `unfrozen file in ${STRICT}: e2e/__golden__/golden.spec.ts/sneaky.txt`,
    ])
  })

  it('does not scan any directory when strictDir is null', () => {
    const files = { 'engine/test/fixtures/base10.golden.json': '{}\n', 'engine/test/fixtures/stray.json': '{}\n' }
    const m = addSet(emptyManifest(), {
      set: SET,
      date: '2026-09-25',
      reason: 'numeric oracle',
      files: hashes({ 'engine/test/fixtures/base10.golden.json': files['engine/test/fixtures/base10.golden.json'] }),
    })
    const { readFile, listDir } = memFs(files)
    expect(verifyManifest(m, readFile, listDir)).toEqual([])
  })

  it('ignores a MANIFEST.json inside the strict directory', () => {
    const { readFile, listDir } = memFs({ ...GOLDENS, 'e2e/__golden__/MANIFEST.json': '{}\n' })
    expect(verifyManifest(baseline(), readFile, listDir)).toEqual([])
  })

  it('verifies every set, including a later dated set', () => {
    const later = { 'e2e/__golden__/2026-10-01/e--f.txt': 'new look\n' }
    const m = addSet(baseline(), {
      set: '2026-10-01-new-look',
      date: '2026-10-01',
      reason: 'intentional visual change',
      files: hashes(later),
    })
    const ok = memFs({ ...GOLDENS, ...later })
    expect(verifyManifest(m, ok.readFile, ok.listDir)).toEqual([])
    const bad = memFs({ ...GOLDENS, 'e2e/__golden__/2026-10-01/e--f.txt': 'tampered\n' })
    expect(verifyManifest(m, bad.readFile, bad.listDir)).toEqual([
      'changed: e2e/__golden__/2026-10-01/e--f.txt (set 2026-10-01-new-look)',
    ])
  })
})

describe('CLI and file system (scratch dir under node_modules)', () => {
  const SCRATCH_REL = 'node_modules/.tmp-golden-manifest-test'
  const scratch = path.join(ROOT, SCRATCH_REL)
  const script = path.join(ROOT, 'scripts', 'golden-manifest.mjs')
  const manifestRel = `${SCRATCH_REL}/MANIFEST.json`
  const goldenDirRel = `${SCRATCH_REL}/g`

  const run = (...args: string[]) => {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' })
    return { status: r.status, out: `${r.stdout}${r.stderr}` }
  }
  const write = (rel: string, content: string) => {
    const abs = path.join(ROOT, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }

  beforeAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
    fs.mkdirSync(scratch, { recursive: true })
  })
  afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('listFiles walks directories, skips MANIFEST.json, sorts and de-duplicates', () => {
    write(`${SCRATCH_REL}/list/b/two.txt`, '2\n')
    write(`${SCRATCH_REL}/list/a.txt`, '1\n')
    write(`${SCRATCH_REL}/list/MANIFEST.json`, '{}\n')
    write(`${SCRATCH_REL}/list/b/MANIFEST.json`, '{}\n')
    expect(listFiles(`${SCRATCH_REL}/list`, `${SCRATCH_REL}/list/a.txt`)).toEqual([
      `${SCRATCH_REL}/list/a.txt`,
      `${SCRATCH_REL}/list/b/two.txt`,
    ])
  })

  it('verify on a missing manifest exits 1 and prints "manifest missing"', () => {
    const r = run('verify', 'does-not-exist.json')
    expect(r.status).toBe(1)
    expect(r.out).toContain('manifest missing')
  })

  it('freeze then verify, then refuses to overwrite and detects tampering', () => {
    write(`${goldenDirRel}/one.txt`, 'one\n')
    write(`${goldenDirRel}/sub/two.txt`, 'two\n')

    const frozen = run('freeze', manifestRel, '--set', '2026-01-01-test-baseline', '--reason', 'unit test baseline', '--strict-dir', goldenDirRel, goldenDirRel)
    expect(frozen.status).toBe(0)
    expect(frozen.out).toContain('froze 2 files as 2026-01-01-test-baseline')

    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestRel), 'utf8'))
    expect(manifest.version).toBe(1)
    expect(manifest.strictDir).toBe(goldenDirRel)
    expect(manifest.sets[0].reason).toBe('unit test baseline')
    expect(Object.keys(manifest.sets[0].files)).toEqual([`${goldenDirRel}/one.txt`, `${goldenDirRel}/sub/two.txt`])
    expect(fs.readFileSync(path.join(ROOT, manifestRel), 'utf8').endsWith('}\n')).toBe(true)

    const ok = run('verify', manifestRel)
    expect(ok.status).toBe(0)
    expect(ok.out).toContain('OK 2 files in 1 sets')

    // Re-freezing an already frozen file under a new set name is refused, and the manifest is untouched.
    const before = fs.readFileSync(path.join(ROOT, manifestRel), 'utf8')
    const refreeze = run('freeze', manifestRel, '--set', '2026-02-02-again', '--reason', 'try to regenerate', `${goldenDirRel}/one.txt`)
    expect(refreeze.status).toBe(1)
    expect(refreeze.out).toContain('already frozen, never overwritten')
    expect(fs.readFileSync(path.join(ROOT, manifestRel), 'utf8')).toBe(before)

    // A missing reason is refused.
    const noReason = run('freeze', manifestRel, '--set', '2026-02-02-again', `${goldenDirRel}/one.txt`)
    expect(noReason.status).toBe(1)
    expect(noReason.out).toContain('--reason')

    // Tampering, and an extra file inside the strict directory, are reported.
    write(`${goldenDirRel}/one.txt`, 'ONE\n')
    write(`${goldenDirRel}/stray.txt`, 'stray\n')
    const bad = run('verify', manifestRel)
    expect(bad.status).toBe(1)
    expect(bad.out).toContain(`changed: ${goldenDirRel}/one.txt (set 2026-01-01-test-baseline)`)
    expect(bad.out).toContain(`unfrozen file in ${goldenDirRel}: ${goldenDirRel}/stray.txt`)
  })

  it('freeze refuses a file that contains a carriage return', () => {
    write(`${SCRATCH_REL}/crlf/bad.txt`, 'a\r\nb\r\n')
    const r = run('freeze', `${SCRATCH_REL}/crlf/MANIFEST.json`, '--set', '2026-03-03-crlf', '--reason', 'should be refused', `${SCRATCH_REL}/crlf/bad.txt`)
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/CR/)
    expect(fs.existsSync(path.join(ROOT, `${SCRATCH_REL}/crlf/MANIFEST.json`))).toBe(false)
  })
})
