// CCRU-derived lore. Not covered by the MIT license; see NOTICE.
// The single CCRU-derived lore module named in NOTICE section 3 (MIG-01, D-06, D-07); text unchanged from the upstream viewer,
// keyed by numeric engine ids: zone 0..9, pair id = low zone 0..4, gate origin zone 0..9, demon mesh number a(a-1)/2 + b.
import type { ZoneMeta } from '../../data/types'

export interface SyzygyLore { readonly demon: string; readonly desc: string }
export interface CurrentLore { readonly name: string; readonly desc: string }
export interface GateLore { readonly desc: string; readonly detail: string }

export const ZONE_CLR: Record<number, string> = {
  0: '#aaaaaa', 1: '#ee44ee', 2: '#4488ff', 3: '#44cc77', 4: '#ee4444',
  5: '#ee8833', 6: '#ddcc33', 7: '#7755cc', 8: '#9944ee', 9: '#666666',
}

export const ZONE_PARTICLE: Record<number, string> = {
  0: 'eiaoung', 1: 'gl', 2: 'dt', 3: 'zx', 4: 'skr',
  5: 'ktt', 6: 'tch', 7: 'pb', 8: 'mnm', 9: 'tn',
}

export const PLANET_SYMBOL: Record<number, string> = {
  0: '\u2609', 1: '\u263F', 2: '\u2640', 3: '\u2641', 4: '\u2642',
  5: '\u2643', 6: '\u2644', 7: '\u2645', 8: '\u2646', 9: '\u2647',
}

export const ZONE_META: Record<number, ZoneMeta> = {
  0: {
    planet: 'Sol', planetFull: 'Sol (The Sun)',
    desc: 'Dense void of the cosmic hypermatrix, upon which absolute desolation crosses infinity as flatline and loss of signal.',
    spinal: 'Coccygeal', meshTag: '0000',
    door: '', phaseCount: 0, lemurs: [],
    lemurian: 'Blind Humpty Johnson\'s Channel-Zero "black snow" cult \u2014 the return of true Tohu Bohu.',
    centauri: 'Eclipsed side of the Fifth (Root) Pylon. Dark aspect of Foundation \u2014 protocosmic abyss anticipating primal reality.',
  },
  1: {
    planet: 'Mercury', planetFull: 'Mercury (Sol-1)',
    desc: 'Meta-static pod-deliria and techno-immortalism. Transcendent sky-god divinity and archaic gnosis of the shelled Old One who supports the world.',
    spinal: 'Dorsal (Thoracic)', meshTag: '0001',
    door: 'Lurgo \u2014 the Initiator (Door of Doors)', phaseCount: 2,
    lemurs: ['1::0 Lurgo'],
    lemurian: 'Turtle cults and bubble-pod techno-immortalism. The primordial click of Tzikvik cipher-shamanism.',
    centauri: 'Palpable side of the First (Center) Pylon. Light aspect of Anamnesis \u2014 enduring ideas, historical time and remembrance.',
  },
  2: {
    planet: 'Venus', planetFull: 'Venus (Sol-2)',
    desc: 'Crypt-navigation, occulted cyberspace. Spectral populations of hallucination and time fragmentation \u2014 greys, ghosts and zombies.',
    spinal: '', meshTag: '0003',
    door: 'Duoddod \u2014 Main Lo-Way into the Crypt', phaseCount: 4,
    lemurs: ['2::0 Duoddod', '2::1 Doogu'],
    lemurian: 'Mirrors Zone-5 \u2014 shared Hyperborean themes of time-lapse and abduction. Mist, vaporization and hazing.',
    centauri: 'Eclipsed side of the Second (Right) Pylon. Dark aspect of Genesis \u2014 epidemic fertility, clones, vampiric contagion.',
  },
  3: {
    planet: 'Earth', planetFull: 'Earth (Sol-3)',
    desc: 'Swirling nebulae, cosmic dust clouds and alien pattern. Vortical involvement with Zone-6 problematizes distinct characterization.',
    spinal: 'Third-eye plane', meshTag: '0007',
    door: 'Ixix \u2014 opens onto the Swirl', phaseCount: 8,
    lemurs: ['3::0 Ixix', '3::1 Ixigool', '3::2 Ixidod'],
    lemurian: 'Swarming insectoid reversion within mammalian vocality. The buzz-cutter sonics of particle zx.',
    centauri: 'Active side of the Fourth (Crown) Pylon. Light aspect of Fortune \u2014 extrinsic fatality, unexpected messages, xenosignal.',
  },
  4: {
    planet: 'Mars', planetFull: 'Mars (Sol-4)',
    desc: 'Delta-phase terminal deliria. Kurtz end-of-the-river disintegration into malarial nightmares, geoconvulsions, continental subsidence, and red-out.',
    spinal: '', meshTag: '0015',
    door: 'Krako \u2014 the Time-Delta', phaseCount: 16,
    lemurs: ['4::0 Krako', '4::1 Sukugool', '4::2 Skoodu', '4::3 Skarkix'],
    lemurian: 'Volcanic jungles of the Tak Nma. Rabid predatory animals \u2014 cats and dogs in their predatory mode.',
    centauri: 'Passive side of the Third (Left) Pylon. Dark aspect of Apocalypse \u2014 random calamity.',
  },
  5: {
    planet: 'Jupiter', planetFull: 'Jupiter (Sol-5)',
    desc: 'Hyperborean or Wendigo mythology. Missing time and alien abduction. Inner-eye of the Barker spiral.',
    spinal: '', meshTag: '0031',
    door: 'Tokhatto \u2014 the Hyperborean Door', phaseCount: 32,
    lemurs: ['5::0 Tokhatto', '5::1 Tukkamu', '5::2 Kuttadid', '5::3 Tikkitix', '5::4 Katak'],
    lemurian: 'Upland rain forests of the Tak Nma. Hybrid bird-reptile forms \u2014 flying worms, bat-monsters and barking snakes.',
    centauri: 'Active side of the Third (Left) Pylon. Light aspect of Apocalypse \u2014 decision, judgement, and war.',
  },
  6: {
    planet: 'Saturn', planetFull: 'Saturn (Sol-6)',
    desc: 'Occulted dimensions of Undu. Turbular erosion and the dead eye of the cyclone. Shocking disappearances.',
    spinal: 'Third-eye plane', meshTag: '0063',
    door: 'Tchu \u2014 gate of Undu', phaseCount: 64,
    lemurs: ['6::0 Tchu', '6::1 Djungo', '6::2 Djuddha', '6::3 Djynxx', '6::4 Tchakki', '6::5 Tchattuk'],
    lemurian: 'The I Ching hexagrams and Ur-Oriyan Yogini yantras. Permanent hexagon of the Saturnian pole.',
    centauri: 'Passive side of the Fourth (Crown) Pylon. Dark aspect of Fortune \u2014 gnostic death, event horizon, the absolutely unexpected.',
  },
  7: {
    planet: 'Uranus', planetFull: 'Uranus (Sol-7)',
    desc: 'Emergence from the depths. Hyper-sea water-carriers and amphibious colonization. Cosmic swamp-labyrinths.',
    spinal: '', meshTag: '0127',
    door: 'Puppo \u2014 Tracts of Dobo', phaseCount: 128,
    lemurs: ['7::0 Puppo', '7::1 Bubbamu', '7::2 Oddubb', '7::3 Pabbakis', '7::4 Ababbatok', '7::5 Papatakoo', '7::6 Bobobja'],
    lemurian: 'Coastal swamps of the Dib Nma. Chubby batrachian (burping toad) totem animals.',
    centauri: 'Active side of the Second (Right) Pylon. Light aspect of Genesis \u2014 genealogy, ancestor worship, inherited wealth.',
  },
  8: {
    planet: 'Neptune', planetFull: 'Neptune (Sol-8)',
    desc: 'Limbic drift, dreams, trance-states and foetal sentience. The digital byte \u2014 eight bits cements cybergothic cults.',
    spinal: 'Lumbar', meshTag: '0255',
    door: 'Minommo \u2014 dream sorcery of the Mu Nma', phaseCount: 256,
    lemurs: ['8::0 Minommo', '8::1 Murrumur', '8::2 Nammamad', '8::3 Mummumix', '8::4 Numko', '8::5 Muntuk', '8::6 Mommoljo', '8::7 Mombbo'],
    lemurian: 'Submarine cities of the ancient Mu Nma. Polytendrilled abominations of the deep sea.',
    centauri: 'Passive side of the First (Centre) Pylon. Dark aspect of Anamnesis \u2014 submerged currents of fatality.',
  },
  9: {
    planet: 'Pluto', planetFull: 'Pluto (Sol-9)',
    desc: 'Cthellloid metallic ocean of the earth\'s iron core. The outermost reaches the innermost \u2014 Plutonic looping.',
    spinal: 'Sacral', meshTag: '0511',
    door: 'Uttunul \u2014 the Ultimate Door', phaseCount: 512,
    lemurs: ['9::0 Uttunul', '9::1 Tuttagool', '9::2 Unnunddo', '9::3 Ununuttix', '9::4 Unnunaka', '9::5 Tukutu', '9::6 Unnutchi', '9::7 Nuttubab', '9::8 Ummnu'],
    lemurian: 'Anticipated by H.P. Lovecraft as Yuggoth. City of the Worms \u2014 Tchukululok.',
    centauri: 'Active side of the Fifth (Root) Pylon. Light aspect of Foundation \u2014 prehuman cultures of the Old Ones.',
  },
}

// Keyed by pair id (the low zone of the syzygy): 0 = 0::9, 1 = 1::8, 2 = 2::7, 3 = 3::6, 4 = 4::5.
export const SYZYGY_LORE: Record<number, SyzygyLore> = {
  0: { demon: 'Uttunul', desc: 'Plex syzygy \u2014 the absolute outer. Outermost curve of the Barker spiral, coinciding with the limit ordinal-span in Barkerian arithmetic.' },
  1: { demon: 'Murrumur', desc: 'Deep Time Circuit syzygy. The great sea-beast \u2014 nethermost denizen of time. Undivided oceanic waters.' },
  2: { demon: 'Oddubb', desc: 'Central syzygy. The lurker of steaming swamps. Hyperstitious doublings reinforce its twin character.' },
  3: { demon: 'Djynxx', desc: 'Warp syzygy \u2014 the Ulterior Vortex of Outer-Time. Self-referential current folds back into Zone-3. Compact tension of the Warp system.' },
  4: { demon: 'Katak', desc: 'Innermost syzygy of the Time Circuit. The great storm-beast that hunts amongst raging storms. Innermost curve of the Barker spiral.' },
}

// Keyed by pair id: 0 Plex, 1 Surge, 2 Hold, 3 Warp, 4 Sink.
export const CURRENT_LORE: Record<number, CurrentLore> = {
  0: { name: 'Plex', desc: 'The 9+0 Syzygy difference folds back into Zone-9. An autonomous self-referential loop constituting Outer-Time, compounding the enigmas of interconnection.' },
  1: { name: 'Surge', desc: 'The 8+1 Syzygy difference produces Surge, rushing outward. Part of the anticlockwise Time Circuit: the hydrocycle\'s down-pour and precipitation.' },
  2: { name: 'Hold', desc: 'The 7+2 Syzygy difference produces Hold. Cloud-building, evaporation \u2014 the lurker of steaming swamps (Oddubb) yields to Hyperborean abduction.' },
  3: { name: 'Warp', desc: 'The 6+3 Syzygy difference folds back into Zone-3. An autonomous self-referential loop constituting Outer-Time. Intrinsically cryptic.' },
  4: { name: 'Sink', desc: 'The 5+4 Syzygy difference produces Sink, dragging inward to termination. Return to the abysmal waters \u2014 cataclysm linking time\'s order and recurrence.' },
}

// Keyed by gate origin zone.
export const GATE_LORE: Record<number, GateLore> = {
  0: { desc: 'Zeroth Gate',
    detail: 'Between its existence and nonexistence there is no difference. Many versions of the Numogram delete it entirely.' },
  1: { desc: 'First Gate',
    detail: 'Zone-1 turning forever into itself. A reduced microcosmic model of the Torque as a whole. Strong associations with the Bubble-Pod mythos.' },
  2: { desc: 'Lo-Way to the Crypt',
    detail: 'Intense line of escape from the Torque to the Warp. Way of the Storm-Worm. Multiply consolidated by cumulation, prime-ordination, and mesh-tagging.' },
  3: { desc: 'Gate to the Swirl',
    detail: 'Third Gate twists Zone-3 through Zone-6, adding an increment of spin to the entire Warp region. Zone-3\'s cumular power equals its syzygetic double.' },
  4: { desc: 'Gate of Submergence',
    detail: 'Completion, catastrophe, subsidence, decadence. The only pro-cyclic channel within the Torque, reinforcing the Sink Current\'s rush toward termination.' },
  5: { desc: 'Fifth Gate',
    detail: 'Tracks the path of abductions into the Warp. The channel through which Hyperborean forces are drawn into the vortex of Outer-Time.' },
  6: { desc: 'Sixth Gate',
    detail: 'Vortically recycling Zone-6 into the Warp, reinforcing the turbular momentum of the entire region. Complements the Third Gate.' },
  7: { desc: 'Gate of Relapse',
    detail: 'Fold-type time anomalies. The only counter-cyclic path within the Torque. Fetishized by the aquassassins of Hyper-C in their Bubble Pod mysteries.' },
  8: { desc: 'Gate of Charon',
    detail: 'Sole path of escape from the Torque into the Plex. Its digital sum cumulates to 666 \u2014 echoing the Seals of the Great Abyss and the Decadence pack.' },
  9: { desc: 'Gate of Pandemonium',
    detail: 'Coincidence of its number with the Nma demonomy. Linked to Tchukululok, fabled City of the Worms. Cross-matches the 5+4 Syzygy.' },
}

// Keyed by mesh number a(a-1)/2 + b of the demon a::b (a > b): 0 = 1::0 ... 44 = 9::8. One row per a.
export const DEMON_NAMES: Record<number, string> = {
  0: 'Lurgo',
  1: 'Duoddod', 2: 'Doogu',
  3: 'Ixix', 4: 'Ixigool', 5: 'Ixidod',
  6: 'Krako', 7: 'Sukugool', 8: 'Skoodu', 9: 'Skarkix',
  10: 'Tokhatto', 11: 'Tukkamu', 12: 'Kuttadid', 13: 'Tikkitix', 14: 'Katak',
  15: 'Tchu', 16: 'Djungo', 17: 'Djuddha', 18: 'Djynxx', 19: 'Tchakki', 20: 'Tchattuk',
  21: 'Puppo', 22: 'Bubbamu', 23: 'Oddubb', 24: 'Pabbakis', 25: 'Ababbatok', 26: 'Papatakoo', 27: 'Bobobja',
  28: 'Minommo', 29: 'Murrumur', 30: 'Nammamad', 31: 'Mummumix', 32: 'Numko', 33: 'Muntuk', 34: 'Mommoljo', 35: 'Mombbo',
  36: 'Uttunul', 37: 'Tuttagool', 38: 'Unnunddo', 39: 'Ununuttix', 40: 'Unnunaka', 41: 'Tukutu', 42: 'Unnutchi', 43: 'Nuttubab', 44: 'Ummnu',
}
