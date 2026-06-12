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
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy CLI tools + config for startup migration
COPY --from=builder /app/node_modules/.bin /app/node_modules/.bin
COPY --from=builder /app/node_modules/payload /app/node_modules/payload
COPY --from=builder /app/node_modules/tsx /app/node_modules/tsx
COPY --from=builder /app/node_modules/typescript /app/node_modules/typescript
COPY --from=builder /app/node_modules/jiti /app/node_modules/jiti
COPY --from=builder /app/node_modules/source-map-support /app/node_modules/source-map-support
COPY --from=builder /app/node_modules/croner /app/node_modules/croner
COPY --from=builder /app/node_modules/minimist /app/node_modules/minimist
COPY --from=builder /app/tsconfig.json /app/tsconfig.json
COPY --from=builder /app/payload.config.ts /app/payload.config.ts
COPY --from=builder /app/src/migrations /app/src/migrations
COPY scripts/start.sh /app/start.sh

RUN chmod +x /app/start.sh /app/node_modules/.bin/payload
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["./start.sh"]
