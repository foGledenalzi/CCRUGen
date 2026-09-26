// Pure Node-side helpers of the behaviour and text baseline (D-15). No Playwright import, so Vitest can
// unit-test them (tests/e2e-normalizer/behaviour-compare.test.ts).

const DATE = /\d{4}-\d{2}-\d{2}/g
const MAX_SHOWN = 160

/**
 * Mask what differs between runs: every ISO date becomes DATE, then every occurrence of the server origin
 * becomes ORIGIN. Strings are rewritten anywhere in arrays and objects; numbers, booleans and null are untouched.
 */
export function normalizeDeep<T>(value: T, origin: string): T {
  const mask = (s: string): string => {
    const dated = s.replace(DATE, 'DATE')
    return origin ? dated.split(origin).join('ORIGIN') : dated
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return mask(v)
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) out[k] = walk(x)
      return out
    }
    return v
  }
  return walk(value) as T
}

const show = (v: unknown): string => {
  const text = JSON.stringify(v) ?? String(v)
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}...(${text.length} chars)` : text
}

const kind = (v: unknown): 'array' | 'object' | 'value' => (Array.isArray(v) ? 'array' : v !== null && typeof v === 'object' ? 'object' : 'value')
const IDENT = /^[A-Za-z_$][\w$]*$/
const child = (path: string, key: string): string => (IDENT.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`)

/**
 * JSON-path of every difference between two JSON-like values, [] when they are deep-equal. Covers changed
 * values, missing and extra keys and array length (a length change is one entry; the shared prefix is still
 * compared). Key order does not matter.
 */
export function diffBaseline(expected: unknown, actual: unknown): string[] {
  const out: string[] = []
  const walk = (e: unknown, a: unknown, path: string): void => {
    const ke = kind(e)
    if (ke !== kind(a)) {
      out.push(`${path}: ${show(e)} != ${show(a)}`)
      return
    }
    if (ke === 'array') {
      const ea = e as unknown[]
      const aa = a as unknown[]
      if (ea.length !== aa.length) out.push(`${path}: length ${ea.length} != ${aa.length}`)
      for (let i = 0; i < Math.min(ea.length, aa.length); i++) walk(ea[i], aa[i], `${path}[${i}]`)
      return
    }
    if (ke === 'object') {
      const eo = e as Record<string, unknown>
      const ao = a as Record<string, unknown>
      for (const k of Object.keys(eo).sort()) {
        if (!Object.prototype.hasOwnProperty.call(ao, k)) out.push(`${child(path, k)}: missing in actual (expected ${show(eo[k])})`)
        else walk(eo[k], ao[k], child(path, k))
      }
      for (const k of Object.keys(ao).sort()) {
        if (!Object.prototype.hasOwnProperty.call(eo, k)) out.push(`${child(path, k)}: unexpected in actual (${show(ao[k])})`)
      }
      return
    }
    if (!Object.is(e, a)) out.push(`${path}: ${show(e)} != ${show(a)}`)
  }
  walk(expected, actual, '$')
  return out
}

/**
 * What the spec does with a baseline file: an existing file is always compared (capture never overwrites);
 * a missing file is written only when BEHAVIOUR_CAPTURE is exactly '1'; otherwise it is a failure.
 */
export function baselineAction(fileExists: boolean, captureEnv: string | undefined): 'compare' | 'capture' | 'fail-missing' {
  if (fileExists) return 'compare'
  return captureEnv === '1' ? 'capture' : 'fail-missing'
}
