/* Порт engine.py 1:1 (порядок операций пиксель в пиксель).
 * Групповые нормы мэппятся ПОЗИЦИОННО, как в оригинале:
 *   g_f = values()[i] для индекса i (порядок yaml сохранён экспортёром). */
/* Один файл — три среды: node (require), GAS и браузер (соседние файлы — глобалы).
 * Порядок подключения скриптами: normalization.js → engine.js → composite.js */
var _nodeNormalize = null;
try { if (typeof require !== 'undefined') _nodeNormalize = require('./normalization.js').normalize; } catch (e) {}
function normText(text) {
  if (_nodeNormalize) return _nodeNormalize(text);
  return normalize(text); // global normalize() из normalization.js (GAS/браузер)
}

function poleName(scaleName, score) {
  const parts = scaleName.split(' — ');
  return score > 0 ? parts[0].trim() : (parts[1] || parts[0]).trim();
}

function computeZScores(features, group, A) {
  const SEPARATOR = A.separatorByte;
  const counts = new Array(45).fill(0);
  for (const feat of features) {
    if (feat === SEPARATOR) break;
    if (feat >= 0 && feat < 45) counts[feat] += 1;
  }
  const V = counts.reduce((a, b) => a + b, 0);
  if (V === 0) return new Array(45).fill(0.0);
  // как в оригинале: default → чистый refFreq; неизвестная группа → нормы default.
  // Внимание: dict.get в Python отдаёт даже ПУСТОЙ словарь (без фолбэка) — повторяем через hasOwnProperty.
  let normKeys = [], groupNorms = {};
  if (group !== 'default') {
    const all = A.norms || {};
    groupNorms = Object.prototype.hasOwnProperty.call(all, group) ? all[group]
      : (Object.prototype.hasOwnProperty.call(all, 'default') ? all.default : {});
    normKeys = Object.keys(groupNorms);
  }
  const zScores = [];
  for (let i = 0; i < 45; i++) {
    let fEff = A.refFreq[i];
    if (group !== 'default' && i < normKeys.length) {
      const vals = Object.values(groupNorms);
      const gF = i < vals.length ? vals[i] : fEff;
      fEff = gF ? 0.7 * gF + 0.3 * fEff : fEff;
    }
    const k = counts[i];
    if (fEff <= 0 || fEff >= 1) { zScores.push(0.0); continue; }
    const numerator = k - fEff * V;
    const denominator = Math.sqrt(fEff * V * (1 - fEff));
    let z = denominator !== 0 ? numerator / denominator : 0.0;
    if (Math.abs(z) <= A.zThreshold) z = 0.0;
    zScores.push(z);
  }
  return zScores;
}

function computeScales(zScores, matrix, divisor) {
  const scores = new Array(matrix.length).fill(0.0);
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    let s = 0.0;
    for (let j = 0; j < 45; j++) s += zScores[j] * (row[j] / divisor);
    scores[i] = s;
  }
  return scores;
}

function scaleColor(score, scaleIndex, method, A) {
  const map = method === 'levitsky' ? A.colors.levitsky_map : A.colors.zhuravlev_map;
  const colorIdx = scaleIndex < map.length ? map[scaleIndex] : 4;
  const clamped = Math.max(0, Math.min(15, colorIdx));
  return A.colors.table[clamped];
}

function analyze(text, method, A, opts) {
  opts = opts || {};
  const group = opts.group || 'default';
  const matrix = method === 'levitsky' ? A.matrices.levitsky_21x45 : A.matrices.zhuravlev_24x45;
  const names = method === 'levitsky' ? A.scales.levitsky_nom : A.scales.zhuravlev_nom;
  const features = normText(text);
  const zScores = computeZScores(features, group, A);
  const SEPARATOR = A.separatorByte;
  const V = features.filter(f => f !== SEPARATOR).length;
  const scores = computeScales(zScores, matrix, A.coeffDivisor);
  const scales = scores.map((score, i) => ({
    name: names[i],
    score,
    pole: poleName(names[i], score),
    color_rgb: opts.colors === false ? [0, 0, 0] : scaleColor(score, i, method, A),
    z_score: i < zScores.length ? zScores[i] : 0.0,
  }));
  return { method, scales, z_scores: zScores, total_features: V, raw_features: features };
}

if (typeof module !== 'undefined') {
  module.exports = { analyze, computeZScores, computeScales, poleName, normalize: normText };
}
