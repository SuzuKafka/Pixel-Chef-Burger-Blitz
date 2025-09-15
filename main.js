// Pixel Chef: Burger Blitz (Endless) — vanilla JS + Canvas
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Hud refs
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const streakEl = document.getElementById('streak');
  const orderListEl = document.getElementById('orderList');
  const orderNameEl = document.getElementById('orderName');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const muteBtn = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  const audio = window.audioEngine;

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
  const COLLISION_BAND = 16;

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
        audio.ensure();
        if (!audio.muted && audio.ctx) audio.tone(state.paused ? 520 : 760, 120, 'sine', 0.15);
        e.preventDefault();
        return;
      }
    }
    // M key to toggle mute
    if (e.key === 'm' || e.key === 'M') {
      audio.ensure();
      audio.setMuted(!audio.muted);
      if (muteBtn) muteBtn.textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
      e.preventDefault();
      return;
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
      this.angle = 0;
      this.angVel = rotten ? (Math.random()*2-1) * 2.2 : 0;
    }
    update(dt) {
      const gravScale = (this.key === 'golden' || this.rotten) ? 0.14 : 0.25;
      this.vy += GRAVITY * dt * gravScale;
      this.y += this.vy * dt;
      if (this.rotten && this.angVel) {
        this.angle += this.angVel * dt;
        if (this.angle > 0.35) { this.angle = 0.35; this.angVel *= -1; }
        if (this.angle < -0.35) { this.angle = -0.35; this.angVel *= -1; }
      }
    }
    draw(g) {
      const highlight = (!this.rotten && this.key === expectedKey());
      if (this.rotten && this.angle !== 0) {
        g.save(); g.translate(this.x, this.y); g.rotate(this.angle);
        drawIngredient(g, -this.w/2, 0, this.w, this.h, this.type.label, this.key, this.rotten);
        if (highlight) {
          g.shadowColor = '#6be7ff'; g.shadowBlur = 10; g.strokeStyle = '#6be7ff'; g.lineWidth = 2;
          g.strokeRect(-this.w/2 - 2, -this.h/2 - 2, this.w + 4, this.h + 4);
          g.shadowBlur = 0;
        }
        g.restore();
      } else {
        drawIngredient(g, this.x - this.w/2, this.y, this.w, this.h, this.type.label, this.key, this.rotten);
        if (highlight) {
          g.save(); g.shadowColor = '#6be7ff'; g.shadowBlur = 10; g.strokeStyle = '#6be7ff'; g.lineWidth = 2;
          g.strokeRect(this.x - this.w/2 - 2, this.y - this.h/2 - 2, this.w + 4, this.h + 4);
          g.shadowBlur = 0; g.restore();
        }
      }
    }
    offscreen() { return this.y - this.h/2 > WORLD.h() + 40; }
  }

  // Game state
  const state = {
    running: false,
    paused: false,
    score: 0,
    best: 0,
    lives: MAX_LIVES,
    level: 1,
    trayPos: Math.floor(WORLD.w()/2),
    ingredients: [],
    spawnTimer: 0,
    spawnEvery: 0.9,
    currentOrder: null,
    orderProgress: 0,
    combo: 0,
    streak: 0,
    stack: [],
    // Blink state when an order is completed
    pendingNextOrder: false,
    completeBlinkTime: 0,
    completeBlinkToggle: 0,
    completeBlinkOn: true,
    // Juice
    particles: [],
    shakeTime: 0, shakeMag: 0,
    // Slow-mo
    timeScale: 1, slowmoTime: 0,
    // Stats
    stats: { orders: 0, correct: 0, wrong: 0, rotten: 0, golden: 0, longestStreak: 0 },
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
    state.streak = 0;
    state.stats = { orders: 0, correct: 0, wrong: 0, rotten: 0, golden: 0, longestStreak: 0 };
    state.particles = [];
    state.shakeTime = 0; state.shakeMag = 0;
    state.timeScale = 1; state.slowmoTime = 0;
    state.stack = [];
    nextOrder();
    document.body.classList.remove('bad-flash');
    overlay.classList.add('hidden');
    updateHUD();
    // init audio context on user gesture; subtle start ping
    audio.ensure();
    if (muteBtn) muteBtn.textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
    if (volumeSlider) {
      // sync slider to current gain
      const percent = Math.round((audio.gain / audio.maxGain) * 100);
      volumeSlider.value = String(percent);
      if (volumeValue) volumeValue.textContent = `${percent}%`;
    }
    if (!audio.muted && audio.ctx) audio.tone(740, 140, 'triangle', 0.15);
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
    if (bestEl) bestEl.textContent = `Best: ${state.best}`;
    if (streakEl) {
      if (state.streak >= 3) { streakEl.style.display = ''; streakEl.textContent = `🔥 Streak: ${state.streak}`; }
      else { streakEl.style.display = 'none'; }
    }
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
  // Particles and screen shake
  class Particle {
    constructor(x,y,vx,vy,life,color,size=3){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.maxLife=life; this.color=color; this.size=size; }
    update(dt){ this.life-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=400*dt; }
    draw(g){ if(this.life<=0) return; const a=Math.max(0,this.life/this.maxLife); g.fillStyle=this.color.replace('ALPHA', a.toFixed(2)); g.fillRect(this.x, this.y, this.size, this.size); }
    alive(){ return this.life>0; }
  }
  function spawnBurst(x,y,color,count=10,speed=120,spread=Math.PI){
    for(let i=0;i<count;i++){ const ang=(Math.random()-0.5)*spread; const s=speed*(0.5+Math.random()); state.particles.push(new Particle(x,y,Math.cos(ang)*s,Math.sin(ang)*s,0.5+Math.random()*0.4,color,3)); }
  }
  function addShake(mag=8,time=0.12){ state.shakeMag=Math.max(state.shakeMag,mag); state.shakeTime=Math.max(state.shakeTime,time); }

  function collideAndCollect() {
    // During completion blink, freeze collection
    if (state.pendingNextOrder) return;
    const tx = state.trayPos - TRAY.w/2;
    const ty = FLOOR_Y();

    // Compute the current burger top surface and catch band matching the next layer's width
    const want = expectedKey();
    const layerHeight = INGREDIENT_SIZE.h + 2;
    const bottomCenterY = ty - 14; // bottom bun center y
    const bottomTopY = bottomCenterY - 18/2; // top surface of bottom bun
    let topY = bottomTopY;
    if (state.stack.length > 0) {
      const lastKey = state.stack[state.stack.length - 1];
      const lastIsTopBun = lastKey === 'topbun';
      const lastCenterY = bottomCenterY - (state.stack.length) * layerHeight; // matches draw Y for i=length-1
      const lastH = lastIsTopBun ? 18 : INGREDIENT_SIZE.h;
      topY = lastCenterY - lastH/2; // top surface of the current stack
    }
    // Define catch band rectangle around topY
    const bandThickness = COLLISION_BAND; // thin band for outline-like collision
    const bandY1 = topY - bandThickness/2;
    const bandY2 = topY + bandThickness/2;
    // Width and x offset depend on next expected key (top bun is wider)
    const isTopNext = want === 'topbun';
    const bandX = tx + (isTopNext ? 8 : 12);
    const bandW = (isTopNext ? (TRAY.w - 16) : (TRAY.w - 24));
    const bandX2 = bandX + bandW;

    for (let i = state.ingredients.length-1; i >= 0; i--) {
      const ing = state.ingredients[i];
      // Ingredient rectangle
      const ix1 = ing.x - ing.w/2;
      const ix2 = ing.x + ing.w/2;
      const iy1 = ing.y - ing.h/2;
      const iy2 = ing.y + ing.h/2;
      // Rect overlap with top band
      const overlapX = ix1 < bandX2 && ix2 > bandX;
      const overlapY = iy1 < bandY2 && iy2 > bandY1;
      if (overlapX && overlapY) {
        state.ingredients.splice(i,1);

        if (ing.rotten) {
          // Rotten: purple, -1 life, score penalty
          state.score = Math.max(0, state.score - 20);
          state.combo = 0;
          state.streak = 0;
          state.stats.rotten++;
          state.lives = Math.max(0, state.lives - 1);
          if (state.lives <= 0) { gameOver(); return; }
          updateHUD();
          flashBad();
          addShake(10,0.18);
          spawnBurst(ing.x, bandY1, 'rgba(187,51,255,ALPHA)', 16, 140, Math.PI);
          audio.ensure();
          if (!audio.muted && audio.ctx) audio.sweep(420, 160, 300, 'square', 0.20);
          continue;
        }

        const want = expectedKey();
        if (ing.key === 'golden') {
          // Golden Patty: +1 life (cap), score bonus
          state.lives = Math.min(MAX_LIVES, state.lives + 1);
          state.score += 100;
          state.stats.golden++;
          state.slowmoTime = 0.35; state.timeScale = 0.55; // slow-mo
          updateHUD();
          audio.ensure();
          if (!audio.muted && audio.ctx) audio.arp([880, 1320, 1760], 110, 'sine', 0.22);
          continue;
        } else if (ing.key === want) {
          state.orderProgress++;
          state.combo++;
          state.streak++;
          state.stats.correct++;
          state.stats.longestStreak = Math.max(state.stats.longestStreak, state.streak);
          state.score += 50 + state.combo * 5;
          state.stack.push(ing.key);
          formatOrderList(state.currentOrder.seq, state.orderProgress);
    if (orderNameEl) orderNameEl.textContent = state.currentOrder.name || '';
          // correct catch plink scaled by combo
          audio.ensure();
          if (!audio.muted && audio.ctx) {
            const f = 560 + Math.min(6, state.combo) * 60;
            audio.tone(f, 120, 'square', 0.16);
          }
          spawnBurst(ing.x, bandY1, 'rgba(255,215,120,ALPHA)', 10, 120, Math.PI/1.5);
          if (state.orderProgress >= state.currentOrder.seq.length) {
            // Order complete! Start blink animation, then advance order
            const comboBonus = Math.min(200, state.combo * 10);
            state.score += 150 + comboBonus;
            const prevLevel = state.level;
            if (state.score > state.level * 600) state.level++;
            audio.ensure();
            if (!audio.muted && audio.ctx) {
              // completion jingle
              audio.arp([523, 659, 784], 160, 'triangle', 0.22);
              // level-up fanfare if applied
              if (state.level > prevLevel) audio.arp([523, 784, 1046], 200, 'sine', 0.24);
            }
            state.stats.orders++;
            state.pendingNextOrder = true;
            state.completeBlinkTime = 0.9; // seconds
            state.completeBlinkToggle = 0;
            state.completeBlinkOn = true;
          }
        } else {
          // wrong ingredient
          state.score = Math.max(0, state.score - 15);
          state.combo = 0;
          state.streak = 0;
          state.stats.wrong++;
          flashBad();
          audio.ensure();
          if (!audio.muted && audio.ctx) {
            audio.sweep(260, 200, 110, 'saw', 0.20);
            setTimeout(() => { audio.sweep(260, 200, 110, 'saw', 0.20); }, 120);
          }
          addShake(8,0.14);
          spawnBurst(ing.x, bandY1, 'rgba(230,60,60,ALPHA)', 14, 130, Math.PI);
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
    // Slow-mo
    if (state.slowmoTime > 0) { state.slowmoTime -= dt; if (state.slowmoTime <= 0) state.timeScale = 1; }
    const t = dt * (state.timeScale || 1);
    // Move tray
    if (input.left)  state.trayPos = Math.max(TRAY.w/2, state.trayPos - TRAY.speed * t);
    if (input.right) state.trayPos = Math.min(WORLD.w() - TRAY.w/2, state.trayPos + TRAY.speed * t);

    // Handle completion blink phase
    if (state.pendingNextOrder) {
      state.completeBlinkTime -= t;
      state.completeBlinkToggle += t;
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
      spawnIngredient(t);
      state.ingredients.forEach(ing => ing.update(t));
      state.ingredients = state.ingredients.filter(ing => !ing.offscreen());

      collideAndCollect();
    }
    // Particles and shake
    state.particles.forEach(p => p.update(t));
    state.particles = state.particles.filter(p => p.alive());
    if (state.shakeTime > 0) state.shakeTime -= dt;
    updateHUD();
  }

  function draw() {
    ctx.clearRect(0,0, WORLD.w(), WORLD.h());
    const gy = FLOOR_Y();
    ctx.fillStyle = '#0e1520';
    ctx.fillRect(0, gy+TRAY.h, WORLD.w(), WORLD.h()-gy);
    ctx.fillStyle = '#121b28';
    ctx.fillRect(0, 0, WORLD.w(), gy);

    // Screen shake translate
    if (state.shakeTime > 0) {
      const m = state.shakeMag * Math.max(0, Math.min(1, state.shakeTime / 0.2));
      ctx.save();
      ctx.translate((Math.random()*2-1)*m, (Math.random()*2-1)*m);
      drawTray();
      state.ingredients.forEach(ing => ing.draw(ctx));
      state.particles.forEach(p => p.draw(ctx));
      ctx.restore();
    } else {
      drawTray();
      state.ingredients.forEach(ing => ing.draw(ctx));
      state.particles.forEach(p => p.draw(ctx));
    }

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
    audio.ensure();
    if (!audio.muted && audio.ctx) audio.sweep(440, 110, 650, 'sine', 0.22);
    state.running = false;
    overlay.classList.remove('hidden');
    overlay.querySelector('h1').textContent = 'Game Over';
    // Replace card body with a quick summary; button restarts
    const card = overlay.querySelector('.card');
    const list = card.querySelector('ol');
    if (list) list.remove(); // keep it tidy
    const h3 = card.querySelector('h3');
    if (h3) h3.textContent = 'Final Score';
    const prev = card.querySelector('.stats-block');
    if (prev) prev.remove();
    // Update high score
    if (state.score > (state.best||0)) { state.best = state.score; try { localStorage.setItem('pcbb_high_score', String(state.best)); } catch {} }
    const accTotal = state.stats.correct + state.stats.wrong + state.stats.rotten;
    const acc = accTotal ? Math.round((state.stats.correct/accTotal)*100) : 0;
    const div = document.createElement('div');
    div.className = 'stats-block';
    div.innerHTML = `
      <p>You scored ${state.score}. Best: ${state.best}</p>
      <ul style="text-align:left;max-width:420px;margin:8px auto;">
        <li>Orders completed: ${state.stats.orders}</li>
        <li>Accuracy: ${acc}%</li>
        <li>Longest streak: ${state.stats.longestStreak}</li>
        <li>Golden caught: ${state.stats.golden}, Rotten hit: ${state.stats.rotten}</li>
      </ul>
    `;
    card.insertBefore(div, card.querySelector('button'));
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
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      audio.ensure();
      audio.setMuted(!audio.muted);
      muteBtn.textContent = audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
    });
  }
  if (volumeSlider) {
    // initialize slider label to current percentage
    const setVolLabel = () => {
      const percent = Math.round((audio.gain / audio.maxGain) * 100);
      volumeValue.textContent = `${percent}%`;
    };
    setVolLabel();
    volumeSlider.addEventListener('input', () => {
      audio.ensure();
      const v = Number(volumeSlider.value) / 100; // 0..1
      audio.setVolume(v);
      // if muted, unmute on user volume change
      if (audio.muted) {
        audio.setMuted(false);
        if (muteBtn) muteBtn.textContent = '🔊 Sound: On';
      }
      setVolLabel();
    });
  }

  // Initialize HUD and initial order preview
  try { const b = parseInt(localStorage.getItem('pcbb_high_score')||'0',10); if (!isNaN(b)) state.best = b; } catch {}
  updateHUD();
  formatOrderList(['patty','cheese','topbun'], 0);
})();
