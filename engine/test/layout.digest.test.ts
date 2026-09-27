// Signed-off layout pin (plan 03-08, contact sheet approved 2026-09-27, sheet sha 0d9cd5c0cb3a). Not a frozen
// oracle, but a digest changes only together with a new user sign-off on the contact sheet; never update it to make
// a test pass. Pins the ten review-set bases' ring (default parameters, packer 'shelf' per the sign-off), ladder,
// spiral and pair-graph coordinates by sha256 of a canonical text so a later change to any layout formula shows up
// as a failing digest instead of silently changing the look (T-03-24). Runs under both CCRUG_TZ=UTC and
// CCRUG_TZ=America/New_York (npm run test:tz) to prove cross-process, cross-timezone determinism.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createNumogram, fmt, ladderLayout, pairGraphLayout, ringLayout, spiralLayout } from '../index'
import type { Layout } from '../layout/types'

const REVIEW_BASES = [2, 4, 6, 8, 12, 16, 28, 64, 82, 100] as const

/** For z = 0..base-1 the line `x[z],y[z]` (fmt'd), then the frame `widthxheight` (fmt'd), joined by '\n'. */
function canonical(layout: Layout): string {
  const lines: string[] = []
  for (let z = 0; z < layout.base; z++) {
    lines.push(`${fmt(layout.x[z]!)},${fmt(layout.y[z]!)}`)
  }
  lines.push(`${fmt(layout.width)}x${fmt(layout.height)}`)
  return lines.join('\n')
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

const SIGNED_OFF: Record<string, string> = {
  'ring@2': '82bb793543cd324b697b299b08356a679f5ffacbd239106630e4f0433512d9b6',
  'ladder@2': '174a356ae8e2db9fe16f74397bbd96924b0ac6e63de18350e206e730a08d121c',
  'spiral@2': 'f390932829e02eee399357eb37d328efbedde17faf079040ccd4e95f6791f2ef',
  'pairGraph@2': 'e315bc4ff7df28ebf562af62941a91cb4bca45ce73d0e3170a7434761d48ce85',
  'ring@4': '5576a0af86e82eab264fe2a14c1b62a666c6341b551432f994d4a98ab505a50b',
  'ladder@4': '5d25c6a565fca55b1de44ae362d3e5419554a3437c7f509ea87458fdebedd1af',
  'spiral@4': '4208165857892f4f397b332d44cad3d1dd881b038c9b4971aef2e6c12b08783f',
  'pairGraph@4': '2ad1ccea9261f78a105f983190b5a13a357860ee32362c55271269cd1199e442',
  'ring@6': '9508f1c646e428cce1e04daa757305ccab368c103e41882f141b3ee7597e4feb',
  'ladder@6': '65fe537a76f70d9ffa9911f6fc95ffb254eff9fca67f5f313f73700662361650',
  'spiral@6': 'f72d9c1ce64d8d8397798da0c21ec9f754cd262f944e9b225af1be0ce6e45135',
  'pairGraph@6': 'd6c5db90aa1511af07d68e819faa4f87bba63e92bc94184b84c8c310afcb2f93',
  'ring@8': 'a32c6087bb92ecfae22dd83990978693c32dd7e6a9415158b4e7abc99f565bb2',
  'ladder@8': 'be8cd4d9058d9efb452ccfc34a703eda43d5f272bea599daf53b5e61451068d6',
  'spiral@8': '88235fedbccdaeddbadfb632685ee2a84de8ecb4b05b024f728119a339e3799c',
  'pairGraph@8': '7b2150cc2c760c3fdd7037c4d1cd5340b4655b15b25dd2dbbe6b27b4ef16a1c9',
  'ring@12': 'd95b38238c4d163e25ec995398e04e5894868ed2c597521579428b877e9bbcb1',
  'ladder@12': 'b31681567a9597a353f01ae76b0e325f7b467cd7e4bed56dac4349e14389980d',
  'spiral@12': '2fb8481dd09c0262b2a590c8579633557184458c58ba4a4e213bde485007d6e3',
  'pairGraph@12': '39255a2c865a8d57694395606fcd2fc535474fe9867dc6f70efc1294f105231f',
  'ring@16': '896f586a5ba820f230c9a1da4636add73827752877fb49846465ea1cad55c0eb',
  'ladder@16': 'd3fa8574fbaf781ca7763c70bddc92b43e29b766c0fc60a74c0fb96d0141cc57',
  'spiral@16': 'e665a15ba5121709dcdb8422f7f1bdf2a9b344a2734c2d8e0fe45d9b9d0b070c',
  'pairGraph@16': '2271f2820e777bb08d8a11de402e378b3ffd84c30c7bade627fa6a80259f2299',
  'ring@28': '0a08ed746913d2f40f227b5be8acfec73d4e4783b44a89098de9ce078307a855',
  'ladder@28': '8b24fa60f3166993b4dbb0d9725921789b34e1972414326dca30763a451d0703',
  'spiral@28': 'ddeec92a42e5f54bcb559d35b556c824c5c2ae64d80395c671e07b6add3192ff',
  'pairGraph@28': 'f138d78b8dcbc5c3f01923b054c276889831dd7fa55b10c82d2cfc003d7aa95c',
  'ring@64': 'aa380762f7cb7356939e7faa404487583f40731500315b5018d8bbc6a8033292',
  'ladder@64': '837e443ee23900243730805d860013535462328b0580932b68bf0aad45c3572d',
  'spiral@64': '2299eb135904046f8e04d0a8bba73c8446d63d770982623de89651d7bfe3eb65',
  'pairGraph@64': '9d8604c4a24154f02315108a96ac3f21cfc75653d2e532af47981232e5308117',
  'ring@82': '175d62096eb40c863fc199b8b45be6f0d413fd9ef0dc97ab60ebf7970254f24f',
  'ladder@82': 'd59a21e2a8ab7d516ea3c84decbfd716b9ec6b3f10a852353cf30b659e2d031e',
  'spiral@82': '1df84489b9435fc17338b7f767dbc56bfec7dd6f92ae1b9041b9165ebf7f7e11',
  'pairGraph@82': '49837fec31c7442c2422fc2652870a915d2e9f0fc54fea15295e8e2efe7ebf7f',
  'ring@100': '880d0cf5e00be9c9c105a1bd42386523c988e42ec2404baa50b038d6441690ce',
  'ladder@100': '80445601520eb086225a2d341bf76a198b8599181f19b5b9bb0dafc8f23b42c1',
  'spiral@100': '4d10b07df9cf2ece24c1adeb3824f7ce1efed6397abbcd96c0890a052183fd74',
  'pairGraph@100': '3b7e320e62a35e6badbc175e189fc2b927966d838af77f6560b67e3cf9f79cee',
}

const BUILDERS: Record<string, (g: ReturnType<typeof createNumogram>) => Layout> = {
  ring: g => ringLayout(g),
  ladder: g => ladderLayout(g),
  spiral: g => spiralLayout(g),
  pairGraph: g => pairGraphLayout(g),
}

describe('signed-off layout pin (plan 03-08 contact-sheet sign-off)', () => {
  for (const [key, expectedDigest] of Object.entries(SIGNED_OFF)) {
    it(`${key} matches its signed-off digest`, () => {
      const at = key.lastIndexOf('@')
      const name = key.slice(0, at)
      const n = Number(key.slice(at + 1))
      const build = BUILDERS[name]
      expect(build, `unknown layout name in key ${key}`).toBeDefined()
      const g = createNumogram(n)
      const layout = build!(g)
      const digest = sha256(canonical(layout))
      expect(digest, `${key} digest changed; this needs a new contact-sheet sign-off, not a test update`).toBe(
        expectedDigest,
      )
    })
  }

  it('covers exactly the 10 review bases x 4 layouts = 40 entries', () => {
    expect(Object.keys(SIGNED_OFF)).toHaveLength(REVIEW_BASES.length * 4)
  })
})
