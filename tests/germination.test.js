import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrayRepository, daysSince, normalizeTray, stageFor, TRAY_STORAGE_KEY,
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
  assert.deepEqual(normalizeTray(sample), sample);
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
  assert.deepEqual(repository.read(), [{ ...sample, name: 'Duplicada' }]);
});

test('repository creates, updates, and removes trays without duplicate records', () => {
  const repository = createTrayRepository(memoryStorage(), { makeId: () => 'new-id' });
  assert.deepEqual(repository.save({ ...sample, id: '' }).map(tray => tray.id), ['new-id']);
  assert.equal(repository.save({ ...sample, name: 'Editado' }, 'new-id').length, 1);
  assert.equal(repository.read()[0].name, 'Editado');
  assert.deepEqual(repository.remove('new-id'), []);
});

test('growth age uses calendar days and clamps future dates', () => {
  assert.equal(daysSince('2026-09-18', new Date('2026-09-20T01:00:00')), 2);
  assert.equal(daysSince('2026-09-21', new Date('2026-09-20T20:00:00')), 0);
  assert.equal(daysSince('invalid', new Date('2026-09-20T20:00:00')), 0);
  assert.equal(stageFor(2), 'RECIÉN SEMBRADA');
  assert.equal(stageFor(3), 'GERMINANDO');
  assert.equal(stageFor(8), 'PLÁNTULA');
  assert.equal(stageFor(18), 'LISTA PARA TRASPLANTE');
});

test('navigation resolves accented and unaccented germination labels', () => {
  assert.equal(resolveDestination('GERMINACIÓN'), 'germination');
  assert.equal(resolveDestination('germinacion'), 'germination');
  assert.equal(resolveDestination('MAP'), 'map');
  assert.equal(resolveDestination('INVENTORY'), null);
});
