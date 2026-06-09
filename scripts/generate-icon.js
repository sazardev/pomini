// Generates a minimal 512x512 pomini icon PNG
// Run: node scripts/generate-icon.js

const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SIZE = 512
const BG = { r: 10, g: 10, b: 10 }    // #0a0a0a
const FG = { r: 240, g: 240, b: 240 }  // #f0f0f0

function createPixelBuffer() {
  const buf = Buffer.alloc(SIZE * SIZE * 4)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const outerR = SIZE * 0.32
  const innerR = SIZE * 0.28

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= innerR) {
        buf[i] = FG.r; buf[i + 1] = FG.g; buf[i + 2] = FG.b; buf[i + 3] = 255
      } else if (dist <= outerR) {
        buf[i] = FG.r; buf[i + 1] = FG.g; buf[i + 2] = FG.b; buf[i + 3] = 255
      } else {
        buf[i] = BG.r; buf[i + 1] = BG.g; buf[i + 2] = BG.b; buf[i + 3] = 255
      }
    }
  }
  return buf
}

function createPNG(pixels) {
  const chunks = []

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  chunks.push(createChunk('IHDR', ihdr))

  // IDAT
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0 // filter none
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  chunks.push(createChunk('IDAT', compressed))

  // IEND
  chunks.push(createChunk('IEND', Buffer.alloc(0)))

  return Buffer.concat(chunks)
}

function createChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crc = crc32(Buffer.concat([typeB, data]))
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc, 0)
  return Buffer.concat([len, typeB, data, crcBuf])
}

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c
  }
  c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

const pixels = createPixelBuffer()
const png = createPNG(pixels)
const outPath = path.join(__dirname, '..', 'assets', 'icon.png')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, png)
console.log(`Icon created: ${outPath} (${SIZE}x${SIZE})`)
