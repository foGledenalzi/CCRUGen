// DRAFT syllable banks from 07-RESEARCH Appendix A. The look of the sounds needs the user's contact-sheet sign-off (plan 07-06)
// before any digest of a sound table is pinned, so nothing here is final until then.
//
// A style supplies two syllable lists whose union is prefix-free (no syllable begins another): INTERNAL syllables are never the
// last of a sound, LEAF syllables are always the last. A sound is zero or more internal syllables followed by one leaf, so the
// raw join of two sounds determines both of them in either order. ORDER MATTERS: it defines the mixed-radix decode in generate.ts,
// so reordering or editing a list changes every generated sound (a new generator id, not an edit).

/** The selectable styles, in picker order. */
export const STYLE_IDS = ['harsh', 'soft', 'syllabic'] as const

export type StyleId = (typeof STYLE_IDS)[number]

/** The style a fresh naming starts with: the CCRU-flavoured consonant clusters (D-04). */
export const DEFAULT_STYLE: StyleId = 'harsh'

/** True for a known style id (URL and file values arrive as unknown strings). */
export function isStyleId(v: unknown): v is StyleId {
  return typeof v === 'string' && (STYLE_IDS as readonly string[]).includes(v)
}

export interface SyllableBank {
  /** Syllables that may begin or continue a sound but never end it. */
  readonly internal: readonly string[]
  /** Syllables that always end a sound. */
  readonly leaf: readonly string[]
}

/** A frozen list from space-separated syllables (the lists below are long; the tests pin their sizes and prefix-freedom). */
function syllables(text: string): readonly string[] {
  return Object.freeze(text.split(' '))
}

export const SYLLABLE_BANKS: Readonly<Record<StyleId, SyllableBank>> = Object.freeze({
  // Consonant clusters between o / e; the fill vowels a u i never occur naturally, which keeps smoothing injective on this style.
  // No syllable equals a CCRU zone sound (the CCRU lore is outside the MIT licence, NOTICE section 3); the leaves are generic
  // clusters and tests/presets/naming-banks-lore.test.ts compares every syllable of every bank with the lore file by import.
  harsh: Object.freeze({
    internal: syllables(
      'sko ske sto ste tko tke kto kte dgo dge gdo gde zdo zde zgo zge xko xke rko rke lko lke nko nke mpo mpe bro bre kro kre tro tre dro dre gro gre pro pre blo ble klo kle plo ple glo gle zro zre xto xte spo spe sbo sbe sdo sde sgo sge zto zte zbo zbe xpo xpe xbo xbe xdo xde pto pte kpo kpe bdo bde rto rte rdo rde lto lte',
    ),
    leaf: syllables(
      'sdr skl str spl zgr zdr xkr pdd lkk mnn nch rkt lkt mpt ngr tkt dgd pkt nmn zbr xtr rnk bgb lgr kd xg gb tb tp bp bt bk nt nd rg ld sm sn zm zn kn gn dn ch th kh sh zh xz mb md mg tm dm km gm bn pn rb lb rm lm ln rp lp rs ls',
    ),
  }),
  // Open consonant + vowel syllables, with diphthong leaves.
  soft: Object.freeze({
    internal: syllables(
      'la le li lo lu ma me mi mo mu na ne ni no nu ra re ri ro ru sa se si so su va ve vi vo vu fa fe fi fo fu ha he hi ho hu wa we wi wo wu ya ye yi yo yu ja je ji jo ju za ze zi zo zu',
    ),
    leaf: syllables(
      'dia dio dua due dai dei dou dae dao doi dea bia bio bua bue bai bei bou bae bao boi bea gia gio gua gue gai gei gou gae gao goi gea tia tio tua tue tai tei tou tae tao toi tea kia kio kua kue kai kei kou kae kao koi kea pia pio pua pue pai pei pou pae pao poi pea',
    ),
  }),
  // Consonant + vowel syllables, closed leaves (CV + n / r / s).
  syllabic: Object.freeze({
    internal: syllables(
      'ka ke ko ku te ti to pa pe po pu na ni no ma me mi mu ra ri ro ru le li lu sa se so su de di do ba be bo bu ga gi go za ze zi zu va vi vo vu fe fi fu ha he ho hu je ji jo wa we wo wu ca ci co',
    ),
    leaf: syllables(
      'kin tan tun pin nen nun mon ren lan lon sin dan dun bin gen gun zon ven fan fon hin jan jun win cen cun kir tar tur pir ner nur mor rer lar lor sir dar dur bir ger gur zor ver far for hir jar jur wir cer cur kis tas tus pis nes nus mos res las los sis das dus bis ges gus zos ves fas fos his jas jus wis ces cus',
    ),
  }),
} as const)
