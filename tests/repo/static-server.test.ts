import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../../scripts/golden-manifest.mjs'
import playwrightConfig from '../../playwright.config'

// Review IN-07: `serve <dir> -l <port>` listened on all interfaces (a Windows firewall prompt, a LAN-visible
// static export) and, without --no-port-switching, quietly moved to another port when the requested one was
// taken, so a test run could end up against the wrong server. The static server used by Playwright and by
// `npm start` is now started on loopback only, with the flag that asks it not to switch ports. Flag names are
// those of serve 14.2.6 (`serve --help`: -l tcp://host:port, --no-port-switching).
//
// This suite pins the command lines; it cannot prove serve's runtime behaviour. Checked by hand against the
// pinned 14.2.6: the tcp://127.0.0.1:<port> endpoint binds loopback only, but serve 14.2.6 parses
// --no-port-switching without ever reading it, so a taken port still makes it fall back to a random port
// (see node_modules/serve/build/main.js, startServer). Playwright's reuseExistingServer:false and its fixed
// readiness URL are what keep a run from testing the wrong server.

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const webServer = playwrightConfig.webServer as { command: string; url: string; reuseExistingServer: boolean }
const LOOPBACK_LISTEN = /(^|\s)(-l|--listen)\s+tcp:\/\/127\.0\.0\.1:(\d+)(\s|$)/

describe('static file server is started on loopback with --no-port-switching (IN-07)', () => {
  it('serves the export through `serve` (this suite runs without E2E_SERVER=dev)', () => {
    expect(webServer.command).toMatch(/^npx serve /)
  })

  it('the Playwright webServer command listens on tcp://127.0.0.1:<port>', () => {
    expect(webServer.command).toMatch(LOOPBACK_LISTEN)
  })

  it('the Playwright webServer command passes --no-port-switching', () => {
    expect(webServer.command).toMatch(/(^|\s)--no-port-switching(\s|$)/)
  })

  it('the readiness URL and baseURL point at the port the server was told to bind', () => {
    const port = webServer.command.match(LOOPBACK_LISTEN)?.[3]
    expect(port).toBeDefined()
    expect(webServer.url.startsWith(`http://127.0.0.1:${port}/`)).toBe(true)
    expect(playwrightConfig.use?.baseURL).toBe(`http://127.0.0.1:${port}`)
    expect(webServer.reuseExistingServer).toBe(false)
  })

  it('no bare `-l <port>` (all interfaces) remains in the config or the start script', () => {
    const source = readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf8')
    expect(source).not.toMatch(/\bserve\b[^\n]*\s-l\s+(\$\{\w+\}|\d+)(\s|`|$)/)
    expect(pkg.scripts.start).not.toMatch(/\s-l\s+\d+(\s|$)/)
  })

  it('`npm start` serves out/ on tcp://127.0.0.1:<port> with --no-port-switching', () => {
    const start = pkg.scripts.start
    expect(start).toMatch(/^serve /)
    expect(start).toMatch(LOOPBACK_LISTEN)
    expect(start).toMatch(/(^|\s)--no-port-switching(\s|$)/)
    expect(start).toMatch(/(^|\s)out$/)
  })
})
