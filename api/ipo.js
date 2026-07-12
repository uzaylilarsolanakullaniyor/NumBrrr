// Daily BIST "new IPOs" list from KAP: members of the BIST HALKA ARZ index
// (XHARZ = companies listed within the last 2 years; new IPOs join on their
// first trading day). Parsed from the SSR-embedded flight JSON on the public
// Endeksler page and CDN-cached for a day (s-maxage + SWR) so it refreshes by
// itself; clients get a ready-made list with one cheap request.

function parseXharz(html) {
  // The Next.js flight payload escapes quotes (\" ); unescape then locate the
  // Endeksler component's initialData array with a balanced-bracket scan
  // (titles contain no brackets; JSON.parse validates the slice anyway).
  const h = html.split('\\"').join('"');
  const key = '"initialData":';
  const i = h.indexOf(key);
  if (i === -1) return [];
  const start = h.indexOf("[", i + key.length);
  if (start === -1) return [];
  let depth = 0, end = -1;
  for (let j = start; j < h.length; j++) {
    const ch = h[j];
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (!depth) { end = j + 1; break; } }
  }
  if (end === -1) return [];
  let data;
  try { data = JSON.parse(h.slice(start, end)); } catch (e) { return []; }
  const x = Array.isArray(data) ? data.find((d) => d && d.code === "XHARZ") : null;
  return ((x && x.content) || [])
    .map((m) => ({ sym: m.stockCode, name: m.title }))
    .filter((m) => m.sym && m.name);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function firstTradeDate(symbol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + ".IS")}?interval=1mo&range=max`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NumBrrr/1.0)" }, signal: controller.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const timestamps = (result && result.timestamp) || [];
    const seconds = result && result.meta && Number.isFinite(result.meta.firstTradeDate)
      ? result.meta.firstTradeDate
      : timestamps.find((value) => Number.isFinite(value));
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function latestFive(items) {
  const dated = await mapLimit(items, 8, async (item) => ({ ...item, listedAt: await firstTradeDate(item.sym) }));
  return dated.sort((a, b) => {
    if (a.listedAt && b.listedAt) return b.listedAt.localeCompare(a.listedAt);
    if (a.listedAt) return -1;
    if (b.listedAt) return 1;
    return 0;
  }).slice(0, 5);
}

module.exports = async (req, res) => {
  try {
    const r = await fetch("https://kap.org.tr/tr/Endeksler?indice=BIST+HALKA+ARZ", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      redirect: "follow",
    });
    if (!r.ok) { res.status(502).json({ error: "KAP fetch failed" }); return; }
    const html = await r.text();
    const members = parseXharz(html);
    if (!members.length) { res.status(502).json({ error: "parse failed" }); return; }
    const items = await latestFive(members);
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json({ updated: new Date().toISOString(), items });
  } catch (e) {
    res.status(502).json({ error: "fetch failed" });
  }
};

module.exports.parseXharz = parseXharz;
module.exports.latestFive = latestFive;
