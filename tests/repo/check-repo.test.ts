import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FORBIDDEN_OUT,
  LORE_FILES,
  LORE_HEADER,
  findCarriageReturns,
  findTrackedJunk,
  findTrackedReference,
  gitattributesProblems,
  isUpstreamOrigin,
  licenseProblems,
  loreProblems,
  missingNoticeEntries,
  parseDirtyStatus,
  scanStaticOut,
  workflowProblems,
} from '../../scripts/check-repo.mjs'
import { ROOT } from '../../scripts/golden-manifest.mjs'

// Repository policy guard (FND-01, FND-02, FND-05, D-04). Every helper is tested with failing inputs so the
// guard cannot pass silently (threat T-01-23). Temp directories live under the OS temp dir and are removed.

const MIT = `MIT License

Copyright (c) 2026 Someone

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.
`

const WORKFLOW = `name: verify
on:
  push:
permissions:
  contents: read
jobs:
  verify:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - run: npm run verify
`

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ccrug-out-'))
  temps.push(dir)
  return dir
}

function put(dir: string, rel: string, content: string | Buffer): void {
  const file = path.join(dir, ...rel.split('/'))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** A clean, minimal static export. */
function cleanOut(): string {
  const dir = tempDir()
  put(dir, 'index.html', '<html><body>redirecting</body></html>')
  put(dir, 'numogram/index.html', '<html><body>CCRUG</body></html>')
  put(dir, '_next/static/chunks/main.js', 'console.log("ok")')
  return dir
}

describe('findTrackedReference', () => {
  it('flags only paths under reference/', () => {
    expect(findTrackedReference(['reference/INDEX.md', 'app/x.ts', 'references.md'])).toEqual(['reference/INDEX.md'])
  })
  it('flags nested reference paths and ignores look-alikes', () => {
    expect(findTrackedReference(['reference/a/b.pdf', 'app/reference/x.ts', 'my-reference/y'])).toEqual(['reference/a/b.pdf'])
  })
  it('returns nothing for an empty file list', () => {
    expect(findTrackedReference([])).toEqual([])
  })
})

describe('isUpstreamOrigin', () => {
  it.each([
    'https://github.com/lumpenspace/ccru.git',
    'https://github.com/lumpenspace/ccru',
    'git@github.com:lumpenspace/ccru.git',
    'https://github.com/lumpenspace/ccru.git\n',
    'https://github.com/lumpenspace/ccru/\n',
    'https://someone@github.com/LumpenSpace/CCRU.git',
  ])('is true for %j', (url) => {
    expect(isUpstreamOrigin(url)).toBe(true)
  })
  it.each([
    'https://github.com/foGledenalzi/CCRUGen.git',
    'https://foGledenalzi@github.com/foGledenalzi/CCRUGen.git\n',
    'https://github.com/lumpenspace/ccru-fork.git',
    'https://github.com/other/ccru.git-mirror',
    '',
  ])('is false for %j', (url) => {
    expect(isUpstreamOrigin(url)).toBe(false)
  })
})

describe('findTrackedJunk', () => {
  it('flags dist/, demo.mov, yarn.lock and every .DS_Store', () => {
    const junk = ['dist/a.js', 'dist/components/x/y.d.ts', 'demo.mov', 'yarn.lock', '.DS_Store', 'public/.DS_Store', '.claude/.DS_Store']
    expect(findTrackedJunk(junk)).toEqual(junk)
  })
  it('does not flag ordinary files or look-alikes', () => {
    expect(findTrackedJunk(['app/page.tsx', 'component-library/index.ts', 'distance/a.js', 'package-lock.json', 'demo.mov.txt'])).toEqual([])
  })
})

describe('missingNoticeEntries', () => {
  const ALL = [...LORE_FILES, 'lumpenspace/ccru'].join('\n')
  it('lists all five lore files and the upstream credit for an empty NOTICE', () => {
    const missing = missingNoticeEntries('')
    expect(missing).toHaveLength(6)
    expect(missing).toContain('lumpenspace/ccru')
    for (const file of LORE_FILES) expect(missing).toContain(file)
  })
  it('returns nothing when all six entries are present', () => {
    expect(missingNoticeEntries(ALL)).toEqual([])
  })
  it('names exactly the entry that was dropped', () => {
    expect(missingNoticeEntries(ALL.replace('app/data/gates.ts', ''))).toEqual(['app/data/gates.ts'])
    expect(missingNoticeEntries(ALL.replace('lumpenspace/ccru', 'upstream'))).toEqual(['lumpenspace/ccru'])
  })
})

describe('licenseProblems', () => {
  it('rejects an empty file', () => {
    expect(licenseProblems('').length).toBeGreaterThan(0)
  })
  it('accepts the canonical MIT text', () => {
    expect(licenseProblems(MIT)).toEqual([])
  })
  it('rejects text missing either required phrase', () => {
    expect(licenseProblems('MIT License\n\nDo what you like.')).not.toEqual([])
    expect(licenseProblems('Permission is hereby granted, free of charge, to anyone.')).not.toEqual([])
  })
})

describe('workflowProblems', () => {
  it('rejects an empty workflow', () => {
    expect(workflowProblems('').length).toBeGreaterThan(0)
  })
  it('accepts a workflow with the verify call, both OSes and a read-only token', () => {
    expect(workflowProblems(WORKFLOW)).toEqual([])
  })
  it('flags pull_request_target', () => {
    expect(workflowProblems(`${WORKFLOW}on:\n  pull_request_target:\n`)).not.toEqual([])
  })
  it.each(['npm run verify', 'ubuntu-latest', 'windows-latest', 'contents: read'])('flags a workflow missing %j', (needle) => {
    expect(workflowProblems(WORKFLOW.replace(needle, 'x'))).not.toEqual([])
  })
})

describe('gitattributesProblems', () => {
  it('accepts the LF rule', () => {
    expect(gitattributesProblems('* text=auto eol=lf\n')).toEqual([])
    expect(gitattributesProblems('# comment\r\n*.png binary\n  * text=auto eol=lf  \n')).toEqual([])
  })
  it('rejects a rule without eol=lf, or an empty file', () => {
    expect(gitattributesProblems('* text=auto\n')).not.toEqual([])
    expect(gitattributesProblems('')).not.toEqual([])
  })
})

describe('loreProblems', () => {
  const good = () => `${LORE_HEADER}\nexport const x = 1\n`
  it('passes when every lore file starts with the header', () => {
    expect(loreProblems(good)).toEqual([])
  })
  it('names a lore file whose header is missing, misplaced or absent', () => {
    const files: Record<string, string> = {}
    for (const f of LORE_FILES) files[f] = good()
    files['app/data/zones.ts'] = 'export const x = 1\n'
    files['app/data/gates.ts'] = `\n${LORE_HEADER}\n`
    const problems = loreProblems((f) => {
      if (f === 'app/data/demons.ts') throw new Error('ENOENT')
      return files[f]
    })
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toContain('app/data/zones.ts')
    expect(problems.join('\n')).toContain('app/data/gates.ts')
    expect(problems.join('\n')).toContain('app/data/demons.ts')
  })
})

describe('findCarriageReturns', () => {
  it('flags files containing byte 13 (relative, forward-slash paths) and skips clean files', () => {
    const dir = tempDir()
    put(dir, 'lf.txt', 'a\nb\n')
    put(dir, 'sub/crlf.txt', Buffer.from('a\r\nb\r\n'))
    expect(findCarriageReturns(dir)).toEqual(['sub/crlf.txt'])
  })
  it('returns nothing for a missing directory', () => {
    expect(findCarriageReturns(path.join(tempDir(), 'nope'))).toEqual([])
  })
})

describe('scanStaticOut', () => {
  it('accepts a clean export', () => {
    expect(scanStaticOut(cleanOut())).toEqual([])
  })
  it('reports a missing index.html and a missing numogram/index.html', () => {
    const dir = tempDir()
    put(dir, 'numogram/index.html', '<html></html>')
    expect(scanStaticOut(dir).join('\n')).toContain('index.html')
    const dir2 = tempDir()
    put(dir2, 'index.html', '<html></html>')
    expect(scanStaticOut(dir2).join('\n')).toContain('numogram/index.html')
  })
  it('reports a missing output directory', () => {
    expect(scanStaticOut(path.join(tempDir(), 'nope')).length).toBeGreaterThan(0)
  })
  it.each([
    ['api/share-image', 'fetch("/api/share-image")'],
    ['_vercel', '<script src="/_vercel/insights/script.js">'],
    ['vercel-scripts', 'vercel-scripts.com'],
    ['vercel-storage', 'x.vercel-storage.com'],
    ['@vercel/', 'import "@vercel/analytics"'],
    ['qliphoth', 'visit num.qliphoth.systems'],
    ['qliphoth (upper case)', 'QLIPHOTH'],
    ['delight nexus', '(c) Delight Nexus'],
  ])('reports a file containing %s and names its path', (_label, text) => {
    const dir = cleanOut()
    put(dir, '_next/static/chunks/leak.js', text)
    const problems = scanStaticOut(dir)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('_next/static/chunks/leak.js')
  })
  it.each(['html', 'js', 'css', 'txt', 'json', 'xml'])('scans .%s files', (ext) => {
    const dir = cleanOut()
    put(dir, `extra/file.${ext}`, 'delight nexus')
    expect(scanStaticOut(dir).join('\n')).toContain(`extra/file.${ext}`)
  })
  it('does not scan binary files', () => {
    const dir = cleanOut()
    put(dir, 'logo.png', 'qliphoth')
    expect(scanStaticOut(dir)).toEqual([])
  })
  it('reports an api directory', () => {
    const dir = cleanOut()
    put(dir, 'api/hello/index.html', '<html></html>')
    expect(scanStaticOut(dir).join('\n')).toContain('api')
  })
  it('reports a .DS_Store file, at any depth', () => {
    const dir = cleanOut()
    put(dir, '.DS_Store', 'x')
    put(dir, 'numogram/.DS_Store', 'x')
    const problems = scanStaticOut(dir)
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('numogram/.DS_Store')
  })
})

describe('FORBIDDEN_OUT', () => {
  it('covers the Vercel, share-image and upstream-branding markers', () => {
    const sample = ['_vercel', 'vercel-scripts', 'vercel-storage', '@vercel/blob', 'api/share-image', 'Qliphoth', 'Delight Nexus']
    for (const text of sample) expect(FORBIDDEN_OUT.some((re) => re.test(text))).toBe(true)
    expect(FORBIDDEN_OUT.some((re) => re.test('CCRUG numogram generator'))).toBe(false)
  })
})

describe('parseDirtyStatus', () => {
  it('returns one entry per non-empty porcelain line, keeping the status columns', () => {
    expect(parseDirtyStatus(' M app/x.ts\n?? y\n')).toEqual([' M app/x.ts', '?? y'])
  })
  it('returns [] for a clean tree', () => {
    expect(parseDirtyStatus('')).toEqual([])
    expect(parseDirtyStatus('\n\n')).toEqual([])
  })
  it('tolerates CRLF line endings', () => {
    expect(parseDirtyStatus('M  a\r\nD  b\r\n')).toEqual(['M  a', 'D  b'])
  })
})

describe('check-repo.mjs source and CLI', () => {
  const script = path.join(ROOT, 'scripts', 'check-repo.mjs')
  it('never uses a shell (execFileSync only)', () => {
    const src = readFileSync(script, 'utf8')
    expect(src).toContain("execFileSync('git'")
    expect(src).not.toMatch(/execSync\(/)
    expect(src).not.toMatch(/shell:\s*true/)
  })
  it('never contacts a remote', () => {
    const src = readFileSync(script, 'utf8')
    expect(src).not.toMatch(/'(push|fetch|pull|ls-remote|clone)'/)
  })
  it('exits 1 on an unknown check name and 0 on a passing one', () => {
    const bad = spawnSync(process.execPath, [script, '--only', 'no-such-check'], { cwd: ROOT, encoding: 'utf8' })
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('no-such-check')
    const ok = spawnSync(process.execPath, [script, '--only', 'gitattributes'], { cwd: ROOT, encoding: 'utf8' })
    expect(ok.status).toBe(0)
    expect(ok.stdout).toContain('check-repo: OK (gitattributes)')
  })
})
