// "Was this module started directly with `node <file>`?" for the CLI guard scripts (review WR-02).
// Zero dependencies, ESM, Windows and Linux safe.
//
// Node resolves symlinks and junctions for the entry module's import.meta.url, but process.argv[1] is only
// made absolute. Comparing the two URLs therefore fails whenever the checkout is reached through a symlink,
// a junction or a subst drive (a /workspace link in a cloud session, for one): the CLI silently did nothing
// and exited 0, so the guard passed vacuously. Compare real paths on both sides instead.

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** @param {string} p */
const real = (p) => {
  const resolved = realpathSync.native(p)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved // NTFS is case-insensitive
}

/**
 * @param {string} metaUrl the caller's import.meta.url
 * @param {string | undefined} [argv1] the entry script path; defaults to process.argv[1]
 * @returns {boolean} true when the caller is the entry script; false (never throws) otherwise
 */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    return real(argv1) === real(fileURLToPath(metaUrl))
  } catch {
    return false
  }
}
