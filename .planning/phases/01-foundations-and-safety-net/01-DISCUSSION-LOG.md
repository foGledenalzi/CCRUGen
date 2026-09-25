# Phase 1: Foundations and Safety Net - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 1-Foundations and Safety Net
**Areas discussed:** Licensing & attribution, Repo home / CI / hosting, Non-numogram baggage, Base-10 parity, What `/` becomes, Playwright browser, Project identity

---

## Licensing & attribution

Evidence gathered: no LICENSE file and no `license` field anywhere; upstream history has 6 commits by `csysp <(old identity email removed)>` (this machine's git identity); gate names/phrases in `app/data/` appear in the CCRU book text.

| Option | Description | Selected |
|--------|-------------|----------|
| Own project, credit upstream | New repo; new code gets your license; upstream-derived files stay "no license stated" with NOTICE | ✓ |
| Stay a fork | Keep fork relationship, no license change until upstream states one | |
| I'm upstream / have their OK | License now with upstream consent | |

| Option (license for new code) | Selected |
|--------|----------|
| MIT | ✓ |
| Apache-2.0 | |
| AGPL-3.0 | |
| Decide later | |

| Option (CCRU-derived lore prose) | Selected |
|--------|----------|
| Isolate as third-party pack (text unchanged, marked, excluded from license, in NOTICE) | ✓ |
| Keep in place, cite sources | |
| Private until reviewed | |

**User's choice:** Own project crediting upstream; MIT; isolate lore as a third-party pack.
**Notes:** Physical isolation is scheduled for the Phase 2 migration; Phase 1 only marks it.

---

## Repo home, CI and hosting

| Option (repo home) | Selected |
|--------|----------|
| GitHub, private first | |
| GitHub, public | |
| Local only for now | ✓ |

| Option (hosting config) | Selected |
|--------|----------|
| Host-agnostic, env basePath | ✓ |
| GitHub Pages | |
| Root-domain host | |

**User's choice:** Local only (rename origin to upstream, no remote); host-agnostic export with env-configured basePath.
**Notes:** CI workflow file is written but dormant (Claude's discretion).

---

## Non-numogram baggage

| Option (routes in export) | Selected |
|--------|----------|
| Ship unchanged | |
| Exclude from the export | |
| Numogram only | ✓ |

| Option (plugin ZIP) | Selected |
|--------|----------|
| fflate inside build | (first answer; conflicted with numogram-only) |
| Separate build:plugin-zip | |
| Drop the ZIP download | |

Follow-up to resolve the conflict:

| Option | Selected |
|--------|----------|
| Drop ZIP from build (optional fflate script stays) | ✓ |
| Keep plugin page + ZIP | |
| Ship all routes after all | |

| Option (dist/ and demo.mov) | Selected |
|--------|----------|
| Untrack both, keep history | ✓ |
| Untrack dist/ only | |
| Leave both tracked | |

**User's choice:** Numogram-only site; no ZIP in `npm run build`; untrack `dist/` and `demo.mov`.

---

## What "base-10 parity" means

| Option (coverage) | Selected |
|--------|----------|
| Layouts x layers x selection | ✓ |
| Plus interaction traces | |
| Minimal | |

| Option (planetary) | Selected |
|--------|----------|
| Pin a fixed date | |
| Exclude planetary | ✓ |
| Several pinned dates | |

| Option (approved DOM changes) | Selected |
|--------|----------|
| Visual-DOM comparison | ✓ |
| Strict DOM + approved-deltas log | |
| Overwrite on approval | |

**User's choice:** Layouts x layers x selection; exclude planetary; visual-DOM comparison.
**Notes:** User wrote: "At base 666 we end up with huge numbers ... option 1 is the best route but I'm concerned about page bloat with high bases." Follow-up (plain text): proposed a page-weight baseline and budget in Phase 1 plus digest-only high-base fixtures; user answered "yes". Captured as D-17.

---

## What `/` becomes

| Option | Selected |
|--------|----------|
| Redirect to /numogram/ (sitemap/robots dropped) | ✓ |
| Numogram lives at / | |
| Minimal landing page | |

## Playwright browser

| Option | Selected |
|--------|----------|
| Pinned Chromium (about 150 MB download) | ✓ |
| Your installed Chrome | |

## Project identity

| Option | Selected |
|--------|----------|
| CCRUG, drop upstream branding | ✓ |
| Neutral name: numogram-generator | |
| Keep upstream branding | |

---

## Claude's Discretion

Script names and layout, CI file contents, basePath env variable name, page-weight tolerances, exact golden state list, `.nojekyll`, copyright holder line in LICENSE.

## Deferred Ideas

GitHub remote and deploy workflow; requesting a license from lumpenspace; sitemap and robots when a host exists; interaction-trace oracle; multiple planetary dates; rewriting history to drop `demo.mov`.
