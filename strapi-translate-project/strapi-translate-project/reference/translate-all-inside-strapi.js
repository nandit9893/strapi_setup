// REFERENCE (final nahi): Strapi project ke ANDAR chalne wali script. Server/code access ho tab best.
// Schema (strapi.contentTypes) se text fields, components, dynamic zones khud dhundhti hai.
// Copy karke Strapi project me scripts/ me rakho.
// Run: ANTHROPIC_API_KEY=xxx node scripts/translate-all.js api::product.product es
const { compileStrapi, createStrapi } = require('@strapi/strapi');

const UID = process.argv[2];
const TARGET = process.argv[3] || 'es';
const SOURCE = 'en';
const FORCE = process.env.FORCE === '1';
const MODEL = 'claude-haiku-5-5';
const BATCH = 40;
const PARALLEL = 5;
const TEXT_TYPES = ['string', 'text', 'richtext', 'blocks'];

async function translateBatch(texts) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: `Translate each string in the JSON array from ${SOURCE} to ${TARGET}. Keep HTML/markdown tags, URLs, emails, {placeholders}, numbers and brand names unchanged. Return ONLY a JSON array of the same length and order. No extra text.`,
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const out = JSON.parse(json.content[0].text.replace(/```json|```/g, '').trim());
  if (out.length !== texts.length) throw new Error('Length mismatch');
  return out;
}

function walkBlocks(node, refs) {
  if (Array.isArray(node)) return node.forEach((n) => walkBlocks(n, refs));
  if (node && typeof node === 'object') {
    if (node.type === 'text' && typeof node.text === 'string') refs.push({ obj: node, key: 'text' });
    if (node.children) walkBlocks(node.children, refs);
  }
}

function walk(attributes, data, refs) {
  if (!data) return;
  for (const [name, attr] of Object.entries(attributes)) {
    const val = data[name];
    if (val == null) continue;
    if (TEXT_TYPES.includes(attr.type)) {
      if (attr.unique || attr.regex) continue;
      if (attr.type === 'blocks') walkBlocks(val, refs);
      else if (typeof val === 'string' && val.trim()) refs.push({ obj: data, key: name });
    } else if (attr.type === 'component') {
      const comp = strapi.components[attr.component].attributes;
      (attr.repeatable ? val : [val]).forEach((v) => walk(comp, v, refs));
    } else if (attr.type === 'dynamiczone') {
      val.forEach((v) => walk(strapi.components[v.__component].attributes, v, refs));
    }
  }
}

function buildPopulate(attributes, depth = 0) {
  if (depth > 5) return undefined;
  const pop = {};
  for (const [name, attr] of Object.entries(attributes)) {
    if (attr.type === 'component') {
      const inner = buildPopulate(strapi.components[attr.component].attributes, depth + 1);
      pop[name] = inner && Object.keys(inner).length ? { populate: inner } : true;
    } else if (attr.type === 'dynamiczone') {
      const on = {};
      for (const c of attr.components) {
        const inner = buildPopulate(strapi.components[c].attributes, depth + 1);
        on[c] = inner && Object.keys(inner).length ? { populate: inner } : {};
      }
      pop[name] = { on };
    }
  }
  return pop;
}

function clean(obj) {
  if (Array.isArray(obj)) return obj.map(clean);
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) {
      if (['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations'].includes(k)) continue;
      o[k] = clean(v);
    }
    return o;
  }
  return obj;
}

async function main() {
  if (!UID) throw new Error('Usage: node translate-all.js <uid> <locale>');
  global.strapi = await createStrapi(await compileStrapi()).load();
  try {
    const schema = strapi.contentTypes[UID];
    const docs = strapi.documents(UID);
    const populate = buildPopulate(schema.attributes);
    const english = await docs.findMany({ locale: SOURCE, status: 'draft', populate, limit: 100000 });
    let todo = english;
    if (!FORCE) {
      const have = await docs.findMany({ locale: TARGET, status: 'draft', fields: ['id'], limit: 100000 });
      const ids = new Set(have.map((e) => e.documentId));
      todo = english.filter((e) => !ids.has(e.documentId));
    }
    console.log(`English: ${english.length}, translate: ${todo.length}`);
    if (!todo.length) return;

    const items = todo.map((e) => ({ documentId: e.documentId, data: clean(JSON.parse(JSON.stringify(e))) }));
    const refs = [];
    items.forEach((it) => walk(schema.attributes, it.data, refs));
    console.log(`Total texts: ${refs.length}`);

    const batches = [];
    for (let i = 0; i < refs.length; i += BATCH) batches.push(refs.slice(i, i + BATCH));
    let done = 0;
    for (let i = 0; i < batches.length; i += PARALLEL) {
      await Promise.all(batches.slice(i, i + PARALLEL).map(async (b) => {
        const out = await translateBatch(b.map((r) => r.obj[r.key]));
        b.forEach((r, k) => (r.obj[r.key] = out[k]));
        done += b.length;
      }));
      console.log(`Translated ${done}/${refs.length}`);
    }

    let saved = 0;
    for (let i = 0; i < items.length; i += 10) {
      await Promise.all(items.slice(i, i + 10).map(async (it) => {
        await docs.update({ documentId: it.documentId, locale: TARGET, data: it.data });
        await docs.publish({ documentId: it.documentId, locale: TARGET });
        saved++;
      }));
      console.log(`Published ${saved}/${items.length}`);
    }
    console.log('Done');
  } finally {
    await strapi.destroy();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
