// Shared by the validator (Playwright) AND the browser extension content script.
window.__afaApply = function (p) {
  const el = document.querySelector(p.selector);
  if (!el) return false;
  switch (p.action) {
    case "set_attr": el.setAttribute(p.name, p.value); break;
    case "remove_attr": el.removeAttribute(p.name); break;
    case "set_style": el.style.setProperty(p.name, p.value, "important"); break;
    case "set_text": el.textContent = p.value; break;
    case "insert_html": el.insertAdjacentHTML(p.position || "afterbegin", p.value); break;
    default: return false;
  }
  return true;
};
