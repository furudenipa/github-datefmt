'use strict';

(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const relativeSelector = 'relative-time[datetime]';
  const fieldSelector = 'button[aria-label^="Edit "] > span[class*="issueFieldValueText"]';
  const boardSelector = '#memex-root li > button[aria-labelledby]';
  const tableSelector = '#memex-root [role="gridcell"] > div[class*="BaseCell"] > span[class*="SanitizedHtml"][data-component="Text"]';
  const commitSelector = 'h3[data-testid="commit-group-title"]';
  const selector = `${relativeSelector}, ${fieldSelector}, ${boardSelector}, ${tableSelector}, ${commitSelector}`;
  const pad = value => String(value).padStart(2, '0');
  const observedShadows = new WeakSet();

  function calendarDate(year, month, day) {
    const y = Number(year), m = Number(month), d = Number(day);
    if (y < 1 || m < 1 || m > 12 || d < 1) return null;
    const days = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= days[m - 1] ? `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}` : null;
  }

  function englishDate(value) {
    const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(value);
    return match && calendarDate(match[3], months.indexOf(match[1]) + 1, match[2]);
  }

  function timestamp(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
    if (!match || !calendarDate(match[1], match[2], match[3])) return null;
    if (!match[4]) return `${match[1]}-${match[2]}-${match[3]}`;
    if (+match[4] > 23 || +match[5] > 59 || (match[6] && +match[6] > 59)) return null;
    if (match[7] !== 'Z' && (+match[7].slice(1, 3) > 23 || +match[7].slice(4, 6) > 59)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isDateTableCell(element) {
    const cell = element.closest('[role="gridcell"]');
    const match = cell && /^calc\(var\(--column-(.+)-width\) \* 1px\)$/.exec(cell.style.width);
    const metadata = document.getElementById('memex-columns-data');
    if (!match || !metadata || metadata.tagName !== 'SCRIPT' || metadata.type !== 'application/json') return false;
    try {
      const columns = JSON.parse(metadata.textContent);
      if (!Array.isArray(columns)) return false;
      const matching = columns.filter(column => column && (typeof column.id === 'string' || typeof column.id === 'number') && String(column.id).replace(/\s+/g, '-') === match[1]);
      return matching.length === 1 && ['date', 'created', 'updated', 'closed'].includes(matching[0].dataType);
    } catch {
      return false;
    }
  }

  function replaceSingleText(element, value) {
    if (element.childNodes.length !== 1 || element.firstChild.nodeType !== Node.TEXT_NODE) return false;
    if (element.firstChild.data !== value) element.firstChild.data = value;
    return true;
  }

  function update(element) {
    if (element.matches(relativeSelector)) {
      const value = timestamp(element.getAttribute('datetime'));
      if (!value) return;
      if (replaceSingleText(element, value)) element.setAttribute('data-github-datefmt', '');
      const shadow = element.shadowRoot;
      if (shadow) {
        if (!observedShadows.has(shadow)) {
          observer.observe(shadow, { subtree: true, childList: true, characterData: true });
          observedShadows.add(shadow);
        }
        const root = shadow.querySelector('[part~="root"]');
        if (root) replaceSingleText(root, value);
      }
    } else if (element.matches(commitSelector)) {
      const match = /^Commits on (.+)$/.exec(element.textContent);
      const value = match && englishDate(match[1]);
      if (value && replaceSingleText(element, `Commits on ${value}`)) element.setAttribute('data-github-datefmt', '');
    } else if (element.matches(fieldSelector) || element.matches(tableSelector)) {
      if (element.matches(tableSelector) && !isDateTableCell(element)) return;
      const value = englishDate(element.textContent);
      if (value && replaceSingleText(element, value)) element.setAttribute('data-github-datefmt', '');
    } else if (element.matches(boardSelector)) {
      const text = element.querySelector('[data-component="Text"]');
      if (!text || element.querySelectorAll('[data-component="Text"]').length !== 1) return;
      const original = text.textContent;
      const value = englishDate(original);
      if (!value) return;
      const tooltip = document.getElementById(element.getAttribute('aria-labelledby'));
      if (!tooltip || tooltip.parentElement !== element.parentElement || !tooltip.textContent.endsWith(`: ${original}`)) return;
      if (replaceSingleText(text, value)) text.setAttribute('data-github-datefmt', '');
      replaceSingleText(tooltip, tooltip.textContent.slice(0, -original.length) + value);
    }
  }

  function scan(root) {
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      const parent = root.closest(selector);
      if (parent) update(parent);
    }
    root.querySelectorAll(selector).forEach(update);
  }

  function scanChange(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return;
    const shadowHost = element.getRootNode().host;
    if (shadowHost?.matches(relativeSelector)) {
      update(shadowHost);
      return;
    }
    const relevant = element.closest(selector) || element.closest('#memex-root li');
    if (relevant) scan(relevant);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') scan(record.target);
      else if (record.type === 'characterData') scanChange(record.target);
      else {
        scanChange(record.target);
        record.addedNodes.forEach(scan);
      }
    }
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['datetime'] });
  scan(document);
  customElements.whenDefined('relative-time').then(() => scan(document));
})();
