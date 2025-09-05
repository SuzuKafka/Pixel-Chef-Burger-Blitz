# Pixel Chef: Burger Blitz (Web)
Minimal, playable HTML5 Canvas version of the burger-only arcade idea.

## Run locally
- Open this folder in VS Code.
- Use the "Live Server" extension or any static server to serve the files.
- Or, from a terminal in this folder, run: `python3 -m http.server 3000` and open http://localhost:3000

## Controls
- Left/Right arrows (or A/D) to move the tray.
- Catch the ingredients in the order shown in the Order card.
- Avoid spoiled (striped) items. Wrong catches reduce score/time.
- Finish the sequence to complete the burger; complete orders quickly for bonus.

## Customize
- Edit `RECIPES` in `main.js` to add/remove burger types.
- Tweak `spawnEvery`, `GRAVITY`, and tray width/speed to change difficulty.
- Replace the drawn rectangles with images or sprites for better art.
