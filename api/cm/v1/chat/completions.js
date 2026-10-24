// ケアマネ転記アシスト Web体験版:AIの中継(Cloudflare Workers AI / OpenRouter)+1日の回数制限
// 画面側は LM Studio と同じ形式(/v1/chat/completions)で呼び出す。APIキーはここ(サーバー)にだけ置く。
import { text, originOk, tursoConf, tursoExec, cell, jstDay, ipHash, USAGE_TABLE } from '../../../_cm-lib.js';

export const config = { runtime: 'edge' };

// AIの接続先:CM_PROVIDER=cloudflare(既定)または openrouter
const PROVIDER = (process.env.CM_PROVIDER || 'cloudflare').toLowerCase();
const MODELS = { cloudflare: '@cf/qwen/qwen3-30b-a3b-fp8', openrouter: 'qwen/qwen3-30b-a3b-instruct-2507' };
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export default async function handler(req){
  if (req.method !== 'POST') return text(405, 'POSTのみ受け付けます。');
  if (!originOk(req)) return text(403, 'このページからはご利用いただけません。');
  let endpoint, key, extra = {}, headers = {};
  if (PROVIDER === 'openrouter') {
    key = process.env.OPENROUTER_API_KEY;
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    extra = { repetition_penalty: 1.1, provider: { data_collection: 'deny' } };
    headers = { 'HTTP-Referer': 'https://start-reposi.vercel.app/care-manager-support/web/', 'X-Title': 'CareManager Assist Web Trial' };
  } else {
    key = process.env.CLOUDFLARE_API_TOKEN;
    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    endpoint = acct ? 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(acct) + '/ai/v1/chat/completions' : '';
    if (!endpoint) key = '';
  }
  if (!key) return text(503, '体験版はただいま準備中です(AIの設定が未完了です)。');
  const model = process.env.CM_MODEL || MODELS[PROVIDER] || MODELS.cloudflare;

  let body;
  try { body = await req.json(); } catch (e) { return text(400, 'リクエストの形式が正しくありません。'); }
  const msgs = body && Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || msgs.length !== 2 || msgs[0].role !== 'system' || msgs[1].role !== 'user'
      || typeof msgs[0].content !== 'string' || typeof msgs[1].content !== 'string') {
    return text(400, 'リクエストの形式が正しくありません。');
  }
  if (msgs[0].content.length + msgs[1].content.length > 40000) return text(413, '入力が長すぎます。');

  // 1日の回数制限(IPごと・全体)
  if (process.env.CM_RATE_LIMIT !== 'off') {
    const conf = tursoConf();
    if (!conf) return text(503, '体験版はただいま準備中です(回数制限の設定が未完了です)。');
    const perIp = clamp(process.env.CM_LIMIT_PER_IP, 1, 1000, 10);
    const global = clamp(process.env.CM_LIMIT_GLOBAL, 1, 100000, 300);
    const day = jstDay(), ip = await ipHash(req);
    try {
      const [, mine, all] = await tursoExec(conf, [
        { sql: USAGE_TABLE },
        { sql: 'SELECT COALESCE((SELECT count FROM cm_usage WHERE day = ? AND ip = ?), 0)', args: [day, ip] },
        { sql: "SELECT COALESCE(SUM(count), 0) FROM cm_usage WHERE day = ? AND ip NOT LIKE 'fb:%'", args: [day] }
      ]);
      if (cell(mine) >= perIp) return text(429, '本日の利用回数の上限(' + perIp + '回)に達しました。また明日お試しください。');
      if (cell(all) >= global) return text(429, '本日はたくさんの方にご利用いただき、全体の上限に達しました。また明日お試しください。');
      await tursoExec(conf, [{ sql: 'INSERT INTO cm_usage (day, ip, count) VALUES (?, ?, 1) ON CONFLICT (day, ip) DO UPDATE SET count = count + 1', args: [day, ip] }]);
    } catch (e) {
      return text(503, 'ただいま混み合っています。時間をおいてお試しください。');
    }
  }

  // Qwen3(思考モードあり)の場合は、考えている途中の文章を出さないよう /no_think を付ける
  const sendMsgs = /qwen3/i.test(model) && !/2507/.test(model)
    ? [msgs[0], { role: 'user', content: msgs[1].content + '\n\n/no_think' }]
    : msgs;
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: Object.assign({ Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(Object.assign({
      model,
      messages: sendMsgs,
      stream: true,
      temperature: clamp(body.temperature, 0, 1, 0.3),
      max_tokens: clamp(body.max_tokens, 500, 6000, 4000)
    }, extra))
  });
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => '');
    return text(502, 'AIサーバーで問題が起きました(HTTP ' + upstream.status + ')。時間をおいてお試しください。\n' + t.slice(0, 200));
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
