export function resolveDestination(label) {
  const key = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (key === 'MAP') return 'map';
  if (key === 'GERMINACION') return 'germination';
  return null;
}

export function mountNavigation(document, ui) {
  const buttons = [...document.querySelectorAll('.nav-item')];
  if (!buttons.length) return;
  const views = {
    map: [document.querySelector('.game-layout'), document.querySelector('.bottom-grid')],
    germination: [document.querySelector('#germinationView')],
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const destination = resolveDestination(button.dataset.nav || button.textContent);
      if (!destination || views[destination].some(view => !view)) {
        ui.toast('Esta sección todavía no está disponible.');
        return;
      }

      for (const [name, viewList] of Object.entries(views)) {
        viewList.forEach(view => { view.hidden = name !== destination; });
      }
      buttons.forEach(item => {
        item.classList.toggle('active', item === button);
        if (item === button) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
    });
  });

  const mapButton = buttons.find(button => resolveDestination(button.dataset.nav || button.textContent) === 'map');
  if (mapButton) {
    mapButton.classList.add('active');
    mapButton.setAttribute('aria-current', 'page');
  }
}
