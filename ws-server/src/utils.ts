export function mulawToWav(mulawBuffer: Buffer): Buffer {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 8
  const dataSize = mulawBuffer.length
  const headerSize = 44
  const header = Buffer.alloc(headerSize)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(0x0101, 20) // WAVE_FORMAT_MULAW
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28)
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, mulawBuffer])
}

export function createUlawWavHeader(dataLength: number): Buffer {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 8
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLength, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(0x0101, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28)
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLength, 40)

  return header
}

const SILENCE_THRESHOLD = 16
const MIN_SILENCE_FRAMES = 15

export function detectSilence(audioBuffer: Buffer): boolean {
  let silentFrames = 0
  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = audioBuffer.readUInt8(i)
    if (Math.abs(sample - 128) < SILENCE_THRESHOLD) {
      silentFrames++
    } else {
      silentFrames = 0
    }
    if (silentFrames >= MIN_SILENCE_FRAMES) {
      return true
    }
  }
  return false
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
