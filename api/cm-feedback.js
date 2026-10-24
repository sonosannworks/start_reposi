// ケアマネ転記アシスト Web体験版:感想フォームの保存(Turso)
import { text, originOk, tursoConf, tursoExec, cell, jstDay, ipHash, USAGE_TABLE, errCode } from './_cm-lib.js';

export const config = { runtime: 'edge' };

const pick = (v, list) => (list.includes(v) ? v : '');
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export default async function handler(req){
  if (req.method !== 'POST') return text(405, 'POSTのみ受け付けます。');
  if (!originOk(req)) return text(403, 'このページからはご利用いただけません。');
  const conf = tursoConf();
  if (!conf) return text(503, 'ただいま感想を受け付けられません(設定が未完了です)。');

  let b;
  try { b = await req.json(); } catch (e) { return text(400, '送信内容の形式が正しくありません。'); }
  const rating = Number(b && b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return text(400, '「出来ばえ」を1〜5から選んでください。');
  const row = {
    persona: /^v[23]-\d{1,2}$/.test(b.personaId || '') ? b.personaId : '',
    role: pick(b.role, ['caremanager', 'nurse', 'carer', 'other']),
    tried: pick(b.tried, ['issue', 'plan', 'both']),
    want: pick(b.wantUse, ['yes', 'maybe', 'no']),
    good: clip(b.good, 1000),
    improve: clip(b.improve, 1000)
  };

  const day = jstDay(), ip = 'fb:' + (await ipHash(req));
  try {
    const [, , mine] = await tursoExec(conf, [
      { sql: USAGE_TABLE },
      { sql: 'CREATE TABLE IF NOT EXISTS cm_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, persona_id TEXT, role TEXT, tried TEXT, rating INTEGER, want_use TEXT, good TEXT, improve TEXT)' },
      { sql: 'SELECT COALESCE((SELECT count FROM cm_usage WHERE day = ? AND ip = ?), 0)', args: [day, ip] }
    ]);
    if (cell(mine) >= 20) return text(429, '本日はこれ以上送信できません。ありがとうございました。');
    await tursoExec(conf, [
      { sql: "INSERT INTO cm_feedback (created_at, persona_id, role, tried, rating, want_use, good, improve) VALUES (datetime('now', '+9 hours'), ?, ?, ?, ?, ?, ?, ?)",
        args: [row.persona, row.role, row.tried, rating, row.want, row.good, row.improve] },
      { sql: 'INSERT INTO cm_usage (day, ip, count) VALUES (?, ?, 1) ON CONFLICT (day, ip) DO UPDATE SET count = count + 1', args: [day, ip] }
    ]);
  } catch (e) {
    console.error('[cm] turso error:', errCode(e));
    return text(503, 'ただいま混み合っています。時間をおいてお試しください。(記録の保存で問題が起きました:' + errCode(e) + ')');
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
