/* Shared MSP Coffee DD/MM/YYYY controls and formatters. */
(()=>{ const exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_DATE_FORMAT = void 0;
exports.validIsoDate = validIsoDate;
exports.parseAppDate = parseAppDate;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.dateInputError = dateInputError;
/** MSP Coffee date convention: DD/MM/YYYY on screen and in exports; ISO in storage. */
exports.APP_DATE_FORMAT = 'DD/MM/YYYY';
function validIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function parseAppDate(value) {
    if (typeof value !== 'string')
        return '';
    const text = value.trim();
    if (validIsoDate(text))
        return text;
    const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
    const separated = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
    const parts = compact || separated;
    if (!parts)
        return '';
    const iso = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    return validIsoDate(iso) ? iso : '';
}
function formatDate(value, empty = '—') {
    if (value == null || value === '')
        return empty;
    const iso = typeof value === 'string' ? parseAppDate(value) : '';
    if (iso)
        return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
    // Only timestamps / Date objects reach the timezone conversion path.
    if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value))
        return value;
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number')
        return empty;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime()))
        return empty;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
    const get = (type) => parts.find(part => part.type === type)?.value || '';
    return get('day') + '/' + get('month') + '/' + get('year');
}
function formatDateTime(value, empty = '—') {
    if (value == null || value === '')
        return empty;
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(date.getTime()))
        return empty;
    return `${formatDate(date, empty)} ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}`;
}
function dateInputError(draft, min, max) {
    if (!draft)
        return '';
    const iso = parseAppDate(draft);
    if (!iso)
        return 'Enter a real date as DD/MM/YYYY, for example 14/11/2026.';
    if (min && iso < min)
        return `Choose ${formatDate(min)} or a later date.`;
    if (max && iso > max)
        return `Choose ${formatDate(max)} or an earlier date.`;
    return '';
}

const api=exports; window.MSPDates=api;
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const states = new WeakMap();
  function upgrade(input) {
    if (input.dataset.mspDateReady || input.dataset.mspDateInternal) return;
    const initial = input.value;
    const state = { iso: api.parseAppDate(initial) };
    states.set(input, state);
    input.dataset.mspDateReady = 'true';
    input.type = 'text'; input.defaultValue = api.formatDate(input.defaultValue, ''); input.inputMode = 'numeric'; input.placeholder = 'DD/MM/YYYY'; input.maxLength = 10; input.pattern = '[0-9]{2}/[0-9]{2}/[0-9]{4}';
    const wrapper = document.createElement('span'); wrapper.className = 'msp-date-control';
    input.parentNode.insertBefore(wrapper, input); wrapper.append(input);
    const picker = document.createElement('input'); picker.type = 'date'; picker.dataset.mspDateInternal = 'true'; picker.tabIndex = -1; picker.setAttribute('aria-hidden','true'); picker.className = 'msp-date-native';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'msp-date-calendar'; button.textContent = '▦'; button.setAttribute('aria-label', 'Choose date from calendar');
    wrapper.append(button, picker);
    function validate() {
      input.setCustomValidity(api.dateInputError(nativeValue.get.call(input), input.min || undefined, input.max || undefined));
      picker.min = input.min; picker.max = input.max; picker.disabled = input.disabled || input.readOnly; button.disabled = picker.disabled; button.hidden = input.readOnly;
      picker.value = state.iso;
    }
    function set(value) {
      state.iso = api.parseAppDate(String(value));
      nativeValue.set.call(input, value ? api.formatDate(String(value), '') : ''); validate();
    }
    Object.defineProperty(input, 'value', { configurable: true, get() { return state.iso; }, set });
    function changed() {
      const raw = nativeValue.get.call(input), iso = api.parseAppDate(raw);
      state.iso = iso;
      nativeValue.set.call(input, iso ? api.formatDate(iso) : raw.replace(/\D/g,'').slice(0,8)); validate();
    }
    input.addEventListener('input', changed, true); input.addEventListener('change', changed, true);
    function openCalendar() { if (input.disabled || input.readOnly) return; try { picker.showPicker(); } catch { /* Typing remains available. */ } }
    button.onclick = openCalendar; input.addEventListener('click', openCalendar);
    picker.onchange = () => { input.value = picker.value; input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true })); };
    new MutationObserver(validate).observe(input, { attributes:true, attributeFilter:['min','max','disabled','readonly'] });
    if (input.form) {
      input.form.addEventListener('formdata', event => { if (input.name && !input.matches(':disabled')) event.formData.set(input.name, state.iso); });
      input.form.addEventListener('reset', () => queueMicrotask(() => { set(input.defaultValue); }));
    }
    set(initial);
  }
  function scan(root) { if (root.nodeType !== 1 && root.nodeType !== 9) return; if (root.matches?.('input[type="date"]')) upgrade(root); root.querySelectorAll?.('input[type="date"]:not([data-msp-date-internal])').forEach(upgrade); }
  function start() { scan(document); new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(scan))).observe(document.body, { childList:true, subtree:true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();

})();
