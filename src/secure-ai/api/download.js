/**
 * Exporting a document out of the app.
 *
 * A released key and a downloadable file are the same event here: if the KAS unwrapped for
 * this persona, they are entitled to the ciphertext too. So the export is offered wherever a
 * grant is shown, and what leaves the app is always the .tdf — never the plaintext the model
 * was handed. The policy is inside the file, so the copy that lands on someone's disk is
 * still gated by the same KAS as the copy in the vault. That is the point of offering it.
 *
 * Two paths, because the app runs two ways: packaged Electron gets a real save dialog over
 * IPC, and a plain browser tab falls back to an <a download>.
 */

/** A filesystem-safe name for a vault unit. Tier keys look like "doc-id:tier-id". */
export function tdfFilename(unit) {
  return `${unit.key.replace(/[^A-Za-z0-9._-]+/g, '-')}.tdf`
}

/**
 * Write a vault entry's TDF wherever the user chooses.
 *
 * @param {object} unit     the vault entry's `unit` (used only for the filename)
 * @param {Uint8Array} tdfBytes
 * @returns {Promise<string|null>} the path written, or null if the save dialog was
 *   cancelled. The browser fallback cannot observe a cancel, so it reports the filename.
 */
export async function saveTdf(unit, tdfBytes) {
  const filename = tdfFilename(unit)

  // `aiSaveFile`, not `saveFile`. Both write bytes to a path the user picks, but Demo Center's
  // older helper takes (bytes, filename) and this one takes (filename, bytes) — the same two
  // arguments in the opposite order. Renaming either one would have been a silent corruption
  // waiting to happen, so they have separate names and the main process guards the shape.
  if (window.electronAPI?.aiSaveFile) {
    return window.electronAPI.aiSaveFile(filename, tdfBytes)
  }

  const url = URL.createObjectURL(new Blob([tdfBytes], { type: 'application/octet-stream' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return filename
}
