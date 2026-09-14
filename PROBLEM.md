# **Hydroponic Garden — Retro Game Management UI**

## **1. Project Overview**

Build a web application for managing a real hydroponic garden, but make the entire experience feel like a retro management videogame.

The application should NOT look like a conventional SaaS dashboard.

Instead, the primary interface should resemble a pixel-art farming / simulation game from the SNES, Game Boy Advance, or early Nintendo DS era.

Think of a combination of:

- Harvest Moon
- Pokémon
- Stardew Valley
- Theme Hospital / RollerCoaster Tycoon management screens
- Tamagotchi-style status monitoring

The important distinction is:

The garden is real. The videogame is the interface.

Real sensors, pumps, reservoirs, plants, nutrient readings, alerts, and automation should be represented through game objects and game mechanics.

---

# **2. Product Goals**

The application should allow me to:

1. Visualize my entire hydroponic garden as a pixel-art map.
2. Register hydroponic systems, reservoirs, grow beds, towers, pots, and plants.
3. Track individual plants or groups of plants.
4. Monitor sensor readings.
5. Track pH and EC.
6. Monitor nutrient solution temperature.
7. Monitor water level.
8. Monitor environmental temperature and humidity.
9. Monitor pumps and irrigation cycles.
10. Track plant growth.
11. Record maintenance.
12. Track nutrient changes.
13. Track harvests.
14. Receive alerts.
15. Eventually integrate with Home Assistant and/or MQTT.
16. Eventually control pumps, valves, lights, and dosing systems.
17. Keep historical information about every crop.

The system should make managing the garden feel rewarding rather than administrative.

---

# **3. Core Design Philosophy**

Avoid building a dashboard like:

```text
+--------------------------+
| Temperature: 24.3 C      |
| pH: 6.1                  |
| EC: 1.8                  |
| Water: 82%               |
+--------------------------+
```

Instead represent that information in the game world.

Example:

```text
        🌿 HYDROPONIC ROOM

 ╔══════════════════════════════╗
 ║                              ║
 ║       🌱 🌱 🌱 🌱           ║
 ║                              ║
 ║  🛢 Reservoir      💧 Pump   ║
 ║                              ║
 ║       🌱 🌱 🌱 🌱           ║
 ║                              ║
 ╚══════════════════════════════╝

 Selected: Strawberry #04

 ♥ HEALTH      █████████░ 92%
 💧 WATER      GOOD
 ⚡ EC         1.7
 🧪 PH         5.9
 🌡 ROOT TEMP  21.4 C

 Age: 34 days
 Stage: Flowering
```

The garden map should be the main navigation mechanism.

---

# **4. Visual Style**

## **General**

Use pixel-art-inspired visuals.

Target aesthetic:

- 16-bit
- SNES / Game Boy Advance
- 2D top-down management game
- Crisp pixels
- Limited color palettes
- Small animations
- Retro dialog boxes
- Pixel fonts where appropriate

Avoid making the UI difficult to read merely to preserve the retro style.

Modern usability is more important than strict historical accuracy.

---

# **5. Main Screen**

The default screen should show a top-down view of the garden.

Example layout:

```text
┌───────────────────────────────────────────────────────────┐
│ HYDRO FARM                     DAY 128       14:32        │
├───────────────────────────────────────────────────────────┤
│                                                           │
│      🌿 GROW ZONE A              🌿 GROW ZONE B           │
│                                                           │
│      ▣ ▣ ▣ ▣ ▣                  ▣ ▣ ▣ ▣ ▣                │
│      ▣ ▣ ▣ ▣ ▣                  ▣ ▣ ▣ ▣ ▣                │
│                                                           │
│                                                           │
│             ┌─────────────┐                               │
│             │ RESERVOIR A │                               │
│             │   💧 78%    │                               │
│             └─────────────┘                               │
│                                                           │
│       ⚙ PUMP A                      ⚗ NUTRIENTS            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ 💰 Harvest: 12.4kg    ⚠ Alerts: 2    🌱 Plants: 42        │
└───────────────────────────────────────────────────────────┘
```

Objects on the map should be clickable.

---

# **6. Game Objects**

Implement the garden using reusable entities.

## **Garden**

Represents the complete property or installation.

Properties:

```ts
Garden {
  id
  name
  description
  location?
  createdAt
}
```

---

## **Zone**

A garden can contain multiple zones.

Examples:

- Indoor hydroponics
- Balcony
- Greenhouse
- Outdoor garden
- Strawberry system
- Herb system

```ts
Zone {
  id
  gardenId
  name
  type
  positionX
  positionY
}
```

---

## **Hydroponic System**

Examples:

- NFT
- DWC
- Dutch Bucket
- Drip Irrigation
- Aeroponic Tower
- Kratky
- Vertical Tower
- Substrate Drip System
- Bamboo Hydroponic System

```ts
HydroponicSystem {
  id
  zoneId
  name
  type

  reservoirId?

  positionX
  positionY

  width
  height

  status
}
```

Possible statuses:

```text
ACTIVE
MAINTENANCE
WARNING
OFFLINE
```

---

# **7. Reservoirs**

Reservoirs are one of the most important entities.

```ts
Reservoir {
  id
  name

  capacityLiters
  currentVolumeLiters?

  targetPhMin
  targetPhMax

  targetEcMin
  targetEcMax

  temperatureTargetMin?
  temperatureTargetMax?

  lastWaterChangeAt?
}
```

The reservoir should appear visually on the map.

Its appearance can change depending on status.

Examples:

Normal:

```text
┌──────────────┐
│    WATER     │
│  ≈≈≈≈≈≈≈≈    │
│    82%       │
└──────────────┘
```

Low water:

```text
┌──────────────┐
│  ! LOW H2O ! │
│  ≈≈≈         │
│    18%       │
└──────────────┘
```

---

# **8. Sensors**

Sensors should be generic.

```ts
Sensor {
  id

  name

  type

  unit

  deviceId?
  entityId?

  zoneId?
  systemId?
  reservoirId?

  lastValue?
  lastReadingAt?
}
```

Supported sensor types should initially include:

```text
PH

EC

WATER_TEMPERATURE

AIR_TEMPERATURE

HUMIDITY

WATER_LEVEL

FLOW_RATE

LIGHT_LEVEL

POWER

DISSOLVED_OXYGEN
```

Design the system so new sensor types can easily be introduced.

---

# **9. Sensor Readings**

Sensor history should be stored separately.

```ts
SensorReading {
  id

  sensorId

  value

  timestamp
}
```

Long-term data should eventually support charts and trend analysis.

---

# **10. Plants**

Plants are the central game entity.

Each plant can exist individually.

Example:

```ts
Plant {
  id

  speciesId

  systemId

  slotId?

  nickname?

  plantedAt

  germinatedAt?

  transplantedAt?

  expectedHarvestAt?

  harvestedAt?

  status

  healthScore

  notes?
}
```

Statuses:

```text
SEED
GERMINATING
SEEDLING
VEGETATIVE
FLOWERING
FRUITING
READY_TO_HARVEST
HARVESTED
DEAD
```

---

# **11. Plant Species**

Keep cultivation requirements separate from the individual plant.

```ts
PlantSpecies {
  id

  commonName
  scientificName?

  optimalPhMin
  optimalPhMax

  optimalEcMin
  optimalEcMax

  optimalTemperatureMin?
  optimalTemperatureMax?

  daysToHarvestMin?
  daysToHarvestMax?

  icon
}
```

Examples:

```text
Strawberry
Basil
Mint
Tomato
Lettuce
Pepper
Fig
Cilantro
Parsley
```

---

# **12. Plant Slots**

Hydroponic systems should have planting positions.

```ts
PlantSlot {
  id

  systemId

  positionX
  positionY

  plantId?
}
```

This enables the UI to visually represent every growing position.

Example:

```text
NFT CHANNEL A

[🌱][🌱][🌱][ ]
[🌱][🌱][ ][🌱]
```

Clicking a slot should open the plant.

---

# **13. Plant Details Screen**

Selecting a plant should display something similar to a videogame character status screen.

Example:

```text
╔══════════════════════════════╗
║      🍓 STRAWBERRY #07       ║
╠══════════════════════════════╣
║                              ║
║   Stage: FLOWERING           ║
║   Age: 41 days               ║
║                              ║
║   HEALTH                     ║
║   ████████████████░░  88%    ║
║                              ║
║   PH       5.9  ✓            ║
║   EC       1.8  ✓            ║
║   WATER    21C   ✓           ║
║                              ║
║   Next harvest               ║
║   ~ 17 days                  ║
║                              ║
╚══════════════════════════════╝
```

Actions:

```text
[ ADD NOTE ]

[ RECORD GROWTH ]

[ REPORT PROBLEM ]

[ RECORD HARVEST ]

[ REMOVE PLANT ]
```

---

# **14. Plant Health**

Calculate a simple health score.

Range:

```text
0-100
```

Potential factors:

```text
pH deviation

EC deviation

temperature deviation

water availability

manual observations

disease reports

sensor availability
```

Version 1 can use a simplistic algorithm.

Do NOT pretend the health score is scientifically precise.

It is primarily a management indicator.

---

# **15. Growth Tracking**

Allow users to periodically record observations.

```ts
PlantObservation {
  id

  plantId

  timestamp

  heightCm?

  leafCount?

  flowers?

  fruits?

  healthScore?

  notes?

  imageUrl?
}
```

Eventually this could produce a growth timeline.

---

# **16. Harvests**

```ts
Harvest {
  id

  plantId?
  speciesId

  systemId

  harvestedAt

  weightGrams

  quality?

  notes?
}
```

Show harvest statistics.

Examples:

```text
TODAY
420 g strawberries

THIS MONTH
8.4 kg

ALL TIME
42.7 kg
```

Game-style feedback can be added.

Example:

```text
+850 XP

HARVEST COMPLETE

Strawberry
420g
★★★★★
```

XP is purely cosmetic.

---

# **17. Maintenance**

Track maintenance events.

```ts
MaintenanceEvent {
  id

  systemId?
  reservoirId?
  deviceId?

  type

  timestamp

  notes?
}
```

Types:

```text
WATER_CHANGE

FILTER_CLEANING

PUMP_CLEANING

SYSTEM_CLEANING

NUTRIENT_CHANGE

PH_ADJUSTMENT

CALIBRATION

REPAIR
```

---

# **18. Nutrient Management**

Track nutrient additions.

```ts
NutrientDose {
  id

  reservoirId

  nutrientName

  amountMl

  timestamp

  notes?
}
```

Eventually support automatic dosing.

---

# **19. Alerts**

Alerts should behave like game events.

Examples:

```text
⚠ RESERVOIR A

pH too high!

Current: 6.8
Target: 5.5 - 6.2
```

```text
⚠ STRAWBERRY ZONE

EC has been below target
for 3 hours.
```

```text
⚠ PUMP A

No water flow detected.
```

Severity levels:

```text
INFO
WARNING
CRITICAL
```

---

# **20. Event Feed**

The application should have a game-style event log.

Example:

```text
14:21  💧 Pump A started

14:18  🌱 Strawberry #04 entered FLOWERING

14:02  ⚗ Nutrient A +10ml

13:43  ⚠ Reservoir pH reached 6.4

12:32  🍓 Harvested 230g strawberries
```

---

# **21. “Game Day” System**

The UI should display the number of days the farm has been running.

Example:

```text
HYDRO FARM
DAY 142
SPRING
14:32
```

This is mostly decorative.

Actual timestamps must continue to use normal dates.

---

# **22. Statistics**

Provide a statistics screen.

Example:

```text
╔════════ FARM STATISTICS ════════╗

Total plants          48

Healthy plants        44

Plants in warning      4

Harvest this month    8.4 kg

Water used           840 L

Average pH             5.9

Average EC             1.7

System uptime         99.8%

╚═════════════════════════════════╝
```

---

# **23. Quests**

Maintenance tasks can optionally be represented as videogame quests.

Example:

```text
DAILY TASKS

[✓] Check reservoir level

[✓] Inspect strawberry roots

[ ] Calibrate pH sensor

[ ] Clean filter
```

Rewards are cosmetic.

Example:

```text
+20 FARM XP
```

Do not make the system dependent on gamification.

Tasks remain normal database entities underneath the presentation.

---

# **24. Achievements**

Possible cosmetic achievements:

```text
FIRST HARVEST

Harvest your first plant.
```

```text
GREEN THUMB

Keep 10 plants above
90 health for 30 days.
```

```text
BERRY FARMER

Harvest 10 kg of strawberries.
```

Achievements should never interfere with actual garden management.

---

# **25. Home Assistant Integration**

This integration is important.

The system should eventually be capable of reading Home Assistant entities.

Example:

```text
sensor.hydroponics_ph

sensor.hydroponics_ec

sensor.reservoir_temperature

sensor.reservoir_level

switch.hydroponics_pump

switch.grow_light
```

Architecture should make integrations replaceable.

Do not tightly couple the application to Home Assistant.

Define an abstraction such as:

```ts
interface DeviceProvider {

  getSensors(): Promise<Sensor[]>

  getSensorValue(id: string): Promise<number>

  setSwitch(id: string, state: boolean): Promise<void>

}
```

Potential providers:

```text
HomeAssistantProvider

MQTTProvider

MockProvider
```

---

# **26. MQTT**

Future support should include MQTT.

Example topics:

```text
hydroponics/reservoir/ph

hydroponics/reservoir/ec

hydroponics/reservoir/temperature

hydroponics/reservoir/level

hydroponics/pump/state
```

---

# **27. Automation**

Eventually support simple automations.

Example:

```text
WHEN

Reservoir level < 20%

THEN

Create CRITICAL alert
```

Future example:

```text
WHEN

EC < 1.5

THEN

Dose nutrient A
```

Safety is extremely important.

Automatic equipment control should therefore NOT be implemented as part of the first iteration.

Initial versions should be monitoring-first.

---

# **28. Proposed Technical Stack**

Prefer:

```text
Frontend:
Next.js
React
TypeScript

Styling:
Tailwind CSS

Database:
PostgreSQL

ORM:
Prisma

API:
Next.js API routes
or
tRPC

Realtime:
WebSockets
or
Server Sent Events

Charts:
Recharts

Authentication:
Auth.js
```

Use the current stable releases.

---

# **29. Pixel Rendering**

Game objects should ideally be rendered using normal DOM/CSS during the first implementation.

Do not introduce a game engine unnecessarily.

Potential later option:

```text
PixiJS
```

Only introduce PixiJS if the map becomes complex enough to justify it.

For MVP:

```text
CSS Grid
absolute positioning
pixel-art sprite sheets
```

should be enough.

---

# **30. UI Components**

Create reusable components such as:

```text
<GameWindow />

<GameDialog />

<PixelButton />

<PixelProgressBar />

<StatusBadge />

<GardenMap />

<GardenZone />

<HydroponicSystemSprite />

<PlantSprite />

<ReservoirSprite />

<PumpSprite />

<SensorIndicator />

<EventLog />

<AlertDialog />

<PlantStatusWindow />

<InventoryWindow />

<QuestLog />
```

---

# **31. Desktop Layout**

Example:

```text
┌─────────────────────────────────────────────────────────┐
│ HYDRO FARM                 DAY 142             14:32    │
├──────────────────────────────────────┬──────────────────┤
│                                      │                  │
│                                      │ STATUS           │
│                                      │                  │
│          FARM MAP                    │ pH      5.9       │
│                                      │ EC      1.8       │
│                                      │ Water   82%       │
│                                      │                  │
│                                      ├──────────────────┤
│                                      │ EVENTS           │
│                                      │                  │
│                                      │ Pump started     │
│                                      │ pH adjusted      │
│                                      │ Harvest +220g    │
│                                      │                  │
├──────────────────────────────────────┴──────────────────┤
│ MAP   PLANTS   SYSTEMS   INVENTORY   STATS   SETTINGS   │
└─────────────────────────────────────────────────────────┘
```

---

# **32. Mobile**

Mobile should resemble a handheld game console UI rather than trying to display the full desktop dashboard.

Focus on:

```text
Garden

Plants

Alerts

Tasks

System status
```

The map can be scrollable.

---

# **33. Map Editor**

Eventually allow editing the farm.

Example:

```text
EDIT MODE

[ NFT CHANNEL ]

[ RESERVOIR ]

[ PUMP ]

[ SENSOR ]

[ PLANTER ]

[ PIPE ]
```

Users should be able to place objects on a grid.

This can eventually become something close to a level editor.

Not necessary for the first MVP.

---

# **34. Inventory**

Optional management screen.

Track items such as:

```text
pH Down

pH Up

Nutrient A

Nutrient B

CalMag

Seeds

Rockwool

Peat moss

Filters

Replacement pumps
```

Example:

```text
INVENTORY

Nutrient A
██████████████░░
720 ml

pH Down
█████░░░░░░░░░░
210 ml

Rockwool Cubes
42
```

---

# **35. Data Model**

Initial entities:

```text
User

Garden

Zone

HydroponicSystem

PlantSlot

Plant

PlantSpecies

PlantObservation

Reservoir

Sensor

SensorReading

Device

Harvest

MaintenanceEvent

NutrientDose

Alert

Task
```

Keep domain logic separate from UI/game concepts.

For example:

Do NOT store:

```text
plant_hp
```

Store:

```text
health_score
```

The UI may display it visually as HP.

This separation is important.

---

# **36. Seed Data**

Provide realistic demo data.

Create:

```text
Garden:
Donnie's Hydro Farm

Zone:
Indoor Garden

System:
Strawberry Drip System

Reservoir:
Reservoir A
100 liters

Plants:
12 strawberries

Sensors:
pH
EC
Water Temperature
Air Temperature
Humidity
Water Level

Pump:
Main Circulation Pump
```

Example current readings:

```text
pH
5.9

EC
1.75 mS/cm

Water temperature
21.4 C

Air temperature
25.2 C

Humidity
62%

Reservoir
82%
```

Plant stages should vary.

---

# **37. MVP**

The first usable version should include only:

## **Garden map**

Display:

```text
systems
plants
reservoir
pump
```

## **Plants**

Create and inspect plants.

## **Sensor readings**

Display mocked sensor values.

## **Reservoir screen**

Display:

```text
pH
EC
temperature
water level
```

## **Event log**

Generate fake historical events.

## **Alerts**

Generate warnings when mock values fall outside configured targets.

## **Persistence**

Use PostgreSQL.

---

# **38. First Development Milestone**

Build a vertical slice rather than implementing the entire backend first.

The first completed screen should show:

```text
A pixel-art hydroponic garden

12 strawberry plants

1 reservoir

1 pump

realistic mocked sensors

animated water

animated plants

a live event feed
```

Clicking a plant should open its status window.

Clicking the reservoir should display:

```text
Water Level

pH

EC

Temperature
```

This should already feel like a small videogame.

---

# **39. Development Principles**

Prioritize:

```text
1. Excellent UX

2. Strong visual identity

3. Clear domain model

4. Modularity

5. Real sensor integration later

6. Easy deployment

7. Mobile usability
```

Avoid premature complexity.

Do NOT initially build:

```text
automatic dosing

complex AI recommendations

advanced automation engine

distributed services

microservices

game engine

3D graphics
```

---

# **40. Architecture**

Use a modular monolith.

Suggested structure:

```text
src/

  app/

  components/

    game/

    garden/

    plants/

    sensors/

    reservoir/

  domain/

    plants/

    sensors/

    systems/

    alerts/

  integrations/

    home-assistant/

    mqtt/

    mock/

  services/

  db/

  styles/
```

---

# **41. Important Requirement**

This project should always maintain two conceptual layers.

## **Domain Layer**

Represents reality.

Example:

```text
SensorReading

Plant

Reservoir

Pump

HydroponicSystem
```

## **Game Presentation Layer**

Represents the same things visually.

Example:

```text
Plant HP bar

Water tank sprite

Pump animation

Warning icon

Quest
```

Do not couple these layers unnecessarily.

A future redesign of the UI should not require changing the underlying hydroponics data model.

---

# **42. Long-Term Vision**

Eventually the application could behave like a digital twin of the physical garden.

The real garden would have:

```text
ESP32 devices

EC sensors

pH sensors

temperature sensors

water-level sensors

flow meters

pumps

solenoid valves

lights

dosing pumps
```

These devices could communicate through:

```text
Home Assistant

MQTT
```

The game map would update in real time.

Example:

A physical pump starts.

The pump sprite begins moving.

Water begins animating through the system.

The event log displays:

```text
14:32

PUMP A STARTED
```

A sensor reports low water.

The reservoir sprite changes.

An alert appears:

```text
⚠ WATER LEVEL LOW

Reservoir A
18%
```

This should make the application behave like a videogame representation of the real hydroponic installation.

---

# **43. First Codex Task**

Start by generating the project skeleton and implementing ONLY the first vertical slice.

Do not attempt to build every feature described in this document.

Implement:

```text
Next.js
TypeScript
Tailwind

+

Pixel-art design system

+

Garden screen
```

Create reusable components for:

```text
GardenMap

PlantSprite

ReservoirSprite

PumpSprite

GameWindow

PixelButton

PixelProgressBar

EventLog
```

Use mocked application data for now.

Create a garden containing:

```text
12 strawberry plants

1 reservoir

1 pump

6 sensor readings
```

Add subtle CSS pixel animations for:

```text
plants

water

pump
```

Clicking a plant should open a plant information panel.

Clicking the reservoir should open a reservoir information panel.

The result should immediately communicate:

“This is software controlling a real hydroponic farm, presented as a retro videogame.”

Once this vertical slice is polished, stop and evaluate the implementation before building the next features.