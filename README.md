# Pixel Chef: Burger Blitz

Arcade‑style burger building game in the browser. Catch falling ingredients to assemble the order shown on the right. Keep the sequence correct, avoid rotten food, and grab golden patties for a little help. It’s endless: play until you run out of lives and try to beat your best score.

## Install and Run

- Option A — quick dev server (Python)
  - `python3 -m http.server 3000`
  - Open `http://localhost:3000`

- Option B — VS Code Live Server
  - Open this folder in VS Code and click “Go Live”.

- Option C — any static server
  - Serve the folder with your tool of choice (e.g., `npx serve .`).

No build step required — it’s plain HTML/CSS/JS.

## How to Play

- Watch the “Order” card and catch ingredients in that exact order.
- Stack completes when you catch the top bun; the finished burger blinks briefly, then a new order starts.
- Rotten items: purple; avoid them (they cost a life and points).
- Golden patties: shiny; catch them for +1 life and a short slow‑mo.
- Score grows with correct catches and combo/streak bonuses.

## Controls

- Move: Left/Right arrows or `A`/`D`
- Start/Restart: Enter
- Pause/Resume: `P` (Esc also supported)
- Mute/Unmute: `M`
- HUD has a ⏸️ button and sound controls in the top‑right.

## HUD & Menus

- Top‑left: title, Score, Lives, Level, Best.
- Top‑right: controls + sound; Order card directly below.
- Sound: mute toggle and volume slider. Settings are saved between sessions.
- Highlight next ingredient: optional glow on falling items that match the next step (toggle in HUD). This preference persists.

## Features

- Endless mode with increasing pace.
- Multiple recipes (classic, double cheeseburger, etc.).
- Golden patty (+life, slow‑mo) and rotten items (‑life, wobble).
- Particles and screen shake for crunchy feedback.
- Streak counter and session stats on game over.
- High score is saved locally.

## Customizing

- Recipes: edit `RECIPES` in `main.js` to add/adjust stacks.
- Ingredient behavior: tweak fall speeds and gravity in `Ingredient` and `spawnIngredient` in `main.js`.
- Collision feel: adjust `COLLISION_BAND` in `main.js`.
- Colors/Style: update `style.css`.

## Troubleshooting

- No audio: Click “Start” or interact once — browsers block autoplay until a gesture. On iOS, make sure the ringer switch isn’t muted. Also check the HUD mute toggle and the volume slider.
- Audio too quiet: Raise the slider in the HUD. Settings persist in localStorage.
- Highlight won’t turn off: Toggle “Highlight next ingredient” in the top‑right HUD. If it seems stuck, clear the site data/localStorage and reload.

## Files

- `index.html` — layout and HUD.
- `style.css` — styles.
- `main.js` — game logic, HUD, effects.
- `audio.js` — tiny Web Audio helper.
