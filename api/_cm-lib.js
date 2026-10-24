// ケアマネ転記アシスト Web体験版 共通処理(Turso・回数制限・送信元チェック)
// ファイル名が _ で始まるため、Vercel ではURLとして公開されません。

export function text(status, msg){
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// 送信元のページが自分のサイトかどうか(他サイトからの悪用をふせぐ)
export function originOk(req){
  const o = req.headers.get('origin') || '';
  if (!o) return false;
  const allow = (process.env.CM_ALLOWED_ORIGINS || 'https://start-reposi.vercel.app').split(',').map(s => s.trim()).filter(Boolean);
  if (allow.includes(o)) return true;
  try { const h = new URL(o).hostname; return h.startsWith('start-reposi') && h.endsWith('.vercel.app'); } catch (e) { return false; }
}

export function tursoConf(){
  const url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, ''), token };
}

function toArg(v){
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}

// Turso(libSQL)のHTTP APIで複数のSQLを順に実行し、それぞれの結果を返す
export async function tursoExec(conf, stmts){
  const requests = stmts.map(s => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args || []).map(toArg) } }));
  requests.push({ type: 'close' });
  const r = await fetch(conf.url + '/v2/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + conf.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  if (!r.ok) throw new Error('turso http ' + r.status);
  const j = await r.json();
  return j.results.slice(0, stmts.length).map(x => {
    if (x.type !== 'ok') throw new Error('turso: ' + JSON.stringify(x.error || x));
    return x.response.result;
  });
}

export function cell(result, row = 0, col = 0){
  const c = result && result.rows && result.rows[row] && result.rows[row][col];
  return c && c.value !== undefined ? Number(c.value) : 0;
}

// 日本時間の日付(回数制限の区切り)
export function jstDay(){ return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }

// IPアドレスはそのまま保存せず、ハッシュ化した値だけを使う
export async function ipHash(req){
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.CM_IP_SALT || 'cm-assist';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const USAGE_TABLE = 'CREATE TABLE IF NOT EXISTS cm_usage (day TEXT NOT NULL, ip TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ip))';
