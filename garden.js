const plants = [
  { id: '04', stage: 'FLOWERING', health: 92, ph: '5.9', ec: '1.8', temp: '21.4°C', age: '34 days' },
  { id: '07', stage: 'FRUITING', health: 88, ph: '5.9', ec: '1.8', temp: '21.4°C', age: '41 days' },
  { id: '02', stage: 'VEGETATIVE', health: 96, ph: '6.0', ec: '1.7', temp: '21.1°C', age: '28 days' },
];

export function mountGarden(document, ui) {
  const nft = document.querySelector('#nftSlots');
  const dwc = document.querySelector('#dwcSlots');
  if (nft && dwc) {
    fillSlots(nft, 25, [5, 11, 16, 21], ui);
    fillSlots(dwc, 13, [2, 8], ui);
  }

  document.querySelectorAll('[data-entity]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.entity === 'reservoir') showReservoir(ui);
      else ui.toast(`${button.dataset.entity.toUpperCase()} seleccionado`);
    });
  });

  document.querySelectorAll('.quest input').forEach(input => {
    input.addEventListener('change', () => {
      input.closest('.quest')?.classList.toggle('done', input.checked);
      ui.toast(input.checked ? 'Quest complete · +10 FARM XP' : 'Quest reopened');
    });
  });

  document.querySelectorAll('.mini-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.mini-button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      ui.toast(`${button.textContent.trim()} view selected`);
    });
  });
}

function fillSlots(container, count, emptyIndexes, ui) {
  for (let index = 0; index < count; index += 1) {
    const empty = emptyIndexes.includes(index);
    const plantId = ['04', '07', '02'][index % 3];
    const slot = container.ownerDocument.createElement('button');
    slot.type = 'button';
    slot.className = `plant-slot${empty ? ' empty' : ''}`;
    slot.textContent = empty ? '·' : '✿';
    slot.dataset.plant = plantId;
    slot.title = empty ? 'Empty slot' : `Strawberry #${plantId}`;
    if (!empty) slot.addEventListener('click', () => showPlant(ui, plantId));
    container.append(slot);
  }
}

function showPlant(ui, id) {
  const plant = plants.find(item => item.id === id) || plants[0];
  ui.showDialog(`<div class="detail-content"><div class="subtitle">PLANT STATUS WINDOW</div><h2>✿ STRAWBERRY #${plant.id}</h2><div class="subtitle">${plant.stage} · ${plant.age}</div><div class="detail-grid"><div class="detail-stat"><small>HEALTH</small><strong style="color:var(--green)">${plant.health}% ✓</strong></div><div class="detail-stat"><small>EXPECTED HARVEST</small><strong>~ 17 days</strong></div><div class="detail-stat"><small>PH</small><strong>${plant.ph} ✓</strong></div><div class="detail-stat"><small>EC</small><strong>${plant.ec} ✓</strong></div><div class="detail-stat"><small>ROOT TEMP</small><strong>${plant.temp} ✓</strong></div><div class="detail-stat"><small>LOCATION</small><strong>NFT A · SLOT ${plant.id}</strong></div></div><div class="detail-actions"><button class="pixel-action" data-toast="Growth note opened">＋ ADD NOTE</button><button class="pixel-action" data-toast="Harvest form opened">RECORD HARVEST</button><button class="pixel-action" data-toast="Problem report opened">REPORT PROBLEM</button></div></div>`);
}

function showReservoir(ui) {
  ui.showDialog(`<div class="detail-content"><div class="subtitle">HYDRO SYSTEM OBJECT</div><h2>▣ RESERVOIR A</h2><div class="subtitle">ACTIVE · 420 / 510 L</div><div class="detail-grid"><div class="detail-stat"><small>WATER LEVEL</small><strong style="color:var(--aqua)">82% ✓</strong></div><div class="detail-stat"><small>PH RANGE</small><strong>5.5—6.2</strong></div><div class="detail-stat"><small>EC RANGE</small><strong>1.5—2.2</strong></div><div class="detail-stat"><small>LAST WATER CHANGE</small><strong>2 days ago</strong></div></div><div class="detail-actions"><button class="pixel-action" data-toast="Water change form opened">RECORD WATER CHANGE</button><button class="pixel-action" data-toast="Nutrient dose form opened">ADD NUTRIENTS</button></div></div>`);
}
