/* Порт normalization.py 1:1. Критично: битовые проверки — БЕЗЗНАКОВЫМ >>>,
 * т.к. маски содержат значения >2^31 (напр. 3959422975), а JS >> знаковый. */
// Exact bitmasks (RVA 0x74D58, 0x74D70, 0x74D60), 16 dword each
const MASK_0 = [0, 3959422975, 0, 3489661216, 0, 3892855073, 0, 3652766, 4042183943, 3924359406, 0, 0, 4008431366, 15331061, 0, 0];
const MASK_1 = [0, 3652766, 4042183943, 3924359406, 0, 0, 4008431366, 15331061, 0, 0, 3773884936, 4225951985, 233, 0, 4076006925, 3907709920];
const MASK_2 = [0, 3489661216, 0, 3892855073, 0, 3652766, 4042183943, 3924359406, 0, 0, 4008431366, 15331061, 0, 0, 3773884936, 4225951985];

function checkBit(table, idx) {
  if (idx < 0 || idx >= 512) return false;
  return (((table[(idx / 32) | 0] >>> 0) >>> (idx % 32)) & 1) === 1;
}

// Jump table 0xE0-0xFF (cp1251 Cyrillic lower) -> (dl0, dl2)
const CYR_MAP = {
  0xE0: [0, 0], 0xE1: [30, 1], 0xE2: [31, 2], 0xE3: [32, 3], 0xE4: [33, 4],
  0xE5: [5, 5], 0xE6: [6, 6], 0xE7: [34, 7], 0xE8: [8, 8], 0xE9: [9, 9],
  0xEA: [35, 10], 0xEB: [36, 11], 0xEC: [37, 12], 0xED: [38, 13], 0xEE: [14, 14],
  0xEF: [39, 15], 0xF0: [40, 16], 0xF1: [41, 17], 0xF2: [42, 18], 0xF3: [19, 19],
  0xF4: [43, 20], 0xF5: [44, 21], 0xF6: [22, 22], 0xF7: [23, 23], 0xF8: [24, 24],
  0xF9: [25, 25], 0xFA: [null, null], 0xFB: [26, null], 0xFC: [null, null],
  0xFD: [27, 27], 0xFE: [28, 28], 0xFF: [29, 29],
};

// cp1251 вручную: TextEncoder его не умеет. ПОЛНАЯ таблица (как ch.encode('cp1251')):
// некириллические байты (пробелы, латиница, тире) отфильтруются битовыми проверками,
// но ОБЯЗАНЫ присутствовать в массиве — оригинал смотрит на них в next_b (dl=0/dl=2)!
const CP1251_EXTRA = {
  0x80:0x402,0x81:0x403,0x82:0x201A,0x83:0x453,0x84:0x201E,0x85:0x2026,0x86:0x2020,0x87:0x2021,
  0x88:0x20AC,0x89:0x2030,0x8A:0x409,0x8B:0x2039,0x8C:0x40A,0x8D:0x40C,0x8E:0x40B,0x8F:0x40F,
  0x90:0x452,0x91:0x2018,0x92:0x2019,0x93:0x201C,0x94:0x201D,0x95:0x2022,0x96:0x2013,0x97:0x2014,
  0x99:0x2122,0x9A:0x459,0x9B:0x203A,0x9C:0x45A,0x9D:0x45C,0x9E:0x45B,0x9F:0x45F,
  0xA0:0xA0,0xA1:0x40E,0xA2:0x45E,0xA3:0x408,0xA4:0xA4,0xA5:0x490,0xA6:0xA6,0xA7:0xA7,
  0xA8:0x401,0xA9:0xA9,0xAA:0x404,0xAB:0xAB,0xAC:0xAC,0xAD:0xAD,0xAE:0xAE,0xAF:0x407,
  0xB0:0xB0,0xB1:0xB1,0xB2:0x406,0xB3:0x456,0xB4:0x491,0xB5:0xB5,0xB6:0xB6,0xB7:0xB7,
  0xB8:0x451,0xB9:0x2116,0xBA:0x454,0xBB:0xBB,0xBC:0x458,0xBD:0x405,0xBE:0x455,0xBF:0x457,
};
const CP1251_ENC = {};
for (const [b, cp] of Object.entries(CP1251_EXTRA)) CP1251_ENC[cp] = Number(b);
function toCp1251Bytes(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp >= 0x410 && cp <= 0x42F) out.push(cp - 0x410 + 0xC0);       // А-Я
    else if (cp >= 0x430 && cp <= 0x44F) out.push(cp - 0x430 + 0xE0);      // а-я
    else if (CP1251_ENC[cp] !== undefined) out.push(CP1251_ENC[cp]);
    // остальное (китайский и т.п.) — пропуск, как except: continue в оригинале
  }
  return out;
}

function lowerCp1251(b) {
  if (b >= 0xC0 && b <= 0xDF) return b + 0x20;
  if (b === 0xA8) return 0xB8;
  return b;
}

function normalize(text) {
  const raw = toCp1251Bytes(text);
  const low = raw.map(lowerCp1251);
  const feats = [];
  const n = low.length;
  for (let i = 0; i < n; i++) {
    const b = low[i];
    const add = (b + 0x40) & 0xFF;
    if (add > 0x3F) continue;
    const idx = add & 0x7F;
    if (!checkBit(MASK_0, idx)) continue;
    const nextB = i + 1 < n ? low[i + 1] : 0;
    const add2 = (b + 0x40) & 0xFF;
    let dl;
    if (add2 > 0x3F) {
      dl = 2;
    } else {
      const idx2 = add2 & 0x7F;
      if (!checkBit(MASK_1, idx2)) {
        dl = 2;
      } else {
        if (nextB === 0) {
          dl = 2;
        } else {
          const add3 = (nextB + 0x40) & 0xFF;
          if (add3 > 0x3F) {
            dl = 2;
          } else {
            const idx3 = add3 & 0x7F;
            dl = checkBit(MASK_2, idx3) ? 0 : 2;
          }
        }
      }
    }
    if (b < 0xE0 || b > 0xFF) continue;
    const pair = CYR_MAP[b];
    if (!pair) continue;
    const [featSoft, featHard] = pair;
    let feat = dl === 0 ? featSoft : featHard;
    if (feat === null || feat === undefined || feat >= 45) {
      if (featSoft !== null && featSoft !== undefined && featSoft < 45) feat = featSoft;
      else continue;
    }
    feats.push(feat);
  }
  feats.push(0x36);
  return feats;
}

if (typeof module !== 'undefined') module.exports = { normalize, checkBit, toCp1251Bytes };
