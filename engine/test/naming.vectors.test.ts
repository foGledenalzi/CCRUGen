// Signed off by the user on 2026-11-09 (plan 07-06 contact sheet). Never update a digest or sample to make a test pass: a change
// needs a new contact-sheet sign-off (orchestrator decision 1). The syllable banks were approved in two rounds: the look of the
// harsh, soft and syllabic styles as shown, then the harsh bank revised to drop every verbatim CCRU zone sound. This file pins the
// generator names-gen@1 over those banks: the sha256 of the sound table of each style at two seeds and five bases, and exact lazy
// samples far above any table. The digests are literals pasted once from the approved banks; never run vitest with -u or any
// snapshot update here (there is nothing to update), and never regenerate a literal to turn a red test green.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { STYLE_IDS } from '../naming/banks'
import type { StyleId } from '../naming/banks'
import { DEFAULT_SEED, createGenerator, generateSounds } from '../naming/generate'

const NEWLINE = String.fromCharCode(10)
const SEEDS = [DEFAULT_SEED, 'hollow-vector'] as const
const BASES = [10, 28, 64, 666, 4000] as const
const LAZY_ZONES = [4001, 65535, 1048576, 67108863] as const

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// key: `${style}/${seed}/${base}`; value: sha256 of generateSounds(createGenerator(seed, style), base) joined by a newline
const SIGNED_OFF: Record<string, string> = {
  'harsh/ccrug/10': '4cfd3bb38dfac76264e1d717c7476c4e9d72ac2c1be85c9dad1e965be008ca0d',
  'harsh/ccrug/28': '5a52c8f5bc2445d74169ceab9d1b2dd34bcc18186c78174b3082eadd4cdc9760',
  'harsh/ccrug/64': 'b94cc6343aca1044e6998dd683854875a0632503b36cb42e267c023bcb510736',
  'harsh/ccrug/666': '98cafae468e214902eab7e2ccd7bce8c65399118edfc330645c33d0ae06e939c',
  'harsh/ccrug/4000': '03efbaee7633704e60f8ad1c3e8d131eae04e0efa43f9057a8b49cbab582e34a',
  'harsh/hollow-vector/10': '818b306c18e04de14a5281cfc75150376c495e39d45b0e69a9c97de175b2e494',
  'harsh/hollow-vector/28': 'c8f8e60cc67eef5a31cd4a0ed064b6a9cd61b97799d74c1087d90e5066000ba6',
  'harsh/hollow-vector/64': '089c151d23e998757b5af05f074520de9647bb7126e219c19bc1b23306626a9a',
  'harsh/hollow-vector/666': 'c80647ca53b00c2e45f7d556a2ff5466e02cd8453bd01ba9387ab3d788381412',
  'harsh/hollow-vector/4000': '0553f073268bbab51be529b33fd8340f4fc6f24a135a474b83b878a152cf2af5',
  'soft/ccrug/10': '55b1800bade15ebfdd772d4ad7ea5027e76748968e03778db3a3578864d38139',
  'soft/ccrug/28': 'c30447d4fd33c051e0b0bacf688ea6cd472b2fdf23697d5f2e535093fb8a7de7',
  'soft/ccrug/64': '16e5b68c8fb40fd924ad5185f3e1b59ecf90197e49f753e81595960e8d8a6069',
  'soft/ccrug/666': '65406ede771ff2080c00c209e86156134a1ae18b8156c8bf416a0a7805b7b916',
  'soft/ccrug/4000': 'cc3ddb0e51435d5e192c300132369e29fa854b1f9fcaf6913db73492faf8de89',
  'soft/hollow-vector/10': '500c808644756817a4a21f2c3c829dc4264a552ea5b31bcc16b604235ab67d88',
  'soft/hollow-vector/28': '5409350eae784d67c9beed747404c4dc416627f497ca1f8888299a141927a76b',
  'soft/hollow-vector/64': '6cb14cddc27958c03e6d89b009958b04c1f92a7c514c1682bcf751efa302ed5d',
  'soft/hollow-vector/666': '5b6704e1fd60cfa4b4287b4ffe6a708ff0eee60a7aa05a82f6ffce5d70e0d9d1',
  'soft/hollow-vector/4000': 'ebd51e31fbdb3b248e6ea1d4a22a9356fc2f51f9bbe39782f9b4cedb229b852a',
  'syllabic/ccrug/10': 'cf293557685edc449d58bbbc55eb408411433d07399faf97f0e1095735861757',
  'syllabic/ccrug/28': 'f4c91c943e9775703f197cf842eb73849c9c4b765b214f14cbd63a3b586251d8',
  'syllabic/ccrug/64': 'db7d3c8e3241b2bf16e1dd97f96b7d344fa552f2d26cb17e6050b7a1f638439b',
  'syllabic/ccrug/666': 'fcc42209edec48df84926b31f174e4d8c1e0ae55da8873eaffda7985087c915f',
  'syllabic/ccrug/4000': 'b5bdcdbea7ffc8fe5a7b7c96814c7e584addb6c86be28ddc12a79957df90a1ac',
  'syllabic/hollow-vector/10': '49fbf108c250f1fdd64d84a26e5d7857cd2a00d149dcd673c9db8a3ba6fab360',
  'syllabic/hollow-vector/28': 'f5e10a2f08a8324d63d5fdcda5ec4f51c3eab13fe67fb870dfdd8a4d2174881b',
  'syllabic/hollow-vector/64': '21c9696643434e931b1a105383bd3a4865b975210384e083ba3ff01c0320c32a',
  'syllabic/hollow-vector/666': 'c6cc5f7e32e482699f68ea2993c0c6122959a9b67a5377c6f02808ad547e143d',
  'syllabic/hollow-vector/4000': 'db28a3968787ae3dec4c402af62a9dcdfaed9186bf13ba92a1b642f33c36b669',
}

// key: `${style}/${zone}`; value: createGenerator(DEFAULT_SEED, style).soundAt(zone), exact
const LAZY_SAMPLES: Record<string, string> = {
  'harsh/4001': 'zdopdd',
  'harsh/65535': 'zdortespl',
  'harsh/1048576': 'treptoplezh',
  'harsh/67108863': 'rdexdosbosdent',
  'soft/4001': 'judia',
  'soft/65535': 'fumagoi',
  'soft/1048576': 'suwehekae',
  'soft/67108863': 'lehinanopai',
  'syllabic/4001': 'huves',
  'syllabic/65535': 'linilar',
  'syllabic/1048576': 'semejilor',
  'syllabic/67108863': 'bapaninolon',
}

function parseKey(key: string): { style: StyleId; seed: string; base: number } {
  const [style, seed, base] = key.split('/')
  if (style === undefined || seed === undefined || base === undefined) throw new Error(`malformed key ${key}`)
  return { style: style as StyleId, seed, base: Number(base) }
}

describe('signed-off sound tables (plan 07-06 contact-sheet sign-off)', () => {
  for (const [key, expectedDigest] of Object.entries(SIGNED_OFF)) {
    it(`${key} matches its signed-off digest`, () => {
      const { style, seed, base } = parseKey(key)
      const digest = sha256(generateSounds(createGenerator(seed, style), base).join(NEWLINE))
      expect(digest, `${key} changed; this needs a new contact-sheet sign-off, not a test update`).toBe(expectedDigest)
    })
  }

  it('covers exactly 3 styles x 2 seeds x 5 bases = 30 entries', () => {
    expect(Object.keys(SIGNED_OFF)).toHaveLength(30)
    const expected: string[] = []
    for (const style of STYLE_IDS) for (const seed of SEEDS) for (const base of BASES) expected.push(`${style}/${seed}/${base}`)
    expect(Object.keys(SIGNED_OFF).sort()).toEqual(expected.sort())
  })
})

describe('signed-off lazy samples (plan 07-06 contact-sheet sign-off)', () => {
  for (const [key, expectedSound] of Object.entries(LAZY_SAMPLES)) {
    it(`${key} is its signed-off sound`, () => {
      const slash = key.indexOf('/')
      const style = key.slice(0, slash) as StyleId
      const zone = Number(key.slice(slash + 1))
      expect(createGenerator(DEFAULT_SEED, style).soundAt(zone), `${key} changed; this needs a new contact-sheet sign-off, not a test update`).toBe(
        expectedSound,
      )
    })
  }

  it('covers exactly 3 styles x 4 zones = 12 entries', () => {
    expect(Object.keys(LAZY_SAMPLES)).toHaveLength(12)
    const expected: string[] = []
    for (const style of STYLE_IDS) for (const zone of LAZY_ZONES) expected.push(`${style}/${zone}`)
    expect(Object.keys(LAZY_SAMPLES).sort()).toEqual(expected.sort())
  })
})
