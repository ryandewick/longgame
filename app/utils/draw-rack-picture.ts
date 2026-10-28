import { capeImageUrl } from './assets'
import {
  RACK_PICTURE_PALETTE,
  rackPictureFonts,
  type PictureCape,
  type PictureLine,
  type RackPictureLayout,
} from './rack-picture'

/*
 * Puts a rack picture on a canvas. Everything that decides what the picture shows is in
 * utils/rack-picture.ts; this only draws the layout it is handed. Browser only.
 */

/**
 * The two fills that grey a cape out on a canvas, standing in for the page's
 * `brightness(0.34) saturate(0.12)`: a mid grey takes the colour out, a darker one dims it.
 */
const GREYING = { desaturate: '#808080', darken: '#5a5a5a' } as const

/** Where the brass gradient passes through its middle colour, as on the page's rail. */
const BRASS_MIDDLE_STOP = 0.45

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser has no 2D canvas.')
  return context
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

/**
 * Waits for the picture's fonts. A canvas draws with whatever is loaded at that moment and never
 * redraws, and the page may not have used every weight yet. A font that fails to load is drawn
 * in its fallback rather than stopping the picture.
 */
async function loadFonts(layout: RackPictureLayout): Promise<void> {
  await Promise.all(
    rackPictureFonts(layout).map(({ font, text }) =>
      document.fonts.load(font, text).catch(() => undefined),
    ),
  )
}

/** The cape at its drawn size with the colour taken out of it, keeping its own outline. */
function greyedCape(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const context = context2d(canvas)
  context.drawImage(image, 0, 0, width, height)
  context.globalCompositeOperation = 'saturation'
  context.fillStyle = GREYING.desaturate
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = 'multiply'
  context.fillStyle = GREYING.darken
  context.fillRect(0, 0, width, height)
  // the two fills covered the whole box: cut it back to the cape's shape
  context.globalCompositeOperation = 'destination-in'
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

/** A cape greyed out, then the same cape in colour over it from the hem up to its fill. */
function drawCape(
  context: CanvasRenderingContext2D,
  cape: PictureCape,
  image: HTMLImageElement,
): void {
  const { x, y, width, height, fill } = cape
  context.drawImage(greyedCape(image, width, height), x, y)
  if (fill <= 0) return
  context.drawImage(
    image,
    0,
    image.naturalHeight * (1 - fill),
    image.naturalWidth,
    image.naturalHeight * fill,
    x,
    y + height * (1 - fill),
    width,
    height * fill,
  )
}

function drawGround(context: CanvasRenderingContext2D, layout: RackPictureLayout): void {
  const { stage, stageGlow, stageFalloff } = RACK_PICTURE_PALETTE
  const { centreX, centreY, radius } = layout.glow
  context.fillStyle = stage
  context.fillRect(0, 0, layout.width, layout.height)
  const glow = context.createRadialGradient(centreX, centreY, 0, centreX, centreY, radius)
  glow.addColorStop(0, stageGlow)
  glow.addColorStop(0.5, stageFalloff)
  glow.addColorStop(1, stage)
  context.fillStyle = glow
  context.fillRect(0, 0, layout.width, layout.height)
}

function drawRail(context: CanvasRenderingContext2D, rail: RackPictureLayout['rail']): void {
  const { brassLight, brass, brassDark, railShadow } = RACK_PICTURE_PALETTE
  context.fillStyle = railShadow
  context.fillRect(rail.x, rail.y + rail.shadowOffset, rail.width, rail.height)
  const metal = context.createLinearGradient(0, rail.y, 0, rail.y + rail.height)
  metal.addColorStop(0, brassLight)
  metal.addColorStop(BRASS_MIDDLE_STOP, brass)
  metal.addColorStop(1, brassDark)
  context.fillStyle = metal
  context.fillRect(rail.x, rail.y, rail.width, rail.height)
}

/** Draws a line's runs one after another, each measured in its own font to place the next. */
function drawLine(context: CanvasRenderingContext2D, line: PictureLine): void {
  context.textBaseline = 'alphabetic'
  context.textAlign = line.align
  let x = line.x
  for (const run of line.runs) {
    context.font = run.font
    x += run.gapBefore
    const y = line.baseline + run.drop
    if (run.shadow) {
      context.fillStyle = RACK_PICTURE_PALETTE.black
      context.fillText(run.text, x + run.shadow, y + run.shadow)
    }
    context.fillStyle = run.colour
    context.fillText(run.text, x, y)
    x += context.measureText(run.text).width
  }
}

/**
 * Draws the picture. Resolves once the fonts and the cape renders have loaded and everything is
 * on the canvas; rejects if a cape render cannot be loaded.
 */
export async function drawRackPicture(layout: RackPictureLayout): Promise<HTMLCanvasElement> {
  const [images] = await Promise.all([
    Promise.all(layout.capes.map((cape) => loadImage(capeImageUrl(cape.skill, cape.trimmed)))),
    loadFonts(layout),
  ])

  const canvas = createCanvas(layout.width, layout.height)
  const context = context2d(canvas)
  drawGround(context, layout)
  drawRail(context, layout.rail)
  for (const [place, cape] of layout.capes.entries()) {
    const image = images[place]
    if (image) drawCape(context, cape, image)
  }
  for (const line of layout.lines) drawLine(context, line)
  return canvas
}
