FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache ffmpeg
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Install all production deps (fills gaps in standalone trace for CLI tools)
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --omit=dev && rm -f package-lock.json

# Copy config + source for startup migration (CLI needs source TS files)
COPY --from=builder /app/tsconfig.json /app/tsconfig.json
COPY --from=builder /app/payload.config.ts /app/payload.config.ts
COPY --from=builder /app/src/payload /app/src/payload
COPY --from=builder /app/src/migrations /app/src/migrations
COPY scripts/start.sh /app/start.sh

RUN mkdir -p /app/.tmp && chown -R nextjs:nodejs /app/src/migrations && chown nextjs:nodejs /app/.tmp
RUN chmod +x /app/start.sh
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["./start.sh"]
