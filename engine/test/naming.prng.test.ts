// NAM-01 PRNG: sfc32-cyrb128@1 is DEFINED by engine/naming/prng.ts and the frozen vectors below (07-RESEARCH Appendix B),
// never by an upstream text. Independence: the oracle is a BigInt implementation written in this file with explicit
// 32-bit masks; it shares no code with the module (a different mechanism from Math.imul and the int32 operators).
// Non-ASCII seeds are built from code points (the file-write tooling decodes typed unicode escapes, PATTERNS alert 10).
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { PRNG_ALGO, cyrb128, sfc32 } from '../naming/prng'

const MASK = 0xffffffffn

function cyrb128Big(str: string): [bigint, bigint, bigint, bigint] {
  let h1 = 1779033703n
  let h2 = 3144134277n
  let h3 = 1013904242n
  let h4 = 2773480762n
  for (let i = 0; i < str.length; i++) {
    const k = BigInt(str.charCodeAt(i))
    h1 = h2 ^ (((h1 ^ k) * 597399067n) & MASK)
    h2 = h3 ^ (((h2 ^ k) * 2869860233n) & MASK)
    h3 = h4 ^ (((h3 ^ k) * 951274213n) & MASK)
    h4 = h1 ^ (((h4 ^ k) * 2716044179n) & MASK)
  }
  h1 = ((h3 ^ (h1 >> 18n)) * 597399067n) & MASK
  h2 = ((h4 ^ (h2 >> 22n)) * 2869860233n) & MASK
  h3 = ((h1 ^ (h3 >> 17n)) * 951274213n) & MASK
  h4 = ((h2 ^ (h4 >> 19n)) * 2716044179n) & MASK
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 & MASK, h2 & MASK, h3 & MASK, h4 & MASK]
}

function sfc32Big(state: readonly bigint[]): () => bigint {
  let [a, b, c, d] = state as [bigint, bigint, bigint, bigint]
  return () => {
    const t = (a + b + d) & MASK
    d = (d + 1n) & MASK
    a = b ^ (b >> 9n)
    b = (c + (c << 3n)) & MASK
    c = ((c << 21n) & MASK) | (c >> 11n)
    c = (c + t) & MASK
    return t
  }
}

const hex = (n: number): string => n.toString(16).padStart(8, '0')

// 07-RESEARCH Appendix B: [label, seed, cyrb128 state words, first eight next32() outputs]
const VECTORS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['empty', '', '027ae52e cfc79621 5593990d 4b41437c', '1d83becb 1d121adc 8614b7f1 efa8f54c 2d290131 c67d7b76 fb901d39 4664774c'],
  ['a', 'a', '5eb8e4e4 08dee167 8f5f05b9 58089485', 'bfa05ad0 6b3a561e 8fbf28cf d10e162c 2481f0f5 6658f5bd 26f3ffa5 8094e87e'],
  ['abc', 'abc', '4664cddf 317f7918 ec487c9f 600d8b09', 'd7f1d200 e001b345 7a22e639 7c85cc5a 52d1df11 062a71f1 43796733 8bd660c1'],
  ['hollow-vector', 'hollow-vector', '7c174536 cea872f3 fa03b141 9e6804ac', 'e927bcd5 375866c0 054b1825 21c7de16 c8e526ee 7878aefe 1f0d3a3c 4e17e868'],
  ['CCRU', 'CCRU', '63ecd27e 3a6b0d60 ada3b9b4 e2b2c849', '810aa827 37ea8884 7222f170 81193981 318c069b 64683718 ae14635d 65cb76a4'],
  ['ccrug', 'ccrug', 'f240cb49 ba9dc081 e972fc8c 9cc03bd4', '499ec79e 8c8bab22 86ec4757 00810bae fd8d264c 955cf9a9 817cbaf1 102955ce'],
  ['0', '0', 'f74d4ea5 48cf1fef e93e0417 5f3557ce', '9f51c662 db4ef4fe c7336adf 303ec9a1 b37ac271 b89b2114 aef7282d f9532416'],
  [
    'NFC three letters (U+00DC U+006E U+00EF)',
    String.fromCodePoint(0xdc, 0x6e, 0xef),
    '841294c2 b5e0c531 175efdbf 1609b627',
    '4ffd101a 9e1ad732 2f2952ac 6420d70f 5cd86310 46444d7d 0f1b058a 470ef409',
  ],
  [
    'one surrogate pair (U+1D518)',
    String.fromCodePoint(0x1d518),
    '32eafad8 3ebb752e 128c276f 15d44204',
    '877ab20a fb65cd80 dcd7765a 0d01c198 f495743a 190f154f ad8206a2 17fdda04',
  ],
  [
    'NFD e + U+0301',
    'e' + String.fromCodePoint(0x301),
    '5ce6a22a 293a9fe8 5c831e91 f1aefe67',
    '77d04079 5b791428 cc45b335 ba5aa9b3 65eba8ac b32350b9 d12e29aa c5832d24',
  ],
  [
    'NFC U+00E9',
    String.fromCodePoint(0xe9),
    '60a2461a d24f6f4c 1c407605 00550ed8',
    '3346c43e d0bf7e01 91ccc1c4 c1181570 0188fbe7 d259e07d 8bf1c6c8 a385bf25',
  ],
  ['x repeated 1000 times', 'x'.repeat(1000), '06349e2a 6ee1ec12 7eb9d9ef 88c4f76e', 'fddb81aa 6c243dba 179e04b0 72199adb 36dbebbd 562ead72 bb3344e8 120a8511'],
]

describe('sfc32-cyrb128@1', () => {
  it('names its frozen algorithm id', () => {
    expect(PRNG_ALGO).toBe('sfc32-cyrb128@1')
  })

  it('has twelve frozen vectors', () => {
    expect(VECTORS).toHaveLength(12)
  })

  it.each(VECTORS)('cyrb128 state words and the first eight outputs match Appendix B: %s', (_label, seed, state, outputs) => {
    const words = cyrb128(seed)
    expect(words.map(hex).join(' ')).toBe(state)
    const next = sfc32(...words)
    const got: string[] = []
    for (let i = 0; i < 8; i++) got.push(hex(next()))
    expect(got.join(' ')).toBe(outputs)
  })

  it('the NFC and NFD spellings of the same text hash differently (callers must normalise)', () => {
    const nfd = 'e' + String.fromCodePoint(0x301)
    expect(nfd.normalize('NFC')).toBe(String.fromCodePoint(0xe9))
    expect(cyrb128(nfd).join()).not.toBe(cyrb128(nfd.normalize('NFC')).join())
  })

  it('cyrb128 returns four unsigned 32-bit words and sfc32 only unsigned 32-bit integers', () => {
    for (const [, seed] of VECTORS) {
      const words = cyrb128(seed)
      expect(words).toHaveLength(4)
      const next = sfc32(...words)
      for (const w of words) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true)
      for (let i = 0; i < 64; i++) {
        const v = next()
        expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true)
      }
    }
  })

  it('two generators from one state produce the same stream, and sfc32 accepts words above 2^31', () => {
    const words = cyrb128('hollow-vector')
    const a = sfc32(...words)
    const b = sfc32(...words)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
    expect(words.some(w => w > 0x7fffffff)).toBe(true)
  })

  it('equals an independent BigInt cyrb128 + sfc32 on 2,000 fixed-seed strings and 64 outputs each', () => {
    const seeds = fc.oneof(fc.string({ maxLength: 40 }), fc.string({ unit: 'binary', maxLength: 40 }))
    fc.assert(
      fc.property(seeds, seed => {
        const words = cyrb128(seed)
        const big = cyrb128Big(seed)
        for (let i = 0; i < 4; i++) if (BigInt(words[i]!) !== big[i]) return false
        const next = sfc32(...words)
        const nextBig = sfc32Big(big)
        for (let i = 0; i < 64; i++) if (BigInt(next()) !== nextBig()) return false
        return true
      }),
      { seed: 20261020, numRuns: 2000 },
    )
  })
})
