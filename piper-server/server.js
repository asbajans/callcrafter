const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5000;
const MODELS_DIR = process.env.MODELS_DIR || '/app/models';

function listModels() {
  try {
    return fs.readdirSync(MODELS_DIR)
      .filter(f => f.endsWith('.onnx'))
      .map(f => f.replace(/\.onnx$/, ''));
  } catch {
    return [];
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'piper-tts', models: listModels() });
});

app.get('/voices', (_req, res) => {
  res.json({ voices: listModels(), modelsDir: MODELS_DIR });
});

app.post('/tts', async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const modelName = voice || 'en_US-lessac-medium';
  const modelPath = path.join(MODELS_DIR, modelName + '.onnx');

  if (!fs.existsSync(modelPath)) {
    return res.status(400).json({ error: `Voice model not found: ${modelName}`, available: listModels() });
  }

  const tmpFile = path.join(os.tmpdir(), `piper-${crypto.randomUUID()}.wav`);

  try {
    await new Promise((resolve, reject) => {
      const piper = spawn('piper', [
        '--model', modelPath,
        '--output-raw',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      const ffmpeg = spawn('ffmpeg', [
        '-f', 's16le',
        '-ar', '22050',
        '-ac', '1',
        '-i', 'pipe:0',
        '-f', 'wav',
        '-ar', '8000',
        '-ac', '1',
        '-sample_fmt', 'u8',
        '-codec', 'pcm_mulaw',
        tmpFile,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      piper.stdout.pipe(ffmpeg.stdin);

      let stderr = '';
      piper.stderr.on('data', d => stderr += d.toString());
      ffmpeg.stderr.on('data', d => stderr += d.toString());

      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(stderr || 'Conversion failed'));
      });

      piper.on('error', reject);
      ffmpeg.on('error', reject);

      piper.stdin.write(text);
      piper.stdin.end();
    });

    const audio = fs.readFileSync(tmpFile);
    try { fs.unlinkSync(tmpFile); } catch {}

    res.set('Content-Type', 'audio/wav');
    res.send(audio);
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    console.error('Piper TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Piper TTS server on port ${PORT}`);
  console.log(`Models dir: ${MODELS_DIR}`);
  console.log(`Available voices: ${listModels().join(', ') || 'none'}`);
});
