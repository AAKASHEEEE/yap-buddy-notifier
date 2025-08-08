import { serve } from "https://deno.land/std@0.195.0/http/server.ts";

// In-memory cache and token bucket per edge runtime instance
const CACHE_TTL_MS_DEFAULT = 10 * 60 * 1000; // 10 minutes
const BATCH_LIMIT = 10;
const KAITO_BASE = "https://api.kaito.ai/api/v1/yaps";

interface YapResult {
  username: string;
  score_total?: number;
  score_24h?: number;
  score_7d?: number;
  score_30d?: number;
  last_updated_at?: string;
  source?: string;
  cached?: boolean;
  error?: string;
}

const g = globalThis as unknown as {
  __yap_cache?: Map<string, { data: YapResult; ts: number }>;
  __yap_bucket?: {
    capacity: number;
    tokens: number;
    refillPerMs: number;
    lastRefill: number;
  };
};

if (!g.__yap_cache) g.__yap_cache = new Map();
if (!g.__yap_bucket) {
  // Default: 100 calls per 5 minutes
  const capacity = 100;
  const windowMs = 5 * 60 * 1000;
  g.__yap_bucket = {
    capacity,
    tokens: capacity,
    refillPerMs: capacity / windowMs,
    lastRefill: Date.now(),
  };
}

function takeToken(n = 1): boolean {
  const bucket = g.__yap_bucket!;
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(
    bucket.capacity,
    bucket.tokens + elapsed * bucket.refillPerMs
  );
  bucket.lastRefill = now;
  if (bucket.tokens >= n) {
    bucket.tokens -= n;
    return true;
  }
  return false;
}

async function fetchKaito(username: string, signal: AbortSignal): Promise<YapResult> {
  const apiKey = Deno.env.get("KAITO_API_KEY");
  const url = `${KAITO_BASE}?username=${encodeURIComponent(username)}`;

  // Exponential backoff on 429
  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (!takeToken(1)) {
      return { username, error: "rate_limited" };
    }

    try {
      const res = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal,
      });

      if (res.status === 429) {
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        return { username, error: "rate_limited" };
      }

      if (!res.ok) {
        return { username, error: `upstream_${res.status}` };
      }

      const data = await res.json();
      // Shape response defensively
      const shaped: YapResult = {
        username,
        score_total: data?.score_total ?? data?.total ?? 0,
        score_24h: data?.score_24h ?? data?.last_24h ?? 0,
        score_7d: data?.score_7d ?? data?.last_7d ?? 0,
        score_30d: data?.score_30d ?? data?.last_30d ?? 0,
        last_updated_at: new Date().toISOString(),
        source: "kaito",
        cached: false,
      };
      return shaped;
    } catch (e) {
      if (e?.name === "AbortError") return { username, error: "aborted" };
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      return { username, error: "network" };
    }
  }
  return { username, error: "unknown" };
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as Record<string, string>;
}

serve(async (req) => {
  const cors = getCorsHeaders();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { searchParams } = new URL(req.url);
    const single = searchParams.get("username");
    const list = searchParams.get("usernames");
    const ttlParam = Number(searchParams.get("ttl"));
    const ttl = Number.isFinite(ttlParam) && ttlParam >= 60_000 && ttlParam <= 60 * 60_000
      ? ttlParam
      : CACHE_TTL_MS_DEFAULT;

    let usernames: string[] = [];
    if (single) usernames = [single];
    if (list) usernames = list.split(",").map((s) => s.trim()).filter(Boolean);

    // Validate format: X/Twitter handles up to 15 chars, letters, numbers, underscore
    usernames = usernames
      .filter((u) => /^[A-Za-z0-9_]{1,15}$/.test(u))
      .slice(0, BATCH_LIMIT);

    if (usernames.length === 0) {
      return new Response(JSON.stringify({ error: "no_usernames" }), {
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const now = Date.now();
    const cached: YapResult[] = [];
    const toFetch: string[] = [];
    for (const u of usernames) {
      const entry = g.__yap_cache!.get(u);
      if (entry && now - entry.ts < ttl) {
        cached.push({ ...entry.data, cached: true });
      } else {
        toFetch.push(u);
      }
    }

    const fetched: YapResult[] = [];
    for (const u of toFetch) {
      const res = await fetchKaito(u, controller.signal);
      if (!res.error) {
        g.__yap_cache!.set(u, { data: res, ts: Date.now() });
      }
      fetched.push(res);
    }

    clearTimeout(timeout);

    const results = usernames.map((u) =>
      cached.find((c) => c.username === u) ?? fetched.find((f) => f.username === u)!
    );

    const body = single ? results[0] : results;

    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 200,
      headers: { "content-type": "application/json", ...getCorsHeaders() },
    });
  }
});
