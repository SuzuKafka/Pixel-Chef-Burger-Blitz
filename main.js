// Pixel Chef: Burger Blitz (Endless) — vanilla JS + Canvas
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Hud refs
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const orderListEl = document.getElementById('orderList');
  const orderNameEl = document.getElementById('orderName');
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
  const INGREDIENT_SIZE = { w: 128, h: 24 };
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
  const ING_COLORS = {
    patty:   { body: '#6b3d2c', text: '#0b0f14' },
    cheese:  { body: '#f4d03f', text: '#0b0f14' },
    lettuce: { body: '#2ecc71', text: '#0b0f14' },
    pickles: { body: '#1f8f55', text: '#ffffff' },
    tomato:  { body: '#ff6b6b', text: '#0b0f14' }, // light red, dark text
    ketchup: { body: '#a32020', text: '#ffffff' }, // dark red, white text
    mustard: { body: '#c9a800', text: '#ffffff' }, // darker yellow vs cheese
    onion:   { body: '#f0f3f7', text: '#0b0f14' },
    topbun:  { body: '#d5a253', text: '#0b0f14' },
    golden:  { body: '#ffc107', text: '#0b0f14' }
  };


  function drawIngredient(g, x, y, w, h, label, key, rotten=false) {
    const r = 8;
    // Solid body color (or solid purple if rotten)
    let bodyColor = rotten ? '#bb33ff' : (ING_COLORS[key]?.body || '#cccccc');
    let textColor = rotten ? '#ffffff' : (ING_COLORS[key]?.text || '#0b0f14');
    const isGolden = key === 'golden' && !rotten;
    const isRotten = !!rotten;
    // Subtle glow for golden and rotten patties
    const prevShadowColor = g.shadowColor;
    const prevShadowBlur = g.shadowBlur;
    const prevLineWidth = g.lineWidth;
    const prevStrokeStyle = g.strokeStyle;
    if (isGolden) { g.shadowColor = '#ffd54f'; g.shadowBlur = 12; }
    if (isRotten) { g.shadowColor = '#d05cff'; g.shadowBlur = 12; }
    g.fillStyle = bodyColor;
    g.beginPath();
    g.moveTo(x - r, y - h/2);
    g.arcTo(x + w + r, y - h/2, x + w + r, y + h/2, r);
    g.arcTo(x + w + r, y + h/2, x - r, y + h/2, r);
    g.arcTo(x - r, y + h/2, x - r, y - h/2, r);
    g.arcTo(x - r, y - h/2, x + w + r, y - h/2, r);
    g.closePath();
    g.fill();
    if (isGolden || isRotten) {
      // Light outline to enhance look
      g.shadowBlur = 0; // outline without glow
      g.strokeStyle = isGolden ? '#ffe082' : '#efb3ff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - r, y - h/2);
      g.arcTo(x + w + r, y - h/2, x + w + r, y + h/2, r);
      g.arcTo(x + w + r, y + h/2, x - r, y + h/2, r);
      g.arcTo(x - r, y + h/2, x - r, y - h/2, r);
      g.arcTo(x - r, y - h/2, x + w + r, y - h/2, r);
      g.closePath();
      g.stroke();
      // restore glow values for future draws
      g.shadowColor = prevShadowColor;
      g.shadowBlur = prevShadowBlur;
      g.lineWidth = prevLineWidth;
      g.strokeStyle = prevStrokeStyle;
    }

    // Label (centered), using per-ingredient text color
    if (rotten) {
      g.fillStyle = '#ffffff';
      g.font = 'bold 12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Rotten', x + w/2 - 4, y);
    } else {
      g.fillStyle = textColor;
      g.font = 'bold 13px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, x + w/2 - 4, y);
    }
  }

  // Recipes (endless, no per-order timer)
  const RECIPES = [
    { name: 'Cheeseburger', seq: ['patty', 'cheese', 'topbun'] },
    { name: 'Classic', seq: ['patty', 'cheese', 'lettuce', 'tomato', 'ketchup', 'topbun'] },
    // Fixed: Double Cheeseburger should have two patties
    { name: 'Double Cheeseburger', seq: ['patty', 'cheese', 'patty', 'cheese', 'topbun'] },
    { name: 'Garden Bite', seq: ['patty', 'lettuce', 'tomato', 'onion', 'mustard', 'topbun'] },
    { name: 'Pickle Pop', seq: ['patty', 'cheese', 'pickles', 'pickles', 'topbun'] },
    { name: 'Mustard Melt', seq: ['patty', 'cheese', 'mustard', 'topbun'] },
    { name: 'Veg-Heavy', seq: ['patty', 'lettuce', 'pickles', 'tomato', 'onion', 'topbun'] },
    // New: King Burger (Big Mac inspired)
    { name: 'King Burger', seq: ['patty','cheese','lettuce','pickles','onion','patty','cheese','topbun'] }
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
    // Enter to start/restart from overlay or idle
    if (e.key === 'Enter') {
      if (!state.running || (overlay && !overlay.classList.contains('hidden'))) {
        resetGame();
        e.preventDefault();
        return;
      }
    }
    // P to pause/resume during gameplay
    if (e.key === 'p' || e.key === 'P') {
      if (state.running) {
        state.paused = !state.paused;
        if (state.paused) { input.left = false; input.right = false; }
        e.preventDefault();
        return;
      }
    }
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
      const gravScale = (this.key === 'golden' || this.rotten) ? 0.14 : 0.25;
      this.vy += GRAVITY * dt * gravScale;
      this.y += this.vy * dt;
    }
    draw(g) { drawIngredient(g, this.x - this.w/2, this.y, this.w, this.h, this.type.label, this.key, this.rotten); }
    offscreen() { return this.y - this.h/2 > WORLD.h() + 40; }
  }

  // Game state
  const state = {
    running: false,
    paused: false,
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
    // Blink state when an order is completed
    pendingNextOrder: false,
    completeBlinkTime: 0,
    completeBlinkToggle: 0,
    completeBlinkOn: true,
  };

  function expectedKey() {
    return state.currentOrder?.seq[state.orderProgress];
  }

  function resetGame() {
    // fully reset state and overlay for clean restart
    state.running = true;
    state.paused = false;
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
    if (orderNameEl) orderNameEl.textContent = state.currentOrder.name || '';
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
      // Golden and Rotten items fall slower
      let vy;
      if (key === 'golden' || rotten) {
        vy = 35 + Math.random() * 50; // even slower
      } else {
        vy = 120 + Math.random() * (140 + state.level*18);
      }
      state.ingredients.push(new Ingredient(key, x, vy, rotten));
    }
  }

  function collideAndCollect() {
    // During completion blink, freeze collection
    if (state.pendingNextOrder) return;
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
    if (orderNameEl) orderNameEl.textContent = state.currentOrder.name || '';
          if (state.orderProgress >= state.currentOrder.seq.length) {
            // Order complete! Start blink animation, then advance order
            const comboBonus = Math.min(200, state.combo * 10);
            state.score += 150 + comboBonus;
            if (state.score > state.level * 600) state.level++;
            state.pendingNextOrder = true;
            state.completeBlinkTime = 0.9; // seconds
            state.completeBlinkToggle = 0;
            state.completeBlinkOn = true;
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
    if (state.paused) { updateHUD(); return; }
    // Move tray
    if (input.left)  state.trayPos = Math.max(TRAY.w/2, state.trayPos - TRAY.speed * dt);
    if (input.right) state.trayPos = Math.min(WORLD.w() - TRAY.w/2, state.trayPos + TRAY.speed * dt);

    // Handle completion blink phase
    if (state.pendingNextOrder) {
      state.completeBlinkTime -= dt;
      state.completeBlinkToggle += dt;
      if (state.completeBlinkToggle >= 0.15) {
        state.completeBlinkToggle = 0;
        state.completeBlinkOn = !state.completeBlinkOn;
      }
      if (state.completeBlinkTime <= 0) {
        state.pendingNextOrder = false;
        state.completeBlinkOn = true;
        nextOrder();
      }
    } else {
      spawnIngredient(dt);
      state.ingredients.forEach(ing => ing.update(dt));
      state.ingredients = state.ingredients.filter(ing => !ing.offscreen());

      collideAndCollect();
    }
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
    
    // Paused banner overlay
    if (state.paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, WORLD.w(), WORLD.h());
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Paused — press P to resume', WORLD.w()/2, WORLD.h()/2);
      ctx.restore();
    }
  }

  function drawTray() {
    const tx = state.trayPos - TRAY.w/2;
    const ty = FLOOR_Y();
    // plate
    ctx.fillStyle = '#1a2433';
    ctx.fillRect(tx, ty, TRAY.w, TRAY.h);
    // bun bottom
    // Blink the completed burger (bottom bun + stack) when pending next order
    const savedAlpha = ctx.globalAlpha;
    if (state.pendingNextOrder && !state.completeBlinkOn) ctx.globalAlpha = 0.2;
    drawIngredient(ctx, tx + 8, ty - 14, TRAY.w - 16, 18, 'Bun', 'topbun', false);

    // stacked layers
    const layerHeight = INGREDIENT_SIZE.h + 2;
    for (let i = 0; i < state.stack.length; i++) {
      const key = state.stack[i];
      const type = TYPE_BY_KEY[key];
      const y = ty - 14 - (i + 1) * layerHeight;
      // Make only the top bun match the bottom bun's size
      if (key === 'topbun') {
        drawIngredient(ctx, tx + 8, y, TRAY.w - 16, 18, type.label, key, false);
      } else {
        drawIngredient(ctx, tx + 12, y, TRAY.w - 24, INGREDIENT_SIZE.h, type.label, key, false);
      }
    }
    // Restore alpha after blink
    ctx.globalAlpha = savedAlpha;
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
