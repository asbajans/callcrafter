FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz \
    && tar -xzf piper_linux_x86_64.tar.gz -C /usr/local/bin/ \
    && rm piper_linux_x86_64.tar.gz

RUN mkdir -p /app/models && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
    -O /app/models/en_US-lessac-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json \
    -O /app/models/en_US-lessac-medium.onnx.json && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx \
    -O /app/models/tr_TR-dfki-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx.json \
    -O /app/models/tr_TR-dfki-medium.onnx.json

WORKDIR /app
COPY package.json server.js ./
RUN npm install --production

EXPOSE 5000
CMD ["node", "server.js"]
