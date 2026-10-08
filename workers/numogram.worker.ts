// The numogram worker (Phase 6 REN-03, D-06): a thin shell around the pure core. Bundled by webpack 5 as a classic worker chunk under
// /_next/static/chunks/ (no `type` option). Original CCRUG code (MIT, NOTICE section 1).
import { handleRequest } from '../app/lib/worker/buildResult'

self.onmessage = (e: MessageEvent<unknown>) => {
  const { response, transfer } = handleRequest(e.data)
  self.postMessage(response, { transfer })
}

export {}
