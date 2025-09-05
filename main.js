// Minimal, playable "Pixel Chef: Burger Blitz" — vanilla JS + Canvas
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Hud refs
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const orderListEl = document.getElementById('orderList');
  const timerEl = document.getElementById('timer');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');

  // Resize canvas to device pixels
  function fitCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Game constants
  const FLOOR_Y = () => Math.min(window.innerHeight - 120, window.innerHeight * 0.82);
  const WORLD = { w: () => window.innerWidth, h: () => window.innerHeight };
  const INGREDIENT_SIZE = { w: 72, h: 24 };
  const TRAY = { w: 160, h: 20, speed: 520 };
  const GRAVITY = 980; // px/s^2
  const MAX_LIVES = 3;

  // Ingredient catalog & drawing
  const TYPES = [
    { key: 'patty', label: 'Patty', color: '#6b3d2c' },
    { key: 'cheese', label: 'Cheese', color: '#f4d03f' },
    { key: 'lettuce', label: 'Lettuce', color: '#2ecc71' },
    { key: 'tomato', label: 'Tomato', color: '#e74c3c' },
    { key: 'pickles', label: 'Pickles', color: '#27ae60' },
    { key: 'ketchup', label: 'Ketchup', color: '#c0392b' },
    { key: 'mustard', label: 'Mustard', color: '#f1c40f' },
    { key: 'onion', label: 'Onion', color: '#ecf0f1' },
    { key: 'topbun', label: 'Top Bun', color: '#d5a253' },
  ];

  const TYPE_BY_KEY = Object.fromEntries(TYPES.map(t => [t.key, t]));

  function drawIngredient(g, x, y, w, h, label, color, rotten=false) {
    // Rounded rect
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
      // glitch stripes
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = '#6c1b1b';
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

  // Orders (recipes) — bottom bun is implicit; you must end with 'topbun'
  const RECIPES = [
    { name: 'Cheeseburger', seq: ['patty', 'cheese', 'topbun'], time: 18 },
    { name: 'Classic', seq: ['patty', 'cheese', 'lettuce', 'tomato', 'ketchup', 'topbun'], time: 24 },
    { name: 'Double', seq: ['patty', 'cheese', 'patty', 'cheese', 'topbun'], time: 26 },
    { name: 'Garden Bite', seq: ['patty', 'lettuce', 'tomato', 'onion', 'mustard', 'topbun'], time: 24 },
    { name: 'Pickle Pop', seq: ['patty', 'cheese', 'pickles', 'pickles', 'topbun'], time: 22 },
  ];

  function randomRecipe(level) {
    // Increase chance of longer recipes as level grows
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
      this.vy += GRAVITY * dt * 0.25; // gentle accel
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
    trayX: () => Math.floor(WORLD.w()/2),
    trayY: () => FLOOR_Y(),
    trayPos: Math.floor(WORLD.w()/2),
    ingredients: [],
    spawnTimer: 0,
    spawnEvery: 0.9, // seconds; decreases with levels
    currentOrder: null,
    orderProgress: 0,
    orderTimeLeft: 0,
    combo: 0,
  };

  function resetGame() {
    state.running = true;
    state.score = 0;
    state.lives = MAX_LIVES;
    state.level = 1;
    state.trayPos = Math.floor(WORLD.w()/2);
    state.ingredients = [];
    state.spawnEvery = 0.9;
    nextOrder();
    overlay.classList.add('hidden');
    updateHUD();
  }

  function nextOrder() {
    state.currentOrder = randomRecipe(state.level);
    state.orderProgress = 0;
    // order time scales with length and level
    state.orderTimeLeft = state.currentOrder.time - Math.min(state.level*1.2, 10);
    formatOrderList(state.currentOrder.seq, state.orderProgress);
  }

  function updateHUD() {
    scoreEl.textContent = `Score: ${state.score}`;
    livesEl.textContent = `Lives: ${'❤️'.repeat(state.lives)}`;
    levelEl.textContent = `Level: ${state.level}`;
    timerEl.textContent = `⏱ ${Math.max(0, state.orderTimeLeft).toFixed(1)}s`;
  }

  function expectedKey() {
    return state.currentOrder.seq[state.orderProgress];
  }

  function spawnIngredient(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(0.35, state.spawnEvery - state.level*0.02);
      // Weighted choice: mostly good, some rotten, some off-order decoys
      const keys = TYPES.map(t => t.key);
      const pool = [...keys, ...keys, ...keys, 'ROTTEN']; // ~25% rotten
      let key = pool[Math.floor(Math.random() * pool.length)];
      let rotten = false;
      if (key === 'ROTTEN') {
        rotten = true;
        // rotten mimics a random type for looks
        key = keys[Math.floor(Math.random()*keys.length)];
      }
      // Don't spawn topbun too early too often
      if (key === 'topbun' && state.orderProgress < Math.max(1, state.currentOrder.seq.length-2) && Math.random() < 0.8) {
        key = 'cheese';
      }
      const x = 40 + Math.random() * (WORLD.w() - 80);
      const vy = 120 + Math.random() * (140 + state.level*18);
      state.ingredients.push(new Ingredient(key, x, vy, rotten));
    }
  }

  function collideAndCollect() {
    // Tray rectangle
    const tx = state.trayPos - TRAY.w/2;
    const ty = state.trayY();
    const tw = TRAY.w;
    const th = TRAY.h;

    for (let i = state.ingredients.length-1; i >= 0; i--) {
      const ing = state.ingredients[i];
      const withinX = ing.x > tx && ing.x < (tx + tw);
      const withinY = ing.y + ing.h/2 >= ty && ing.y - ing.h/2 <= ty + th;
      if (withinX && withinY) {
        // Collected!
        state.ingredients.splice(i,1);
        if (ing.rotten) {
          // penalty
          state.score = Math.max(0, state.score - 20);
          state.combo = 0;
          flashBad();
          continue;
        }
        const want = expectedKey();
        if (ing.key === want) {
          state.orderProgress++;
          state.combo++;
          state.score += 50 + state.combo * 5;
          formatOrderList(state.currentOrder.seq, state.orderProgress);
          if (state.orderProgress >= state.currentOrder.seq.length) {
            // Order completed!
            const speedBonus = Math.floor(Math.max(0, state.orderTimeLeft) * 6);
            const comboBonus = Math.min(200, state.combo * 10);
            state.score += 150 + speedBonus + comboBonus;
            // level up occasionally
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
    // force reflow
    void document.body.offsetWidth;
    document.body.classList.add('bad-flash');
  }

  function update(dt) {
    // Move tray
    if (input.left)  state.trayPos = Math.max(TRAY.w/2, state.trayPos - TRAY.speed * dt);
    if (input.right) state.trayPos = Math.min(WORLD.w() - TRAY.w/2, state.trayPos + TRAY.speed * dt);

    // Spawn & update ingredients
    spawnIngredient(dt);
    state.ingredients.forEach(ing => ing.update(dt));

    // Remove offscreen
    state.ingredients = state.ingredients.filter(ing => !ing.offscreen());

    // Collide/collect
    collideAndCollect();

    // Order timer
    state.orderTimeLeft -= dt;
    if (state.orderTimeLeft <= 0) {
      // failed order
      state.lives--;
      state.combo = 0;
      if (state.lives <= 0) {
        gameOver();
      } else {
        nextOrder();
      }
    }

    updateHUD();
  }

  function draw() {
    // clear
    ctx.clearRect(0,0, WORLD.w(), WORLD.h());

    // floor line / kitchen
    const gy = state.trayY();
    ctx.fillStyle = '#0e1520';
    ctx.fillRect(0, gy+TRAY.h, WORLD.w(), WORLD.h()-gy);
    ctx.fillStyle = '#121b28';
    ctx.fillRect(0, 0, WORLD.w(), gy);

    // tray (bun bottom + plate)
    drawTray();

    // falling ingredients
    state.ingredients.forEach(ing => ing.draw(ctx));

    // UI hints
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, gy-2, WORLD.w(), 2);
  }

  function drawTray() {
    const tx = state.trayPos - TRAY.w/2;
    const ty = state.trayY();
    // plate
    ctx.fillStyle = '#1a2433';
    ctx.fillRect(tx, ty, TRAY.w, TRAY.h);
    // bun bottom visual
    drawIngredient(ctx, tx + 8, ty - 14, TRAY.w - 16, 18, 'Bun', '#d5a253', false);
  }

  function gameOver() {
    state.running = false;
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = 'Game Over';
    overlay.querySelector('p').textContent = `Final score: ${state.score}. Press Start to play again.`;
  }

  // Loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); // clamp
    last = now;
    if (state.running) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start
  startBtn.addEventListener('click', resetGame);

  overlay.classList.remove('hidden'); // show overlay at load

  // Initialize static HUD
  updateHUD();
  formatOrderList(['patty','cheese','topbun'], 0);
})();
