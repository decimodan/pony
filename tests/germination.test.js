import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cellGrowthStage, createTrayRepository, daysSince, inferPlantIcon, normalizeTray, stageFor, TRAY_STORAGE_KEY,
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
  assert.equal(normalizeTray({ ...sample, cellSeeds: ['Cherry', null, 'Romaine'] }).seeded, 2);
  const iconData = normalizeTray({ ...sample, capacity: 2, seeded: 0,
    cellSeeds: ['Arugula', 'Romaine'], cellIcons: ['basil', 'unknown'],
    cellPlantedAt: ['2026-09-19', 'bad-date'] });
  assert.deepEqual(iconData.cellIcons, ['basil', 'seedling']);
  assert.deepEqual(iconData.cellPlantedAt, ['2026-09-19', sample.sown]);
  assert.equal(inferPlantIcon('Fresa'), 'strawberry');
  assert.equal(inferPlantIcon('Menta'), 'basil');
  assert.equal(normalizeTray({ ...sample, cellSeeds: ['Cherry', null, 'Romaine'], capacity: 2 }).cellSeeds.length, 2);
  assert.equal(normalizeTray({ ...sample, capacity: 241 }), null);
  assert.equal(normalizeTray({ ...sample, seeded: -1 }), null);
  assert.equal(normalizeTray({ ...sample, seeded: 73 }), null);
  assert.equal(normalizeTray({ ...sample, sown: '2026-02-31' }), null);
  assert.equal(normalizeTray({ ...sample, name: '' }), null);
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
