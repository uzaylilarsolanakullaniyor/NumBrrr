/* ============================================================
   Numbr — financial freedom calculator
   Required Savings = (Monthly Expenses × 12) / Annual Return Rate
   ============================================================ */

// ---- Instrument definitions (default rates are editable in the UI) ----
const INSTRUMENTS = {
  USD: [
    { id: "savings",  name: "Savings / Money Market", sub: "High-yield savings",     rate: 4.5,  color: "#21d4fd" },
    { id: "treasury", name: "US Treasury Bonds",       sub: "~10-year approx.",       rate: 4.25, color: "#4f8cff" },
    { id: "sp500",    name: "S&P 500",                 sub: "SPX historical avg.",    rate: 10,   color: "#2ee6a6", historical: true },
    { id: "nasdaq",   name: "Nasdaq 100",              sub: "Historical avg.",        rate: 13,   color: "#7c5cff", historical: true },
    { id: "btc",      name: "Bitcoin (BTC)",           sub: "Speculative — see note", rate: 25,   color: "#ffb454", warn: true, historical: true },
  ],
  TL: [
    { id: "deposit",  name: "TL Deposit",              sub: "Annual interest rate",   rate: 42,   color: "#21d4fd" },
    { id: "gold",     name: "Gold (in TL)",            sub: "Gold priced in lira",    rate: 40,   color: "#ffd54a", historical: true },
    { id: "bist",     name: "BIST 100",                sub: "Borsa Istanbul avg.",    rate: 35,   color: "#2ee6a6", historical: true },
    { id: "eurobond", name: "Eurobond / FX deposit",   sub: "FX-linked return",       rate: 25,   color: "#7c5cff" },
  ],
};

const CURRENCY_META = {
  USD: { symbol: "$", code: "USD", locale: "en-US", inflation: 3 },
  TL:  { symbol: "₺", code: "TRY", locale: "tr-TR", inflation: 40 },
};

// ---- State ----
const state = {
  currency: "USD",
  monthlyExpenses: 3000,
  realMode: false,
  inflation: { USD: 3, TL: 40 },
  // editable rates kept per currency so toggling never loses edits
  rates: {
    USD: Object.fromEntries(INSTRUMENTS.USD.map((i) => [i.id, i.rate])),
    TL: Object.fromEntries(INSTRUMENTS.TL.map((i) => [i.id, i.rate])),
  },
};

// ---- Elements ----
const el = {
  toggle: document.querySelector(".toggle"),
  toggleBtns: document.querySelectorAll(".toggle-btn"),
  currencySymbol: document.getElementById("currencySymbol"),
  expenses: document.getElementById("expenses"),
  realMode: document.getElementById("realMode"),
  inflationField: document.getElementById("inflationField"),
  inflation: document.getElementById("inflation"),
  cards: document.getElementById("cards"),
  bars: document.getElementById("bars"),
  bestAmount: document.getElementById("bestAmount"),
  bestLabel: document.getElementById("bestLabel"),
  bestRate: document.getElementById("bestRate"),
  headlineNote: document.getElementById("headlineNote"),
  ruleNumber: document.getElementById("ruleNumber"),
  ruleNote: document.getElementById("ruleNote"),
};

// ---- Helpers ----
function parseNumber(str) {
  if (typeof str !== "string") return Number(str) || 0;
  // strip everything except digits, dot and minus
  const cleaned = str.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatMoney(value, { compact = false } = {}) {
  const meta = CURRENCY_META[state.currency];
  if (!isFinite(value)) return "—";
  const fmt = new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  });
  return fmt.format(value);
}

function formatThousands(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/**
 * Effective annual rate for an instrument.
 * In real mode we subtract inflation (nominal − inflation), as a fraction.
 */
function effectiveRate(nominalPercent) {
  const infl = state.realMode ? state.inflation[state.currency] : 0;
  return (nominalPercent - infl) / 100;
}

function requiredSavings(nominalPercent) {
  const annualExpenses = state.monthlyExpenses * 12;
  const rate = effectiveRate(nominalPercent);
  if (rate <= 0) return Infinity; // return can't keep up with inflation / no growth
  return annualExpenses / rate;
}

// ---- Rendering ----
function render() {
  const meta = CURRENCY_META[state.currency];
  const list = INSTRUMENTS[state.currency];

  el.currencySymbol.textContent = meta.symbol;

  // compute results
  const results = list.map((inst) => {
    const nominal = state.rates[state.currency][inst.id];
    const eff = effectiveRate(nominal) * 100;
    const required = requiredSavings(nominal);
    return { inst, nominal, eff, required };
  });

  const reachable = results.filter((r) => isFinite(r.required));
  const best = reachable.reduce(
    (a, b) => (b.required < a.required ? b : a),
    reachable[0] || null
  );

  renderHeadline(best, results, reachable.length);
  renderRule();
  renderCards(results, best);
  renderBars(results, best);
}

// The canonical "4% rule" figure: 25× annual expenses (1 / 0.04 = 25).
// Independent of the editable rates above — it's the academic benchmark.
function renderRule() {
  const annual = state.monthlyExpenses * 12;
  el.ruleNumber.textContent = formatMoney(annual * 25);
  el.ruleNote.textContent =
    state.currency === "TL"
      ? "Heads-up: the 4% rule is drawn from long-run US market history. In a high-inflation currency like the lira, think in real (after-inflation) terms — switch on Real return mode above for a more honest number."
      : "Based on ~30 years of historical US stock & bond returns and a balanced portfolio. A guideline, not a guarantee — past performance doesn't predict the future.";
}

function renderHeadline(best, results, reachableCount) {
  if (!best) {
    el.bestAmount.textContent = "Not reachable";
    el.bestLabel.textContent = "No instrument beats inflation";
    el.bestRate.textContent = "";
    el.headlineNote.textContent =
      "At these rates, real returns are zero or negative — passive income can't outpace inflation. Lower your inflation assumption or raise a return rate.";
    return;
  }
  el.bestAmount.textContent = formatMoney(best.required);
  el.bestLabel.textContent = `via ${best.inst.name}`;
  el.bestRate.textContent = `${formatRate(best.eff)} ${state.realMode ? "real" : ""} return`.trim();
  const monthly = formatMoney(state.monthlyExpenses);
  el.headlineNote.textContent =
    `Save this much and ${best.inst.name}'s return would generate about ${monthly}/month — covering your expenses without touching the principal.` +
    (reachableCount < results.length ? " Some instruments below don't reach freedom at the current inflation assumption." : "");
}

function renderCards(results, best) {
  el.cards.innerHTML = "";
  results.forEach((r, idx) => {
    const { inst, nominal, eff, required } = r;
    const isBest = best && inst.id === best.inst.id;
    const unreachable = !isFinite(required);

    const card = document.createElement("article");
    card.className = "card" + (isBest ? " is-best" : "");
    card.style.setProperty("--card-color", inst.color);
    card.style.animationDelay = `${idx * 55}ms`;

    const badge = isBest
      ? `<span class="card-badge badge-best">Easiest</span>`
      : inst.warn
      ? `<span class="card-badge badge-warn">Volatile</span>`
      : "";

    const amountHtml = unreachable
      ? `<div class="card-amount-value unreachable">Doesn't outpace inflation</div>`
      : `<div class="card-amount-value">${formatMoney(required)}</div>`;

    const effLine = state.realMode
      ? `<div class="card-effrate">Real rate: ${formatRate(eff)} &nbsp;(${formatRate(nominal)} − ${formatRate(state.inflation[state.currency])} inflation)</div>`
      : "";

    const notes = [];
    if (inst.warn) notes.push("Bitcoin is highly volatile; this figure is speculative.");
    else if (inst.historical) notes.push("Based on historical averages — not a guarantee.");
    const noteHtml = notes.length
      ? `<div class="card-warn-note">${notes.join(" ")}</div>`
      : "";

    card.innerHTML = `
      <div class="card-accent"></div>
      <div class="card-head">
        <div>
          <h3 class="card-title">${inst.name}</h3>
          <p class="card-sub">${inst.sub}</p>
        </div>
        ${badge}
      </div>
      <div class="card-rate">
        <span class="card-rate-label">Annual return</span>
        <div class="rate-input">
          <input type="text" inputmode="decimal" value="${formatRate(nominal, false)}" data-id="${inst.id}" aria-label="${inst.name} annual return rate" />
          <span class="rate-sign">%</span>
        </div>
      </div>
      <div class="card-amount">
        ${amountHtml}
        <div class="card-amount-label">total savings required</div>
        ${effLine}
        ${noteHtml}
      </div>
    `;
    el.cards.appendChild(card);
  });

  // wire up the per-card rate inputs
  el.cards.querySelectorAll('input[data-id]').forEach((input) => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      state.rates[state.currency][id] = parseNumber(input.value);
      render();
      // keep focus + caret on the edited field after re-render
      restoreFocus(id);
    });
  });

  if (focusTarget) focusTarget = null;
}

function renderBars(results, best) {
  el.bars.innerHTML = "";
  const finite = results.filter((r) => isFinite(r.required)).map((r) => r.required);
  const max = finite.length ? Math.max(...finite) : 0;

  results.forEach((r) => {
    const { inst, required } = r;
    const unreachable = !isFinite(required);
    const isBest = best && inst.id === best.inst.id;
    const pct = unreachable || max === 0 ? 0 : Math.max(4, (required / max) * 100);

    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-name">${inst.name}${isBest ? " <small>· easiest</small>" : ""}</div>
      <div class="bar-track">
        <div class="bar-fill ${unreachable ? "unreachable" : ""}" style="--bar-color:${inst.color}"></div>
        <span class="bar-value">${unreachable ? "Out of reach" : formatMoney(required, { compact: true })}</span>
      </div>
    `;
    el.bars.appendChild(row);
    // animate width on next frame
    const fill = row.querySelector(".bar-fill");
    if (!unreachable) {
      requestAnimationFrame(() => { fill.style.width = pct + "%"; });
    }
  });
}

// Pretty-print a rate: trims trailing .0 but keeps decimals when present
function formatRate(value, withSign = true) {
  const rounded = Math.round(value * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return withSign ? str + "%" : str;
}

// ---- Focus restoration after re-render ----
let focusTarget = null;
function restoreFocus(id) {
  const input = el.cards.querySelector(`input[data-id="${id}"]`);
  if (input) {
    const len = input.value.length;
    input.focus();
    try { input.setSelectionRange(len, len); } catch (_) {}
  }
}

// ---- Event wiring ----
el.toggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const cur = btn.dataset.currency;
    if (cur === state.currency) return;
    state.currency = cur;

    // visual toggle state
    el.toggleBtns.forEach((b) => {
      const active = b.dataset.currency === cur;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    el.toggle.classList.toggle("tl", cur === "TL");

    // sync inflation field to currency default if untouched-by-currency
    el.inflation.value = formatRate(state.inflation[cur], false);
    render();
  });
});

el.expenses.addEventListener("input", () => {
  state.monthlyExpenses = parseNumber(el.expenses.value);
  render();
});
// format expenses with thousands separators on blur
el.expenses.addEventListener("blur", () => {
  if (state.monthlyExpenses > 0) el.expenses.value = formatThousands(state.monthlyExpenses);
});

el.realMode.addEventListener("change", () => {
  state.realMode = el.realMode.checked;
  el.inflationField.hidden = !state.realMode;
  render();
});

el.inflation.addEventListener("input", () => {
  state.inflation[state.currency] = parseNumber(el.inflation.value);
  render();
});

// ---- Init ----
el.expenses.value = formatThousands(state.monthlyExpenses);
el.inflation.value = formatRate(state.inflation.USD, false);
render();
