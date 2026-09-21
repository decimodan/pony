import { mountGarden } from './garden.js';
import { mountGermination } from './germination.js';
import { mountNavigation } from './navigation.js';
import { createUI } from './ui.js';

function startApp(document = window.document) {
  const ui = createUI(document);
  mountGarden(document, ui);
  mountGermination(document, ui);
  mountNavigation(document, ui);
  updateClock(document);
  window.setInterval(() => updateClock(document), 1000);
}

function updateClock(document) {
  const clock = document.querySelector('#clock');
  if (clock) {
    clock.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }
}

const appDocument = globalThis.document;
if (appDocument) {
  if (appDocument.readyState === 'loading') {
    appDocument.addEventListener('DOMContentLoaded', () => startApp(appDocument), { once: true });
  } else {
    startApp(appDocument);
  }
}
