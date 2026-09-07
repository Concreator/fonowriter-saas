/* FonoWriter GAS-адаптер: полный WebUI работает БЕЗ своего сервера.
 * Подключать ДО бандла приложения. Читает ./api-config.json {"gas": "https://.../exec"}.
 * Если gas пуст — прозрачен (обычный режим того же хоста).
 * Маппинг: /health, /analyze, /chat/stream (fake-SSE), /chat classic,
 *   /system-prompt GET/PUT, /license/status, /content/effectiveness.
 */
(function () {
  var GAS_URL = null, FP = null, READY = null;
  function fp() {
    try {
      var id = localStorage.getItem('fw_fp');
      if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('fw_fp', id); }
      return id;
    } catch (e) { return 'anon'; }
  }
  function init() {
    if (!READY) {
      READY = fetch('./api-config.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
        if (j && typeof j.gas === 'string' && j.gas.indexOf('http') === 0) GAS_URL = j.gas.replace(/\/$/, '');
      }).catch(function () {});
    }
    return READY;
  }
  function gasCall(body, signal) {
    body.fp = fp();
    return fetch(GAS_URL, { method: 'POST', body: JSON.stringify(body), signal: signal }).then(function (r) {
      return r.json();
    }).then(function (j) {
      if (j && j.error) { var e = new Error(j.error); e.isGasQuota = /исчерпано|исчерпан/i.test(j.error); throw e; }
      return j;
    });
  }
  function jsonResp(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj),
      { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
  }
  function extractMarked(text) {
    var out = [], re = /<<<ТЕКСТ>>>([\s\S]*?)<<<КОНЕЦ>>>/g, m;
    while ((m = re.exec(text || ''))) { var t = m[1].trim(); if (t) out.push(t); }
    if (!out.length) return null;
    if (out.length === 1) return out[0];
    return out.map(function (t, i) { return '────────── Вариант ' + (i + 1) + ' ──────────\n\n' + t; }).join('\n\n');
  }
  function cleanMarkers(text) {
    return String(text || '').replace(/<<<ТЕКСТ>>>\s*([\s\S]*?)\s*<<<КОНЕЦ>>>/g, '$1');
  }
  function fakeStream(full, extra) {
    var enc = new TextEncoder(), chunks = [];
    chunks.push('event: start\ndata: {"mode":"chat"}\n\n');
    full = String(full || '');
    for (var i = 0; i < full.length; i += 30) {
      chunks.push('event: token\ndata: ' + JSON.stringify({ token: full.slice(i, i + 30) }) + '\n\n');
    }
    var done = { reply: full, thinking_len: 0, optimized: null };
    if (extra) for (var k in extra) done[k] = extra[k];
    chunks.push('event: done\ndata: ' + JSON.stringify(done) + '\n\n');
    return new Response(new ReadableStream({
      start: function (c) { chunks.forEach(function (s) { c.enqueue(enc.encode(s)); }); c.close(); }
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }
  function rawTextOf(combined) {
    // как бэкенд: "Текст для правки:\n...\n\nИнструкция: ..."
    var m = String(combined || '').split('Текст для правки:');
    if (m.length < 2) return { raw: combined, instr: combined };
    var parts = m[1].split('Инструкция:');
    return { raw: (parts[0] || '').trim(), instr: (parts[1] || '').trim() || combined };
  }
  function planFromHistory(history) {
    try {
      var hs = (history || []).slice(-6).map(function (x) { return { role: x.role, content: x.content }; });
      for (var i = hs.length - 1; i >= 0; i--) {
        var c = String(hs[i].content || '');
        if (hs[i].role === 'assistant' && (/Саммари/i.test(c) || /План правок/i.test(c))) return c.slice(0, 2000);
      }
    } catch (e) {}
    return '';
  }
  var origFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    await init();
    if (!GAS_URL || typeof url !== 'string') return origFetch(url, opts);
    opts = opts || {};
    var signal = opts.signal;
    var body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    var isV1 = url.indexOf('/v1/fonowriter/') !== -1;
    var isHealth = url.replace(/\/$/, '').endsWith('/health');
    if (!isV1 && !isHealth) return origFetch(url, opts);
    // /health
    if (isHealth) {
      try { await gasCall({ action: 'health' }); return jsonResp({ status: 'healthy', service: 'FonoWriter GAS' }); }
      catch (e) { return jsonResp({ status: 'degraded', service: 'FonoWriter GAS' }); }
    }
    // /analyze
    if (url.indexOf('/v1/fonowriter/analyze') !== -1) {
      var a = await gasCall({ action: 'analyze', text: body.text, method: body.method });
      return jsonResp({ method: a.method, total_features: a.V,
        scales: a.scales.map(function (s) { return { name: s.name, score: s.score, color_rgb: [0, 0, 0], z_score: 0 }; }) });
    }
    // /chat/stream — свободный чат (fake-SSE из полного ответа)
    if (url.indexOf('/v1/fonowriter/chat/stream') !== -1) {
      var cs = await gasCall({ action: 'chat', message: body.message, history: body.history || [],
        systemPrompt: body.system_prompt || '', temperature: body.temperature,
        thinking: body.thinking, maxTokens: body.max_tokens }, signal);
      var ans = String(cs.reply || '');
      var opt = extractMarked(ans);
      ans = cleanMarkers(ans);
      return fakeStream(ans, { optimized: opt });
    }
    // /chat classic
    if (url.indexOf('/v1/fonowriter/chat') !== -1) {
      var mode = (body.mode || 'chat').toLowerCase();
      if (mode === 'summary') {
        var s = await gasCall({ action: 'summary', message: body.message, preset: body.preset }, signal);
        return jsonResp({ reply: s.reply, analysis: null, alt_analysis: null, optimized: null, diff_summary: null, notes: null });
      }
      // rewrite: пресет-цикл или одиночка
      var rt = rawTextOf(body.message);
      var cyc = await gasCall({ action: 'cycle', text: rt.raw || body.message,
        preset: body.preset || '', systemPrompt: body.system_prompt || '',
        targets: [], plan: planFromHistory(body.history),
        maxIter: body.preset ? 3 : 1,
        temperature: body.temperature, thinking: body.thinking }, signal);
      return jsonResp({ reply: cyc.reply, analysis: null, alt_analysis: null,
        optimized: cyc.optimized || null, diff_summary: null, notes: cyc.notes || null });
    }
    // /system-prompt
    if (url.indexOf('/v1/fonowriter/system-prompt') !== -1) {
      if ((opts.method || 'GET').toUpperCase() === 'PUT')
        return jsonResp({ detail: 'системный промпт меняет только владелец' }, 403);
      return jsonResp({ content: '', default: '' });
    }
    // /license/status
    if (url.indexOf('/v1/fonowriter/license/status') !== -1) {
      return jsonResp({ licensed: true, mode: 'demo', customer: 'гость',
        plan: 'demo', expires: '', days_left: 1, hwid: fp(),
        reason: 'бессерверное демо: 3 пресета + 15 вопросов в сутки' });
    }
    // /content/effectiveness
    if (url.indexOf('/v1/content/effectiveness') !== -1) {
      var ce = await gasCall({ action: 'composite', text: body.text }, signal);
      return jsonResp({ communicative_score: ce.communicative_score,
        emotional_score: ce.emotional_score,
        sincerity: ce.sincerity, markdown: ce.markdown });
    }
    return origFetch(url, opts);
  };
  // флаг для диагностики
  window.__fwGasAdapter = function () { return { active: !!GAS_URL }; };
  // остатки демо-квоты для счётчика в интерфейсе
  window.__fwQuota = async function () {
    await init();
    if (!GAS_URL) return null;
    try {
      var j = await gasCall({ action: 'quota' });
      return { chats: j.chats_left, presets: j.presets_left };
    } catch (e) { return null; }
  };
})();
