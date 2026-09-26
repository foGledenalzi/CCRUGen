// FND-04 guard: proves the engine boundary fails on DOM/Node types, non-relative imports and app/ imports.
// Two mechanisms are tested because neither is enough alone: tsc (lib ES2022, types []) rejects DOM/Node
// globals and node: modules, ESLint rejects bare imports, app/ imports and nondeterminism.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
const BOUNDARY_RULES = new Set(['no-restricted-syntax', 'no-restricted-globals', 'import/no-restricted-paths'])

interface LintMessage { ruleId: string | null; message: string }
interface LintResult { messages: LintMessage[] }
interface ESLintLike { lintText(code: string, options: { filePath: string }): Promise<LintResult[]> }
type ESLintCtor = new (options: { cwd: string }) => ESLintLike

// eslint 8.57.1 ships no types and @types/eslint is not installed: load it through createRequire.
const loadCjs = createRequire(import.meta.url)
const { ESLint } = loadCjs('eslint') as { ESLint: ESLintCtor }
const eslint = new ESLint({ cwd: ROOT })

async function boundaryRules(code: string, file = 'engine/core/__guard__.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) })
  return (result?.messages ?? []).map(m => m.ruleId ?? '').filter(id => BOUNDARY_RULES.has(id))
}

function runTsc(source: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ccrug-engine-guard-'))
  try {
    writeFileSync(join(dir, 'probe.ts'), source)
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ extends: join(ROOT, 'engine', 'tsconfig.json'), include: ['./*.ts'], exclude: [] }),
    )
    try {
      return { code: 0, out: execFileSync(process.execPath, [TSC, '-p', dir, '--noEmit'], { encoding: 'utf8', stdio: 'pipe' }) }
    } catch (e) {
      const err = e as { status?: number | null; stdout?: string }
      return { code: err.status ?? 1, out: String(err.stdout ?? '') }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('ESLint engine boundary', () => {
  const violations: Array<[string, string, string]> = [
    ['bare import (react)', "import React from 'react'\nexport const a = React", 'no-restricted-syntax'],
    ['node: import', "import { readFileSync } from 'node:fs'\nexport const a = readFileSync", 'no-restricted-syntax'],
    ['alias import (@/app/...)', "import { ZONE_REGION } from '@/app/data/zones'\nexport const a = ZONE_REGION", 'no-restricted-syntax'],
    ['export * from a bare module', "export * from 'react'", 'no-restricted-syntax'],
    ['named re-export from a bare module', "export { useState } from 'react'", 'no-restricted-syntax'],
    ['dynamic import of a bare module', "export const load = () => import('react')", 'no-restricted-syntax'],
    ['relative import of app/', "import { ZONE_REGION } from '../../app/data/zones'\nexport const a = ZONE_REGION", 'import/no-restricted-paths'],
    // WR-04: any relative import that climbs out of engine/ is a violation, not only app/ and workers/.
    // These three resolve to real files, which import/no-restricted-paths needs (it ignores unresolved paths).
    ['relative import of tests/', "import { deriveBase10 } from '../../tests/oracle/deriveBase10'\nexport const a = deriveBase10", 'import/no-restricted-paths'],
    ['relative import of scripts/', "import { ROOT } from '../../scripts/golden-manifest.mjs'\nexport const a = ROOT", 'import/no-restricted-paths'],
    ['relative import of component-library/', "import * as lib from '../../component-library/index'\nexport const a = lib", 'import/no-restricted-paths'],
    ['relative re-export of scripts/', "export { ROOT } from '../../scripts/golden-manifest.mjs'", 'import/no-restricted-paths'],
    ['DOM global (document)', 'export const a = document.title', 'no-restricted-globals'],
    ['Node global (process)', 'export const a = process.env.X', 'no-restricted-globals'],
    ['Math.random()', 'export const a = Math.random()', 'no-restricted-syntax'],
    ['new Date()', 'export const a = new Date()', 'no-restricted-syntax'],
    ['Date.now()', 'export const a = Date.now()', 'no-restricted-syntax'],
  ]

  it.each(violations)('rejects %s', async (_name, code, rule) => {
    expect(await boundaryRules(code)).toContain(rule)
  })

  it('accepts a clean engine module with relative imports', async () => {
    expect(await boundaryRules("import { x } from './other'\nexport const y = x + 1")).toEqual([])
  })

  // The except path must really work: `../index` resolves to the existing engine/index.ts, so this fails
  // if the zone rejected everything (the unresolved './other' and '../other' would pass either way).
  it.each(['./other', '../other', '../index', '../core/sibling'])('accepts the import %s, which stays inside engine/', async spec => {
    expect(await boundaryRules(`import * as x from '${spec}'\nexport const y = x`)).toEqual([])
  })

  // WR-04: the override used to match engine/**/*.ts only, so these files escaped every purity rule.
  it.each(['tsx', 'mts', 'cts', 'js', 'mjs', 'cjs'])('applies the purity rules to engine/**/*.%s', async ext => {
    const rules = await boundaryRules(
      "import * as lib from '../../component-library/index'\nexport const a = [lib, document.title, Math.random()]",
      `engine/core/__guard__.${ext}`,
    )
    expect(rules).toContain('import/no-restricted-paths')
    expect(rules).toContain('no-restricted-globals')
    expect(rules).toContain('no-restricted-syntax')
  })

  it('does not apply the purity rules under engine/test/ (scope of the override)', async () => {
    const code = "import { it } from 'vitest'\nexport const a = process.env.X\nexport { it }"
    expect(await boundaryRules(code, 'engine/test/__guard__.test.ts')).toEqual([])
  })
})

// WR-04: `include: ["**/*.ts"]` left .tsx, .mts, .cts, .js, .mjs and .cjs under engine/ outside tsc entirely.
// The probe reuses the include patterns of each real engine tsconfig (and its inherited compiler options) in a
// temp dir, so it fails if a pattern or allowJs/checkJs is dropped, without writing into engine/.
const SOURCE_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs']

function tscOnProbes(extensions: string[]): { code: number; out: string } {
  const real = JSON.parse(readFileSync(join(ROOT, 'engine', 'tsconfig.json'), 'utf8')) as { include: string[] }
  const dir = mkdtempSync(join(tmpdir(), 'ccrug-engine-include-'))
  try {
    for (const ext of extensions) writeFileSync(join(dir, `probe-${ext}.${ext}`), 'export const t = document.title\n')
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ extends: join(ROOT, 'engine', 'tsconfig.json'), include: real.include, exclude: [] }),
    )
    try {
      return { code: 0, out: execFileSync(process.execPath, [TSC, '-p', dir, '--noEmit'], { encoding: 'utf8', stdio: 'pipe' }) }
    } catch (e) {
      const err = e as { status?: number | null; stdout?: string }
      return { code: err.status ?? 1, out: String(err.stdout ?? '') }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('tsc covers every source extension under engine/ (WR-04)', () => {
  it('engine/tsconfig.json checks .ts, .tsx, .mts, .cts, .js, .mjs and .cjs', () => {
    const { code, out } = tscOnProbes(SOURCE_EXTENSIONS)
    expect(code).not.toBe(0)
    for (const ext of SOURCE_EXTENSIONS) expect(out).toMatch(new RegExp(`probe-${ext}\\.${ext}\\(\\d+,\\d+\\): error TS2584`))
  })

  it('engine/tsconfig.test.json lists the same extensions for engine/test and engine/cli', () => {
    const real = JSON.parse(readFileSync(join(ROOT, 'engine', 'tsconfig.test.json'), 'utf8')) as { include: string[] }
    for (const dir of ['test', 'cli']) {
      for (const ext of SOURCE_EXTENSIONS) expect(real.include).toContain(`${dir}/**/*.${ext}`)
    }
  })
})

describe('tsc engine boundary', () => {
  it('rejects DOM types, Node types and node: modules under the real engine config', () => {
    const { code, out } = runTsc(
      "import { readFileSync } from 'node:fs'\nexport const t = document.title\nexport const p = process.env.X\nexport const f = readFileSync\n",
    )
    expect(code).not.toBe(0)
    expect(out).toContain('TS2584')
    expect(out).toContain('TS2591')
    expect(out).toContain('TS2307')
  })

  it('accepts ES2022 code (#private, bigint exponent, for..of over a Set)', () => {
    const { code, out } = runTsc(
      'export class Counter { #n = 0; inc(): number { return ++this.#n } }\n' +
        'export const big = 2n ** 64n\n' +
        'export function sum(s: Set<number>): number { let t = 0; for (const v of s) t += v; return t }\n',
    )
    expect(code).toBe(0)
    expect(out).toBe('')
  })
})

describe('typecheck wiring', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }

  it.each([
    'tsc --noEmit --incremental false',
    'tsc -p engine/tsconfig.json --noEmit',
    'tsc -p engine/tsconfig.test.json --noEmit',
    'tsc -p tsconfig.components.json --noEmit',
    'npm run lint',
  ])('typecheck runs %s', part => {
    expect(pkg.scripts?.typecheck ?? '').toContain(part)
  })

  it('lint covers engine/', () => {
    expect(pkg.scripts?.lint ?? '').toContain('--dir engine')
  })
})
