#!/usr/bin/env node
// Strapi v5 auto-translate (collection types + single types)
// Node 18+ chahiye. npm install ki zaroorat NAHI hai.
//
// Run:
//   node translate.js                 -> config me jitne collections/singles hain sab
//   node translate.js products        -> sirf ek content type
//   node translate.js --test 3        -> sirf pehli 3 entries (pehle test ke liye)

const fs = require('fs');
const path = require('path');

// ---------- .env + config ----------
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'translate.config.json'), 'utf8'));
const BASE = (process.env.STRAPI_URL || cfg.strapiUrl || '').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;

// Provider: "claude" (paid) ya "gemini" (free tier chal jata hai)
const PROVIDER = cfg.provider || 'claude';
const GEMINI = PROVIDER === 'gemini';
const AKEY = GEMINI ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY;
const KEY_NAME = GEMINI ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
if (!BASE || !TOKEN || !AKEY) {
  console.error(`STRAPI_URL (ya config me strapiUrl), STRAPI_TOKEN aur ${KEY_NAME} set karo (.env file me).`);
  process.exit(1);
}

const SOURCE = cfg.sourceLocale || 'en';
const TARGETS = cfg.targetLocales || ['es'];
const MODEL = cfg.model || (GEMINI ? 'gemini-flash-lite-latest' : 'claude-haiku-5-5');
// Free tier ke liye dheere chalao: kitni requests ek saath, aur per minute max kitni
const PARALLEL = cfg.parallel || (GEMINI ? 1 : 5);
const RPM = cfg.requestsPerMinute || (GEMINI ? 10 : 0);
const BATCH_STRINGS = cfg.batchStrings || (GEMINI ? 80 : 40);
const BATCH_CHARS = cfg.batchChars || (GEMINI ? 12000 : 6000);
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const ti = args.indexOf('--test');
const TEST = ti >= 0 ? Number(args[ti + 1]) || 3 : 0;
const ONLY = args.filter((a, i) => !a.startsWith('--') && (ti < 0 || i !== ti + 1));

const SYS = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations'];
const SKIP = new Set([
  ...SYS, 'slug', 'uid', 'url', 'email', '__component', 'type', 'format', 'mime', 'ext', 'hash', 'provider',
  ...(cfg.skipKeys || []),
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    })
  );
}

// ---------- Strapi HTTP ----------
async function api(method, url, body) {
  for (let a = 1; a <= 4; a++) {
    const r = await fetch(BASE + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && a < 4) { await sleep(1000 * a); continue; }
    const t = await r.text();
    const e = new Error(`${method} ${url} -> ${r.status} ${t.slice(0, 600)}`);
    e.status = r.status;
    throw e;
  }
}

// ---------- populate (components, dynamic zones, nested) ----------
function qs(prefix, v, out) {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) qs(`${prefix}[${k}]`, x, out);
  else out.push(`${prefix}=${encodeURIComponent(v)}`);
}
function populateQuery(tree) {
  if (tree === '*') return 'populate=*';
  if (!Object.keys(tree).length) return '';
  const out = [];
  qs('populate', tree, out);
  return out.join('&');
}
function merge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (o[k] === undefined || o[k] === true) o[k] = v;
    else if (v !== true && typeof v === 'object') o[k] = typeof o[k] === 'object' ? merge(o[k], v) : v;
  }
  return o;
}
const isFile = (o) => o && o.mime && o.url;
const isRelation = (o) => o && o.documentId && !o.mime;
const isComponent = (o) => o && typeof o === 'object' && !isFile(o) && !isRelation(o) && (o.__component || typeof o.id === 'number');

function treeOf(node) {
  const t = {};
  for (const [k, v] of Object.entries(node)) {
    if (!v || typeof v !== 'object') continue;
    const objs = (Array.isArray(v) ? v : [v]).filter((x) => x && typeof x === 'object');
    if (!objs.length) continue;
    if (objs.some((o) => o.__component)) {
      const on = {};
      for (const o of objs) on[o.__component] = merge(on[o.__component] || {}, treeOf(o));
      t[k] = { on: Object.fromEntries(Object.entries(on).map(([c, ch]) => [c, Object.keys(ch).length ? { populate: ch } : { populate: '*' }])) };
    } else if (objs.some((o) => isFile(o) || isRelation(o))) {
      t[k] = true;
    } else if (objs.every(isComponent)) {
      let child = {};
      objs.forEach((o) => (child = merge(child, treeOf(o))));
      t[k] = Object.keys(child).length ? { populate: child } : true;
    }
  }
  return t;
}

async function getRaw(name, single, locale, tree) {
  const pq = populateQuery(tree);
  const base = `/api/${name}?locale=${locale}&status=draft${pq ? '&' + pq : ''}`;
  if (single) {
    const j = await api('GET', base);
    return j.data ? [j.data] : [];
  }
  const all = [];
  for (let page = 1; ; page++) {
    const j = await api('GET', `${base}&pagination[page]=${page}&pagination[pageSize]=100`);
    all.push(...j.data);
    if (page >= j.meta.pagination.pageCount) break;
  }
  return all;
}

async function fetchEntries(name, single, locale) {
  let tree = '*', entries = [];
  for (let i = 0; i < 6; i++) {
    entries = await getRaw(name, single, locale, tree);
    let t = {};
    entries.forEach((e) => (t = merge(t, treeOf(e))));
    if (tree !== '*' && JSON.stringify(t) === JSON.stringify(tree)) break;
    tree = t;
  }
  return entries;
}

// ---------- PUT ke liye data saaf karo ----------
function prep(n, root = false) {
  if (Array.isArray(n)) {
    const r = n.map((x) => prep(x)).filter((x) => x !== undefined);
    return n.length && !r.length ? undefined : r; // relations drop (shared rehti hain)
  }
  if (n && typeof n === 'object') {
    if (isFile(n)) return n.id;
    if (!root && isRelation(n)) return undefined;
    const o = {};
    for (const [k, v] of Object.entries(n)) {
      if (SYS.includes(k)) continue;
      const p = prep(v);
      if (p !== undefined) o[k] = p;
    }
    return o;
  }
  return n;
}

// ---------- translate karne layak text dhundho ----------
function isText(s) {
  return (
    s.trim() &&
    /\p{L}/u.test(s) &&
    !/^(https?:|mailto:|tel:|\/|#)/.test(s) &&
    !/^\d{4}-\d{2}-\d{2}/.test(s) &&
    !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(s) &&
    !/^[a-z][a-z0-9_]*$/.test(s) &&   // enum / identifier jaisi values
    !/^[A-Z0-9_]+$/.test(s)
  );
}
function collect(node, refs) {
  if (Array.isArray(node)) return node.forEach((x) => collect(x, refs));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP.has(k)) continue;
      if (typeof v === 'string') { if (isText(v)) refs.push({ o: node, k }); }
      else collect(v, refs);
    }
  }
}

// ---------- LLM translate (Claude ya Gemini) ----------
const systemPrompt = (locale) => {
  const lang = new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) || locale;
  return (
    `Translate every string in the JSON array into ${lang} (locale ${locale}). ` +
    'Keep HTML/markdown tags, URLs, emails, {placeholders}, numbers and brand/product names unchanged. ' +
    'Return ONLY a JSON array with the same length and order. No explanation, no code fences.'
  );
};
function parseArray(txt, texts) {
  const out = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error('Length mismatch');
  return out.map(String);
}

// requestsPerMinute se upar na jaye (free tier)
let nextSlot = 0;
async function throttle() {
  if (!RPM) return;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 60000 / RPM;
  if (wait) await sleep(wait);
}

async function callClaude(texts, locale) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': AKEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(locale),
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return parseArray(j.content.filter((c) => c.type === 'text').map((c) => c.text).join(''), texts);
}

async function callGemini(texts, locale) {
  for (let a = 1; ; a++) {
    await throttle();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': AKEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(locale) }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(texts) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 16384 },
      }),
    });
    // Free tier limit: thoda ruk ke dobara try (batch split mat karo, requests bachao)
    if (r.status === 429 && a < 5) {
      console.log(`\n  Gemini limit (429), ${20 * a}s ruk rahe hain...`);
      await sleep(20000 * a);
      continue;
    }
    if (r.status === 404) throw new Error(`Gemini model "${MODEL}" nahi mila. Sahi model dekhne ke liye: node translate.js --models`);
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const parts = j.candidates?.[0]?.content?.parts || [];
    return parseArray(parts.filter((p) => !p.thought).map((p) => p.text || '').join(''), texts);
  }
}

async function translate(texts, locale) {
  for (let a = 1; a <= 3; a++) {
    try { return await (GEMINI ? callGemini : callClaude)(texts, locale); }
    catch (e) {
      if (a === 3) {
        if (texts.length > 1) {
          const m = texts.length >> 1;
          return [...(await translate(texts.slice(0, m), locale)), ...(await translate(texts.slice(m), locale))];
        }
        throw e;
      }
      await sleep(1500 * a);
    }
  }
}
function makeBatches(strs) {
  const b = []; let cur = [], len = 0;
  for (const s of strs) {
    if (cur.length && (len + s.length > BATCH_CHARS || cur.length >= BATCH_STRINGS)) { b.push(cur); cur = []; len = 0; }
    cur.push(s); len += s.length;
  }
  if (cur.length) b.push(cur);
  return b;
}

// ---------- main ----------
async function run(name, single, entries, locale) {
  const items = entries.map((e) => ({ id: e.documentId, data: prep(JSON.parse(JSON.stringify(e)), true) }));
  const refs = [];
  items.forEach((i) => collect(i.data, refs));
  const unique = [...new Set(refs.map((r) => r.o[r.k]))];
  console.log(`  [${locale}] ${items.length} entries, ${refs.length} texts (${unique.length} unique)`);

  const map = new Map();
  const batches = makeBatches(unique);
  let done = 0;
  console.log(`  ${PROVIDER} (${MODEL}): ${batches.length} requests, ${PARALLEL} parallel${RPM ? `, max ${RPM}/min` : ''}`);
  await pool(batches, PARALLEL, async (b) => {
    const out = await translate(b, locale);
    b.forEach((s, i) => map.set(s, out[i]));
    done += b.length;
    process.stdout.write(`\r  translated ${done}/${unique.length}   `);
  });
  console.log();
  refs.forEach((r) => (r.o[r.k] = map.get(r.o[r.k])));

  let ok = 0, fail = 0;
  await pool(items, 10, async (it) => {
    const url = single
      ? `/api/${name}?locale=${locale}&status=published`
      : `/api/${name}/${it.id}?locale=${locale}&status=published`;
    try { await api('PUT', url, { data: it.data }); ok++; }
    catch (e) { fail++; if (fail <= 5) console.error('\n  FAIL', e.message); }
    process.stdout.write(`\r  saved ${ok + fail}/${items.length}   `);
  });
  console.log(`\n  [${locale}] ok: ${ok}, failed: ${fail}`);

  // verify: kitne Spanish published hain
  try {
    const j = await api('GET', single
      ? `/api/${name}?locale=${locale}&status=published`
      : `/api/${name}?locale=${locale}&status=published&pagination[pageSize]=1`);
    const total = single ? (j.data ? 1 : 0) : j.meta.pagination.total;
    console.log(`  [${locale}] published count in Strapi: ${total}${total < ok ? '  <-- kam hai, publish nahi hua (README dekho)' : ''}`);
  } catch (e) { console.log('  verify skip:', e.message.slice(0, 120)); }
}

(async () => {
  // node translate.js --models  -> Gemini key se available models ki list
  if (args.includes('--models')) {
    if (!GEMINI) { console.log('--models sirf provider "gemini" ke liye hai.'); return; }
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': AKEY } });
    if (!r.ok) { console.error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
    const j = await r.json();
    (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .forEach((m) => console.log(m.name.replace('models/', '').padEnd(45), m.displayName || ''));
    return;
  }

  const types = [
    ...(cfg.collections || []).map((n) => ({ name: n, single: false })),
    ...(cfg.singles || []).map((n) => ({ name: n, single: true })),
  ].filter((t) => !ONLY.length || ONLY.includes(t.name));
  if (!types.length) { console.error('Config me koi collection/single nahi mila.'); process.exit(1); }

  for (const t of types) {
    console.log(`\n== ${t.name} (${t.single ? 'single' : 'collection'}) ==`);
    try {
      let entries = await fetchEntries(t.name, t.single, SOURCE);
      if (TEST) entries = entries.slice(0, TEST);
      if (!entries.length) { console.log('  koi entry nahi mili, skip'); continue; }
      for (const loc of TARGETS) await run(t.name, t.single, entries, loc);
    } catch (e) {
      console.error(`  ERROR (${t.name}):`, e.message);
    }
  }
  console.log('\nDone');
})();
