const test = require("node:test");
const assert = require("node:assert/strict");
const { parseXharz, latestFive } = require("../api/ipo.js");

test("KAP XHARZ payload is parsed into symbols and names", () => {
  const html = 'prefix {\\"initialData\\":[{\\"code\\":\\"XHARZ\\",\\"content\\":[{\\"stockCode\\":\\"AAA\\",\\"title\\":\\"Alpha AŞ\\"}]}]} suffix';
  assert.deepEqual(parseXharz(html), [{ sym: "AAA", name: "Alpha AŞ" }]);
});

test("IPO list is sorted newest-first and limited to five", async () => {
  const originalFetch = global.fetch;
  const dates = { A: "2026-01-01", B: "2026-06-10", C: "2025-12-01", D: "2026-05-02", E: "2026-04-03", F: "2026-03-04", G: "2026-02-05" };
  global.fetch = async (url) => {
    const symbol = decodeURIComponent(String(url).match(/chart\/([^?]+)/)[1]).replace(".IS", "");
    return { ok: true, json: async () => ({ chart: { result: [{ meta: { firstTradeDate: Date.parse(dates[symbol] + "T00:00:00Z") / 1000 }, timestamp: [] }] } }) };
  };
  try {
    const result = await latestFive(Object.keys(dates).map((sym) => ({ sym, name: sym })));
    assert.deepEqual(result.map((item) => item.sym), ["B", "D", "E", "F", "G"]);
    assert.equal(result.length, 5);
  } finally {
    global.fetch = originalFetch;
  }
});
