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

  it('does not apply the purity rules under engine/test/ (scope of the override)', async () => {
    const code = "import { it } from 'vitest'\nexport const a = process.env.X\nexport { it }"
    expect(await boundaryRules(code, 'engine/test/__guard__.test.ts')).toEqual([])
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
