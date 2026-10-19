# Phase 7: Naming Builder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 7-Naming Builder
**Areas discussed:** Where the builder lives and where names show up; What generated sounds look like; Euphony smoothing of derived demon names; Saving, undo and base switching; (round 2) Naming at very large bases, Name collisions, CCRU names outside base 10; (round 3) Shared seed links, Valid zone sounds, Name case

---

## Where the builder lives and where names show up

### Placement of the builder

| Option | Description | Selected |
|--------|-------------|----------|
| A fourth tab in the Demons overlay (Recommended) | Shares the overlay's large surface and selected-demon state; one entry point | |
| Its own overlay with its own header button | Dedicated Names surface, independent of demons; a second large overlay competing for space | |
| A compact side panel in the existing panel stack | Consistent with the old panels; tight for a table and controls | ✓ |

**User's choice:** A compact side panel in the existing panel stack (chosen over the recommended overlay tab).

### Editing from a compact panel

| Option | Description | Selected |
|--------|-------------|----------|
| One self-contained panel with a scrolling zone list (Recommended) | Global controls on top, virtualized zone list with editable sound and lock; demons renamed from the Selection detail | ✓ |
| Global controls only; edit sounds where you select things | Smallest panel; no bulk view or edit of all sounds | |
| Panel plus a larger table window on demand | Comfortable for big edits; adds the second large surface | |

**User's choice:** One self-contained panel with a scrolling zone list.

### Where else names appear (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Zone sounds as a diagram label mode | A `sounds` mode beside digits, xenotation and alphabets | ✓ |
| A zone's sound in the Zones panel rows and zone detail | Helpful for reviewing a table; covers SVG-tier bases plus the zone detail | |
| Names along demon chords in focus mode | Drawing work and clutter risk | |

**User's choice:** Zone sounds as a diagram label mode.

---

## What generated sounds look like

### Sound style

| Option | Description | Selected |
|--------|-------------|----------|
| CCRU-flavoured clusters by default, plus a few selectable styles (Recommended) | Harsh default imitating the originals, style part of the seed | ✓ |
| One style only: CCRU-flavoured clusters | Simplest and most faithful | |
| One pronounceable-syllable style only | Easy to read aloud, nothing like CCRU | |

**User's choice:** CCRU-flavoured clusters by default, plus a few selectable styles.

### Styles and distinctness

| Option | Description | Selected |
|--------|-------------|----------|
| Three styles; sounds are always distinct and grow longer as needed (Recommended) | Harsh, soft, syllabic; no duplicate zone sounds at any base | ✓ |
| Two styles (CCRU-like and pronounceable); same guarantee | Fewer things to tune and freeze | |
| Three styles, but short sounds with duplicates allowed at huge bases | Punchy, but duplicates cascade into many identical demon names | |

**User's choice:** Three styles; sounds are always distinct and grow longer as needed.

---

## Euphony smoothing of derived demon names

| Option | Description | Selected |
|--------|-------------|----------|
| Optional smoothing, off by default, raw and smoothed shown side by side (Recommended) | Plain join by default; deterministic vowel insertion on request | ✓ |
| Smoothing on by default, with a raw option | More real-looking names, hides the simple rule, more collisions | |
| Raw join only in v1 | Smallest build; unpronounceable strings at harsh-style bases | |

**User's choice:** Optional smoothing, off by default, raw and smoothed shown side by side.

---

## Saving, undo and base switching

### Saving

| Option | Description | Selected |
|--------|-------------|----------|
| Autosave in the browser per base, plus explicit export (Recommended) | One local-storage slot per base; export for moving and backup | ✓ |
| Session only until exported | Nothing stored; a lost tab loses work | |
| Autosave a single working set (not per base) | Switching bases discards the previous base's names | |

**User's choice:** Autosave in the browser per base, plus explicit export.

### Base switch and undo

| Option | Description | Selected |
|--------|-------------|----------|
| Each base loads its own saved naming; edits join undo/redo (Recommended) | Fresh seeded naming when none; no per-zone carry-over; no cross-base history restore | ✓ |
| Carry the seed, style and join rule to the new base | New base starts from the same flavour; still no per-zone carry-over | |
| Keep names in memory only for the current base; leave undo as is | Conflicts with per-base autosave | |

**User's choice:** Each base loads its own saved naming; edits join undo/redo.

---

## Round 2

### Naming at very large bases

| Option | Description | Selected |
|--------|-------------|----------|
| Full editing to the interactive ceiling; seed-only naming above it (Recommended) | Table, locks, autosave, full export up to `INTERACTIVE_MAX_N`; above it seed-only, lazily derived names | ✓ |
| Full editing to a smaller fixed limit (say 1,024), seed-only above | Second threshold to explain | |
| No naming above the interactive ceiling at all | Name column stays empty where the browser still works | |

**User's choice:** Full editing to the interactive ceiling; seed-only naming above it.

### Collisions

| Option | Description | Selected |
|--------|-------------|----------|
| Report only, with a jump to each colliding demon (Recommended) | Nothing changed behind the user's back | ✓ |
| Report plus a 'regenerate to reduce collisions' action | Changes every unlocked sound | |
| Report plus an automatic disambiguating suffix | Artificial, order-dependent suffixes | |

**User's choice:** Report only, with a jump to each colliding demon.

### CCRU names outside base 10

| Option | Description | Selected |
|--------|-------------|----------|
| CCRU preset stays base 10 only (Recommended) | Canonical names never claimed where the lore says nothing | ✓ |
| An optional toggle applies canonical names to demons between zones 0-9 in other bases | Names could land on a different kind of demon | |

**User's choice:** CCRU preset stays base 10 only.

---

## Round 3

### Shared seed link when saved names exist

| Option | Description | Selected |
|--------|-------------|----------|
| Open as an unsaved preview with an 'adopt' or 'discard' choice (Recommended) | Shown immediately, never saved over anything; "Keep this naming" or "Back to my saved naming" | ✓ |
| Ask first, before showing anything | Interrupts opening a link | |
| The link always wins for that session and never touches saved names | No way to keep what you were sent | |

**User's choice:** Open as an unsaved preview with an adopt or discard choice.

### Valid zone sound

| Option | Description | Selected |
|--------|-------------|----------|
| Letters of any script, 1 to 16 characters, no spaces or digits (Recommended) | NFC, grapheme-counted, inline messages | ✓ |
| Lowercase Latin letters a to z only, 1 to 12 characters | Strictest; excludes accents and other scripts | |
| Any visible Unicode text up to 24 characters, spaces and punctuation allowed | Ambiguous joins, complicates collisions | |

**User's choice:** Letters of any script, 1 to 16 characters, no spaces or digits.

### Name case

| Option | Description | Selected |
|--------|-------------|----------|
| Capitalise the first letter of every derived name (Recommended) | Matches the canonical names; overrides shown as typed | ✓ |
| Keep the sounds' own case, no automatic capitalisation | Literal; inconsistent next to canonical names | |
| A case setting in the panel (as typed, Capitalised, UPPER) | Another setting to freeze and test per script | |

**User's choice:** Capitalise the first letter of every derived name.

---

## Claude's Discretion

PRNG and Feistel details, style inventories and tuning, euphony rules and versioning, JSON schema field names, import size cap and error wording, panel layout and copy within D-01/D-02, local-storage key format, undo granularity, virtualization approach, how the name column reads the naming without per-demon storage, `sounds` label-mode wording and legibility cutoffs, worker involvement for large seeded tables, plan and wave breakdown.

## Deferred Ideas

- Zone sound in Zones panel rows and zone detail; names along focus chords.
- A larger table window for big edits.
- Canonical-name inheritance outside base 10.
- Collision repair actions (regenerate, automatic suffixes).
- A case setting for derived names; punctuation-rich or spaced sounds.
