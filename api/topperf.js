// Daily "top performers" leaderboard, computed server-side and cached on the CDN
// for a day (s-maxage=86400 + stale-while-revalidate) — it refreshes by itself,
// so clients get a ready-made list instantly instead of fetching ~35 quotes.
// ?market=US -> crypto + US stocks/indices/metals; ?market=TR -> also BIST30
// (BIST ranked on the USD return via TRY=X; the ₺ price is kept for display).

const US_POOL = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V", "MA", "UNH", "HD", "PG", "JNJ", "XOM", "CVX", "KO",
  "AVGO", "LLY", "UBER", "COIN", "PLTR", "MSTR", "HOOD", "AMD", "NFLX", "CRWD",
];
const INDICES = [["spx", "SPX", "^GSPC"], ["ndx", "NDX", "^NDX"], ["dji", "DJI", "^DJI"]];
const BIST30 = [
  "AKBNK", "GARAN", "ISCTR", "YKBNK", "VAKBN", "THYAO", "PGSUS", "BIMAS", "MGROS", "ASELS",
  "KCHOL", "SAHOL", "EREGL", "KRDMD", "SISE", "TUPRS", "PETKM", "SASA", "FROTO", "TOASO",
  "ARCLK", "TCELL", "TTKOM", "ENKAI", "ALARK", "KOZAL", "GUBRF", "HEKTS", "OYAKC", "ASTOR",
];
// Stablecoins / wrapped & staked duplicates — not real "performers".
const SKIP = new Set([
  "USDT", "USDC", "DAI", "BUSD", "TUSD", "USDD", "FDUSD", "PYUSD", "USDE", "USDS",
  "USD1", "GUSD", "FRAX", "LUSD", "USDP", "EURT", "EURS", "RLUSD", "USDG", "USDTB",
  "BUIDL", "AEUR", "EURC", "USDX", "CRVUSD",
  "WBTC", "WETH", "STETH", "WSTETH", "WEETH", "WBETH", "CBBTC", "RETH", "LBTC",
  "SOLVBTC", "BNSOL", "JITOSOL", "METH", "RSETH", "EZETH", "CBETH",
]);

const UA = { headers: { "User-Agent": "Mozilla/5.0 (compatible; NumBrrr/1.0)" } };
const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(() => res(null), ms))]);

async function yahoo1y(ysym) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=1d&range=1y`;
    const r = await fetch(url, UA);
    const j = await r.json();
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const meta = result && result.meta;
    const closes = (result && result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
    const valid = closes.filter((c) => typeof c === "number");
    const price = meta && typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : (valid.length ? valid[valid.length - 1] : null);
    const chg1y = valid.length && price != null ? (price / valid[0] - 1) * 100 : null;
    return price != null && chg1y != null ? { price, chg1y } : null;
  } catch (e) { return null; }
}

async function topCrypto() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=40&page=1&price_change_percentage=1y", UA);
    if (!r.ok) return [];
    return (await r.json())
      .filter((c) => !SKIP.has((c.symbol || "").toUpperCase()))
      .slice(0, 25)
      .map((c) => ({ type: "crypto", key: c.id, sym: (c.symbol || "").toUpperCase(), name: c.name, price: c.current_price, ccy: "USD", chg1y: c.price_change_percentage_1y_in_currency }))
      .filter((c) => typeof c.chg1y === "number");
  } catch (e) { return []; }
}

module.exports = async (req, res) => {
  const market = req.query && req.query.market === "TR" ? "TR" : "US";
  const jobs = [];
  US_POOL.forEach((s) => jobs.push({ type: "usstock", key: s, sym: s, ysym: s, ccy: "USD" }));
  INDICES.forEach(([key, sym, ysym]) => jobs.push({ type: "index", key, sym, ysym, ccy: "USD" }));
  jobs.push({ type: "gold", key: "gold", sym: "XAU", ysym: "GC=F", ccy: "USD" });
  jobs.push({ type: "silver", key: "silver", sym: "XAG", ysym: "SI=F", ccy: "USD" });
  if (market === "TR") BIST30.forEach((s) => jobs.push({ type: "bist", key: s, sym: s, ysym: s + ".IS", ccy: "TRY" }));

  const [crypto, fx, quotes] = await Promise.all([
    withTimeout(topCrypto(), 7000),
    market === "TR" ? withTimeout(yahoo1y("TRY=X"), 7000) : Promise.resolve(null),
    Promise.all(jobs.map(async (j) => {
      const d = await withTimeout(yahoo1y(j.ysym), 7000);
      return d ? Object.assign({}, j, d) : null;
    })),
  ]);

  const items = [];
  (crypto || []).forEach((c) => items.push(c));
  const fxChg = fx && typeof fx.chg1y === "number" ? fx.chg1y : null;
  (quotes || []).forEach((q) => {
    if (!q) return;
    if (q.type === "bist") {
      if (fxChg == null) return; // no USD/TRY -> can't express a dollar return
      q.chg1y = ((1 + q.chg1y / 100) / (1 + fxChg / 100) - 1) * 100;
    }
    items.push(q);
  });
  const ranked = items
    .filter((c) => typeof c.chg1y === "number" && isFinite(c.chg1y))
    .sort((a, b) => b.chg1y - a.chg1y)
    .slice(0, 15);

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).json({ updated: new Date().toISOString(), items: ranked });
};
