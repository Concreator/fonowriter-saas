/* Порт content.py + effectiveness.py. Внимание: Python round() — банковское
 * (half-even), Math.round — half-up. Для точного паритета — roundHalfEven. */
function roundHalfEven(x, dp) {
  const m = Math.pow(10, dp);
  const n = x * m;
  const f = Math.floor(n);
  const diff = n - f;
  if (Math.abs(diff - 0.5) < 1e-9) return (f % 2 === 0 ? f : f + 1) / m;
  return Math.round(n) / m;
}

function tokenize(text) {
  const m = text.toLowerCase().match(/[а-яёa-z]+/g);
  return m || [];
}

function analyzeContent(text, categories, group) {
  group = group || 'default';
  const words = tokenize(text);
  const total = words.length || 1;
  const counter = {};
  for (const w of words) counter[w] = (counter[w] || 0) + 1;
  let norm = 0.01;
  if (group === 'military') norm = 0.02;
  else if (group === 'marketing') norm = 0.008;
  const results = [];
  for (const cat of Object.keys(categories)) {
    const terms = categories[cat].map(t => t.toLowerCase());
    let N = 0;
    for (const t of terms) N += counter[t] || 0;
    const E = norm * total;
    const sigma = E > 0 ? Math.sqrt(E * (1 - norm)) : 1;
    const z = sigma ? (N - E) / sigma : 0;
    results.push({ category: cat, N, E: roundHalfEven(E, 2), z: roundHalfEven(z, 3),
                   relative: roundHalfEven(N / total, 4), terms: categories[cat] });
  }
  return { total_words: total, results };
}

const SINCERITY_CATS = ['ВРЕМЯ_НЕОПРЕДЕЛЕННОЕ', 'ИНФ_НЕКОНКРЕТНАЯ', 'ПРЕУВЕЛИЧЕНИЕ',
  'ПРЕУМЕНЬШЕНИЕ', 'ОТРИЦАНИЕ', 'НО'];
const COMM_HIGH = ['АРХЕТИПИЧНОСТЬ', 'ЖИЗНЬ', 'КАНАЛ_ЗРИТЕЛЬНЫЙ', 'КАНАЛ_ЧУВСТВЕННЫЙ',
  'КАНАЛ_СЛУХОВОЙ', 'КАНАЛ_РАЦИОНАЛЬНЫЙ', 'МОТИВ_ДОСТИЖЕНИЕ', 'МОТИВ_ВЛАСТЬ',
  'МОТИВ_АФФИЛИАЦИЯ', 'МОТИВ_ФИЗИОЛОГИЯ', 'МОТИВ_ПОМОЩЬ', 'ПОТР_ВНУТРЕННЯЯ',
  'ПОЗИТИВ', 'ВПЕРЕД'];
const COMM_LOW = ['СМЕРТЬ', 'ПОТР_ВНЕШНЯЯ', 'НЕГАТИВ', 'ОТРИЦАНИЕ', 'НО'];
const EMO_CATS = ['АРХЕТИПИЧНОСТЬ', 'ЖИЗНЬ', 'СМЕРТЬ', 'ПОЗИТИВ', 'НЕГАТИВ',
  'КАНАЛ_ЗРИТЕЛЬНЫЙ', 'КАНАЛ_ЧУВСТВЕННЫЙ', 'КАНАЛ_СЛУХОВОЙ', 'ПОТР_ВНУТРЕННЯЯ',
  'ПОТР_ВНЕШНЯЯ', 'МОТИВ_ДОСТИЖЕНИЕ', 'МОТИВ_ВЛАСТЬ', 'МОТИВ_АФФИЛИАЦИЯ'];

function sincerity(results) {
  const zmap = {};
  for (const r of results) zmap[r.category] = r.z;
  const markers = {};
  for (const c of SINCERITY_CATS) markers[c] = roundHalfEven(zmap[c] || 0, 2);
  const top = Object.entries(markers).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const flag = Object.values(markers).some(v => v >= 2.0);
  return { markers, top, flag,
    verdict: flag ? 'есть маркеры неискренности' : 'маркеров неискренности нет' };
}

function communicative(results) {
  const zmap = {};
  for (const r of results) zmap[r.category] = r.z;
  const high = COMM_HIGH.map(c => zmap[c] || 0.0);
  const low = COMM_LOW.map(c => zmap[c] || 0.0);
  const score = high.length && low.length
    ? high.reduce((a, b) => a + b, 0) / high.length - low.reduce((a, b) => a + b, 0) / low.length : 0.0;
  const pick = list => { const o = {}; for (const c of list) o[c] = roundHalfEven(zmap[c] || 0, 2); return o; };
  return { score: roundHalfEven(score, 2), high: pick(COMM_HIGH), low: pick(COMM_LOW) };
}

function emotional(results) {
  const zmap = {};
  for (const r of results) zmap[r.category] = r.z;
  const vals = EMO_CATS.map(c => zmap[c] || 0.0);
  const score = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.0;
  const cats = {};
  for (const c of EMO_CATS) cats[c] = roundHalfEven(zmap[c] || 0, 2);
  return { score: roundHalfEven(score, 2), cats };
}

function effectivenessSummary(text, A, group) {
  const content = analyzeContent(text, A.categories, group || 'default');
  const results = content.results;
  return { total_words: content.total_words, sincerity: sincerity(results),
           communicative: communicative(results), emotional: emotional(results) };
}

function poleOf(name, v) {
  const p = name.split(' — ');
  return v > 0 ? p[0].trim() : (p[1] || p[0]).trim();
}

function moveOf(name, b, a) {
  const pb = poleOf(name, b), pa = poleOf(name, a);
  if (pb !== pa) return 'разворот ' + pb + ' → ' + pa;
  return Math.abs(a) > Math.abs(b) ? 'усиление ' + pa : 'ослабление ' + pa;
}

function deltaTable(before, after, label) {
  const A = {};
  for (const s of before.scales) A[s.name] = s.score;
  const rows = [];
  for (const s of after.scales) {
    if (!(s.name in A)) continue;
    const d = s.score - A[s.name];
    if (Math.abs(d) >= 0.5) rows.push({ name: s.name, b: A[s.name], a: s.score, d });
  }
  rows.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const f = v => (v >= 0 ? '+' : '') + v.toFixed(2);
  const lines = rows.map(r => r.name + ': ' + r.b.toFixed(2) + ' → ' + r.a.toFixed(2) +
    ' (Δ' + f(r.d) + ', ' + moveOf(r.name, r.b, r.a) + ')');
  const up = rows.filter(r => r.d > 0).length, down = rows.filter(r => r.d < 0).length;
  return 'Δ-таблица ' + label + ' (значимых |Δ|≥0.5: ' + rows.length +
    ', +' + up + '/−' + down + '):\n' + (lines.join('\n') || 'все Δ<0.5');
}

if (typeof module !== 'undefined') {
  module.exports = { analyzeContent, sincerity, communicative, emotional,
    effectivenessSummary, deltaTable, moveOf, poleOf, roundHalfEven };
}
