# Project Dragon: View Layer & Asset Architecture (Phases 5-6)

## 1. Hybrid Rendering Architecture
The view layer strictly separates the Map from the User Interface to ensure performance.
- **Canvas (`<canvas>`)**: Responsible ONLY for rendering the World Map (Routes, Nodes, moving Armies). Redrawn every frame using `requestAnimationFrame`, reading from the Headless Engine's `GameState`.
- **HTML DOM**: Responsible for all UI Overlays (Menus, Top Bar, Modals, Resource Bars). Absolute positioned over the Canvas.

## 2. Asset Management (Phase 6)
To support 2026-level visuals (dynamically generated AI art later), implement a singleton `AssetManager`.
- **Preloading**: Loads images into a `Map<string, HTMLImageElement>` before the engine starts rendering.
- **Fallback Mechanism**: If an image URL is missing or fails to load, the `AssetManager` MUST gracefully return null, and the Canvas MUST fallback to drawing colored geometric shapes (e.g., fillRect, arc). Do NOT crash the game.
- **Directory Structure**: Setup the following in the project root:
  - `/public/assets/portraits/`
  - `/public/assets/nodes/`
  - `/public/assets/ui/`
- **ComfyUI Placeholder**: Create an empty `ComfyUIService.ts` with comments explaining it will later handle local API calls to `http://127.0.0.1:8188/prompt`.

## 3. Data Model Upgrades (Visual Asset IDs)
Extend the existing Phase 1-4 interfaces (do not delete existing logic properties, just add these):
- `Officer`: Add `portraitAssetId?: string`, `avatarAssetId?: string`.
- `MapNode`: Add `spriteAssetId?: string`.
- `Route`: Add `textureAssetId?: string`.

## 4. Canvas Drawing Rules
When rendering inside the `requestAnimationFrame` loop:
- **Routes**: Draw lines between `sourceNodeId` and `targetNodeId`. 
  - PLAIN: Solid wide line (beige).
  - MOUNTAIN: Solid thin line (brown).
  - WATER: Solid blue line.
  - *Note*: If `isHidden === true`, do NOT draw until revealed.
- **Nodes (Cities/Gates)**: Draw at `(x, y)` coordinates. Use `AssetManager` to get `spriteAssetId`. If null, fallback: CITY = large square (faction color), GATE = rectangle wall. Draw Node name and troops count below it.
- **Armies**: Calculate exact `(x, y)` by interpolating between Source and Target nodes based on `Army.progress / Route.distance`. Draw `avatarAssetId` (clip to circle). If null, fallback: draw a colored circle with the Commander's initial. If `status === "COMBAT"` or `"SIEGE"`, draw a "Crossed Swords" icon/shape on top of the Army.

## 5. UI DOM Components & Interactivity
- **CSS Guidelines (Glassmorphism)**: All UI panels MUST use `backdrop-filter: blur(10px)` with a semi-transparent dark background (`rgba(15, 23, 42, 0.8)`). Use modern sans-serif fonts (`system-ui`, `Roboto`). Add smooth transitions (`all 0.2s ease`) to hover states.
- **Global Header**: Displays Player Faction's Total Gold, Total Food, and Current Date (calculated from Tick).
- **Time Controls**: `[ Pause ]`, `[ 1x ]`, `[ 2x ]`, `[ 4x ]` buttons. Clicking these mutates the Headless Engine's TimeScale.
- **Node Context Menu**: Clicking a Node on the Canvas opens a HTML Panel. 
  - Displays: Defense, Gold, Food, Troops.
  - Buttons: Assign Mayor, Set Policy (Gold/Food/Draft).
  - Button: **Dispatch Army** (Opens Dispatch Modal).
- **Army Dispatch Modal**: 
  - Select 1 Commander, up to 2 Deputies.
  - Input/Slider for Troops and Carried Food.
  - Select Target Node. 
  - *Confirm*: Triggers Engine logic to create Army and push to `GameState`.

## 6. State Persistence (Save/Load)
Use `IndexedDB` (raw or via lightweight wrapper like `localforage`) to bypass localStorage 5MB limits.
- **exportGameState()**: Serializes the entire `GameState` (Tick, Officers, Nodes, Routes, Armies) into JSON and stores it.
- **importGameState()**: Loads JSON from IndexedDB, completely overriding the Headless Engine's current state, and forces Canvas to re-render.
- **Auto-Save**: Trigger silently every 30 Ticks (after Economy resolves).