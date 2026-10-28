/*
 * Writes the site's icon files into public/: the mark on its tile, as the files a search engine, a
 * bookmark bar and a phone's home screen ask for by address.
 *
 * The mark itself is drawn in code (app/utils/brand-mark.ts); a search engine, a bookmark bar and
 * a phone need it as files they can fetch. Run this by hand when the mark changes:
 *
 *   node tools/social/icons.mjs
 *
 * tests/app/brand-mark.test.ts checks that public/favicon.svg is still the mark the app draws.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { brandMarkSvg } from '../../app/utils/brand-mark.ts'

const publicFolder = fileURLToPath(new URL('../../public/', import.meta.url))
const svg = brandMarkSvg()

/** The mark as a PNG this many pixels square. */
function png(size) {
  return sharp(Buffer.from(svg), { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toBuffer()
}

/** An .ico file holding these PNGs, which is all the format needs to be read by a modern browser. */
function ico(images) {
  const HEADER_BYTES = 6
  const ENTRY_BYTES = 16
  const header = Buffer.alloc(HEADER_BYTES)
  header.writeUInt16LE(1, 2) // an icon, not a cursor
  header.writeUInt16LE(images.length, 4)
  let offset = HEADER_BYTES + ENTRY_BYTES * images.length
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ENTRY_BYTES)
    entry.writeUInt8(size, 0)
    entry.writeUInt8(size, 1)
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits a pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)])
}

writeFileSync(publicFolder + 'favicon.svg', svg + '\n')
// Google asks for a square icon whose side is a multiple of 48 pixels
writeFileSync(publicFolder + 'favicon-96x96.png', await png(96))
writeFileSync(publicFolder + 'apple-touch-icon.png', await png(180))
const icoSizes = [16, 32, 48]
writeFileSync(
  publicFolder + 'favicon.ico',
  ico(await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(size) })))),
)
console.log('wrote favicon.svg, favicon-96x96.png, apple-touch-icon.png and favicon.ico to public/')
