import { S } from './state.js';
import {
  W, H, PLATFORM_Y, PLATFORM_X, PLATFORM_W, PLATFORM_H,
  THEMES,
  FLOAT_PLAT_W, FLOAT_PLAT_H, FLOAT_PLAT_LIFETIME, FLOAT_PLAT_WARN_TIME,
  FLOAT_PLAT_FADE_IN, FLOAT_PLAT_SPAWN_CD, FLOAT_PLAT_MAX, FLOAT_PLAT_SLOTS,
} from './constants.js';
import { random } from './rng.js';
import { spawnParticles } from './effects.js';
import { playSound } from './audio.js';

// ============================================================
// THEME HELPERS
// ============================================================
export function getThemeIndex(r) {
  for (let i = THEMES.length - 1; i >= 0; i--) {
    if (r >= THEMES[i].minRound) return i;
  }
  return 0;
}

export function getTheme() {
  return THEMES[S.currentThemeIndex];
}

function getBackgroundStyle(theme) {
  if (theme.name === 'CASTLE') return 'castle';
  if (theme.name === 'DUPONT CIRCLE DC') return 'dupont';
  if (theme.ambientType === 'stars') return 'space';
  if (theme.ambientType === 'spores') return 'jungle';
  return 'volcanic';
}

// ============================================================
// AMBIENT PARTICLES (theme-aware: stars / spores / embers)
// ============================================================
export function initAmbientParticles() {
  S.ambientParticles = [];
  const theme = getTheme();
  const count = theme.ambientCount;
  for (let i = 0; i < count; i++) {
    S.ambientParticles.push(createAmbientParticle(theme, true));
  }
}

export function createAmbientParticle(theme, randomY) {
  const t = theme.ambientType;
  if (t === 'stars') {
    return {
      x: random() * W,
      y: randomY ? random() * H : 0,
      size: random() * 2 + 0.5,
      speed: random() * 20 + 5,
      brightness: random() * 0.5 + 0.5,
      type: 'stars'
    };
  } else if (t === 'spores') {
    return {
      x: random() * W,
      y: randomY ? random() * H : H + random() * 40,
      size: random() * 3 + 1.5,
      speed: -(15 + random() * 25), // drift upward
      drift: (random() - 0.5) * 20,
      brightness: random() * 0.6 + 0.3,
      glowPhase: random() * Math.PI * 2,
      type: 'spores'
    };
  } else { // embers
    return {
      x: random() * W,
      y: randomY ? random() * H : H + random() * 20,
      size: random() * 2.5 + 1,
      speed: -(40 + random() * 60), // fast upward
      drift: (random() - 0.5) * 30,
      brightness: random() * 0.8 + 0.2,
      glowPhase: random() * Math.PI * 2,
      hue: random() < 0.6 ? 0 : 1, // 0=orange, 1=red
      type: 'embers'
    };
  }
}

export function updateAmbientParticles(dt) {
  const theme = getTheme();
  for (const s of S.ambientParticles) {
    if (s.type === 'stars') {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = 0; s.x = random() * W; }
      s.brightness = 0.5 + 0.5 * Math.sin(S.tickCount * 0.06 * s.speed * 0.1);
    } else if (s.type === 'spores') {
      s.y += s.speed * dt;
      s.x += s.drift * dt;
      s.glowPhase += dt * 2;
      s.brightness = 0.3 + 0.3 * Math.sin(s.glowPhase);
      if (s.y < -10) { s.y = H + 10; s.x = random() * W; }
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;
    } else { // embers
      s.y += s.speed * dt;
      s.x += s.drift * dt;
      s.glowPhase += dt * 4;
      s.brightness = 0.4 + 0.4 * Math.sin(s.glowPhase);
      if (s.y < -10) { s.y = H + 10; s.x = random() * W; }
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;
    }
  }
}

export function drawAmbientParticles() {
  const ctx = S.ctx;
  for (const s of S.ambientParticles) {
    if (s.type === 'stars') {
      ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    } else if (s.type === 'spores') {
      ctx.fillStyle = `rgba(80,255,80,${s.brightness})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      // glow halo
      ctx.fillStyle = `rgba(60,200,60,${s.brightness * 0.3})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else { // embers
      const r = s.hue === 0 ? 255 : 220;
      const g = s.hue === 0 ? 140 : 50;
      const b = s.hue === 0 ? 20 : 10;
      ctx.fillStyle = `rgba(${r},${g},${b},${s.brightness})`;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      // glow
      ctx.fillStyle = `rgba(${r},${g},${b},${s.brightness * 0.2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// BACKGROUND DETAILS (pre-computed, regenerated on theme change)
// ============================================================
export function initBgDetails() {
  S.bgDetails = {};
  const theme = getTheme();
  const bgStyle = getBackgroundStyle(theme);

  if (bgStyle === 'space') {
    // Hull panel lines for space station
    S.bgDetails.hullPanels = [];
    for (let i = 0; i < 8; i++) {
      S.bgDetails.hullPanels.push({
        x: random() * W,
        y: random() * PLATFORM_Y * 0.8,
        w: 40 + random() * 80,
        h: 30 + random() * 60
      });
    }
  } else if (bgStyle === 'jungle') {
    // Hanging vines at top
    S.bgDetails.vines = [];
    for (let i = 0; i < 12; i++) {
      const x = 20 + random() * (W - 40);
      const segments = 4 + Math.floor(random() * 5);
      const vine = { x, segments: [], berries: [] };
      let cy = 0;
      for (let j = 0; j < segments; j++) {
        cy += 12 + random() * 18;
        vine.segments.push({ x: x + (random() - 0.5) * 20, y: cy });
      }
      // Glowing berries at ends
      if (random() < 0.6) {
        const last = vine.segments[vine.segments.length - 1];
        vine.berries.push({ x: last.x, y: last.y + 4, phase: random() * Math.PI * 2 });
      }
      S.bgDetails.vines.push(vine);
    }
    // Canopy silhouettes
    S.bgDetails.canopy = [];
    for (let i = 0; i < 6; i++) {
      S.bgDetails.canopy.push({
        x: random() * W,
        r: 40 + random() * 60,
        y: -10 + random() * 20
      });
    }
  } else if (bgStyle === 'volcanic') {
    // Stalactites at top
    S.bgDetails.stalactites = [];
    for (let i = 0; i < 10; i++) {
      S.bgDetails.stalactites.push({
        x: 20 + random() * (W - 40),
        w: 6 + random() * 10,
        h: 20 + random() * 50
      });
    }
    // Magma vein cracks in background
    S.bgDetails.magmaVeins = [];
    for (let i = 0; i < 5; i++) {
      const startX = random() * W;
      const startY = 50 + random() * (PLATFORM_Y - 100);
      const segs = [];
      let cx = startX, cy = startY;
      for (let j = 0; j < 4 + Math.floor(random() * 4); j++) {
        cx += (random() - 0.5) * 60;
        cy += 10 + random() * 30;
        segs.push({ x: cx, y: cy });
      }
      S.bgDetails.magmaVeins.push({ startX, startY, segs });
    }
  } else if (bgStyle === 'castle') {
    S.bgDetails.castleMoon = {
      x: W * 0.72 + (random() - 0.5) * 40,
      y: 80 + random() * 24,
      r: 26 + random() * 10
    };
    S.bgDetails.castleTowers = [];
    const towerCount = 6;
    const spacing = W / (towerCount - 1);
    for (let i = 0; i < towerCount; i++) {
      const w = 46 + random() * 26;
      const h = 120 + random() * 120;
      const cx = i * spacing + (random() - 0.5) * 18;
      const windows = [];
      const windowCount = 3 + Math.floor(random() * 4);
      for (let j = 0; j < windowCount; j++) {
        windows.push({
          rx: 8 + random() * (w - 16),
          ry: 14 + random() * (h - 36),
          lit: random() < 0.75,
          phase: random() * Math.PI * 2
        });
      }
      S.bgDetails.castleTowers.push({
        x: cx - w / 2,
        w,
        h,
        windows,
        bannerDir: random() < 0.55 ? (random() < 0.5 ? -1 : 1) : 0
      });
    }
  } else if (bgStyle === 'dupont') {
    S.bgDetails.bgTrees = [];
    for (let i = 0; i < 10; i++) {
      const x = 20 + (i / 9) * (W - 40) + (random() - 0.5) * 18;
      S.bgDetails.bgTrees.push({
        x,
        baseY: PLATFORM_Y - 10 + (random() - 0.5) * 16,
        trunkH: 44 + random() * 26,
        canopyR: 18 + random() * 12,
        hueMix: random()
      });
    }

    S.bgDetails.fountain = {
      x: W / 2,
      y: PLATFORM_Y - 145,
      topBowlW: 190,
      topBowlH: 18,
      basinW: 250,
      basinH: 34
    };

    S.bgDetails.fallLeaves = [];
    for (let i = 0; i < 95; i++) {
      S.bgDetails.fallLeaves.push({
        x: random() * W,
        y: random() * (PLATFORM_Y + 30),
        speed: 10 + random() * 22,
        sway: 1 + random() * 1.8,
        size: 2 + random() * 4,
        phase: random() * Math.PI * 2
      });
    }

    S.bgDetails.groundLeaves = [];
    for (let i = 0; i < 55; i++) {
      S.bgDetails.groundLeaves.push({
        x: random() * W,
        y: PLATFORM_Y - 16 + random() * 20,
        size: 2 + random() * 3,
        phase: random() * Math.PI * 2,
        hueMix: random()
      });
    }
  }
}

// ============================================================
// BACKGROUND DRAWING
// ============================================================
export function drawBackground() {
  const ctx = S.ctx;
  const theme = getTheme();
  const bgStyle = getBackgroundStyle(theme);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Theme-specific background decorations
  if (bgStyle === 'space') {
    // Subtle blue nebula glow
    const ncx = W * 0.3, ncy = H * 0.25;
    const nebGrad = ctx.createRadialGradient(ncx, ncy, 20, ncx, ncy, 180);
    nebGrad.addColorStop(0, theme.nebulaColor || 'rgba(30,60,120,0.08)');
    nebGrad.addColorStop(1, 'rgba(30,60,120,0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, W, H);

    // Hull panel outlines
    ctx.strokeStyle = 'rgba(60,80,110,0.06)';
    ctx.lineWidth = 1;
    for (const p of S.bgDetails.hullPanels || []) {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  } else if (bgStyle === 'jungle') {
    // Alien canopy silhouettes at top
    ctx.fillStyle = 'rgba(10,40,20,0.5)';
    for (const c of S.bgDetails.canopy || []) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hanging vines
    ctx.strokeStyle = 'rgba(30,100,40,0.4)';
    ctx.lineWidth = 2;
    for (const vine of S.bgDetails.vines || []) {
      ctx.beginPath();
      ctx.moveTo(vine.x, 0);
      for (const seg of vine.segments) {
        ctx.lineTo(seg.x, seg.y);
      }
      ctx.stroke();
      // Glowing berries
      for (const b of vine.berries) {
        const glow = 0.4 + 0.3 * Math.sin(performance.now() * 0.003 + b.phase);
        ctx.fillStyle = `rgba(80,255,120,${glow})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(80,255,120,${glow * 0.3})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fog layer just above platform
    const fogGrad = ctx.createLinearGradient(0, PLATFORM_Y - 60, 0, PLATFORM_Y);
    fogGrad.addColorStop(0, 'rgba(20,60,30,0)');
    fogGrad.addColorStop(1, 'rgba(20,60,30,0.15)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, PLATFORM_Y - 60, W, 60);
  } else if (bgStyle === 'volcanic') {
    // Lava glow from below
    const lavaGrad = ctx.createLinearGradient(0, PLATFORM_Y, 0, H);
    lavaGrad.addColorStop(0, 'rgba(200,80,10,0.08)');
    lavaGrad.addColorStop(0.5, 'rgba(200,60,5,0.15)');
    lavaGrad.addColorStop(1, 'rgba(180,40,0,0.25)');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, PLATFORM_Y, W, H - PLATFORM_Y);

    // Stalactites at top
    ctx.fillStyle = '#1a0e0c';
    for (const st of S.bgDetails.stalactites || []) {
      ctx.beginPath();
      ctx.moveTo(st.x - st.w / 2, 0);
      ctx.lineTo(st.x + st.w / 2, 0);
      ctx.lineTo(st.x, st.h);
      ctx.closePath();
      ctx.fill();
    }

    // Magma vein cracks
    const veinGlow = 0.3 + 0.15 * Math.sin(performance.now() * 0.002);
    ctx.strokeStyle = `rgba(255,100,20,${veinGlow})`;
    ctx.lineWidth = 1.5;
    for (const vein of S.bgDetails.magmaVeins || []) {
      ctx.beginPath();
      ctx.moveTo(vein.startX, vein.startY);
      for (const seg of vein.segs) {
        ctx.lineTo(seg.x, seg.y);
      }
      ctx.stroke();
    }
    // glow pass
    ctx.strokeStyle = `rgba(255,60,10,${veinGlow * 0.4})`;
    ctx.lineWidth = 4;
    for (const vein of S.bgDetails.magmaVeins || []) {
      ctx.beginPath();
      ctx.moveTo(vein.startX, vein.startY);
      for (const seg of vein.segs) {
        ctx.lineTo(seg.x, seg.y);
      }
      ctx.stroke();
    }
  } else if (bgStyle === 'castle') {
    const moon = S.bgDetails.castleMoon || { x: W * 0.72, y: 92, r: 30 };
    const moonGlow = ctx.createRadialGradient(moon.x, moon.y, moon.r * 0.2, moon.x, moon.y, moon.r * 4);
    moonGlow.addColorStop(0, 'rgba(220,220,255,0.22)');
    moonGlow.addColorStop(1, 'rgba(220,220,255,0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(215,220,240,0.2)';
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
    ctx.fill();

    const baseY = PLATFORM_Y + 30;
    const wallTop = baseY - 86;
    ctx.fillStyle = 'rgba(42,36,50,0.84)';
    ctx.fillRect(-20, wallTop, W + 40, baseY - wallTop);

    // Wall crenellations
    ctx.fillStyle = 'rgba(68,60,80,0.72)';
    for (let x = -10; x < W + 20; x += 18) {
      ctx.fillRect(x, wallTop - 10, 12, 10);
    }

    // Main gate
    ctx.fillStyle = 'rgba(18,16,24,0.8)';
    const gateW = 64, gateH = 74, gateX = W / 2 - gateW / 2;
    ctx.fillRect(gateX, baseY - gateH, gateW, gateH);
    ctx.beginPath();
    ctx.arc(W / 2, baseY - gateH, gateW / 2, Math.PI, 0);
    ctx.fill();

    for (const tower of S.bgDetails.castleTowers || []) {
      const topY = baseY - tower.h;
      ctx.fillStyle = 'rgba(54,48,64,0.86)';
      ctx.fillRect(tower.x, topY, tower.w, tower.h);

      // Tower crenellations
      ctx.fillStyle = 'rgba(80,72,92,0.76)';
      const crenels = Math.max(3, Math.floor(tower.w / 13));
      const crenelW = tower.w / crenels;
      for (let i = 0; i < crenels; i += 2) {
        ctx.fillRect(tower.x + i * crenelW, topY - 9, crenelW * 0.82, 9);
      }

      // Lit window slits
      const flicker = 0.55 + 0.25 * Math.sin(performance.now() * 0.003);
      for (const w of tower.windows) {
        if (!w.lit) continue;
        const alpha = 0.22 + flicker * 0.25 + Math.sin(performance.now() * 0.004 + w.phase) * 0.08;
        ctx.fillStyle = `rgba(255,210,120,${Math.max(0.1, alpha)})`;
        ctx.fillRect(tower.x + w.rx, topY + w.ry, 3, 8);
      }

      if (tower.bannerDir !== 0) {
        const bx = tower.bannerDir < 0 ? tower.x + 5 : tower.x + tower.w - 5;
        const by = topY + 22;
        ctx.strokeStyle = 'rgba(100,90,120,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by - 10);
        ctx.lineTo(bx, by + 16);
        ctx.stroke();
        ctx.fillStyle = 'rgba(145,40,50,0.55)';
        ctx.beginPath();
        ctx.moveTo(bx, by - 9);
        ctx.lineTo(bx + tower.bannerDir * 16, by - 5);
        ctx.lineTo(bx, by + 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (bgStyle === 'dupont') {
    // Warm autumn haze
    const haze = ctx.createLinearGradient(0, 0, 0, PLATFORM_Y);
    haze.addColorStop(0, 'rgba(165,180,210,0.07)');
    haze.addColorStop(0.55, 'rgba(205,160,120,0.12)');
    haze.addColorStop(1, 'rgba(220,145,95,0.22)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, PLATFORM_Y);

    // Flat background trees (autumn palette)
    for (const tr of S.bgDetails.bgTrees || []) {
      ctx.fillStyle = 'rgba(85,62,44,0.32)';
      ctx.fillRect(tr.x - 2, tr.baseY - tr.trunkH, 4, tr.trunkH);

      const c1 = tr.hueMix < 0.33 ? 'rgba(228,135,62,0.26)' :
        (tr.hueMix < 0.66 ? 'rgba(206,92,56,0.24)' : 'rgba(244,176,78,0.26)');
      const c2 = tr.hueMix < 0.33 ? 'rgba(235,164,78,0.22)' :
        (tr.hueMix < 0.66 ? 'rgba(222,118,74,0.21)' : 'rgba(252,194,102,0.22)');

      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(tr.x, tr.baseY - tr.trunkH - tr.canopyR * 0.25, tr.canopyR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(tr.x - tr.canopyR * 0.6, tr.baseY - tr.trunkH - tr.canopyR * 0.05, tr.canopyR * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tr.x + tr.canopyR * 0.6, tr.baseY - tr.trunkH - tr.canopyR * 0.05, tr.canopyR * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flat, front-facing fountain
    const f = S.bgDetails.fountain || {
      x: W / 2,
      y: PLATFORM_Y - 145,
      topBowlW: 190,
      topBowlH: 18,
      basinW: 250,
      basinH: 34
    };

    // Keep fountain faint so it reads as background art, not an interactable object.
    ctx.save();
    ctx.globalAlpha = 0.34;
    const shimmer = 0.65 + 0.2 * Math.sin(performance.now() * 0.0035);
    ctx.fillStyle = 'rgba(116,122,132,0.52)';
    ctx.fillRect(f.x - f.basinW / 2, f.y + 56, f.basinW, f.basinH);
    ctx.fillStyle = 'rgba(185,192,205,0.42)';
    ctx.fillRect(f.x - f.basinW / 2, f.y + 56, f.basinW, 3);

    ctx.fillStyle = 'rgba(104,112,124,0.5)';
    ctx.fillRect(f.x - 18, f.y + 14, 36, 44);
    ctx.fillStyle = 'rgba(170,178,192,0.4)';
    ctx.fillRect(f.x - 18, f.y + 14, 36, 3);

    ctx.fillStyle = 'rgba(130,138,150,0.48)';
    ctx.fillRect(f.x - f.topBowlW / 2, f.y, f.topBowlW, f.topBowlH);
    ctx.fillStyle = 'rgba(190,198,210,0.38)';
    ctx.fillRect(f.x - f.topBowlW / 2, f.y, f.topBowlW, 3);

    ctx.fillStyle = `rgba(130,190,230,${0.24 * shimmer})`;
    ctx.fillRect(f.x - f.topBowlW / 2 + 10, f.y + 4, f.topBowlW - 20, 7);
    ctx.fillStyle = `rgba(120,185,225,${0.21 * shimmer})`;
    ctx.fillRect(f.x - f.basinW / 2 + 12, f.y + 60, f.basinW - 24, f.basinH - 8);

    // Water spray
    const t = performance.now() * 0.0045;
    ctx.strokeStyle = 'rgba(170,220,255,0.26)';
    ctx.lineWidth = 1.2;
    for (let i = -4; i <= 4; i++) {
      const x1 = f.x + i * 11;
      const y1 = f.y + 4;
      const jetH = 18 + 7 * Math.sin(t + i * 0.8);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1 + i * 1.5, y1 - jetH, x1, y1 - jetH + 6);
      ctx.stroke();
    }
    ctx.restore();

    // Falling autumn leaves
    const tt = performance.now() * 0.001;
    for (const lf of S.bgDetails.fallLeaves || []) {
      const ly = (lf.y + tt * lf.speed) % (PLATFORM_Y + 40);
      const lx = lf.x + Math.sin(tt * lf.sway + lf.phase) * 10;
      const c = Math.sin(lf.phase) < -0.33 ? 'rgba(225,120,45,0.5)' :
        (Math.sin(lf.phase) < 0.33 ? 'rgba(210,78,45,0.5)' : 'rgba(240,170,60,0.5)');
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lf.size, lf.size * 0.65, Math.sin(tt * 2 + lf.phase), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground leaves
    for (const lf of S.bgDetails.groundLeaves || []) {
      const c = lf.hueMix < 0.33 ? 'rgba(210,98,38,0.42)' :
        (lf.hueMix < 0.66 ? 'rgba(190,70,40,0.4)' : 'rgba(235,155,65,0.42)');
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(lf.x, lf.y, lf.size + 1, lf.size * 0.55, lf.phase, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw ambient particles on top of background
  drawAmbientParticles();
}

// ============================================================
// PLATFORM
// ============================================================
export function drawPlatform() {
  const ctx = S.ctx;
  const theme = getTheme();
  const pw = theme.pillarWidth;
  const [ugR, ugG, ugB] = theme.underglowColor;

  // Main platform body
  ctx.fillStyle = theme.platformColor;
  ctx.fillRect(PLATFORM_X, PLATFORM_Y, PLATFORM_W, PLATFORM_H);
  // Top edge highlight
  ctx.fillStyle = theme.platformHighlight;
  ctx.fillRect(PLATFORM_X, PLATFORM_Y, PLATFORM_W, 4);
  // Bottom edge
  ctx.fillStyle = theme.platformDark;
  ctx.fillRect(PLATFORM_X, PLATFORM_Y + PLATFORM_H - 4, PLATFORM_W, 4);

  // Side pillars
  const pillarH = H - PLATFORM_Y;
  ctx.fillStyle = theme.pillarColor;
  ctx.fillRect(PLATFORM_X, PLATFORM_Y, pw, pillarH);
  ctx.fillRect(PLATFORM_X + PLATFORM_W - pw, PLATFORM_Y, pw, pillarH);

  // Theme-specific pillar/platform decorations
  if (theme.decorStyle === 'rivets') {
    // Brushed steel panel lines on platform
    ctx.fillStyle = 'rgba(120,150,180,0.15)';
    const numLines = Math.floor(PLATFORM_W / 60);
    const lineSpacing = PLATFORM_W / numLines;
    for (let i = 0; i < numLines; i++) {
      ctx.fillRect(PLATFORM_X + 10 + i * lineSpacing, PLATFORM_Y + 8, lineSpacing * 0.6, 3);
    }
    // Rivet dots
    ctx.fillStyle = 'rgba(140,170,200,0.2)';
    for (let i = 0; i < numLines + 1; i++) {
      const rx = PLATFORM_X + 6 + i * lineSpacing;
      ctx.beginPath();
      ctx.arc(rx, PLATFORM_Y + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx, PLATFORM_Y + PLATFORM_H - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Panel seams on pillars every 40px
    ctx.strokeStyle = 'rgba(100,130,160,0.12)';
    ctx.lineWidth = 1;
    for (let y = PLATFORM_Y; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X, y); ctx.lineTo(PLATFORM_X + pw, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X + PLATFORM_W - pw, y); ctx.lineTo(PLATFORM_X + PLATFORM_W, y);
      ctx.stroke();
    }
  } else if (theme.decorStyle === 'roots') {
    // Root texture lines on platform
    ctx.strokeStyle = 'rgba(60,100,50,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const rx = PLATFORM_X + 20 + i * (PLATFORM_W / 6);
      ctx.beginPath();
      ctx.moveTo(rx, PLATFORM_Y + 4);
      ctx.quadraticCurveTo(rx + 15, PLATFORM_Y + 12, rx + 5, PLATFORM_Y + PLATFORM_H - 2);
      ctx.stroke();
    }
    // Bark texture on pillars (horizontal lines)
    ctx.strokeStyle = 'rgba(80,60,40,0.2)';
    ctx.lineWidth = 1;
    for (let y = PLATFORM_Y; y < H; y += 8) {
      const wobble = Math.sin(y * 0.1) * 2;
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X + wobble, y);
      ctx.lineTo(PLATFORM_X + pw + wobble, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X + PLATFORM_W - pw + wobble, y);
      ctx.lineTo(PLATFORM_X + PLATFORM_W + wobble, y);
      ctx.stroke();
    }
    // Root flare at top of pillars
    ctx.fillStyle = theme.pillarColor;
    ctx.beginPath();
    ctx.moveTo(PLATFORM_X, PLATFORM_Y);
    ctx.quadraticCurveTo(PLATFORM_X - 6, PLATFORM_Y + 20, PLATFORM_X, PLATFORM_Y + 30);
    ctx.lineTo(PLATFORM_X + pw + 4, PLATFORM_Y + 30);
    ctx.quadraticCurveTo(PLATFORM_X + pw + 6, PLATFORM_Y + 15, PLATFORM_X + pw, PLATFORM_Y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(PLATFORM_X + PLATFORM_W, PLATFORM_Y);
    ctx.quadraticCurveTo(PLATFORM_X + PLATFORM_W + 6, PLATFORM_Y + 20, PLATFORM_X + PLATFORM_W, PLATFORM_Y + 30);
    ctx.lineTo(PLATFORM_X + PLATFORM_W - pw - 4, PLATFORM_Y + 30);
    ctx.quadraticCurveTo(PLATFORM_X + PLATFORM_W - pw - 6, PLATFORM_Y + 15, PLATFORM_X + PLATFORM_W - pw, PLATFORM_Y);
    ctx.closePath();
    ctx.fill();
  } else if (theme.decorStyle === 'cracks') {
    // Crack lines with magma glow on platform
    const crackGlow = 0.3 + 0.2 * Math.sin(performance.now() * 0.003);
    ctx.strokeStyle = `rgba(255,100,20,${crackGlow})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const cx = PLATFORM_X + 30 + i * (PLATFORM_W / 5);
      ctx.beginPath();
      ctx.moveTo(cx, PLATFORM_Y + 2);
      ctx.lineTo(cx + 8, PLATFORM_Y + PLATFORM_H / 2);
      ctx.lineTo(cx - 3, PLATFORM_Y + PLATFORM_H - 2);
      ctx.stroke();
    }
    // Pulsing lava veins on pillars
    ctx.strokeStyle = `rgba(255,80,10,${crackGlow * 0.6})`;
    ctx.lineWidth = 1.5;
    for (let y = PLATFORM_Y + 20; y < H; y += 35) {
      const wobble = Math.sin(y * 0.08 + performance.now() * 0.001) * 3;
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X + pw / 2 + wobble, y);
      ctx.lineTo(PLATFORM_X + pw / 2 - wobble, y + 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PLATFORM_X + PLATFORM_W - pw / 2 + wobble, y);
      ctx.lineTo(PLATFORM_X + PLATFORM_W - pw / 2 - wobble, y + 20);
      ctx.stroke();
    }
  }

  // Underglow (theme-colored)
  const glowH = Math.min(60, H - PLATFORM_Y - PLATFORM_H);
  if (glowH > 0) {
    const glow = ctx.createLinearGradient(PLATFORM_X, PLATFORM_Y + PLATFORM_H, PLATFORM_X, PLATFORM_Y + PLATFORM_H + glowH);
    glow.addColorStop(0, `rgba(${ugR},${ugG},${ugB},0.3)`);
    glow.addColorStop(1, `rgba(${ugR},${ugG},${ugB},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(PLATFORM_X, PLATFORM_Y + PLATFORM_H, PLATFORM_W, glowH);
  }
}

// ============================================================
// FLOATING PLATFORMS — DRAWING
// ============================================================
export function drawFloatingPlatforms() {
  const ctx = S.ctx;
  const theme = getTheme();
  const [ugR, ugG, ugB] = theme.underglowColor;

  for (const fp of S.floatingPlatforms) {
    if (fp.phase === 'gone') continue;
    const alpha = fp.alpha * 0.85;
    if (alpha <= 0) continue;

    ctx.save();

    const sx = fp.shakeOffset || 0;
    const dx = fp.x + sx;
    const dy = fp.y;
    const r = 4; // corner radius

    // Underglow beneath platform
    const fpGlow = ctx.createLinearGradient(dx, dy + fp.h, dx, dy + fp.h + 20);
    fpGlow.addColorStop(0, `rgba(${ugR},${ugG},${ugB},${alpha * 0.25})`);
    fpGlow.addColorStop(1, `rgba(${ugR},${ugG},${ugB},0)`);
    ctx.fillStyle = fpGlow;
    ctx.fillRect(dx, dy + fp.h, fp.w, 20);

    // Platform body (rounded rect)
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(dx + r, dy);
    ctx.lineTo(dx + fp.w - r, dy);
    ctx.arcTo(dx + fp.w, dy, dx + fp.w, dy + r, r);
    ctx.lineTo(dx + fp.w, dy + fp.h - r);
    ctx.arcTo(dx + fp.w, dy + fp.h, dx + fp.w - r, dy + fp.h, r);
    ctx.lineTo(dx + r, dy + fp.h);
    ctx.arcTo(dx, dy + fp.h, dx, dy + fp.h - r, r);
    ctx.lineTo(dx, dy + r);
    ctx.arcTo(dx, dy, dx + r, dy, r);
    ctx.closePath();
    ctx.fillStyle = theme.platformColor;
    ctx.fill();

    // Top highlight
    ctx.fillStyle = theme.platformHighlight;
    ctx.beginPath();
    ctx.moveTo(dx + r, dy);
    ctx.lineTo(dx + fp.w - r, dy);
    ctx.arcTo(dx + fp.w, dy, dx + fp.w, dy + r, r);
    ctx.lineTo(dx + fp.w, dy + 3);
    ctx.lineTo(dx, dy + 3);
    ctx.lineTo(dx, dy + r);
    ctx.arcTo(dx, dy, dx + r, dy, r);
    ctx.closePath();
    ctx.fill();

    // Bottom dark edge
    ctx.fillStyle = theme.platformDark;
    ctx.fillRect(dx + r, dy + fp.h - 3, fp.w - r * 2, 3);

    // Theme-specific mini decorations
    if (theme.decorStyle === 'rivets') {
      ctx.fillStyle = theme.platformHighlight;
      for (let i = 0; i < 3; i++) {
        const rx = dx + 12 + i * 38;
        ctx.beginPath();
        ctx.arc(rx, dy + fp.h / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.decorStyle === 'roots') {
      ctx.strokeStyle = theme.platformHighlight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx + 10, dy + fp.h);
      ctx.quadraticCurveTo(dx + 5, dy + fp.h + 6, dx + 8, dy + fp.h + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dx + fp.w - 10, dy + fp.h);
      ctx.quadraticCurveTo(dx + fp.w - 5, dy + fp.h + 6, dx + fp.w - 8, dy + fp.h + 10);
      ctx.stroke();
    } else if (theme.decorStyle === 'cracks') {
      ctx.strokeStyle = theme.platformHighlight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx + fp.w * 0.3, dy + 2);
      ctx.lineTo(dx + fp.w * 0.35, dy + fp.h - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dx + fp.w * 0.7, dy + 2);
      ctx.lineTo(dx + fp.w * 0.65, dy + fp.h - 2);
      ctx.stroke();
    }

    // Warning phase: red tint overlay
    if (fp.phase === 'warning') {
      const warnProgress = (fp.lifetime - FLOAT_PLAT_LIFETIME) / FLOAT_PLAT_WARN_TIME;
      const blinkRate = 4 + warnProgress * 12; // accelerating blink
      const blinkOn = Math.sin(fp.lifetime * blinkRate * Math.PI) > 0;
      if (blinkOn) {
        ctx.globalAlpha = alpha * (0.2 + warnProgress * 0.3);
        ctx.fillStyle = '#ff2222';
        ctx.beginPath();
        ctx.moveTo(dx + r, dy);
        ctx.lineTo(dx + fp.w - r, dy);
        ctx.arcTo(dx + fp.w, dy, dx + fp.w, dy + r, r);
        ctx.lineTo(dx + fp.w, dy + fp.h - r);
        ctx.arcTo(dx + fp.w, dy + fp.h, dx + fp.w - r, dy + fp.h, r);
        ctx.lineTo(dx + r, dy + fp.h);
        ctx.arcTo(dx, dy + fp.h, dx, dy + fp.h - r, r);
        ctx.lineTo(dx, dy + r);
        ctx.arcTo(dx, dy, dx + r, dy, r);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// ============================================================
// FLOATING PLATFORMS — UPDATE
// ============================================================
export function updateFloatingPlatforms(dt) {
  if (S.gameState !== 'playing') return;

  // Spawn timer
  S.floatPlatSpawnTimer -= dt;
  if (S.floatPlatSpawnTimer <= 0 && S.floatingPlatforms.length < FLOAT_PLAT_MAX) {
    // Pick random unoccupied slot
    const available = [];
    for (let i = 0; i < FLOAT_PLAT_SLOTS.length; i++) {
      if (!S.occupiedSlots.has(i)) available.push(i);
    }
    if (available.length > 0) {
      const slotIdx = available[Math.floor(random() * available.length)];
      const slot = FLOAT_PLAT_SLOTS[slotIdx];
      S.occupiedSlots.add(slotIdx);
      S.floatingPlatforms.push({
        x: slot.x, y: slot.y,
        w: FLOAT_PLAT_W, h: FLOAT_PLAT_H,
        lifetime: 0, maxLifetime: FLOAT_PLAT_LIFETIME + FLOAT_PLAT_WARN_TIME,
        phase: 'fadein', slotIndex: slotIdx,
        shakeOffset: 0, alpha: 0
      });
    }
    // Stagger: next spawn depends on how many are alive
    const count = S.floatingPlatforms.length;
    S.floatPlatSpawnTimer = FLOAT_PLAT_SPAWN_CD * (0.5 + 0.5 * count / FLOAT_PLAT_MAX);
  }

  // Update each platform
  for (let i = S.floatingPlatforms.length - 1; i >= 0; i--) {
    const fp = S.floatingPlatforms[i];
    fp.lifetime += dt;

    if (fp.phase === 'fadein') {
      fp.alpha = Math.min(1, fp.lifetime / FLOAT_PLAT_FADE_IN);
      if (fp.lifetime >= FLOAT_PLAT_FADE_IN) {
        fp.phase = 'solid';
        fp.alpha = 1;
        playSound('platAppear');
      }
    } else if (fp.phase === 'solid') {
      fp.alpha = 1;
      if (fp.lifetime >= FLOAT_PLAT_LIFETIME) {
        fp.phase = 'warning';
      }
    } else if (fp.phase === 'warning') {
      const warnProgress = (fp.lifetime - FLOAT_PLAT_LIFETIME) / FLOAT_PLAT_WARN_TIME;
      fp.alpha = 1;
      // Shake intensifies over warning period
      fp.shakeOffset = (random() - 0.5) * warnProgress * 6;
      if (fp.lifetime >= FLOAT_PLAT_LIFETIME + FLOAT_PLAT_WARN_TIME) {
        fp.phase = 'gone';
      }
    }

    // Remove gone platforms
    if (fp.phase === 'gone') {
      // Crumble particles
      const theme = getTheme();
      spawnParticles(fp.x + fp.w / 2, fp.y + fp.h / 2, theme.platformColor, 12, 120, 0.5);
      spawnParticles(fp.x + fp.w / 2, fp.y + fp.h / 2, theme.platformHighlight, 6, 80, 0.4);
      playSound('platCrumble');
      S.occupiedSlots.delete(fp.slotIndex);
      S.floatingPlatforms.splice(i, 1);
    }
  }
}
