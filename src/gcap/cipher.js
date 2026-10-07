const hex = (n, w) => n.toString(16).padStart(w, '0')

/** Offset of the encrypted payload inside the TDF's zip, past the local file header. */
function payloadOffset(bytes) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return 0
  return 30 + (bytes[26] | (bytes[27] << 8)) + (bytes[28] | (bytes[29] << 8))
}

/** The first encrypted bytes of a file as a hex dump, so a sealed window shows what is really on disk. */
export function hexRows(bytes, rows = 15, width = 6) {
  const start = payloadOffset(bytes)
  const out = []
  for (let r = 0; r < rows && start + r * width < bytes.length; r++) {
    const at = start + r * width
    out.push(`${hex(at, 4)}  ${[...bytes.subarray(at, at + width)].map(b => hex(b, 2)).join(' ')}`)
  }
  return out
}

export async function sha256(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...d].map(b => hex(b, 2)).join('')
}

export const byteSize = (n) => `${n.toLocaleString('en-US')} B`

/** Wrapped-key size of a manifest's first key access object, as sent on the rewrap. */
export function wrappedKeyBytes(manifest) {
  const w = manifest?.encryptionInformation?.keyAccess?.[0]?.wrappedKey
  if (!w) return null
  return Math.floor((w.length * 3) / 4) - (w.endsWith('==') ? 2 : w.endsWith('=') ? 1 : 0)
}

/** The entries of a TDF's zip, read from its central directory (zip64 aware): name and uncompressed size. */
export function zipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o) => (o >= 0 && o + 2 <= dv.byteLength ? dv.getUint16(o, true) : null)
  const u32 = (o) => (o >= 0 && o + 4 <= dv.byteLength ? dv.getUint32(o, true) : null)
  const u64 = (o) => (o >= 0 && o + 8 <= dv.byteLength ? Number(dv.getBigUint64(o, true)) : null)
  let e = bytes.length - 22
  while (e >= 0 && u32(e) !== 0x06054b50) e--
  if (e < 0) return []
  let count = u16(e + 10)
  let p = u32(e + 16)
  if (count === 0xffff || p === 0xffffffff) {
    const loc = e - 20
    if (u32(loc) !== 0x07064b50) return []
    const z = u64(loc + 8)
    if (z == null || u32(z) !== 0x06064b50) return []
    count = u64(z + 32)
    p = u64(z + 48)
  }
  const out = []
  for (let i = 0; i < count && p != null && u32(p) === 0x02014b50; i++) {
    const n = u16(p + 28)
    const extra = u16(p + 30)
    let size = u32(p + 24)
    if (size === 0xffffffff) {
      let x = p + 46 + n
      const end = x + extra
      while (x + 4 <= end) {
        const id = u16(x)
        const len = u16(x + 2)
        if (id === 0x0001) { size = u64(x + 4); break }
        x += 4 + len
      }
    }
    out.push({ name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + n)), size })
    p += 46 + n + extra + u16(p + 32)
  }
  return out
}
