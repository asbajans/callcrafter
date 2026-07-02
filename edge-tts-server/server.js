import express from 'express';
import { EdgeTTS } from '@andresaya/edge-tts';

const PORT = parseInt(process.env.PORT || '5000');
const app = express();

const tts = new EdgeTTS();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'edge-tts' }));

app.get('/tts', async (req, res) => {
  const text = req.query.text || '';
  const voice = req.query.voice || 'tr-TR-EmelNeural';

  if (!text) {
    return res.status(400).json({ error: 'text query parameter is required' });
  }

  try {
    console.log(`Edge TTS: voice=${voice}, text="${text.slice(0, 60)}..."`);

    await tts.synthesize(text, voice);
    const buffer = tts.toBuffer();

    console.log(`Edge TTS success: ${buffer.length} bytes`);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-cache',
    });
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`Edge TTS error: ${err.message}`);
    res.status(500).json({ error: err.message || 'Edge TTS failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Edge TTS server listening on port ${PORT}`);
});
