export const TRAY_STORAGE_KEY = 'pony.germination.trays.v1';
export const MAX_TRAY_CELLS = 240;
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
};

export function normalizeTray(value) {
  if (!value || typeof value !== 'object') return null;
  const capacity = Number(value.capacity);
  const seeded = Number(value.seeded);
  const text = key => typeof value[key] === 'string' ? value[key].trim().slice(0, key === 'name' ? 32 : 100) : '';
  const id = typeof value.id === 'string' ? value.id.slice(0, 100) : '';
  const tray = {
    id, name: text('name'), size: text('size'), capacity,
    seed: text('seed'), substrate: text('substrate'), seeded,
    sown: typeof value.sown === 'string' ? value.sown : '',
  };
  if (!tray.id || !tray.name || !tray.size || !tray.seed || !tray.substrate) return null;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_TRAY_CELLS) return null;
  if (!Number.isInteger(seeded) || seeded < 0 || seeded > capacity) return null;
  if (!validDate(tray.sown)) return null;
  return tray;
}

export function createTrayRepository(storage, { key = TRAY_STORAGE_KEY, makeId = defaultId } = {}) {
  function read() {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.map(normalizeTray).filter(Boolean);
      return [...new Map(valid.map(tray => [tray.id, tray])).values()];
    } catch {
      return [];
    }
  }

  function write(trays) {
    const valid = trays.map(normalizeTray);
    if (valid.some(tray => !tray)) throw new TypeError('Invalid tray data');
    storage.setItem(key, JSON.stringify(valid));
    return valid;
  }

  function save(input, existingId = '') {
    const tray = normalizeTray({ ...input, id: existingId || input.id || makeId() });
    if (!tray) throw new TypeError('Revisa los datos de la charola.');
    const trays = read();
    const index = trays.findIndex(item => item.id === tray.id);
    if (index < 0) trays.push(tray);
    else trays[index] = tray;
    return write(trays);
  }

  function remove(id) {
    return write(read().filter(tray => tray.id !== id));
  }

  return { read, save, remove };
}

function defaultId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch { /* Some insecure/embedded contexts throw when accessing Web Crypto. */ }
  return `tray-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function daysSince(date, now = new Date()) {
  if (!validDate(date)) return 0;
  const [year, month, day] = date.split('-').map(Number);
  const seededAt = Date.UTC(year, month - 1, day);
  const current = new Date(now);
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  return Math.max(0, Math.floor((today - seededAt) / 86400000));
}

export function stageFor(days) {
  if (days < 3) return 'RECIÉN SEMBRADA';
  if (days < 8) return 'GERMINANDO';
  if (days < 18) return 'PLÁNTULA';
  return 'LISTA PARA TRASPLANTE';
}

export function mountGermination(document, ui, storage = safeStorage()) {
  const addButton = document.querySelector('#addTray');
  const list = document.querySelector('#trayList');
  const summary = document.querySelector('#germinationSummary');
  if (!addButton || !list || !summary) return;

  const repository = createTrayRepository(storage);
  let trays = repository.read();

  function apply(nextTrays) {
    try {
      trays = nextTrays;
      render();
      return true;
    } catch {
      ui.toast('No se pudieron guardar los cambios en este dispositivo.');
      return false;
    }
  }

  function render() {
    const planted = trays.reduce((total, tray) => total + tray.seeded, 0);
    const cells = trays.reduce((total, tray) => total + tray.capacity, 0);
    summary.replaceChildren(...[
      ['CHAROLAS', trays.length], ['SEMILLAS', planted], ['ESPACIOS LIBRES', cells - planted],
    ].map(([label, number]) => {
      const card = document.createElement('div');
      const title = document.createElement('small');
      const value = document.createElement('strong');
      title.textContent = label;
      value.textContent = number;
      card.append(title, value);
      return card;
    }));

    if (trays.length === 0) {
      list.innerHTML = '<div class="empty-trays">♧<strong>Todavía no hay charolas</strong><span>Agrega una para empezar a simular tus semillas y sustratos.</span></div>';
      return;
    }
    list.innerHTML = trays.map(tray => renderTray(tray)).join('');
  }

  function openForm(tray) {
    const editing = Boolean(tray);
    ui.showDialog(`<form class="detail-content tray-form" id="trayForm"><div class="subtitle">SIMULADOR DE SIEMBRA</div><h2>${editing ? 'EDITAR CHAROLA' : 'NUEVA CHAROLA'}</h2><label>Nombre<input name="name" required maxlength="32" placeholder="Ej. Tomates" value="${escapeHTML(tray?.name || '')}"></label><div class="tray-form-row"><label>Formato<input name="size" required maxlength="100" placeholder="Ej. 6×12" value="${escapeHTML(tray?.size || '')}"></label><label>Celdas<input name="capacity" required type="number" min="1" max="${MAX_TRAY_CELLS}" value="${tray?.capacity ?? 72}"></label></div><label>Semilla / variedad<input name="seed" required maxlength="100" placeholder="Ej. Jitomate cherry" value="${escapeHTML(tray?.seed || '')}"></label><label>Sustrato<input name="substrate" required maxlength="100" placeholder="Ej. Fibra de coco + perlita" value="${escapeHTML(tray?.substrate || '')}"></label><div class="tray-form-row"><label>Celdas sembradas<input name="seeded" required type="number" min="0" max="${MAX_TRAY_CELLS}" value="${tray?.seeded ?? 0}"></label><label>Fecha de siembra<input name="sown" required type="date" value="${tray?.sown || todayISO()}"></label></div><div class="detail-actions"><button class="pixel-action" type="submit">GUARDAR CHAROLA</button></div></form>`);
    const form = document.querySelector('#trayForm');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      values.capacity = Number(values.capacity);
      values.seeded = Number(values.seeded);
      const trayData = normalizeTray({ ...values, id: tray?.id || defaultId() });
      if (!trayData) {
        ui.toast('Las celdas sembradas no pueden superar la capacidad.');
        return;
      }
      let next;
      try {
        next = repository.save(trayData, tray?.id || '');
      } catch (error) {
        ui.toast(error?.message || 'No se pudieron guardar los cambios.');
        return;
      }
      if (apply(next)) ui.closeDialog();
    });
  }

  addButton.addEventListener('click', () => openForm());
  document.defaultView?.addEventListener('storage', event => {
    if (event.key !== TRAY_STORAGE_KEY) return;
    trays = repository.read();
    render();
  });
  list.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-tray]');
    const remove = event.target.closest('[data-remove-tray]');
    if (edit) openForm(trays.find(tray => tray.id === edit.dataset.editTray));
    if (remove) {
      try {
        apply(repository.remove(remove.dataset.removeTray));
      } catch {
        ui.toast('No se pudieron guardar los cambios en este dispositivo.');
      }
    }
  });

  render();
}

function renderTray(tray) {
  const filled = Math.min(tray.capacity, tray.seeded);
  const days = daysSince(tray.sown);
  const cells = Array.from({ length: tray.capacity }, (_, index) => `<i class="${index < filled ? 'sown' : ''}" title="${index < filled ? 'Semilla sembrada' : 'Espacio vacío'}">${index < filled ? '✿' : '·'}</i>`).join('');
  return `<article class="tray-card"><div class="tray-card-head"><div><small>CHAROLA · ${escapeHTML(tray.size)}</small><h3>${escapeHTML(tray.name)}</h3></div><span class="tray-stage">${stageFor(days)} · DÍA ${days + 1}</span></div><div class="tray-meta"><span>🌱 <b>${escapeHTML(tray.seed)}</b></span><span>▧ Sustrato: <b>${escapeHTML(tray.substrate)}</b></span><span>◉ Siembra: <b>${escapeHTML(tray.sown)}</b></span></div><div class="tray-cells" style="--tray-cols:${Math.min(12, Math.ceil(Math.sqrt(tray.capacity)))}">${cells}</div><div class="tray-card-foot"><span>${filled} / ${tray.capacity} celdas sembradas</span><button class="link-button" type="button" data-edit-tray="${escapeHTML(tray.id)}">EDITAR</button><button class="link-button remove-tray" type="button" data-remove-tray="${escapeHTML(tray.id)}">ELIMINAR</button></div></article>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function todayISO() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function safeStorage() {
  try { return globalThis.localStorage; }
  catch { return { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
}
