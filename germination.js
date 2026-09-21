export const TRAY_STORAGE_KEY = 'pony.germination.trays.v1';
export const MAX_TRAY_CELLS = 240;
export const PLANT_ICONS = [
  { key: 'seedling', label: 'Planta', symbol: '🌱' },
  { key: 'tomato', label: 'Tomate', symbol: '🍅' },
  { key: 'lettuce', label: 'Lechuga', symbol: '🥬' },
  { key: 'basil', label: 'Albahaca', symbol: '🌿' },
  { key: 'pepper', label: 'Chile', symbol: '🌶️' },
  { key: 'strawberry', label: 'Fresa', symbol: '🍓' },
  { key: 'cucumber', label: 'Pepino', symbol: '🥒' },
];
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
};
const validDateTime = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [date, time] = value.split('T');
  const [hour, minute] = time.split(':').map(Number);
  return validDate(date) && hour < 24 && minute < 60;
};

function normalizeWatering(value) {
  if (!value || typeof value !== 'object' || !validDateTime(value.at)) return null;
  const amountMl = value.amountMl === '' || value.amountMl == null ? null : Number(value.amountMl);
  if (amountMl !== null && (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 10000)) return null;
  return {
    at: value.at,
    amountMl,
    note: typeof value.note === 'string' ? value.note.trim().slice(0, 160) : '',
  };
}

export function normalizeTray(value) {
  if (!value || typeof value !== 'object') return null;
  const legacyCapacity = Number(value.capacity);
  const legacySeeded = Number(value.seeded ?? 0);
  const text = key => typeof value[key] === 'string' ? value[key].trim().slice(0, key === 'name' ? 32 : 100) : '';
  const id = typeof value.id === 'string' ? value.id.slice(0, 100) : '';
  let rows = Number(value.rows);
  let columns = Number(value.columns);
  if (!(Number.isInteger(rows) && rows > 0 && Number.isInteger(columns) && columns > 0)) {
    const match = text('size').match(/^(\d+)\s*[x×]\s*(\d+)$/i);
    if (match) [rows, columns] = [Number(match[1]), Number(match[2])];
    else {
      columns = Number.isInteger(legacyCapacity) && legacyCapacity > 0 ? Math.ceil(Math.sqrt(legacyCapacity)) : 1;
      rows = Number.isInteger(legacyCapacity) && legacyCapacity > 0 ? Math.ceil(legacyCapacity / columns) : 1;
    }
  }
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return null;
  // The dimensions are authoritative. A stale legacy capacity must never silently
  // change the requested row count (or turn a rectangle into a different shape).
  const capacity = rows * columns;
  const tray = {
    id, name: text('name'), size: `${rows}×${columns}`, rows, columns, capacity,
    seed: text('seed'), substrate: text('substrate'),
    sown: typeof value.sown === 'string' ? value.sown : '',
  };
  if (!tray.id || !tray.name || !tray.size || !tray.seed || !tray.substrate) return null;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_TRAY_CELLS) return null;
  if (Number.isInteger(legacyCapacity) && legacyCapacity < 1) return null;
  if (!Array.isArray(value.cellSeeds) && (!Number.isInteger(legacySeeded) || legacySeeded < 0 || legacySeeded > capacity)) return null;
  if (!validDate(tray.sown)) return null;
  tray.cellSeeds = Array.isArray(value.cellSeeds)
    ? Array.from({ length: capacity }, (_, index) => {
      const seed = value.cellSeeds[index];
      return typeof seed === 'string' && seed.trim() ? seed.trim().slice(0, 100) : null;
    })
    : Array.from({ length: capacity }, (_, index) => index < legacySeeded && tray.seed ? tray.seed : null);
  tray.cellIcons = tray.cellSeeds.map((seed, index) => seed
    ? (PLANT_ICONS.some(icon => icon.key === value.cellIcons?.[index]) ? value.cellIcons[index] : inferPlantIcon(seed))
    : null);
  tray.cellPlantedAt = tray.cellSeeds.map((seed, index) => seed
    ? (validDate(value.cellPlantedAt?.[index]) ? value.cellPlantedAt[index] : tray.sown)
    : null);
  tray.cellWaterings = tray.cellSeeds.map((seed, index) => seed && Array.isArray(value.cellWaterings?.[index])
    ? value.cellWaterings[index].map(normalizeWatering).filter(Boolean).slice(-100)
    : []);
  tray.seeded = tray.cellSeeds.filter(Boolean).length;
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

export function cellGrowthStage(days) {
  if (days < 3) return { key: 'seed', label: 'SEMILLA' };
  if (days < 8) return { key: 'sprout', label: 'BROTE' };
  return { key: 'plant', label: days < 18 ? 'PLÁNTULA' : 'LISTA PARA TRASPLANTE' };
}

export function inferPlantIcon(seedName) {
  const name = String(seedName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/fresa|strawberr/.test(name)) return 'strawberry';
  if (/lechuga|arugula|espinaca|kale/.test(name)) return 'lettuce';
  if (/menta|hierbabuena|albahaca|cilantro|romero|perejil|oregano|basil/.test(name)) return 'basil';
  if (/chile|pimiento|jalap|serrano|pepper/.test(name)) return 'pepper';
  if (/pepino|cucumber/.test(name)) return 'cucumber';
  if (/tomate|jitomate|tomato/.test(name)) return 'tomato';
  return 'seedling';
}

export function assignSeedsToCells(value, indices, { seed, icon, plantedAt }) {
  const tray = normalizeTray(value);
  const seedName = String(seed || '').trim().slice(0, 100);
  const uniqueIndices = [...new Set(indices)];
  if (!tray || !seedName || !PLANT_ICONS.some(item => item.key === icon) || !validDate(plantedAt)) {
    throw new TypeError('Revisa la semilla, icono y fecha de siembra.');
  }
  if (!uniqueIndices.length || uniqueIndices.some(index => !Number.isInteger(index) || index < 0 || index >= tray.capacity)) {
    throw new RangeError('Selecciona celdas válidas de la charola.');
  }
  const cellSeeds = [...tray.cellSeeds];
  const cellIcons = [...tray.cellIcons];
  const cellPlantedAt = [...tray.cellPlantedAt];
  for (const index of uniqueIndices) {
    cellSeeds[index] = seedName;
    cellIcons[index] = icon;
    cellPlantedAt[index] = plantedAt;
  }
  return normalizeTray({ ...tray, cellSeeds, cellIcons, cellPlantedAt });
}

export function moveCell(value, sourceIndex, destinationIndex) {
  const tray = normalizeTray(value);
  if (!tray || !Number.isInteger(sourceIndex) || !Number.isInteger(destinationIndex)
    || sourceIndex < 0 || sourceIndex >= tray.capacity || destinationIndex < 0 || destinationIndex >= tray.capacity) {
    throw new RangeError('Selecciona dos celdas válidas de la charola.');
  }
  if (sourceIndex === destinationIndex) return tray;
  if (!tray.cellSeeds[sourceIndex]) throw new TypeError('La celda de origen está vacía.');
  if (tray.cellSeeds[destinationIndex]) throw new TypeError('Elige una celda de destino vacía.');
  const cellSeeds = [...tray.cellSeeds];
  const cellIcons = [...tray.cellIcons];
  const cellPlantedAt = [...tray.cellPlantedAt];
  const cellWaterings = tray.cellWaterings.map(history => [...history]);
  cellSeeds[destinationIndex] = cellSeeds[sourceIndex];
  cellIcons[destinationIndex] = cellIcons[sourceIndex];
  cellPlantedAt[destinationIndex] = cellPlantedAt[sourceIndex];
  cellWaterings[destinationIndex] = cellWaterings[sourceIndex];
  cellSeeds[sourceIndex] = null;
  cellIcons[sourceIndex] = null;
  cellPlantedAt[sourceIndex] = null;
  cellWaterings[sourceIndex] = [];
  return normalizeTray({ ...tray, cellSeeds, cellIcons, cellPlantedAt, cellWaterings });
}

export function waterCells(value, indices, watering) {
  const tray = normalizeTray(value);
  const uniqueIndices = [...new Set(indices)];
  const entry = normalizeWatering(watering);
  if (!tray || !entry) throw new TypeError('Revisa la fecha y cantidad de agua.');
  if (!uniqueIndices.length || uniqueIndices.some(index => !Number.isInteger(index) || index < 0 || index >= tray.capacity)) {
    throw new RangeError('Selecciona celdas válidas de la charola.');
  }
  if (uniqueIndices.some(index => !tray.cellSeeds[index])) throw new TypeError('El riego solo se puede registrar en celdas sembradas.');
  const cellWaterings = tray.cellWaterings.map(history => [...history]);
  for (const index of uniqueIndices) {
    cellWaterings[index] = [...cellWaterings[index], entry].sort((left, right) => left.at.localeCompare(right.at)).slice(-100);
  }
  return normalizeTray({ ...tray, cellWaterings });
}

export function resizeTray(value, rows, columns) {
  const tray = normalizeTray(value);
  if (!tray || !Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
    throw new TypeError('Indica filas y columnas válidas.');
  }
  if (rows * columns > MAX_TRAY_CELLS) throw new RangeError(`La charola no puede superar ${MAX_TRAY_CELLS} celdas.`);
  return normalizeTray({ ...tray, rows, columns, size: `${rows}×${columns}`, capacity: rows * columns });
}

export function mountGermination(document, ui, storage = safeStorage()) {
  const addButton = document.querySelector('#addTray');
  const list = document.querySelector('#trayList');
  const summary = document.querySelector('#germinationSummary');
  if (!addButton || !list || !summary) return;

  const repository = createTrayRepository(storage);
  let trays = repository.read();
  let multiSelectTrayId = '';
  let selectedCells = new Set();
  let moveTrayId = '';
  let moveSourceIndex = null;

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
    const planted = trays.reduce((total, tray) => total + tray.cellSeeds.filter(Boolean).length, 0);
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
    list.innerHTML = trays.map(tray => renderTray(tray, {
      multiSelecting: multiSelectTrayId === tray.id,
      selectedCells: multiSelectTrayId === tray.id ? selectedCells : new Set(),
      moving: moveTrayId === tray.id,
      moveSourceIndex: moveTrayId === tray.id ? moveSourceIndex : null,
    })).join('');
  }

  function openForm(tray) {
    const editing = Boolean(tray);
    const rows = tray?.rows ?? 8;
    const columns = tray?.columns ?? 9;
    ui.showDialog(`<form class="detail-content tray-form" id="trayForm"><div class="subtitle">SIMULADOR DE SIEMBRA</div><h2>${editing ? 'EDITAR CHAROLA' : 'NUEVA CHAROLA'}</h2><label>Nombre<input name="name" required maxlength="32" placeholder="Ej. Tomates" value="${escapeHTML(tray?.name || '')}"></label><fieldset class="dimension-picker"><legend>Tamaño de la charola</legend><div class="dimension-fields"><label>Filas<span class="dimension-stepper"><input name="rows" type="number" required min="1" max="${MAX_TRAY_CELLS}" value="${rows}"><button type="button" data-add-dimension="rows" aria-label="Agregar una fila">+</button></span></label><label>Columnas<span class="dimension-stepper"><input name="columns" type="number" required min="1" max="${MAX_TRAY_CELLS}" value="${columns}"><button type="button" data-add-dimension="columns" aria-label="Agregar una columna">+</button></span></label></div><output class="dimension-capacity" aria-live="polite">${rows * columns} celdas</output><small>Máximo ${MAX_TRAY_CELLS} celdas por charola.</small></fieldset><label>Semilla sugerida<input name="seed" required maxlength="100" placeholder="Ej. Jitomate cherry" value="${escapeHTML(tray?.seed || '')}"></label><label>Sustrato<input name="substrate" required maxlength="100" placeholder="Ej. Fibra de coco + perlita" value="${escapeHTML(tray?.substrate || '')}"></label><label>Fecha de siembra<input name="sown" required type="date" value="${tray?.sown || todayISO()}"></label><div class="detail-actions"><button class="pixel-action" type="submit">GUARDAR CHAROLA</button></div></form>`);
    const form = document.querySelector('#trayForm');
    const rowInput = form?.elements.namedItem('rows');
    const columnInput = form?.elements.namedItem('columns');
    const capacityOutput = form?.querySelector('.dimension-capacity');
    const updateCapacity = () => {
      const rowCount = Number(rowInput.value);
      const columnCount = Number(columnInput.value);
      const valid = Number.isInteger(rowCount) && rowCount > 0 && Number.isInteger(columnCount) && columnCount > 0 && rowCount * columnCount <= MAX_TRAY_CELLS;
      capacityOutput.textContent = valid ? `${rowCount * columnCount} celdas` : `Máximo ${MAX_TRAY_CELLS} celdas`;
      form.querySelectorAll('[data-add-dimension]').forEach(button => {
        const input = button.dataset.addDimension === 'rows' ? rowInput : columnInput;
        button.disabled = !valid || (Number(input.value) + 1) * Number(button.dataset.addDimension === 'rows' ? columnInput.value : rowInput.value) > MAX_TRAY_CELLS;
      });
    };
    form?.addEventListener('input', event => {
      if (event.target === rowInput || event.target === columnInput) updateCapacity();
    });
    form?.addEventListener('click', event => {
      const button = event.target.closest('[data-add-dimension]');
      if (!button || button.disabled) return;
      const input = button.dataset.addDimension === 'rows' ? rowInput : columnInput;
      input.value = String(Number(input.value) + 1);
      updateCapacity();
    });
    updateCapacity();
    form?.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      values.rows = Number(values.rows);
      values.columns = Number(values.columns);
      values.capacity = values.rows * values.columns;
      values.size = `${values.rows}×${values.columns}`;
      let trayData;
      try {
        trayData = resizeTray({
          ...values, id: tray?.id || defaultId(),
          cellSeeds: tray?.cellSeeds || [], cellIcons: tray?.cellIcons || [], cellPlantedAt: tray?.cellPlantedAt || [], cellWaterings: tray?.cellWaterings || [],
        }, values.rows, values.columns);
      } catch (error) {
        ui.toast(error?.message || 'Revisa el tamaño y los datos de la charola.');
        return;
      }
      if (!trayData) {
        ui.toast('Revisa la capacidad y los datos de la charola.');
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

  function openCellForm(tray, index) {
    let currentTray = tray;
    const currentSeed = tray.cellSeeds[index] || '';
    const currentIcon = tray.cellIcons[index] || inferPlantIcon(currentSeed || tray.seed);
    const history = tray.cellWaterings[index] || [];
    const renderHistory = entries => entries.length
      ? `<ul class="watering-history-list">${[...entries].reverse().map(entry => `<li><time>${escapeHTML(formatWateringDateTime(entry.at))}</time>${entry.amountMl === null ? '' : `<b>${entry.amountMl} ml</b>`}${entry.note ? `<span>${escapeHTML(entry.note)}</span>` : ''}</li>`).join('')}</ul>`
      : '<p class="cell-form-hint">Todavía no hay riegos registrados.</p>';
    const iconOptions = PLANT_ICONS.map(icon => `<label class="plant-icon-option"><input type="radio" name="icon" value="${icon.key}" ${currentIcon === icon.key ? 'checked' : ''}><span>${icon.symbol}</span><small>${icon.label}</small></label>`).join('');
    const wateringSection = currentSeed ? `<fieldset class="watering-panel"><legend>RIEGOS REGISTRADOS · ${history.length}</legend><div id="cellWateringHistory">${renderHistory(history)}</div>${wateringInputsHTML()}<div class="detail-actions"><button class="pixel-action" type="button" id="recordWatering">REGISTRAR RIEGO</button></div></fieldset>` : '';
    ui.showDialog(`<form class="detail-content tray-form" id="cellForm"><div class="subtitle">CHAROLA · ${escapeHTML(tray.name)}</div><h2>CELDA ${index + 1}</h2><label>Semilla / variedad<input name="seed" maxlength="100" placeholder="Ej. Lechuga romana" value="${escapeHTML(currentSeed || tray.seed)}"></label><fieldset class="icon-picker"><legend>Icono de la planta</legend><div class="plant-icon-options">${iconOptions}</div></fieldset><label>Fecha de siembra<input name="plantedAt" type="date" required value="${tray.cellPlantedAt[index] || tray.sown || todayISO()}"></label><p class="cell-form-hint">La celda empieza como semilla y evoluciona con los días.</p>${wateringSection}<div class="detail-actions"><button class="pixel-action" type="submit">GUARDAR CELDA</button><button class="link-button" type="button" id="clearCell">VACIAR CELDA</button></div></form>`);
    const form = document.querySelector('#cellForm');
    const saveCell = (seed, icon = currentIcon, plantedAt = tray.sown) => {
      const cellSeeds = [...currentTray.cellSeeds];
      const cellIcons = [...currentTray.cellIcons];
      const cellPlantedAt = [...currentTray.cellPlantedAt];
      const cellWaterings = currentTray.cellWaterings.map(events => [...events]);
      cellSeeds[index] = seed || null;
      cellIcons[index] = seed ? icon : null;
      cellPlantedAt[index] = seed ? plantedAt : null;
      if (!seed) cellWaterings[index] = [];
      try {
        const next = repository.save({ ...currentTray, cellSeeds, cellIcons, cellPlantedAt, cellWaterings }, currentTray.id);
        if (apply(next)) ui.closeDialog();
      } catch {
        ui.toast('No se pudo guardar esta celda.');
      }
    };
    form?.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      saveCell(values.get('seed').trim(), values.get('icon'), values.get('plantedAt'));
    });
    document.querySelector('#clearCell')?.addEventListener('click', () => saveCell(''));
    document.querySelector('#recordWatering')?.addEventListener('click', () => {
      const dateInput = form.elements.namedItem('wateringDate');
      const timeInput = form.elements.namedItem('wateringTime');
      if (!dateInput.value || !timeInput.value) {
        ui.toast('Indica la fecha y hora del riego.');
        return;
      }
      const values = new FormData(form);
      try {
        const updated = waterCells(currentTray, [index], {
          at: `${values.get('wateringDate')}T${values.get('wateringTime')}`,
          amountMl: values.get('amountMl'), note: values.get('wateringNote'),
        });
        const next = repository.save(updated, currentTray.id);
        const savedTray = next.find(item => item.id === currentTray.id);
        if (apply(next)) {
          currentTray = savedTray;
          document.querySelector('#cellWateringHistory').innerHTML = renderHistory(savedTray.cellWaterings[index]);
          document.querySelector('.watering-panel legend').textContent = `RIEGOS REGISTRADOS · ${savedTray.cellWaterings[index].length}`;
          const newWateringTime = localDateTimeInputValue();
          form.elements.namedItem('wateringDate').value = newWateringTime.date;
          form.elements.namedItem('wateringTime').value = newWateringTime.time;
          form.elements.namedItem('amountMl').value = '';
          form.elements.namedItem('wateringNote').value = '';
          ui.toast('Riego registrado.');
        }
      } catch (error) {
        ui.toast(error?.message || 'No se pudo registrar el riego.');
      }
    });
  }

  function openBulkCellForm(tray) {
    const indices = [...selectedCells].sort((left, right) => left - right);
    if (indices.length === 0) return;
    const icon = inferPlantIcon(tray.seed);
    const iconOptions = PLANT_ICONS.map(item => `<label class="plant-icon-option"><input type="radio" name="icon" value="${item.key}" ${icon === item.key ? 'checked' : ''}><span>${item.symbol}</span><small>${item.label}</small></label>`).join('');
    ui.showDialog(`<form class="detail-content tray-form" id="bulkCellForm"><div class="subtitle">${escapeHTML(tray.name)} · ${indices.length} CELDAS</div><h2>SEMBRAR SELECCIÓN</h2><label>Semilla / variedad<input name="seed" required maxlength="100" value="${escapeHTML(tray.seed)}"></label><fieldset class="icon-picker"><legend>Icono de la planta</legend><div class="plant-icon-options">${iconOptions}</div></fieldset><label>Fecha de siembra<input name="plantedAt" type="date" required value="${tray.sown || todayISO()}"></label><p class="cell-form-hint">Se aplicará a las ${indices.length} celdas seleccionadas.</p><div class="detail-actions"><button class="pixel-action" type="submit">SEMBRAR ${indices.length} CELDAS</button></div></form>`);
    const form = document.querySelector('#bulkCellForm');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      let next;
      try {
        const updated = assignSeedsToCells(tray, indices, {
          seed: values.get('seed'), icon: values.get('icon'), plantedAt: values.get('plantedAt'),
        });
        next = repository.save(updated, tray.id);
      } catch (error) {
        ui.toast(error?.message || 'No se pudieron llenar las celdas.');
        return;
      }
      multiSelectTrayId = '';
      selectedCells = new Set();
      if (apply(next)) {
        ui.closeDialog();
        ui.toast(`${indices.length} celdas sembradas.`);
      }
    });
  }

  addButton.addEventListener('click', () => openForm());
  document.defaultView?.addEventListener('storage', event => {
    if (event.key !== TRAY_STORAGE_KEY) return;
    trays = repository.read();
    render();
  });
  list.addEventListener('click', event => {
    const selectionMode = event.target.closest('[data-cell-selection]');
    const moveMode = event.target.closest('[data-cell-move]');
    const cancelMove = event.target.closest('[data-cancel-cell-move]');
    const bulkPlant = event.target.closest('[data-plant-selected]');
    const bulkWater = event.target.closest('[data-water-selected]');
    const clearSelection = event.target.closest('[data-clear-selection]');
    const cell = event.target.closest('[data-cell-index]');
    const edit = event.target.closest('[data-edit-tray]');
    const remove = event.target.closest('[data-remove-tray]');
    if (selectionMode) {
      moveTrayId = '';
      moveSourceIndex = null;
      if (multiSelectTrayId === selectionMode.dataset.cellSelection) {
        multiSelectTrayId = '';
        selectedCells = new Set();
      } else {
        multiSelectTrayId = selectionMode.dataset.cellSelection;
        selectedCells = new Set();
      }
      render();
      return;
    }
    if (moveMode) {
      multiSelectTrayId = '';
      selectedCells = new Set();
      if (moveTrayId === moveMode.dataset.cellMove) {
        moveTrayId = '';
        moveSourceIndex = null;
      } else {
        moveTrayId = moveMode.dataset.cellMove;
        moveSourceIndex = null;
      }
      render();
      return;
    }
    if (cancelMove) {
      moveTrayId = '';
      moveSourceIndex = null;
      render();
      return;
    }
    if (bulkPlant) {
      const tray = trays.find(item => item.id === bulkPlant.dataset.plantSelected);
      if (tray) openBulkCellForm(tray);
      return;
    }
    if (bulkWater) {
      const tray = trays.find(item => item.id === bulkWater.dataset.waterSelected);
      const indices = tray ? [...selectedCells].filter(index => tray.cellSeeds[index]).sort((a, b) => a - b) : [];
      if (!tray || !indices.length) {
        ui.toast('Selecciona al menos una celda sembrada.');
        return;
      }
      const now = localDateTimeInputValue();
      try {
        const updated = waterCells(tray, indices, {
          at: `${now.date}T${now.time}`, amountMl: null, note: '',
        });
        const next = repository.save(updated, tray.id);
        selectedCells = new Set();
        if (apply(next)) ui.toast(`Riego registrado en ${indices.length} celdas.`);
      } catch (error) {
        ui.toast(error?.message || 'No se pudieron registrar los riegos.');
      }
      return;
    }
    if (clearSelection) {
      selectedCells.clear();
      render();
      return;
    }
    if (cell) {
      const tray = trays.find(item => item.id === cell.dataset.trayId);
      if (tray && moveTrayId === tray.id) {
        const index = Number(cell.dataset.cellIndex);
        if (moveSourceIndex === null) {
          if (!tray.cellSeeds[index]) {
            ui.toast('Primero toca una celda sembrada para elegir el origen.');
            return;
          }
          moveSourceIndex = index;
          render();
        } else if (moveSourceIndex === index) {
          moveSourceIndex = null;
          render();
        } else {
          try {
            const updated = moveCell(tray, moveSourceIndex, index);
            const next = repository.save(updated, tray.id);
            moveSourceIndex = null;
            if (apply(next)) ui.toast('Celda movida.');
          } catch (error) {
            ui.toast(error?.message || 'No se pudo mover la celda.');
          }
        }
      } else if (tray && multiSelectTrayId === tray.id) {
        const index = Number(cell.dataset.cellIndex);
        if (selectedCells.has(index)) selectedCells.delete(index);
        else selectedCells.add(index);
        render();
      } else if (tray) {
        openCellForm(tray, Number(cell.dataset.cellIndex));
      }
      return;
    }
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

export function renderTray(tray, { multiSelecting = false, selectedCells = new Set(), moving = false, moveSourceIndex = null } = {}) {
  const filled = tray.cellSeeds.filter(Boolean).length;
  const days = daysSince(tray.sown);
  const cells = tray.cellSeeds.map((seed, index) => {
    const selected = selectedCells.has(index);
    const movingSource = moving && moveSourceIndex === index;
    const stateClass = `${selected ? ' selected-cell' : ''}${movingSource ? ' move-source-cell' : ''}`;
    if (!seed) return `<button class="tray-cell${stateClass}" type="button" data-tray-id="${escapeHTML(tray.id)}" data-cell-index="${index}" aria-pressed="${selected || movingSource}" title="Celda ${index + 1}: vacía${moving ? (moveSourceIndex === null ? ', elige primero una celda sembrada' : ', destino disponible') : multiSelecting ? (selected ? ', seleccionada' : ', toca para seleccionar') : ''}" aria-label="Celda ${index + 1}: vacía${moving ? (moveSourceIndex === null ? ', elige primero una celda sembrada' : ', destino disponible') : multiSelecting ? (selected ? ', seleccionada' : ', toca para seleccionar') : ''}">·</button>`;
    const plantedAt = tray.cellPlantedAt[index] || tray.sown;
    const age = daysSince(plantedAt);
    const stage = cellGrowthStage(age);
    const icon = PLANT_ICONS.find(item => item.key === tray.cellIcons[index]) || PLANT_ICONS[0];
    const visual = stage.key === 'seed'
      ? '<span class="growth-sprite growth-seed"><i></i></span>'
      : stage.key === 'sprout'
        ? '<span class="growth-sprite growth-sprout"><i></i><b></b><b></b></span>'
        : `<span class="growth-sprite growth-plant">${icon.symbol}</span>`;
    const seedIndicator = stage.key === 'plant' ? '' : `<span class="crop-badge" aria-hidden="true">${icon.symbol}</span>`;
    const waterings = tray.cellWaterings?.[index] || [];
    const lastWatering = waterings.at(-1);
    const lastWateringLabel = lastWatering ? formatWateringDateTime(lastWatering.at) : '';
    const waterBadge = lastWatering ? `<span class="cell-water-indicator" title="Último riego: ${escapeHTML(lastWateringLabel)}" aria-label="Último riego ${escapeHTML(lastWateringLabel)}">💧</span>` : '';
    const label = `Celda ${index + 1}: ${seed}, ${stage.label.toLowerCase()}, día ${age + 1}${lastWatering ? `, último riego ${lastWateringLabel}` : ''}`;
    const cellLabel = `${label}${moving ? (movingSource ? ', origen seleccionado' : moveSourceIndex === null ? ', toca para seleccionar como origen' : ', destino ocupado') : multiSelecting ? (selected ? ', seleccionada' : ', toca para seleccionar') : ''}`;
    return `<button class="tray-cell sown${stateClass}" type="button" data-tray-id="${escapeHTML(tray.id)}" data-cell-index="${index}" aria-pressed="${selected || movingSource}" title="${escapeHTML(cellLabel)}" aria-label="${escapeHTML(cellLabel)}"><span class="cell-icon-box">${visual}${seedIndicator}</span><small>${escapeHTML(seed)}</small>${waterBadge}</button>`;
  }).join('');
  const selectedCount = selectedCells.size;
  const selectedPlantedCount = [...selectedCells].filter(index => tray.cellSeeds[index]).length;
  const selectionToolbar = multiSelecting ? `<div class="cell-selection-toolbar"><span aria-live="polite">${selectedCount} CELDAS · ${selectedPlantedCount} SEMBRADAS</span><button class="pixel-action watering-action" type="button" data-water-selected="${escapeHTML(tray.id)}" aria-label="Regar ${selectedPlantedCount} celdas sembradas" title="Registrar riego ahora en las celdas sembradas seleccionadas" ${selectedPlantedCount ? '' : 'disabled'}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 20h20a4 4 0 0 1 4 4v14H9zM13 20v-4a7 7 0 0 1 14 0v4M33 24l8-5 3 4-11 8M9 25H4v9h5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="round"/><path d="M39 12v2m5 1-1 2m-9-4 1 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/></svg><span>REGAR SELECCIONADAS</span></button><button class="pixel-action" type="button" data-plant-selected="${escapeHTML(tray.id)}" ${selectedCount ? '' : 'disabled'}>SEMBRAR SELECCIONADAS</button><button class="link-button" type="button" data-clear-selection="${escapeHTML(tray.id)}" ${selectedCount ? '' : 'disabled'}>LIMPIAR</button></div>` : '';
  const moveToolbar = moving ? `<div class="cell-selection-toolbar move-cell-toolbar"><span aria-live="polite">${moveSourceIndex === null ? 'ELIGE UNA CELDA SEMBRADA COMO ORIGEN' : `ORIGEN: CELDA ${moveSourceIndex + 1} · ELIGE UN DESTINO VACÍO`}</span><button class="link-button" type="button" data-cancel-cell-move="${escapeHTML(tray.id)}">CANCELAR</button></div>` : '';
  return `<article class="tray-card"><div class="tray-card-head"><div><small>CHAROLA · ${escapeHTML(tray.size)}</small><h3>${escapeHTML(tray.name)}</h3></div><span class="tray-stage">${stageFor(days)} · DÍA ${days + 1}</span></div><div class="tray-meta"><span>🌱 <b>${escapeHTML(tray.seed)}</b></span><span>▧ Sustrato: <b>${escapeHTML(tray.substrate)}</b></span><span>◉ Siembra: <b>${escapeHTML(tray.sown)}</b></span></div><div class="tray-cells" style="--tray-cols:${tray.columns}">${cells}</div>${selectionToolbar}${moveToolbar}<div class="tray-card-foot"><span>${filled} / ${tray.capacity} celdas sembradas</span><button class="link-button" type="button" data-cell-move="${escapeHTML(tray.id)}" aria-pressed="${moving}">${moving ? 'CANCELAR MOVER' : 'MOVER CELDAS'}</button><button class="link-button" type="button" data-cell-selection="${escapeHTML(tray.id)}" aria-pressed="${multiSelecting}">${multiSelecting ? 'CANCELAR SELECCIÓN' : 'SELECCIONAR CELDAS'}</button><button class="link-button" type="button" data-edit-tray="${escapeHTML(tray.id)}">EDITAR</button><button class="link-button remove-tray" type="button" data-remove-tray="${escapeHTML(tray.id)}">ELIMINAR</button></div></article>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function todayISO() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function localDateTimeInputValue(now = new Date()) {
  const value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { date: value.slice(0, 10), time: value.slice(11) };
}

function wateringInputsHTML() {
  const value = localDateTimeInputValue();
  return `<div class="watering-fields"><label>Fecha<input lang="es-MX" name="wateringDate" type="date" value="${value.date}"></label><label>Hora<input lang="es-MX" name="wateringTime" type="time" value="${value.time}"></label><label>Cantidad (ml, opcional)<input name="amountMl" type="number" step="any" placeholder="Ej. 20"></label><label>Nota (opcional)<input name="wateringNote" maxlength="160" placeholder="Ej. Humedecí el sustrato"></label></div>`;
}

function formatWateringDateTime(value) {
  if (!validDateTime(value)) return value;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} · ${time}`;
}

function safeStorage() {
  try { return globalThis.localStorage; }
  catch { return { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
}
