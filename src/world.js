import { S } from './state.js';
import {
  W, H, PLATFORM_Y, PLATFORM_X, PLATFORM_W, PLATFORM_H,
  THEMES,
  FLOAT_PLAT_W, FLOAT_PLAT_H, FLOAT_PLAT_LIFETIME, FLOAT_PLAT_WARN_TIME,
  FLOAT_PLAT_FADE_IN, FLOAT_PLAT_SPAWN_CD, FLOAT_PLAT_MAX, FLOAT_PLAT_SLOTS,
} from './constants.js';
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
      x: Math.random() * W,
      y: randomY ? Math.random() * H : 0,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 20 + 5,
      brightness: Math.random() * 0.5 + 0.5,
      type: 'stars'
    };
  } else if (t === 'spores') {
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + Math.random() * 40,
      size: Math.random() * 3 + 1.5,
      speed: -(15 + Math.random() * 25), // drift upward
      drift: (Math.random() - 0.5) * 20,
      brightness: Math.random() * 0.6 + 0.3,
      glowPhase: Math.random() * Math.PI * 2,
      type: 'spores'
    };
  } else { // embers
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + Math.random() * 20,
      size: Math.random() * 2.5 + 1,
      speed: -(40 + Math.random() * 60), // fast upward
      drift: (Math.random() - 0.5) * 30,
      brightness: Math.random() * 0.8 + 0.2,
      glowPhase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.6 ? 0 : 1, // 0=orange, 1=red
      type: 'embers'
    };
  }
}

export function updateAmbientParticles(dt) {
  const theme = getTheme();
  for (const s of S.ambientParticles) {
    if (s.type === 'stars') {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      s.brightness = 0.5 + 0.5 * Math.sin(performance.now() * 0.001 * s.speed * 0.1);
    } else if (s.type === 'spores') {
      s.y += s.speed * dt;
      s.x += s.drift * dt;
      s.glowPhase += dt * 2;
      s.brightness = 0.3 + 0.3 * Math.sin(s.glowPhase);
      if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;
    } else { // embers
      s.y += s.speed * dt;
      s.x += s.drift * dt;
      s.glowPhase += dt * 4;
      s.brightness = 0.4 + 0.4 * Math.sin(s.glowPhase);
      if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
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

  if (theme.ambientType === 'stars') {
    // Hull panel lines for space station
    S.bgDetails.hullPanels = [];
    for (let i = 0; i < 8; i++) {
      S.bgDetails.hullPanels.push({
        x: Math.random() * W,
        y: Math.random() * PLATFORM_Y * 0.8,
        w: 40 + Math.random() * 80,
        h: 30 + Math.random() * 60
      });
    }
  } else if (theme.ambientType === 'spores') {
    // Hanging vines at top
    S.bgDetails.vines = [];
    for (let i = 0; i < 12; i++) {
      const x = 20 + Math.random() * (W - 40);
      const segments = 4 + Math.floor(Math.random() * 5);
      const vine = { x, segments: [], berries: [] };
      let cy = 0;
      for (let j = 0; j < segments; j++) {
        cy += 12 + Math.random() * 18;
        vine.segments.push({ x: x + (Math.random() - 0.5) * 20, y: cy });
      }
      // Glowing berries at ends
      if (Math.random() < 0.6) {
        const last = vine.segments[vine.segments.length - 1];
        vine.berries.push({ x: last.x, y: last.y + 4, phase: Math.random() * Math.PI * 2 });
      }
      S.bgDetails.vines.push(vine);
    }
    // Canopy silhouettes
    S.bgDetails.canopy = [];
    for (let i = 0; i < 6; i++) {
      S.bgDetails.canopy.push({
        x: Math.random() * W,
        r: 40 + Math.random() * 60,
        y: -10 + Math.random() * 20
      });
    }
  } else { // embers / volcanic
    // Stalactites at top
    S.bgDetails.stalactites = [];
    for (let i = 0; i < 10; i++) {
      S.bgDetails.stalactites.push({
        x: 20 + Math.random() * (W - 40),
        w: 6 + Math.random() * 10,
        h: 20 + Math.random() * 50
      });
    }
    // Magma vein cracks in background
    S.bgDetails.magmaVeins = [];
    for (let i = 0; i < 5; i++) {
      const startX = Math.random() * W;
      const startY = 50 + Math.random() * (PLATFORM_Y - 100);
      const segs = [];
      let cx = startX, cy = startY;
      for (let j = 0; j < 4 + Math.floor(Math.random() * 4); j++) {
        cx += (Math.random() - 0.5) * 60;
        cy += 10 + Math.random() * 30;
        segs.push({ x: cx, y: cy });
      }
      S.bgDetails.magmaVeins.push({ startX, startY, segs });
    }
  }
}

// ============================================================
// BACKGROUND DRAWING
// ============================================================
export function drawBackground() {
  const ctx = S.ctx;
  const theme = getTheme();

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Theme-specific background decorations
  if (theme.ambientType === 'stars') {
    // Subtle blue nebula glow
    const ncx = W * 0.3, ncy = H * 0.25;
    const nebGrad = ctx.createRadialGradient(ncx, ncy, 20, ncx, ncy, 180);
    nebGrad.addColorStop(0, theme.nebulaColor);
    nebGrad.addColorStop(1, 'rgba(30,60,120,0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, W, H);

    // Hull panel outlines
    ctx.strokeStyle = 'rgba(60,80,110,0.06)';
    ctx.lineWidth = 1;
    for (const p of S.bgDetails.hullPanels || []) {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  } else if (theme.ambientType === 'spores') {
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
  } else { // volcanic
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
      const slotIdx = available[Math.floor(Math.random() * available.length)];
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
      fp.shakeOffset = (Math.random() - 0.5) * warnProgress * 6;
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
