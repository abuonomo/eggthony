const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function sanitizeName(raw) {
  return String(raw).trim().replace(/[<>&"'/\\]/g, '').slice(0, 16);
}

const VALID_PLATFORMS = ['desktop', 'mobile'];

function kvKey(platform) {
  if (VALID_PLATFORMS.includes(platform)) return `leaderboard:${platform}`;
  return 'leaderboard'; // backward compat for old clients
}

async function migrateIfNeeded(env) {
  const migrated = await env.SCORES.get('migration:desktop_done');
  if (migrated) return;

  const raw = await env.SCORES.get('leaderboard');
  if (raw) {
    await env.SCORES.put('leaderboard:desktop', raw);
  }
  await env.SCORES.put('migration:desktop_done', 'true');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    await migrateIfNeeded(env);

    const url = new URL(request.url);

    if (url.pathname === '/scores' && request.method === 'GET') {
      const platform = url.searchParams.get('platform');
      const key = kvKey(platform);
      const raw = await env.SCORES.get(key);
      const board = raw ? JSON.parse(raw) : [];
      return json(board.slice(0, 10));
    }

    if (url.pathname === '/scores' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const name = sanitizeName(body.name);
      const score = Math.floor(Number(body.score));
      const round = Math.floor(Number(body.round));
      const platform = VALID_PLATFORMS.includes(body.platform) ? body.platform : null;
      const key = kvKey(platform);

      if (!name || name.length < 1) return json({ error: 'Name required' }, 400);
      if (!Number.isFinite(score) || score < 0) return json({ error: 'Invalid score' }, 400);
      if (!Number.isFinite(round) || round < 1) return json({ error: 'Invalid round' }, 400);

      const raw = await env.SCORES.get(key);
      const board = raw ? JSON.parse(raw) : [];

      board.push({ name, score, round, date: new Date().toISOString() });
      board.sort((a, b) => b.score - a.score);
      const capped = board.slice(0, 50);

      await env.SCORES.put(key, JSON.stringify(capped));

      return json(capped.slice(0, 10));
    }

    return json({ error: 'Not found' }, 404);
  },
};
