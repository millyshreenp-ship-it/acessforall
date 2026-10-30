/* Where the AccessForAll API lives. Served by the API itself, the base is the same origin ('').
   Opened from a file or a different dev server, it falls back to the Docker default.
   Override any time in the "Server settings" panel (saved in this browser). */
window.AFA_CONFIG = (function () {
  var served = /^https?:$/.test(location.protocol) && (location.port === '8000' || location.port === '');
  var cfg = { apiBase: served ? '' : 'http://localhost:8000', apiKey: 'dev-key' };
  try {
    var s = JSON.parse(localStorage.getItem('afa-server') || 'null');
    if (s && typeof s.apiBase === 'string') cfg.apiBase = s.apiBase;
    if (s && typeof s.apiKey === 'string') cfg.apiKey = s.apiKey;
  } catch (e) {}
  return cfg;
})();
