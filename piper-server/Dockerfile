FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    ffmpeg \
    libespeak-ng1 \
    espeak-ng-data \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz \
    && tar -xzf piper_amd64.tar.gz -C /usr/local/ --strip-components=1 \
    && rm piper_amd64.tar.gz && \
    chmod +x /usr/local/piper && \
    ln -s /usr/local/piper /usr/local/bin/piper

RUN mkdir -p /app/models && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
    -O /app/models/en_US-lessac-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json \
    -O /app/models/en_US-lessac-medium.onnx.json && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx \
    -O /app/models/tr_TR-dfki-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx.json \
    -O /app/models/tr_TR-dfki-medium.onnx.json

WORKDIR /app
COPY package.json server.js ./
RUN npm install --production

EXPOSE 5000
CMD ["node", "server.js"]
