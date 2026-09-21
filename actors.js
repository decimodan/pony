export const ACTOR_STORAGE_KEY = 'pony.active-actor.v1';
export const ACTIVITY_STORAGE_KEY = 'pony.germination.activity.v1';
export const ACTORS = [
  { id: 'isis', name: 'Isis', avatar: 'isis' },
  { id: 'daniel', name: 'Daniel', avatar: 'daniel' },
];

export function createActivityRepository(storage) {
  return {
    read() {
      try {
        const value = JSON.parse(storage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value.filter(item => item && typeof item.at === 'string' && typeof item.actor?.id === 'string').slice(0, 200) : [];
      } catch { return []; }
    },
    record(actor, action, detail, at = new Date().toISOString()) {
      const entry = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at, actor: { id: actor.id, name: actor.name }, action: String(action).slice(0, 48), detail: String(detail).slice(0, 160) };
      const entries = [entry, ...this.read()].slice(0, 200);
      storage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(entries));
      return entry;
    },
  };
}

export function mountActors(document, storage = safeStorage()) {
  const button = document.querySelector('#avatarButton');
  const dialog = document.querySelector('#actorDialog');
  const picker = document.querySelector('#actorChoices');
  let active = ACTORS.find(actor => actor.id === storage.getItem(ACTOR_STORAGE_KEY)) || null;

  function render() {
    if (!button) return;
    button.innerHTML = active
      ? `<span class="actor-avatar actor-avatar-${active.avatar}" aria-hidden="true"></span><span class="avatar-name">${active.name}</span>`
      : '<span class="actor-unknown" aria-hidden="true">?</span><span class="avatar-name">¿QUIÉN?</span>';
    button.setAttribute('aria-label', active ? `Actuando como ${active.name}. Cambiar persona` : 'Elegir quién hará las acciones');
    button.title = active ? `Actuando como ${active.name} · Cambiar persona` : 'Elegir quién hará las acciones';
  }
  function renderChoices() {
    if (picker) picker.innerHTML = ACTORS.map(actor => `<button type="button" class="actor-choice" data-actor-id="${actor.id}" aria-pressed="${actor.id === active?.id}"><span class="actor-avatar actor-avatar-${actor.avatar}" aria-hidden="true"></span><span><b>${actor.name}</b><small>${actor.id === 'isis' ? 'Cultivadora' : 'Cultivador'}</small></span>${actor.id === active?.id ? '<em>ACTIVA</em>' : ''}</button>`).join('');
  }
  render();
  renderChoices();
  button?.addEventListener('click', () => dialog?.showModal());
  picker?.addEventListener('click', event => {
    const choice = event.target.closest('[data-actor-id]');
    const actor = ACTORS.find(item => item.id === choice?.dataset.actorId);
    if (!actor) return;
    active = actor;
    storage.setItem(ACTOR_STORAGE_KEY, active.id);
    render();
    renderChoices();
    dialog?.close();
    document.dispatchEvent(new CustomEvent('pony:actor-change', { detail: active }));
  });
  document.querySelector('#closeActorDialog')?.addEventListener('click', () => dialog?.close());
  return { current: () => active, choose: () => dialog?.showModal(), onChange(callback) { document.addEventListener('pony:actor-change', event => callback(event.detail)); } };
}

function safeStorage() {
  try { return globalThis.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
}
