import { S } from './state.js';
import { W, H, PLAYER_W, PLAYER_H, SNOT_COOLDOWN, SNOT_MAX_CHARGE } from './constants.js';
import { ensureAudio, snotSniffleClip, snotLaunchClip } from './audio.js';
import { fireSnotRocket } from './weapons.js';

// ============================================================
// INPUT HANDLING
// ============================================================

export const isMobile = 'ontouchstart' in window;

export function autoAimMouse() {
  const { player, enemies, boss, bossActive, mouse } = S;
  const pcx = player.x + PLAYER_W / 2;
  const pcy = player.y + PLAYER_H / 2;
  let nearest = null, nearDist = Infinity;
  for (const en of enemies) {
    if (en.dying) continue;
    const d = Math.hypot(en.x + en.w / 2 - pcx, en.y + en.h / 2 - pcy);
    if (d < nearDist) { nearDist = d; nearest = en; }
  }
  if (boss && bossActive && !boss.dying) {
    const d = Math.hypot(boss.x + boss.w / 2 - pcx, boss.y + boss.h / 2 - pcy);
    if (d < nearDist) { nearDist = d; nearest = boss; }
  }
  if (nearest) {
    mouse.x = nearest.x + nearest.w / 2;
    mouse.y = nearest.y + nearest.h / 2;
  } else {
    mouse.x = player.facingRight ? pcx + 200 : pcx - 200;
    mouse.y = pcy;
  }
}

function skipLeaderboardInput() {
  const nameOverlay = document.getElementById('nameOverlay');
  if (nameOverlay) nameOverlay.style.display = 'none';
  S.leaderboardInputActive = false;
  S.gameOverPhase = 'showing';
}

export function setupKeyboard() {
  const { keys, mouse } = S;

  window.addEventListener('keydown', e => {
    ensureAudio();
    if (S.leaderboardInputActive) {
      if (e.key === 'Escape') { skipLeaderboardInput(); }
      return;
    }
    if (e.repeat) return;
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') {
      if (S.gameState === 'playing') { S.gameState = 'paused'; }
      else if (S.gameState === 'paused') { S.gameState = 'playing'; }
    }
    const k = e.key.toLowerCase();
    if ((k === 'q' || k === 'e') && S.gameState === 'playing') {
      if (S.player.snotCooldown <= 0 && !S.player.snotHolding && !S.snotRocket) {
        S.player.snotHolding = true;
        S.player.snotChargeTime = 0;
        snotSniffleClip.currentTime = 0;
        snotSniffleClip.play().catch(() => {});
      }
    }
  });

  window.addEventListener('keyup', e => {
    if (S.leaderboardInputActive) return;
    keys[e.key.toLowerCase()] = false;
    const k = e.key.toLowerCase();
    if ((k === 'q' || k === 'e') && S.player.snotHolding) {
      autoAimMouse();
      const chargeRatio = Math.min(S.player.snotChargeTime / SNOT_MAX_CHARGE, 1);
      S.player.snotHolding = false;
      S.player.snotChargeTime = 0;
      snotSniffleClip.pause();
      snotSniffleClip.currentTime = 0;
      snotLaunchClip.currentTime = 0;
      snotLaunchClip.play().catch(() => {});
      fireSnotRocket(chargeRatio);
      S.player.snotCooldown = SNOT_COOLDOWN;
    }
  });
}

export function setupMouse() {
  const canvas = S.canvas;
  const { mouse } = S;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (W / rect.width);
    mouse.y = (e.clientY - rect.top) * (H / rect.height);
  });

  canvas.addEventListener('mousedown', e => {
    ensureAudio();
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) {
      mouse.right = true;
      if (S.gameState === 'playing' && S.player.snotCooldown <= 0 && !S.player.snotHolding && !S.snotRocket) {
        S.player.snotHolding = true;
        S.player.snotChargeTime = 0;
        snotSniffleClip.currentTime = 0;
        snotSniffleClip.play().catch(() => {});
      }
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) {
      mouse.right = false;
      if (S.player.snotHolding) {
        autoAimMouse();
        const chargeRatio = Math.min(S.player.snotChargeTime / SNOT_MAX_CHARGE, 1);
        S.player.snotHolding = false;
        S.player.snotChargeTime = 0;
        snotSniffleClip.pause();
        snotSniffleClip.currentTime = 0;
        snotLaunchClip.currentTime = 0;
        snotLaunchClip.play().catch(() => {});
        fireSnotRocket(chargeRatio);
        S.player.snotCooldown = SNOT_COOLDOWN;
      }
    }
  });
}

export function setupTouch() {
  if (!isMobile) return;
  const canvas = S.canvas;
  const { keys, mouse } = S;

  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  const JOYSTICK_DEAD = 15;
  let joyTouch = null;
  let joyOrigin = null;
  let joyPos = null;
  let attackTouch = null;
  let jumpTouch = null;
  let snotTouch = null;

  const ZAP_BTN = { x: W - 70, y: H - 80, r: 44 };
  const SNOT_BTN = { x: W - 160, y: H - 80, r: 36 };
  const JUMP_BTN = { x: W - 70, y: H - 185, r: 38 };

  function touchToCanvas(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (W / rect.width),
      y: (touch.clientY - rect.top) * (H / rect.height)
    };
  }

  function inCircle(px, py, cx, cy, r) {
    return Math.hypot(px - cx, py - cy) <= r;
  }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    ensureAudio();

    if (S.gameState === 'title') {
      const tc = touchToCanvas(e.changedTouches[0]);
      if (S.devMenuOpen) {
        const synth = new MouseEvent('click', {
          clientX: e.changedTouches[0].clientX,
          clientY: e.changedTouches[0].clientY
        });
        canvas.dispatchEvent(synth);
        return;
      }
      if (tc.x < 80 && tc.y < 80) {
        S.devTapCount++;
        S.devTapTimer = 1.0;
        if (S.devTapCount >= 5) {
          S.devMenuOpen = true;
          S.devTapCount = 0;
        }
        return;
      }
      canvas.dispatchEvent(new Event('click'));
      return;
    }
    if (S.gameState === 'gameOver') {
      canvas.dispatchEvent(new Event('click'));
      return;
    }

    for (const touch of e.changedTouches) {
      const c = touchToCanvas(touch);
      if (attackTouch === null && inCircle(c.x, c.y, ZAP_BTN.x, ZAP_BTN.y, ZAP_BTN.r + 10)) {
        attackTouch = touch.identifier;
        autoAimMouse();
        mouse.left = true;
        continue;
      }
      if (snotTouch === null && inCircle(c.x, c.y, SNOT_BTN.x, SNOT_BTN.y, SNOT_BTN.r + 10)) {
        snotTouch = touch.identifier;
        if (S.player.snotCooldown <= 0 && !S.player.snotHolding && !S.snotRocket) {
          autoAimMouse();
          S.player.snotHolding = true;
          S.player.snotChargeTime = 0;
          snotSniffleClip.currentTime = 0;
          snotSniffleClip.play().catch(() => {});
        }
        continue;
      }
      if (jumpTouch === null && inCircle(c.x, c.y, JUMP_BTN.x, JUMP_BTN.y, JUMP_BTN.r + 10)) {
        jumpTouch = touch.identifier;
        keys[' '] = true;
        continue;
      }
      if (joyTouch === null && c.x < W * 0.65) {
        joyTouch = touch.identifier;
        joyOrigin = { x: touch.clientX, y: touch.clientY };
        joyPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyTouch) {
        joyPos = { x: touch.clientX, y: touch.clientY };
        const dx = joyPos.x - joyOrigin.x;
        if (dx < -JOYSTICK_DEAD) { keys['a'] = true; keys['d'] = false; }
        else if (dx > JOYSTICK_DEAD) { keys['d'] = true; keys['a'] = false; }
        else { keys['a'] = false; keys['d'] = false; }
        const dy = joyPos.y - joyOrigin.y;
        if (dy > JOYSTICK_DEAD) { keys['s'] = true; keys['joyup'] = false; }
        else if (dy < -JOYSTICK_DEAD) { keys['s'] = false; keys['joyup'] = true; }
        else { keys['s'] = false; keys['joyup'] = false; }
      }
      if (touch.identifier === attackTouch) {
        autoAimMouse();
      }
    }
  }, { passive: false });

  function endTouch(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joyTouch) {
        joyTouch = null;
        joyOrigin = null;
        joyPos = null;
        keys['a'] = false;
        keys['d'] = false;
        keys['s'] = false;
        keys['joyup'] = false;
      }
      if (touch.identifier === attackTouch) {
        mouse.left = false;
        attackTouch = null;
      }
      if (touch.identifier === jumpTouch) {
        keys[' '] = false;
        jumpTouch = null;
      }
      if (touch.identifier === snotTouch) {
        snotTouch = null;
        if (S.player.snotHolding) {
          autoAimMouse();
          const chargeRatio = Math.min(S.player.snotChargeTime / SNOT_MAX_CHARGE, 1);
          S.player.snotHolding = false;
          S.player.snotChargeTime = 0;
          snotSniffleClip.pause();
          snotSniffleClip.currentTime = 0;
          snotLaunchClip.currentTime = 0;
          snotLaunchClip.play().catch(() => {});
          fireSnotRocket(chargeRatio);
          S.player.snotCooldown = SNOT_COOLDOWN;
        }
      }
    }
  }
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  // Store touch state references for drawTouchHUD
  S._touch = {
    get attackTouch() { return attackTouch; },
    get jumpTouch() { return jumpTouch; },
    get snotTouch() { return snotTouch; },
    get joyOrigin() { return joyOrigin; },
    get joyPos() { return joyPos; },
    ZAP_BTN, SNOT_BTN, JUMP_BTN,
  };
}

export function drawTouchHUD() {
  if (!isMobile) return;
  if (S.gameState !== 'playing' && S.gameState !== 'paused') return;
  const { ctx, player, _touch: t } = S;
  if (!t) return;

  const { ZAP_BTN, SNOT_BTN, JUMP_BTN } = t;
  const attackTouch = t.attackTouch;
  const jumpTouch = t.jumpTouch;
  const snotTouch = t.snotTouch;
  const joyOrigin = t.joyOrigin;
  const joyPos = t.joyPos;

  // ZAP button
  const zapActive = attackTouch !== null;
  ctx.beginPath();
  ctx.arc(ZAP_BTN.x, ZAP_BTN.y, ZAP_BTN.r, 0, Math.PI * 2);
  ctx.fillStyle = zapActive ? 'rgba(68,136,255,0.3)' : 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = zapActive ? 'rgba(68,136,255,0.6)' : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = zapActive ? '#88bbff' : 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ZAP', ZAP_BTN.x, ZAP_BTN.y + 5);

  // SNOT button
  const snotReady = player.snotCooldown <= 0 && !player.snotHolding;
  const snotActive = snotTouch !== null;
  const snotHolding = player.snotHolding;
  ctx.beginPath();
  ctx.arc(SNOT_BTN.x, SNOT_BTN.y, SNOT_BTN.r, 0, Math.PI * 2);
  if (snotHolding) {
    ctx.fillStyle = 'rgba(200,180,30,0.3)';
  } else if (snotReady) {
    ctx.fillStyle = snotActive ? 'rgba(100,200,40,0.3)' : 'rgba(100,200,40,0.1)';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
  }
  ctx.fill();
  ctx.strokeStyle = snotReady ? 'rgba(100,200,40,0.5)' : (snotHolding ? 'rgba(200,180,30,0.6)' : 'rgba(255,255,255,0.12)');
  ctx.lineWidth = 2;
  ctx.stroke();
  if (snotHolding) {
    const chargeRatio = Math.min(player.snotChargeTime / SNOT_MAX_CHARGE, 1);
    ctx.strokeStyle = 'rgba(200,180,30,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SNOT_BTN.x, SNOT_BTN.y, SNOT_BTN.r, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
    ctx.stroke();
  }
  if (!snotReady && !snotHolding) {
    const cdRatio = 1 - player.snotCooldown / SNOT_COOLDOWN;
    ctx.strokeStyle = 'rgba(100,200,40,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SNOT_BTN.x, SNOT_BTN.y, SNOT_BTN.r, -Math.PI / 2, -Math.PI / 2 + cdRatio * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = snotReady ? '#88cc22' : (snotHolding ? '#ddcc22' : 'rgba(255,255,255,0.25)');
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(snotHolding ? 'AIM' : 'SNOT', SNOT_BTN.x, SNOT_BTN.y + 4);

  // JUMP button
  const jumpActive = jumpTouch !== null;
  ctx.beginPath();
  ctx.arc(JUMP_BTN.x, JUMP_BTN.y, JUMP_BTN.r, 0, Math.PI * 2);
  ctx.fillStyle = jumpActive ? 'rgba(68,255,68,0.25)' : 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = jumpActive ? 'rgba(68,255,68,0.5)' : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = jumpActive ? '#88ff88' : 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('JUMP', JUMP_BTN.x, JUMP_BTN.y + 5);

  // Joystick
  const STICK_BASE_X = 80;
  const STICK_BASE_Y = H - 90;
  const STICK_R = 50;
  const KNOB_R = 22;

  if (joyOrigin) {
    const rect = S.canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const ox = (joyOrigin.x - rect.left) * scaleX;
    const oy = (joyOrigin.y - rect.top) * scaleY;

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox, oy, STICK_R, 0, Math.PI * 2);
    ctx.stroke();

    if (joyPos) {
      let tx = (joyPos.x - rect.left) * scaleX;
      let ty = (joyPos.y - rect.top) * scaleY;
      const dx = tx - ox, dy = ty - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > STICK_R) {
        tx = ox + dx / dist * STICK_R;
        ty = oy + dy / dist * STICK_R;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(tx, ty, KNOB_R, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(STICK_BASE_X, STICK_BASE_Y, STICK_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(STICK_BASE_X, STICK_BASE_Y, KNOB_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u25C0', STICK_BASE_X - 36, STICK_BASE_Y + 5);
    ctx.fillText('\u25B6', STICK_BASE_X + 36, STICK_BASE_Y + 5);
    ctx.fillText('\u25B2', STICK_BASE_X, STICK_BASE_Y - 28);
    ctx.fillText('\u25BC', STICK_BASE_X, STICK_BASE_Y + 38);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '10px monospace';
    ctx.fillText('MOVE', STICK_BASE_X, STICK_BASE_Y + STICK_R + 14);
  }
}
