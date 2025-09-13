// Pixel Chef: Burger Blitz (Endless) — vanilla JS + Canvas
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Hud refs
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const orderListEl = document.getElementById('orderList');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');

  // Resize canvas to CSS pixels * DPR
  function fitCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // World helpers
  const WORLD = { w: () => canvas.getBoundingClientRect().width, h: () => canvas.getBoundingClientRect().height };
  const FLOOR_Y = () => Math.min(WORLD.h() - 120, WORLD.h() * 0.82);

  // Constants
  const INGREDIENT_SIZE = { w: 72, h: 24 };
  const TRAY = { w: 160, h: 20, speed: 520 };
  const GRAVITY = 980;
  const MAX_LIVES = 3;

  // Ingredient catalog
  const TYPES = [
    { key: 'patty',   label: 'Patty',   color: '#6b3d2c' },
    { key: 'cheese',  label: 'Cheese',  color: '#f4d03f' },
    { key: 'lettuce', label: 'Lettuce', color: '#2ecc71' },
    { key: 'tomato',  label: 'Tomato',  color: '#e74c3c' },
    { key: 'pickles', label: 'Pickles', color: '#27ae60' },
    { key: 'ketchup', label: 'Ketchup', color: '#c0392b' },
    { key: 'mustard', label: 'Mustard', color: '#f1c40f' },
    { key: 'onion',   label: 'Onion',   color: '#ecf0f1' },
    { key: 'topbun',  label: 'Top Bun', color: '#d5a253' },
    { key: 'golden',  label: 'Golden Patty', color: '#f7d04b' },
  ];
  const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]));

  function drawIngredient(g, x, y, w, h, label, color, rotten=false) {
    const r = 8;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x-r, y-h/2);
    g.arcTo(x+w+r, y-h/2, x+w+r, y+h/2, r);
    g.arcTo(x+w+r, y+h/2, x-r, y+h/2, r);
    g.arcTo(x-r, y+h/2, x-r, y-h/2, r);
    g.arcTo(x-r, y-h/2, x+w+r, y-h/2, r);
    g.closePath();
    g.fill();
    if (rotten) {
      // purple stripes
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = '#7d3c98';
      const stripes = 4;
      for (let i=0;i<stripes;i++) {
        g.fillRect(x-10 + i*(w/stripes), y-h/2, w/stripes/2, h);
      }
      g.restore();
    }
    g.fillStyle = '#0b0f14';
    g.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, x + w/2 - 4, y);
  }

  // Recipes (endless, no per-order timer)
  const RECIPES = [
    { name: 'Cheeseburger', seq: ['patty', 'cheese', 'topbun'] },
    { name: 'Classic', seq: ['patty', 'cheese', 'lettuce', 'tomato', 'ketchup', 'topbun'] },
    { name: 'Double', seq: ['patty', 'cheese', 'patty', 'cheese', 'topbun'] },
    { name: 'Garden Bite', seq: ['patty', 'lettuce', 'tomato', 'onion', 'mustard', 'topbun'] },
    { name: 'Pickle Pop', seq: ['patty', 'cheese', 'pickles', 'pickles', 'topbun'] },
  ];
  function randomRecipe(level) {
    const pool = level < 3 ? RECIPES.slice(0,3) : RECIPES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function formatOrderList(seq, progress) {
    orderListEl.innerHTML = '';
    seq.forEach((k, i) => {
      const li = document.createElement('li');
      li.textContent = TYPE_BY_KEY[k]?.label || k;
      if (i < progress) {
        li.style.opacity = '0.35';
        li.style.textDecoration = 'line-through';
      } else if (i === progress) {
        li.style.fontWeight = '700';
      }
      orderListEl.appendChild(li);
    });
  }

  // Input
  const input = { left: false, right: false };
  const keymap = { 'ArrowLeft': 'left', 'ArrowRight': 'right', 'a':'left', 'd':'right', 'A':'left', 'D':'right' };
  window.addEventListener('keydown', (e) => {
    const k = keymap[e.key]; if (k) { input[k] = true; e.preventDefault(); }
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    const k = keymap[e.key]; if (k) { input[k] = false; e.preventDefault(); }
  }, { passive: false });

  // Entities
  class Ingredient {
    constructor(typeKey, x, speedY, rotten=false) {
      this.type = TYPE_BY_KEY[typeKey];
      this.key = typeKey;
      this.x = x;
      this.y = -INGREDIENT_SIZE.h;
      this.vy = speedY;
      this.rotten = rotten;
      this.w = INGREDIENT_SIZE.w;
      this.h = INGREDIENT_SIZE.h;
    }
    update(dt) {
      this.vy += GRAVITY * dt * 0.25;
      this.y += this.vy * dt;
    }
    draw(g) {
      drawIngredient(g, this.x - this.w/2, this.y, this.w, this.h, this.type.label, this.type.color, this.rotten);
    }
    offscreen() { return this.y - this.h/2 > WORLD.h() + 40; }
  }

  // Game state
  const state = {
    running: false,
    score: 0,
    lives: MAX_LIVES,
    level: 1,
    trayPos: Math.floor(WORLD.w()/2),
    ingredients: [],
    spawnTimer: 0,
    spawnEvery: 0.9,
    currentOrder: null,
    orderProgress: 0,
    combo: 0,
    stack: [],
  };

  function expectedKey() {
    return state.currentOrder?.seq[state.orderProgress];
  }

  function resetGame() {
    // fully reset state and overlay for clean restart
    state.running = true;
    state.score = 0;
    state.lives = MAX_LIVES;
    state.level = 1;
    state.trayPos = Math.floor(WORLD.w()/2);
    state.ingredients = [];
    state.spawnEvery = 0.9;
    state.combo = 0;
    state.stack = [];
    nextOrder();
    document.body.classList.remove('bad-flash');
    overlay.classList.add('hidden');
    updateHUD();
  }

  function nextOrder() {
    state.currentOrder = randomRecipe(state.level);
    state.orderProgress = 0;
    state.stack = [];
    formatOrderList(state.currentOrder.seq, state.orderProgress);
  }

  function updateHUD() {
    scoreEl.textContent = `Score: ${state.score}`;
    livesEl.textContent = `Lives: ${'❤️'.repeat(state.lives)}`;
    levelEl.textContent = `Level: ${state.level}`;
  }

  function spawnIngredient(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(0.35, state.spawnEvery - state.level*0.02);

      const keys = TYPES.map(t => t.key);
      const want = expectedKey();
      const good = keys.filter(k => k !== 'golden');

      // Weighted pool (bias expected): 45% expected, 40% random good, 12% rotten, 3% golden
      const pool = [];
      if (want) for (let i=0;i<45;i++) pool.push(want);
      for (let i=0;i<40;i++) pool.push(good[Math.floor(Math.random()*good.length)]);
      for (let i=0;i<12;i++) pool.push('ROTTEN');
      for (let i=0;i<3;i++) pool.push('golden');

      let key = pool[Math.floor(Math.random() * pool.length)];
      let rotten = false;
      if (key === 'ROTTEN') {
        rotten = true;
        key = good[Math.floor(Math.random()*good.length)];
      }
      // Avoid spawning topbun too early unless it's expected
      if (key === 'topbun' && key !== want && state.orderProgress < Math.max(1, state.currentOrder.seq.length-2) && Math.random() < 0.9) {
        key = 'cheese';
      }

      const x = 40 + Math.random() * (WORLD.w() - 80);
      const vy = 120 + Math.random() * (140 + state.level*18);
      state.ingredients.push(new Ingredient(key, x, vy, rotten));
    }
  }

  function collideAndCollect() {
    const tx = state.trayPos - TRAY.w/2;
    const ty = FLOOR_Y();
    const tw = TRAY.w;
    const th = TRAY.h;

    for (let i = state.ingredients.length-1; i >= 0; i--) {
      const ing = state.ingredients[i];
      const withinX = ing.x > tx && ing.x < (tx + tw);
      const withinY = ing.y + ing.h/2 >= ty && ing.y - ing.h/2 <= ty + th;
      if (withinX && withinY) {
        state.ingredients.splice(i,1);

        if (ing.rotten) {
          // Rotten: purple, -1 life, score penalty
          state.score = Math.max(0, state.score - 20);
          state.combo = 0;
          state.lives = Math.max(0, state.lives - 1);
          if (state.lives <= 0) { gameOver(); return; }
          updateHUD();
          flashBad();
          continue;
        }

        const want = expectedKey();
        if (ing.key === 'golden') {
          // Golden Patty: +1 life (cap), score bonus
          state.lives = Math.min(MAX_LIVES, state.lives + 1);
          state.score += 100;
          updateHUD();
          continue;
        } else if (ing.key === want) {
          state.orderProgress++;
          state.combo++;
          state.score += 50 + state.combo * 5;
          state.stack.push(ing.key);
          formatOrderList(state.currentOrder.seq, state.orderProgress);
          if (state.orderProgress >= state.currentOrder.seq.length) {
            // Order complete!
            const comboBonus = Math.min(200, state.combo * 10);
            state.score += 150 + comboBonus;
            if (state.score > state.level * 600) state.level++;
            nextOrder();
          }
        } else {
          // wrong ingredient
          state.score = Math.max(0, state.score - 15);
          state.combo = 0;
          flashBad();
        }
      }
    }
  }

  function flashBad() {
    document.body.classList.remove('bad-flash');
    void document.body.offsetWidth;
    document.body.classList.add('bad-flash');
  }

  function update(dt) {
    // Move tray
    if (input.left)  state.trayPos = Math.max(TRAY.w/2, state.trayPos - TRAY.speed * dt);
    if (input.right) state.trayPos = Math.min(WORLD.w() - TRAY.w/2, state.trayPos + TRAY.speed * dt);

    spawnIngredient(dt);
    state.ingredients.forEach(ing => ing.update(dt));
    state.ingredients = state.ingredients.filter(ing => !ing.offscreen());

    collideAndCollect();
    updateHUD();
  }

  function draw() {
    ctx.clearRect(0,0, WORLD.w(), WORLD.h());
    const gy = FLOOR_Y();
    ctx.fillStyle = '#0e1520';
    ctx.fillRect(0, gy+TRAY.h, WORLD.w(), WORLD.h()-gy);
    ctx.fillStyle = '#121b28';
    ctx.fillRect(0, 0, WORLD.w(), gy);

    drawTray();
    state.ingredients.forEach(ing => ing.draw(ctx));

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, gy-2, WORLD.w(), 2);
  }

  function drawTray() {
    const tx = state.trayPos - TRAY.w/2;
    const ty = FLOOR_Y();
    // plate
    ctx.fillStyle = '#1a2433';
    ctx.fillRect(tx, ty, TRAY.w, TRAY.h);
    // bun bottom
    drawIngredient(ctx, tx + 8, ty - 14, TRAY.w - 16, 18, 'Bun', '#d5a253', false);

    // stacked layers
    const layerHeight = INGREDIENT_SIZE.h + 2;
    for (let i = 0; i < state.stack.length; i++) {
      const key = state.stack[i];
      const type = TYPE_BY_KEY[key];
      const y = ty - 14 - (i + 1) * layerHeight;
      drawIngredient(ctx, tx + 12, y, TRAY.w - 24, INGREDIENT_SIZE.h, type.label, type.color, false);
    }
  }

  function gameOver() {
    state.running = false;
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = 'Game Over';
    // Replace card body with a quick summary; button restarts
    const card = overlay.querySelector('.card');
    const list = card.querySelector('ol');
    if (list) list.remove(); // keep it tidy
    const h3 = card.querySelector('h3');
    if (h3) h3.textContent = 'Final Score';
    const p = document.createElement('p');
    p.textContent = `You scored ${state.score}. Press Start to play again.`;
    // Remove previous p if exists
    const prevP = card.querySelector('p');
    if (prevP) prevP.remove();
    card.insertBefore(p, card.querySelector('button'));
  }

  // Loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state.running) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  startBtn.addEventListener('click', resetGame);

  // Initialize HUD and initial order preview
  updateHUD();
  formatOrderList(['patty','cheese','topbun'], 0);
})();
