#!/usr/bin/env node
// Moves out/ (built with NEXT_PUBLIC_BASE_PATH=<sub>) to .e2e-basepath/<sub>/ so `serve .e2e-basepath` hosts it under the sub-path.
// out/ is removed by the move; run `npm run build` again before any root-path check.
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'

const sub = process.argv[2] ?? ''
if (!/^\/[A-Za-z0-9_-]+$/.test(sub)) {
  console.error(`stage-basepath: expected a sub-path like /ccrug, got "${sub}" (Git Bash rewrites /x arguments: run it through npm run test:e2e:basepath or set MSYS_NO_PATHCONV=1)`)
  process.exit(2)
}
if (!existsSync(path.join('out', 'index.html'))) {
  console.error('stage-basepath: out/ is missing; run the basePath build first')
  process.exit(1)
}
const STAGE = '.e2e-basepath'
rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })
renameSync('out', path.join(STAGE, sub.slice(1)))
console.log(`stage-basepath: out/ -> ${STAGE}${sub}/`)
