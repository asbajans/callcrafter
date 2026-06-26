const express = require('express');
const { spawn, execSync } = require('child_process');
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

function checkPpiper() {
  try {
    const out = execSync('which piper 2>/dev/null || echo notfound').toString().trim();
    return out !== 'notfound' ? out : null;
  } catch {
    return null;
  }
}

app.get('/health', (_req, res) => {
  const models = listModels();
  res.json({
    status: 'ok',
    service: 'piper-tts',
    piperBinary: checkPpiper(),
    modelsCount: models.length,
    models: models,
  });
});

app.get('/voices', (_req, res) => {
  res.json({ voices: listModels(), modelsDir: MODELS_DIR });
});

const multer = require('multer');
const upload = multer({ dest: os.tmpdir() });

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const voiceId = req.body.voiceId || req.file.originalname.replace(/\.(onnx|json)$/i, '');
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.onnx' && ext !== '.json') {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: `Unsupported file type: ${ext} (only .onnx and .json)` });
  }
  const destPath = path.join(MODELS_DIR, voiceId + ext);
  try {
    fs.copyFileSync(req.file.path, destPath);
    try { fs.unlinkSync(req.file.path); } catch {}
    if (ext === '.onnx' && !fs.existsSync(path.join(MODELS_DIR, voiceId + '.json'))) {
      console.log(`Warning: ${voiceId}.json config not found — Piper may still work`);
    }
    const parts = voiceId.split('-');
    const langCode = parts.length > 1 ? parts[0].replace(/_/g, '') : 'EN';
    const lang = langCode === 'tr' ? 'TR' : langCode === 'en' ? 'EN' : langCode === 'de' ? 'DE' : langCode === 'fr' ? 'FR' : langCode === 'es' ? 'ES' : 'EN';
    const displayName = voiceId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    res.json({ success: true, voiceId, displayName, language: lang, file: req.file.originalname, modelsDir: MODELS_DIR, available: listModels() });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
});

app.post('/tts', async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const modelName = voice || 'en_US-lessac-medium';
  const modelPath = path.join(MODELS_DIR, modelName + '.onnx');

  if (!fs.existsSync(modelPath)) {
    return res.status(400).json({
      error: `Voice model not found: ${modelName}`,
      modelPath,
      modelsDir: MODELS_DIR,
      available: listModels(),
    });
  }

  const stats = fs.statSync(modelPath);
  if (stats.size < 1000) {
    return res.status(500).json({ error: `Model file too small (${stats.size} bytes): ${modelName}`, modelPath });
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
        '-codec', 'pcm_mulaw',
        tmpFile,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      piper.stdout.pipe(ffmpeg.stdin);

      let piperStderr = '';
      let ffmpegStderr = '';
      piper.stderr.on('data', d => piperStderr += d.toString());
      ffmpeg.stderr.on('data', d => ffmpegStderr += d.toString());

      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else {
          const msg = [
            piperStderr ? `piper: ${piperStderr.trim()}` : '',
            ffmpegStderr ? `ffmpeg: ${ffmpegStderr.slice(0, 500).trim()}` : '',
          ].filter(Boolean).join(' | ') || `ffmpeg exit code ${code}`;
          reject(new Error(msg));
        }
      });

      piper.on('error', err => reject(new Error(`piper spawn failed: ${err.message}`)));
      ffmpeg.on('error', err => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));

      piper.stdin.write(text);
      piper.stdin.end();
    });

    const audio = fs.readFileSync(tmpFile);
    try { fs.unlinkSync(tmpFile); } catch {}

    res.set('Content-Type', 'audio/wav');
    res.send(audio);
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    console.error('Piper TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const piperPath = checkPpiper();
app.listen(PORT, () => {
  console.log(`Piper TTS server on port ${PORT}`);
  console.log(`Piper binary: ${piperPath || 'NOT FOUND!'}`);
  console.log(`Models dir: ${MODELS_DIR}`);
  const models = listModels();
  console.log(`Available voices (${models.length}): ${models.join(', ') || 'none'}`);
});
