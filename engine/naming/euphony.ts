// euphony@1, a frozen convenience pass, not a reproduction of the canonical names (0 of 45 match, research Pattern 4; never
// test it against DEMON_NAMES). It is the optional smoothing of a raw join of two zone sounds (D-06): deterministic vowel
// insertion, off by default, and its behaviour is defined by the vector table and properties in the tests, so any change to
// a rule is a new version number, never an edit of this one.
//
// Rules, for a name made only of ASCII letters (anything else is returned unchanged, so Greek, Cyrillic, CJK, Arabic, accented
// Latin, mixed scripts and names with a space or hyphen are untouched):
//   - vowels are a e i o u y, in either case;
//   - a maximal run of consonants longer than 2 is cut into chunks of 2 from the left, and after every chunk of exactly 2 the
//     context-free fill vowel of that chunk's last consonant is inserted (a leftover single consonant gets nothing);
//   - a run of 1 or 2 consonants is copied as it is;
//   - afterwards, a name that ends in two different consonants gets the fill vowel of its last consonant appended;
//   - an inserted vowel takes the case of the consonant before it, and is only ever a, u or i.
// There is deliberately NO rule that collapses three identical letters: it was the only source of collisions between smoothed
// names (a run of three equal letters and a run of two merged), and without it the pass is insert-only, hence injective on inputs with no a, u or i.
//
// The pass is a linear walk over char codes with a string builder (no per-character regex), about 0.2 microseconds a join.

export const EUPHONY_VERSION = 1

const CHAR_LOWER_A = 97
const CHAR_LOWER_Z = 122
const CHAR_UPPER_A = 65
const CHAR_UPPER_Z = 90
const CASE_OFFSET = 32 // lowercase code minus uppercase code

// The fill vowel of each consonant. y is a vowel, so it has no entry.
const FILL: Readonly<Record<string, string>> = {
  b: 'u', c: 'a', d: 'i', f: 'a', g: 'u', h: 'a', j: 'u', k: 'u', l: 'a', m: 'u',
  n: 'a', p: 'a', q: 'u', r: 'a', s: 'a', t: 'a', v: 'a', w: 'a', x: 'i', z: 'a',
}

// FILL_CODE[c - 'a'] is the char code of the fill vowel of lowercase consonant c (0 for a vowel).
const FILL_CODE: readonly number[] = (() => {
  const table = new Array<number>(26).fill(0)
  for (const [consonant, vowel] of Object.entries(FILL)) {
    table[consonant.charCodeAt(0) - CHAR_LOWER_A] = vowel.charCodeAt(0)
  }
  return table
})()

function isAsciiLetter(code: number): boolean {
  return (code >= CHAR_LOWER_A && code <= CHAR_LOWER_Z) || (code >= CHAR_UPPER_A && code <= CHAR_UPPER_Z)
}

// Whether an ASCII letter code is one of a e i o u y (either case).
function isVowel(code: number): boolean {
  switch (code | CASE_OFFSET) {
    case 97: // a
    case 101: // e
    case 105: // i
    case 111: // o
    case 117: // u
    case 121: // y
      return true
    default:
      return false
  }
}

// The fill vowel for a consonant code, in the case of that consonant.
function fillFor(consonantCode: number): string {
  const fill = FILL_CODE[(consonantCode | CASE_OFFSET) - CHAR_LOWER_A] as number
  return String.fromCharCode(consonantCode < CHAR_LOWER_A ? fill - CASE_OFFSET : fill)
}

/** raw with euphony@1 applied. Unchanged if raw is empty or contains anything but ASCII letters. Idempotent and insert-only. */
export function smoothName(raw: string): string {
  const n = raw.length
  if (n === 0) return raw
  for (let i = 0; i < n; i++) {
    if (!isAsciiLetter(raw.charCodeAt(i))) return raw
  }

  let out = ''
  let i = 0
  while (i < n) {
    let j = i + 1
    if (isVowel(raw.charCodeAt(i))) {
      while (j < n && isVowel(raw.charCodeAt(j))) j++
      out += raw.slice(i, j)
    } else {
      while (j < n && !isVowel(raw.charCodeAt(j))) j++
      if (j - i <= 2) {
        out += raw.slice(i, j)
      } else {
        for (let k = i; k < j; k += 2) {
          out += k + 1 < j ? raw.slice(k, k + 2) + fillFor(raw.charCodeAt(k + 1)) : raw.charAt(k)
        }
      }
    }
    i = j
  }

  // a name that still ends in two different consonants gets a closing vowel
  const m = out.length
  if (m >= 2) {
    const last = out.charCodeAt(m - 1)
    const before = out.charCodeAt(m - 2)
    if (!isVowel(last) && !isVowel(before) && (last | CASE_OFFSET) !== (before | CASE_OFFSET)) out += fillFor(last)
  }
  return out
}

// Whether one sound can never be changed by smoothing when joined to another inert sound on either side.
function soundIsInert(sound: string): boolean {
  const n = sound.length
  if (n === 0) return false
  let run = 0
  let sawVowel = false
  for (let i = 0; i < n; i++) {
    const code = sound.charCodeAt(i)
    if (!isAsciiLetter(code)) return false
    if (isVowel(code)) {
      sawVowel = true
      run = 0
    } else {
      run++
      if (run > 2) return false // an internal run of three would be cut
      if (!sawVowel && run > 1) return false // a leading run of two plus a neighbour's trailing consonant would be three
    }
  }
  return sawVowel && run <= 1 // a trailing run of two would, with the next sound's leading consonant, be three
}

/**
 * True only when smoothing changes no join of any two of these sounds, in either order (research Pattern 5, certificate
 * condition B): every sound is ASCII letters with a vowel, has no consonant run longer than 2, and its leading and trailing
 * consonant runs are at most 1. Sufficient, not necessary. The empty table is inert.
 */
export function smoothingInert(sounds: readonly string[]): boolean {
  for (const sound of sounds) {
    if (!soundIsInert(sound)) return false
  }
  return true
}
