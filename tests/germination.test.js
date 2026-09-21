import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignSeedsToCells, cellGrowthStage, createTrayRepository, daysSince, inferPlantIcon, moveCell, normalizeTray, renderTray, resizeTray, stageFor, trayPlantingAgeLabel, TRAY_STORAGE_KEY, waterCells, wateringAgeLabel,
} from '../germination.js';
import { resolveDestination } from '../navigation.js';

const sample = {
  id: 'tray-a', name: 'Tomate', size: '6×12', capacity: 72,
  seed: 'Cherry', substrate: 'Coco', seeded: 40, sown: '2026-09-20',
};

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    inspect: key => data.get(key),
  };
}

test('normalizes valid tray values and rejects corrupt/unsafe fields', () => {
  const normalized = normalizeTray(sample);
  assert.equal(normalized.seeded, 40);
  assert.equal(normalized.cellSeeds.length, 72);
  assert.equal(normalized.cellSeeds[0], 'Cherry');
  assert.equal(normalized.cellSeeds[40], null);
  assert.equal(normalized.cellIcons[0], 'seedling');
  assert.equal(normalized.cellPlantedAt[0], sample.sown);
  assert.equal(normalized.rows, 6);
  assert.equal(normalized.columns, 12);
  const legacyMismatch = normalizeTray({ ...sample, size: '9×10', capacity: 72 });
  assert.equal(legacyMismatch.capacity, 90);
  assert.equal(legacyMismatch.cellSeeds[39], 'Cherry');
  assert.equal(legacyMismatch.cellSeeds[72], null);
  const rectangle = normalizeTray({ ...sample, size: '9×14', capacity: 126, seeded: 0 });
  assert.equal(rectangle.rows, 9);
  assert.equal(rectangle.columns, 14);
  assert.equal(rectangle.capacity, 126);
  assert.match(renderTray(rectangle), /--tray-cols:14/);
  assert.equal(normalizeTray({ ...sample, size: '9×12', capacity: 126 }).capacity, 108);
  assert.equal(normalizeTray({ ...sample, cellSeeds: ['Cherry', null, 'Romaine'] }).seeded, 2);
  const iconData = normalizeTray({ ...sample, size: '1×2', capacity: 2, seeded: 0,
    cellSeeds: ['Arugula', 'Romaine'], cellIcons: ['basil', 'unknown'],
    cellPlantedAt: ['2026-09-19', 'bad-date'] });
  assert.deepEqual(iconData.cellIcons, ['basil', 'seedling']);
  assert.deepEqual(iconData.cellPlantedAt, ['2026-09-19', sample.sown]);
  assert.equal(inferPlantIcon('Fresa'), 'strawberry');
  assert.equal(inferPlantIcon('Menta'), 'basil');
  assert.equal(normalizeTray({ ...sample, size: '1×2', cellSeeds: ['Cherry', null, 'Romaine'], capacity: 2 }).cellSeeds.length, 2);
  assert.equal(normalizeTray({ ...sample, size: '16×16', capacity: 241 }), null);
  assert.equal(normalizeTray({ ...sample, seeded: -1 }), null);
  assert.equal(normalizeTray({ ...sample, seeded: 73 }), null);
  assert.equal(normalizeTray({ ...sample, sown: '2026-02-31' }), null);
  assert.equal(normalizeTray({ ...sample, name: '' }), null);
});

test('resizes trays by rows and columns while preserving planted cell metadata', () => {
  const tray = normalizeTray({ ...sample, cellSeeds: ['Menta', null, ...Array(70).fill(null)],
    cellIcons: ['basil'], cellPlantedAt: ['2026-09-19'],
    cellWaterings: [[{ at: '2026-09-20T08:00', amountMl: 20, note: '' }]] });
  const enlarged = resizeTray(tray, 7, 12);
  assert.equal(enlarged.size, '7×12');
  assert.equal(enlarged.capacity, 84);
  assert.equal(enlarged.cellSeeds[0], 'Menta');
  assert.equal(enlarged.cellIcons[0], 'basil');
  assert.equal(enlarged.cellPlantedAt[0], '2026-09-19');
  assert.deepEqual(enlarged.cellWaterings[0], [{ at: '2026-09-20T08:00', amountMl: 20, note: '' }]);
  assert.equal(enlarged.cellSeeds[83], null);
  assert.throws(() => resizeTray(tray, 21, 12), RangeError);
  assert.throws(() => resizeTray(tray, 0, 12), TypeError);
});

test('repository reads malformed JSON safely and filters malformed entries', () => {
  const storage = memoryStorage({ [TRAY_STORAGE_KEY]: '{broken' });
  const repository = createTrayRepository(storage);
  assert.deepEqual(repository.read(), []);

  storage.setItem(TRAY_STORAGE_KEY, JSON.stringify([sample, { ...sample, id: '' }, { ...sample, name: 'Duplicada' }]));
  assert.equal(repository.read().length, 1);
  assert.equal(repository.read()[0].name, 'Duplicada');
});

test('repository creates, updates, and removes trays without duplicate records', () => {
  const repository = createTrayRepository(memoryStorage(), { makeId: () => 'new-id' });
  assert.deepEqual(repository.save({ ...sample, id: '' }).map(tray => tray.id), ['new-id']);
  assert.equal(repository.save({ ...sample, name: 'Editado' }, 'new-id').length, 1);
  assert.equal(repository.read()[0].name, 'Editado');
  assert.deepEqual(repository.remove('new-id'), []);
});

test('stores individual seed assignments and derives seeded count from cells', () => {
  const repository = createTrayRepository(memoryStorage());
  const blank = Array(72).fill(null);
  const [created] = repository.save({ ...sample, id: 'cells', seeded: 0, cellSeeds: blank });
  const cellSeeds = [...created.cellSeeds];
  cellSeeds[4] = 'Albahaca genovesa';
  cellSeeds[11] = 'Lechuga romana';
  const [updated] = repository.save({ ...created, cellSeeds }, 'cells');
  assert.equal(updated.seeded, 2);
  assert.equal(updated.cellSeeds[4], 'Albahaca genovesa');
  assert.equal(updated.cellSeeds[11], 'Lechuga romana');
  const cleared = [...updated.cellSeeds];
  cleared[4] = null;
  const [afterClear] = repository.save({ ...updated, cellSeeds: cleared }, 'cells');
  assert.equal(afterClear.seeded, 1);
});

test('bulk planting fills multiple unique cells and keeps other cells unchanged', () => {
  const tray = normalizeTray({ ...sample, id: 'bulk', seeded: 0, cellSeeds: Array(72).fill(null) });
  const updated = assignSeedsToCells(tray, [1, 4, 7, 4], {
    seed: 'Menta', icon: 'basil', plantedAt: '2026-09-20',
  });
  assert.equal(updated.seeded, 3);
  assert.deepEqual([updated.cellSeeds[1], updated.cellSeeds[4], updated.cellSeeds[7]], ['Menta', 'Menta', 'Menta']);
  assert.deepEqual([updated.cellIcons[1], updated.cellIcons[4], updated.cellIcons[7]], ['basil', 'basil', 'basil']);
  assert.equal(updated.cellSeeds[2], null);
  assert.throws(() => assignSeedsToCells(tray, [72], { seed: 'Menta', icon: 'basil', plantedAt: '2026-09-20' }), RangeError);
  assert.throws(() => assignSeedsToCells(tray, [1], { seed: 'Menta', icon: 'unknown', plantedAt: '2026-09-20' }), TypeError);
});

test('moves one planted cell into an empty slot and preserves its plant data', () => {
  const tray = normalizeTray({ ...sample, seeded: 0,
    cellSeeds: ['Menta', null, 'Tomate', ...Array(69).fill(null)],
    cellIcons: ['basil', null, 'tomato'], cellPlantedAt: ['2026-09-19', null, '2026-09-18'],
    cellWaterings: [[{ at: '2026-09-20T08:00', amountMl: 20, note: 'Ligero' }]] });
  const moved = moveCell(tray, 0, 10);
  assert.equal(moved.cellSeeds[0], null);
  assert.equal(moved.cellIcons[0], null);
  assert.equal(moved.cellPlantedAt[0], null);
  assert.equal(moved.cellSeeds[10], 'Menta');
  assert.equal(moved.cellIcons[10], 'basil');
  assert.equal(moved.cellPlantedAt[10], '2026-09-19');
  assert.deepEqual(moved.cellWaterings[10], [{ at: '2026-09-20T08:00', amountMl: 20, note: 'Ligero' }]);
  assert.deepEqual(moved.cellWaterings[0], []);
  assert.equal(moved.cellSeeds[2], 'Tomate');
  assert.equal(moved.seeded, 2);
  assert.throws(() => moveCell(tray, 0, 2), /destino vacía/);
  assert.throws(() => moveCell(tray, 1, 10), /origen está vacía/);
  assert.throws(() => moveCell(tray, 0, 72), RangeError);
});

test('records watering history for planted cells only', () => {
  const tray = normalizeTray({ ...sample, seeded: 0,
    cellSeeds: ['Menta', null, 'Tomate', ...Array(69).fill(null)] });
  const watered = waterCells(tray, [0, 2, 0], {
    at: '2026-09-21T09:30', amountMl: '25', note: 'Humedecí el sustrato',
  });
  assert.equal(watered.cellWaterings[0].length, 1);
  assert.deepEqual(watered.cellWaterings[0][0], {
    at: '2026-09-21T09:30', amountMl: 25, note: 'Humedecí el sustrato',
  });
  assert.deepEqual(watered.cellWaterings[2], watered.cellWaterings[0]);
  assert.deepEqual(watered.cellWaterings[1], []);
  assert.match(renderTray(watered), /cell-water-indicator/);
  assert.match(renderTray(watered), /Último riego 21\/09\/2026 · 09:30/);
  const selectionMarkup = renderTray(watered, { multiSelecting: true, selectedCells: new Set([0, 1, 2]) });
  assert.match(selectionMarkup, /data-water-selected="tray-a"[^>]*Regar 2 celdas sembradas/);
  assert.match(selectionMarkup, /REGAR SELECCIONADAS/);
  assert.doesNotMatch(selectionMarkup, /bulkWateringForm/);
  assert.match(renderTray(watered, { multiSelecting: true, selectedCells: new Set([1]) }), /data-water-selected="tray-a"[^>]*disabled/);
  const newer = waterCells(watered, [0], { at: '2026-09-21T10:00' });
  assert.equal(newer.cellWaterings[0].length, 2);
  assert.equal(waterCells(newer, [0], { at: '2026-09-19T10:00' }).cellWaterings[0].at(-1).at, '2026-09-21T10:00');
  assert.throws(() => waterCells(tray, [1], { at: '2026-09-21T09:30' }), /celdas sembradas/);
  assert.throws(() => waterCells(tray, [0], { at: '2026-02-31T09:30' }), /fecha y cantidad/);
  assert.throws(() => waterCells(tray, [0], { at: '2026-09-21T09:30', amountMl: '0' }), /fecha y cantidad/);
});

test('summarizes planted age and latest watering time in compact tray status', () => {
  const now = new Date(2026, 8, 21, 10, 0);
  const dry = normalizeTray({ ...sample, seeded: 0, cellSeeds: ['Menta', ...Array(71).fill(null)] });
  assert.equal(trayPlantingAgeLabel(dry, now), 'Día 2');
  assert.equal(wateringAgeLabel(dry, now), 'Sin riego');
  const staggered = normalizeTray({ ...dry,
    cellSeeds: ['Menta', 'Cherry', ...Array(70).fill(null)],
    cellPlantedAt: ['2026-09-20', '2026-09-21'] });
  assert.equal(trayPlantingAgeLabel(staggered, now), 'Día 1–2');
  const watered = waterCells(dry, [0], { at: '2026-09-21T09:30' });
  assert.equal(wateringAgeLabel(watered, now), 'Hace 30 min');
  const markup = renderTray(watered, { now });
  assert.match(markup, /ÚLTIMO RIEGO/);
  assert.match(markup, /Hace 30 min/);
  assert.match(markup, /SEMBRADO/);
});

test('growth age uses calendar days and clamps future dates', () => {
  assert.equal(daysSince('2026-09-18', new Date('2026-09-20T01:00:00')), 2);
  assert.equal(daysSince('2026-09-21', new Date('2026-09-20T20:00:00')), 0);
  assert.equal(daysSince('invalid', new Date('2026-09-20T20:00:00')), 0);
  assert.equal(stageFor(2), 'RECIÉN SEMBRADA');
  assert.equal(stageFor(3), 'GERMINANDO');
  assert.equal(stageFor(8), 'PLÁNTULA');
  assert.equal(stageFor(18), 'LISTA PARA TRASPLANTE');
  assert.equal(cellGrowthStage(0).key, 'seed');
  assert.equal(cellGrowthStage(2).label, 'SEMILLA');
  assert.equal(cellGrowthStage(3).key, 'sprout');
  assert.equal(cellGrowthStage(8).key, 'plant');
  assert.equal(cellGrowthStage(18).label, 'LISTA PARA TRASPLANTE');
});

test('navigation resolves accented and unaccented germination labels', () => {
  assert.equal(resolveDestination('GERMINACIÓN'), 'germination');
  assert.equal(resolveDestination('germinacion'), 'germination');
  assert.equal(resolveDestination('MAP'), 'map');
  assert.equal(resolveDestination('INVENTORY'), null);
});
