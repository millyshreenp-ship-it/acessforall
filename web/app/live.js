/* Live scan: talks to the AccessForAll API (POST /scans -> /fixes -> /patches -> /feedback). */
(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var CFG = window.AFA_CONFIG;
if (!$('#live')) return;

var st = { scanId: null, issues: [], patches: {}, html: null, busy: false, applyFn: null };

/* ---------- API ---------- */
function base() { return (CFG.apiBase || '').replace(/\/+$/, ''); }
async function api(path, opts) {
  opts = opts || {};
  var headers = { 'X-API-Key': CFG.apiKey };
  if (opts.body) headers['Content-Type'] = 'application/json';
  var res;
  try {
    res = await fetch(base() + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch (e) {
    throw new Error('Cannot reach the server at ' + (base() || location.origin) + '. Start it with "docker compose up --build" or change the address under Server settings.');
  }
  if (!res.ok) {
    var detail = ''; try { var j = await res.clone().json(); detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch (e) {}
    var err = new Error(res.status === 401 ? 'The server rejected the API key. Check Server settings.'
      : res.status === 429 ? 'Rate limit reached. Wait a minute and try again.'
      : (detail || 'Server error ' + res.status));
    err.status = res.status; throw err;
  }
  return opts.raw ? res : res.json();
}

/* Progress over WebSocket is a bonus; polling below is what the flow relies on. */
function watch(id, onEvent) {
  try {
    var url = (base() || location.origin).replace(/^http/, 'ws') + '/scans/' + id + '/stream?api_key=' + encodeURIComponent(CFG.apiKey);
    var ws = new WebSocket(url);
    ws.onmessage = function (m) { try { onEvent(JSON.parse(m.data)); } catch (e) {} };
    return function () { try { ws.close(); } catch (e) {} };
  } catch (e) { return function () {}; }
}

async function waitFor(id, states, limitMs) {
  var t0 = Date.now(), delay = 2000;   // the API allows 60 requests a minute per key
  for (;;) {
    var s;
    try { s = await api('/scans/' + id); }
    catch (e) { if (e.status === 429) { delay = Math.min(delay * 2, 10000); await sleep(delay); continue; } throw e; }
    if (s.status === 'failed') throw new Error(s.error || 'The scan failed on the server.');
    if (states.indexOf(s.status) >= 0) return s;
    if (Date.now() - t0 > limitMs) throw new Error('Timed out waiting for the server (status: ' + s.status + ').');
    await sleep(delay);
  }
}

/* ---------- helpers ---------- */
function wcagRefs(tags) {
  var out = {};
  (tags || []).forEach(function (t) { var m = /^wcag(\d)(\d)(\d+)$/.exec(t); if (m) out[m[1] + '.' + m[2] + '.' + m[3]] = 1; });
  return Object.keys(out).sort();
}
var IMPACT = { critical: ['crit', 'Critical'], serious: ['ser', 'Serious'], moderate: ['mod', 'Moderate'], minor: ['mod', 'Minor'] };
var ORDER = ['critical', 'serious', 'moderate', 'minor'];

function describe(a) {
  var v = a.value == null ? '' : a.value;
  switch (a.action) {
    case 'set_attr': return 'Set ' + a.name + ' to “' + v + '”';
    case 'remove_attr': return 'Remove ' + a.name;
    case 'set_style': return 'Set ' + a.name + ' to ' + v;
    case 'set_text': return 'Set text to “' + v + '”';
    case 'insert_html': return 'Insert ' + v;
    default: return a.action;
  }
}
function setStatus(t, alert) {
  var el = $('#liveStatus'); el.textContent = t; el.setAttribute('role', alert ? 'alert' : 'status');
}
function setBusy(b) {
  st.busy = b; $('#liveGo').disabled = b; $('#liveGo').textContent = b ? 'Working…' : 'Scan and fix';
}

/* Same sanitising the server does, done before upload so scripts and form values never leave
   the browser. The preview shows this exact string, so server selectors match it. */
function sanitize(raw) {
  var doc = new DOMParser().parseFromString(raw, 'text/html');
  $$('script,noscript', doc).forEach(function (n) { n.remove(); });
  $$('input,textarea', doc).forEach(function (n) { n.removeAttribute('value'); if (n.tagName === 'TEXTAREA') n.textContent = ''; });
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/* ---------- server status + settings ---------- */
async function checkServer() {
  var el = $('#srvState');
  try {
    var r = await fetch(base() + '/health'); var j = await r.json();
    el.textContent = j.ok ? 'Server connected.' : 'Server answered but reports a problem.';
    el.className = 'pill ' + (j.ok ? 'fixed' : 'review');
  } catch (e) { el.textContent = 'Server not reachable.'; el.className = 'pill issue'; }
}
$('#srvBase').value = CFG.apiBase; $('#srvKey').value = CFG.apiKey;
$('#srvSave').addEventListener('click', function () {
  CFG.apiBase = $('#srvBase').value.trim(); CFG.apiKey = $('#srvKey').value.trim();
  try { localStorage.setItem('afa-server', JSON.stringify(CFG)); } catch (e) {}
  checkServer();
});
$('#srvBase').placeholder = location.origin + ' (leave empty for this site)';

/* ---------- input mode ---------- */
function mode() { return $('input[name="liveSrc"]:checked').value; }
function syncMode() {
  var url = mode() === 'url';
  $('#liveUrlWrap').hidden = !url; $('#liveHtmlWrap').hidden = url;
}
$$('input[name="liveSrc"]').forEach(function (r) { r.addEventListener('change', syncMode); });
$('#liveSample').addEventListener('click', async function () {
  try {
    var r = await fetch('sample.html'); if (!r.ok) throw 0;
    $('#liveHtml').value = await r.text();
    $('input[name="liveSrc"][value="html"]').checked = true; syncMode();
    setStatus('Sample page loaded. Press Scan and fix.');
  } catch (e) { setStatus('Could not load the sample page.', true); }
});

/* ---------- main flow ---------- */
$('#liveForm').addEventListener('submit', async function (e) {
  e.preventDefault(); if (st.busy) return;
  var body, preview = null;
  if (mode() === 'url') {
    var u = $('#liveUrl').value.trim();
    if (!/^https?:\/\/.+/i.test(u)) { setStatus('Enter a full address that starts with http:// or https://.', true); $('#liveUrl').focus(); return; }
    body = { url: u };
  } else {
    var raw = $('#liveHtml').value.trim();
    if (!raw) { setStatus('Paste some HTML first, or load the sample page.', true); $('#liveHtml').focus(); return; }
    preview = sanitize(raw); body = { html: preview };
  }
  var fixMode = $('input[name="liveMode"]:checked').value;
  setBusy(true); $('#liveOut').hidden = true; st.html = preview; st.patches = {}; st.issues = [];
  var stop = function () {};
  try {
    setStatus('Starting scan…');
    var created = await api('/scans', { method: 'POST', body: body });
    st.scanId = created.id;
    stop = watch(created.id, function (ev) { if (ev.stage === 'scanning') setStatus('Scanning the page in a headless browser…'); });
    setStatus('Scanning the page in a headless browser…');
    var scanned = await waitFor(created.id, ['scanned', 'done'], 120000); stop();
    st.issues = scanned.issues; st.keyboard = scanned.keyboard;
    setStatus('Found ' + scanned.issues.length + ' issues. Generating fixes (' + (fixMode === 'fast' ? 'rules only' : 'rules and AI') + ')…');

    stop = watch(created.id, function (ev) {
      if (ev.stage === 'proposing') setStatus('Proposing fixes: ' + ev.done + ' of ' + ev.total + '…');
      if (ev.stage === 'validating') setStatus('Verifying ' + ev.candidates + ' fixes in a fresh browser…');
    });
    await api('/scans/' + created.id + '/fixes?mode=' + fixMode, { method: 'POST' });
    await waitFor(created.id, ['done'], 300000); stop();
    (await api('/scans/' + created.id + '/patches')).forEach(function (p) { st.patches[p.issue_id] = p; });
    render();
    var ok = Object.keys(st.patches).filter(function (k) { return st.patches[k].validated; }).length;
    setStatus('Done. ' + st.issues.length + ' issues, ' + ok + ' fixes verified by re-testing.');
    $('#liveOut').hidden = false; $('#liveOutH').focus();
  } catch (err) { stop(); setStatus(err.message, true); }
  setBusy(false);
});

/* ---------- results ---------- */
function render() {
  var by = {}; st.issues.forEach(function (i) { by[i.impact || 'unknown'] = (by[i.impact || 'unknown'] || 0) + 1; });
  var patches = Object.keys(st.patches).map(function (k) { return st.patches[k]; });
  var verified = patches.filter(function (p) { return p.validated; }).length;
  $('#liveSum').innerHTML = '<strong>' + st.issues.length + '</strong> issues' +
    ORDER.filter(function (k) { return by[k]; }).map(function (k) { return ' · <span class="pill ' + IMPACT[k][0] + '">' + IMPACT[k][1] + ' ' + by[k] + '</span>'; }).join('') +
    '<br><strong>' + verified + '</strong> of ' + patches.length + ' proposed fixes passed re-testing.';
  var kb = st.keyboard;
  $('#liveKb').textContent = kb ? 'Keyboard audit: ' + kb.focusable + ' focusable elements, ' + kb.tab_stops + ' reached with Tab, ' +
    (kb.unreachable || []).length + ' unreachable, ' + (kb.traps || []).length + ' focus traps.' : '';

  var sorted = st.issues.slice().sort(function (a, b) {
    var ia = ORDER.indexOf(a.impact), ib = ORDER.indexOf(b.impact); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
  $('#liveList').innerHTML = sorted.map(function (i) {
    var imp = IMPACT[i.impact] || ['mod', i.impact || 'Unknown'], p = st.patches[i.id];
    var refs = wcagRefs(i.wcag).join(', ');
    var fix;
    if (!p) fix = '<p class="note">No automatic fix. A person needs to review this one.</p>';
    else {
      var pill = p.status === 'accepted' ? ['fixed', 'Accepted'] : p.status === 'rejected' ? ['mod', 'Rejected'] : p.status === 'edited' ? ['fixed', 'Edited']
        : p.validated ? ['fixed', 'Verified'] : ['issue', 'Failed re-test'];
      fix = '<p class="lf-fix"><span class="pill ' + pill[0] + '">' + pill[1] + '</span> ' + esc(describe(p.action)) +
        ' <span class="note">(' + esc(p.source) + ', confidence ' + Math.round((p.confidence || 0) * 100) + '%)</span></p>';
      if (!p.validated) fix += '<p class="note">Not applied: ' + esc((p.validation && p.validation.reason) || 'did not pass validation') + '.</p>';
      else fix += '<div class="row lf-act" data-patch="' + p.id + '"><button class="btn small" type="button" data-do="accept">Accept</button>' +
        '<button class="btn small" type="button" data-do="reject">Reject</button>' +
        (p.action.value != null ? '<button class="btn small" type="button" data-do="edit">Edit value</button>' : '') + '</div>' +
        '<div class="lf-edit field" hidden><label for="ed' + p.id + '">New value</label><div class="row"><input type="text" id="ed' + p.id + '" value="' + esc(p.action.value) + '">' +
        '<button class="btn small primary" type="button" data-do="save">Save</button></div></div>';
    }
    return '<li class="lf" data-issue="' + i.id + '"><div class="lf-h"><span class="pill ' + imp[0] + '">' + imp[1] + '</span><strong>' + esc(i.rule) + '</strong>' +
      (refs ? '<span class="note">WCAG ' + esc(refs) + '</span>' : '') + '</div>' +
      '<code class="lf-sel">' + esc(i.selector) + '</code>' + fix +
      (st.html ? '<button class="btn small" type="button" data-do="locate">Show in preview</button>' : '') + '</li>';
  }).join('') || '<li class="note">No issues found.</li>';
  renderPreview();
}

$('#liveList').addEventListener('click', async function (e) {
  var b = e.target.closest('button[data-do]'); if (!b) return;
  var li = b.closest('.lf'), iid = +li.dataset.issue, p = st.patches[iid], act = b.dataset.do;
  if (act === 'locate') return locate(iid);
  if (act === 'edit') { var w = $('.lf-edit', li); w.hidden = !w.hidden; if (!w.hidden) $('input', w).focus(); return; }
  var body = act === 'save' ? { decision: 'edit', edited_value: $('.lf-edit input', li).value } : { decision: act };
  try {
    var r = await api('/patches/' + p.id + '/feedback', { method: 'POST', body: body });
    p.status = r.status; p.action = r.action; render();
    var again = $('.lf[data-issue="' + iid + '"] button[data-do]'); if (again) again.focus();
    setStatus('Fix ' + r.status + '.');
  } catch (err) { setStatus(err.message, true); }
});

/* ---------- preview (pasted HTML only: a cross-origin page cannot be patched from here) ---------- */
async function loadApply() {
  if (st.applyFn) return st.applyFn;
  var src = await (await fetch(base() + '/static/apply_patch.js')).text();   // the file the validator ran
  st.applyFn = function (doc, patch) {
    var fake = {}; new Function('window', 'document', src)(fake, doc); return fake.__afaApply(patch);
  };
  return st.applyFn;
}
async function renderPreview() {
  var wrap = $('#livePrev'); wrap.hidden = !st.html; if (!st.html) return;
  var frame = $('#liveFrame'), on = $('#liveApply').checked;
  frame.srcdoc = st.html;
  await new Promise(function (r) { frame.onload = r; });
  var n = 0;
  if (on) {
    try {
      var ap = await loadApply();
      Object.keys(st.patches).forEach(function (k) {
        var p = st.patches[k];
        if (p.validated && p.status !== 'rejected') { try { if (ap(frame.contentDocument, p.action)) n++; } catch (e) {} }
      });
    } catch (e) { setStatus('Preview could not load the patch applier: ' + e.message, true); }
  }
  $('#livePrevNote').textContent = on ? n + ' verified fixes applied to this preview.' : 'Showing the page as submitted.';
}
$('#liveApply').addEventListener('change', renderPreview);
function locate(iid) {
  var i = st.issues.filter(function (x) { return x.id === iid; })[0], d = $('#liveFrame').contentDocument;
  if (!i || !d) return;
  try {
    var el = d.querySelector(i.selector); if (!el) { setStatus('That element is not in the preview.', true); return; }
    $$('[data-af-loc]', d).forEach(function (n) { n.style.outline = ''; n.removeAttribute('data-af-loc'); });
    el.setAttribute('data-af-loc', ''); el.style.outline = '3px dashed #d4380d'; el.scrollIntoView({ block: 'center' });
  } catch (e) { setStatus('Could not locate that element.', true); }
}

/* ---------- report ---------- */
$('#liveRepHtml').addEventListener('click', async function () {
  var w = window.open('', '_blank');   // open synchronously so popup blockers allow it
  try {
    var r = await api('/scans/' + st.scanId + '/report?format=html', { raw: true });
    var url = URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' }));
    if (w) w.location = url; else location.href = url;
  } catch (err) { if (w) w.close(); setStatus(err.message, true); }
});
$('#liveRepJson').addEventListener('click', async function () {
  try {
    var j = await api('/scans/' + st.scanId + '/report');
    var a = document.createElement('a'); a.download = 'accessforall-report.json';
    a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })); a.click();
  } catch (err) { setStatus(err.message, true); }
});

syncMode(); checkServer();
})();
