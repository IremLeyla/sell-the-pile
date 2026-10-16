// Sell the Pile prototype. No AI, no upload, nothing is posted.
// A real photo is cut into a 3 x 2 grid; the sample photo is a drawing for demos.
// Recognition is Wizard of Oz: the facilitator types the item names.

const SHAPES = {
  tshirt: 'M30 20 L42 14 Q50 22 58 14 L70 20 L84 34 L74 42 L68 37 L68 86 L32 86 L32 37 L26 42 L16 34 Z',
  jacket: 'M32 16 L43 12 L50 26 L57 12 L68 16 L88 70 L78 74 L68 46 L68 88 L32 88 L32 46 L22 74 L12 70 Z',
  sweater: 'M32 16 L42 12 Q50 20 58 12 L68 16 L88 70 L78 74 L68 46 L68 88 L32 88 L32 46 L22 74 L12 70 Z',
  jeans: 'M32 12 L68 12 L72 88 L56 88 L50 40 L44 88 L28 88 Z',
  shorts: 'M28 26 L72 26 L76 68 L56 68 L50 48 L44 68 L24 68 Z',
  dress: 'M40 12 L60 12 L62 30 L78 88 L22 88 L38 30 Z',
  skirt: 'M34 24 L66 24 L80 82 L20 82 Z',
  scarf: 'M20 30 L80 30 L80 42 L62 42 L62 88 L50 88 L50 42 L20 42 Z',
  bag: 'M24 42 L76 42 L80 86 L20 86 Z M38 42 Q38 20 50 20 Q62 20 62 42 L58 42 Q58 25 50 25 Q42 25 42 42 Z',
};

const SAMPLE_GROUPS = [
  [
    { shape: 'jacket', color: '#2f2a26', name: 'Black jacket' },
    { shape: 'jeans', color: '#4c6b8a', name: 'Blue jeans' },
    { shape: 'dress', color: '#c46f52', name: 'Terracotta dress' },
    { shape: 'tshirt', color: '#f4f0e6', name: 'White T-shirt' },
    { shape: 'sweater', color: '#7f8f4e', name: 'Olive sweater' },
    { shape: 'skirt', color: '#d8ae5f', name: 'Mustard skirt' },
  ],
  [
    { shape: 'sweater', color: '#9a9a96', name: 'Grey jumper' },
    { shape: 'shorts', color: '#6d8fae', name: 'Denim shorts' },
    { shape: 'tshirt', color: '#a8c3dc', name: 'Light blue top' },
    { shape: 'scarf', color: '#a8352c', name: 'Red scarf' },
    { shape: 'bag', color: '#c79a63', name: 'Tan bag' },
    { shape: 'jacket', color: '#b98a55', name: 'Camel coat' },
  ],
];

// Facilitator mode (Wizard of Oz) runs only when the file is opened locally.
// The shared link has no facilitator: the demo photo is "recognised",
// real photos get blank titles for the tester to fill in.
const FACILITATOR = location.protocol === 'file:';

const state = {
  pileTotal: 12,
  groupIndex: 0,
  photo: null,       // { kind: 'real', url, ratio } or { kind: 'sample', items }
  excluded: new Set(),
  names: [],         // what the facilitator typed for each grid spot
  recognised: false, // whether names come from (simulated) recognition
  drafts: [],        // { photo, cell, title, price, size, condition, platforms, desc, ready }
  history: ['start'],
  editing: null,
};

const $ = (sel) => document.querySelector(sel);

// ---------- Drawing ----------

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + c * amount)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function garment(item, x, y, size, rotate) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate} ${size / 2} ${size / 2}) scale(${size / 100})">
    <path d="${SHAPES[item.shape]}" fill="${item.color}" stroke="${shade(item.color, -0.35)}" stroke-width="2.5" stroke-linejoin="round" fill-rule="evenodd"/>
  </g>`;
}

const DEFS = `<defs><linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient></defs>`;

function floor(w, h) {
  let lines = '';
  for (let x = 46; x < w; x += 48) lines += `<rect x="${x}" y="0" width="2" height="${h}" fill="#96663f"/>`;
  return `<rect width="${w}" height="${h}" fill="#a9774f"/>${lines}<rect width="${w}" height="${h}" fill="url(#light)"/>`;
}

const CELLS = [[8, 12, -6], [111, 8, 4], [214, 14, -3], [10, 128, 5], [112, 134, -4], [212, 126, 6]];

function sampleSvg(items) {
  const parts = items.map((item, i) => garment(item, CELLS[i][0], CELLS[i][1], 90, CELLS[i][2])).join('');
  return `<svg viewBox="0 0 312 240" preserveAspectRatio="none" role="img" aria-label="Sample photo of ${items.length} clothing items on a wooden floor">${DEFS}${floor(312, 240)}${parts}</svg>`;
}

// The full photo, with a numbered 3 x 2 grid over it.
function photoWithGrid(photo, excluded) {
  const base = photo.kind === 'real'
    ? `<img src="${photo.url}" alt="Your photo of the items">`
    : sampleSvg(photo.items);
  const cells = [0, 1, 2, 3, 4, 5].map((i) => `
    <span class="grid-cell ${excluded.has(i) ? 'is-out' : ''}"><span class="grid-num">${i + 1}</span></span>`).join('');
  return `<div class="grid-photo" style="aspect-ratio:${photo.ratio}">${base}<div class="grid-overlay" aria-hidden="true">${cells}</div></div>`;
}

// One cell of the photo, cut out the way a crop would be.
function crop(photo, cell, label) {
  const col = cell % 3, row = Math.floor(cell / 3);
  const inner = photo.kind === 'real'
    ? `<img src="${photo.url}" alt="">`
    : sampleSvg(photo.items);
  return `<div class="crop" style="aspect-ratio:${photo.ratio * 2 / 3}" role="img" aria-label="${label}">
    <div class="crop-inner" style="left:${-col * 100}%;top:${-row * 100}%">${inner}</div></div>`;
}

// ---------- Navigation ----------

function show(name, { push = true } = {}) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('is-active'));
  $(`#screen-${name}`).classList.add('is-active');
  if (push) state.history.push(name);
  if (name === 'drafts') renderDrafts();
  if (name === 'layout') $('#layout-group-label').textContent = `Group ${state.groupIndex + 1}`;
  window.scrollTo(0, 0);
  const heading = $(`#screen-${name} h1, #screen-${name} h2`);
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
}

function back() {
  if (state.history.length < 2) return;
  state.history.pop();
  show(state.history[state.history.length - 1], { push: false });
}

document.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.go)));
document.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', back));

// ---------- 1. Start ----------

document.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
  state.pileTotal = Math.max(1, Math.min(60, state.pileTotal + Number(btn.dataset.step)));
  $('#pile-count').textContent = state.pileTotal;
}));

// ---------- 3. Camera ----------

$('#shutter').addEventListener('click', () => $('#photo-input').click());

$('#photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => usePhoto({ kind: 'real', url, ratio: img.naturalWidth / img.naturalHeight });
  img.src = url;
  e.target.value = '';
});

$('#use-sample').addEventListener('click', () => {
  const round = Math.floor(state.groupIndex / SAMPLE_GROUPS.length);
  const items = SAMPLE_GROUPS[state.groupIndex % SAMPLE_GROUPS.length]
    .map((it) => ({ ...it, color: round ? shade(it.color, 0.25 * round) : it.color }));
  usePhoto({ kind: 'sample', items, ratio: 312 / 240 });
});

function usePhoto(photo) {
  state.photo = photo;
  const remaining = state.pileTotal - state.drafts.length;
  if (FACILITATOR) {
    renderFacilitator();
    show('facilitator');
  } else if (photo.kind === 'sample') {
    state.names = [0, 1, 2, 3, 4, 5].map((i) => (i < remaining ? photo.items[i].name : ''));
    state.recognised = true;
    state.excluded = new Set();
    show('recognising');
    state.history.pop();
    setTimeout(() => { renderCheck(); show('check'); }, 1600);
  } else {
    state.names = [0, 1, 2, 3, 4, 5].map((i) => (i < remaining ? `Item ${i + 1}` : ''));
    state.recognised = false;
    state.excluded = new Set();
    renderCheck();
    show('check');
  }
}

// ---------- 3b. Facilitator (Wizard of Oz) ----------

function renderFacilitator() {
  const remaining = state.pileTotal - state.drafts.length;
  const photo = state.photo;
  $('#fac-list').innerHTML = [0, 1, 2, 3, 4, 5].map((i) => {
    const preset = photo.kind === 'sample' && i < remaining ? photo.items[i].name : '';
    return `<li class="fac-item">
      <span class="fac-thumb">${crop(photo, i, '')}</span>
      <label class="visually-hidden" for="fac-${i}">Spot ${i + 1}</label>
      <input class="input" id="fac-${i}" type="text" autocomplete="off" placeholder="Spot ${i + 1}: empty" value="${escapeHtml(preset)}">
    </li>`;
  }).join('');
}

$('#fac-done').addEventListener('click', () => {
  state.names = [0, 1, 2, 3, 4, 5].map((i) => $(`#fac-${i}`).value.trim());
  // Empty spots and spots beyond the pile start as "left out".
  const remaining = state.pileTotal - state.drafts.length;
  state.excluded = new Set([0, 1, 2, 3, 4, 5].filter((i) => !state.names[i] || i >= remaining));
  state.recognised = true;
  state.history.pop();
  show('recognising', { push: false });
  setTimeout(() => { renderCheck(); show('check'); }, 1600);
});

// ---------- 4. Check ----------

function renderCheck() {
  $('#check-photo').innerHTML = photoWithGrid(state.photo, state.excluded);
  const found = state.names.filter(Boolean).length;
  $('#check-title').innerHTML = state.recognised
    ? `We found <span id="found-count">${found}</span> items`
    : 'Which spots have an item?';
  $('#check-lead').textContent = state.recognised
    ? 'Tap an item to leave it out of this session.'
    : 'Tap a spot to leave it out, for example if it is empty.';
  $('#check-list').innerHTML = [0, 1, 2, 3, 4, 5].filter((i) => state.names[i]).map((i) => {
    const on = !state.excluded.has(i);
    return `<li><button class="chip" type="button" data-i="${i}" aria-pressed="${on}">
      <span class="chip-num">${i + 1}</span>${escapeHtml(state.names[i])}<span class="visually-hidden">, ${on ? 'included' : 'left out'}</span></button></li>`;
  }).join('');
  const n = [0, 1, 2, 3, 4, 5].filter((i) => state.names[i] && !state.excluded.has(i)).length;
  const btn = $('#create-drafts');
  btn.textContent = n === 1 ? 'Create 1 draft' : `Create ${n} drafts`;
  btn.disabled = n === 0;
}

$('#check-list').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const i = Number(chip.dataset.i);
  state.excluded.has(i) ? state.excluded.delete(i) : state.excluded.add(i);
  renderCheck();
  $(`.chip[data-i="${i}"]`).focus();
});

$('#create-drafts').addEventListener('click', () => {
  for (let i = 0; i < 6; i++) {
    if (state.excluded.has(i) || !state.names[i]) continue;
    state.drafts.push({ photo: state.photo, cell: i, recognised: state.recognised, title: state.recognised ? state.names[i] : '', price: '', size: '', condition: '', platforms: [], desc: '', ready: false });
  }
  state.groupIndex += 1;
  state.history = ['start', 'drafts'];
  show('drafts', { push: false });
});

// ---------- 5. Drafts ----------

function titleOf(d, i) { return d.title || `Item ${i + 1}`; }

function missing(d) {
  const m = [];
  if (!d.title) m.push('title');
  if (!d.price) m.push('price');
  if (!d.size) m.push('size');
  if (!d.condition) m.push('condition');
  if (!d.platforms.length) m.push('where to sell');
  return m;
}

function renderDrafts() {
  const ready = state.drafts.filter((d) => d.ready).length;
  const done = state.drafts.length;
  $('#stat-drafted').textContent = done;
  $('#stat-ready').textContent = ready;
  $('#pile-bar').style.width = `${Math.min(100, (done / state.pileTotal) * 100)}%`;
  $('#pile-note').textContent = done >= state.pileTotal
    ? `Your whole pile of ${state.pileTotal} is drafted`
    : `${done} of ${state.pileTotal} items from your pile`;

  $('#draft-list').innerHTML = state.drafts.map((d, i) => {
    const m = missing(d);
    const meta = d.ready ? `€${d.price} · ready for ${d.platforms.join(' + ')}` : m.length ? `Add ${m.join(', ')}` : 'Ready to mark';
    return `<li><button class="draft" type="button" data-i="${i}">
      <span class="draft-thumb">${crop(d.photo, d.cell, '')}</span>
      <span class="draft-info"><span class="draft-title">${escapeHtml(titleOf(d, i))}</span><span class="draft-meta">${escapeHtml(meta)}</span></span>
      <span class="status ${d.ready ? 'status-ready' : ''}">${d.ready ? 'Ready' : 'Draft'}</span>
    </button></li>`;
  }).join('');

  $('#next-group').hidden = done >= state.pileTotal;
}

$('#draft-list').addEventListener('click', (e) => {
  const card = e.target.closest('.draft');
  if (card) openDraft(Number(card.dataset.i));
});

$('#next-group').addEventListener('click', () => show('layout'));

$('#finish-later').addEventListener('click', () => {
  const ready = state.drafts.filter((d) => d.ready).length;
  const open = state.drafts.length - ready;
  $('#sum-drafted').textContent = state.drafts.length;
  $('#sum-ready').textContent = ready;
  $('#sum-open').textContent = open;
  $('#sum-left').textContent = Math.max(0, state.pileTotal - state.drafts.length);
  $('#sum-text').textContent = open > 0
    ? 'Your drafts are saved. Finish them whenever you like.'
    : 'Everything you drafted is ready to sell.';
  show('summary');
});

$('#back-to-drafts').addEventListener('click', () => {
  state.history = ['start', 'drafts'];
  show('drafts', { push: false });
});

// ---------- 5b. Draft detail ----------

function openDraft(i) {
  state.editing = i;
  const d = state.drafts[i];
  $('#detail-title').textContent = `Draft ${i + 1} of ${state.drafts.length}`;
  $('#detail-photo').innerHTML = crop(d.photo, d.cell, `Photo of ${titleOf(d, i)}`);
  $('#f-title').value = d.title;
  $('#title-hint').textContent = d.recognised
    ? 'Recognised from your photo. Change it if you like.'
    : 'Add a title for this item.';
  $('#f-price').value = d.price;
  $('#f-size').value = d.size;
  $('#f-condition').value = d.condition;
  $('#f-desc').value = d.desc;
  document.querySelectorAll('input[name="platform"]').forEach((r) => { r.checked = d.platforms.includes(r.value); });
  clearErrors();
  $('#mark-ready').textContent = d.ready ? 'Save changes' : 'Mark ready';
  show('detail');
}

function parsePrice(raw) {
  const n = Number(raw.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function saveFields() {
  const d = state.drafts[state.editing];
  d.title = $('#f-title').value.trim();
  d.price = $('#f-price').value.trim();
  d.size = $('#f-size').value;
  d.condition = $('#f-condition').value;
  d.platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map((r) => r.value);
  d.desc = $('#f-desc').value.trim();
  return d;
}

function showError(id, input, msg) {
  $(id).textContent = msg;
  if (input) input.setAttribute('aria-invalid', 'true');
}

function clearErrors() {
  $('#price-error').textContent = '';
  $('#platform-error').textContent = '';
  $('#f-price').removeAttribute('aria-invalid');
}

$('#save-draft').addEventListener('click', () => {
  const d = saveFields();
  if (d.ready && (!parsePrice(d.price) || !d.platforms.length)) d.ready = false;
  back();
});

$('#mark-ready').addEventListener('click', () => {
  const d = saveFields();
  clearErrors();
  const price = parsePrice(d.price);
  let first = null;
  if (!price) {
    showError('#price-error', $('#f-price'), 'Add a price to mark this item ready. You can save it as a draft without one.');
    first = $('#f-price');
  }
  if (!d.platforms.length) {
    showError('#platform-error', null, 'Choose Vinted, Kleinanzeigen, or both.');
    first = first || document.querySelector('input[name="platform"]');
  }
  if (first) { first.focus(); return; }
  d.price = price.toFixed(2).replace('.', ',').replace(',00', '');
  d.ready = true;
  back();
});

$('#f-price').addEventListener('input', () => { $('#price-error').textContent = ''; $('#f-price').removeAttribute('aria-invalid'); });
document.querySelectorAll('input[name="platform"]').forEach((r) => r.addEventListener('change', () => { $('#platform-error').textContent = ''; }));

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
