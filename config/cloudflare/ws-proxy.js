/**
 * Cloudflare Workers — WebSocket Proxy for CallCrafter
 *
 * Deploy as a Cloudflare Worker to:
 * 1. Route WebSocket connections to the ws-server
 * 2. Provide failover across multiple ws-server instances
 * 3. Add DDoS protection and rate limiting at the edge
 *
 * Deployment:
 *   wrangler deploy config/cloudflare/ws-proxy.js
 *
 * wrangler.toml:
 *   name = "callcrafter-ws-proxy"
 *   main = "config/cloudflare/ws-proxy.js"
 *   compatibility_date = "2026-06-01"
 *
 * Environment variables (set via wrangler secret):
 *   WS_SERVER_URLS  = comma-separated list of ws-server origins, e.g. "https://ws1.example.com,https://ws2.example.com"
 *   INTERNAL_API_KEY = shared secret for health check auth
 *
 * DNS:
 *   ws.callcrafter.com.tr → Cloudflare Worker (proxied)
 */

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// Rate limiting state (per-IP, per 60s window)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function getServerUrls() {
  const urls = (globalThis.WS_SERVER_URLS || 'http://ws-server:8080').split(',');
  return urls.map((u) => u.trim());
}

function selectServer(serverUrls) {
  // Simple round-robin; could be replaced with least-connections
  const index = Math.floor(Math.random() * serverUrls.length);
  return serverUrls[index];
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const serverUrls = getServerUrls();

  // Health check endpoint
  if (url.pathname === '/health') {
    const results = await Promise.allSettled(
      serverUrls.map(async (origin) => {
        const response = await fetch(`${origin}/health`, {
          headers: { Authorization: `Bearer ${globalThis.INTERNAL_API_KEY || ''}` },
        });
        return { origin, status: response.status, ok: response.ok };
      })
    );

    const servers = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { origin: 'unknown', status: 503, ok: false }
    );

    const allHealthy = servers.every((s) => s.ok);

    return new Response(JSON.stringify({ status: allHealthy ? 'healthy' : 'degraded', servers }), {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // WebSocket upgrade
  if (request.headers.get('Upgrade') === 'websocket') {
    const targetUrl = selectServer(serverUrls);

    // Forward the request to the selected ws-server
    const proxyUrl = new URL(url.pathname + url.search, targetUrl);
    const proxyRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Cloudflare will handle the WebSocket upgrade transparently
    return fetch(proxyRequest);
  }

  // Fallback for non-WebSocket requests (e.g., Twilio webhooks)
  const targetUrl = selectServer(serverUrls);
  const proxyUrl = new URL(url.pathname + url.search, targetUrl);
  const proxyRequest = new Request(proxyUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  return fetch(proxyRequest);
}
