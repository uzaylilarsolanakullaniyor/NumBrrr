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

module.exports = async (req, res) => {
  try {
    const r = await fetch("https://kap.org.tr/tr/Endeksler?indice=BIST+HALKA+ARZ", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
      redirect: "follow",
    });
    const html = await r.text();
    const items = parseXharz(html);
    if (!items.length) { res.status(502).json({ error: "parse failed" }); return; }
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json({ updated: new Date().toISOString(), items });
  } catch (e) {
    res.status(502).json({ error: "fetch failed" });
  }
};
