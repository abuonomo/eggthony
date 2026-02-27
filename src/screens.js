import { S, resetPlayer, resetGameState } from './state.js';
import {
  W, H, PLATFORM_Y, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  METAL_DURATION, MUSCLE_DURATION, WINGS_DURATION,
  SNOT_COOLDOWN, SNOT_MAX_CHARGE, SNOT_STORM_DURATION,
  DWYER_DURATION, CROWN_ANIM_DURATION, THEMES,
  LEADERBOARD_API,
} from './constants.js';
import { ensureAudio, playSound, playVoice, musicClip } from './audio.js';
import { eggSprite, spriteLoaded } from './sprites.js';
import { spawnParticles, drawParticles } from './effects.js';
import { isMobile } from './input.js';
import { isBossRound, bossAppearance } from './boss.js';
import { getThemeIndex, initAmbientParticles, initBgDetails } from './world.js';
import { startRound } from './waves.js';
import { GEAR_ITEMS, awardDrop, recalcBuffs, saveGear, drawGearOnPlayer } from './gear.js';

// ============================================================
// LEADERBOARD
// ============================================================
export async function fetchLeaderboard() {
  if (S.devLeaderboard) {
    S.leaderboardData = getDevScores();
    return;
  }
  try {
    const res = await fetch(LEADERBOARD_API + '/scores');
    if (res.ok) S.leaderboardData = await res.json();
  } catch {}
}

async function submitScore(name, score, round) {
  if (S.devLeaderboard) {
    const scores = getDevScores();
    scores.push({ name, score, round });
    scores.sort((a, b) => b.score - a.score);
    scores.length = Math.min(scores.length, 20);
    saveDevScores(scores);
    S.leaderboardData = scores;
    return;
  }
  try {
    const res = await fetch(LEADERBOARD_API + '/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, round }),
    });
    if (res.ok) S.leaderboardData = await res.json();
  } catch {}
}

export function getDevScores() {
  try { return JSON.parse(localStorage.getItem('eggthonyDevScores') || '[]'); }
  catch { return []; }
}

export function saveDevScores(scores) {
  localStorage.setItem('eggthonyDevScores', JSON.stringify(scores));
}

// ============================================================
// NAME INPUT OVERLAY
// ============================================================
let nameOverlay, nameInput, nameSubmit, nameSkip;

export function initNameOverlay() {
  nameOverlay = document.getElementById('nameOverlay');
  nameInput = document.getElementById('nameInput');
  nameSubmit = document.getElementById('nameSubmit');
  nameSkip = document.getElementById('nameSkip');

  nameSubmit.addEventListener('click', handleNameSubmit);
  nameSkip.addEventListener('click', skipLeaderboardInput);
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleNameSubmit();
  });
}

export function showNameInput() {
  S.gameOverPhase = 'input';
  S.leaderboardInputActive = true;
  nameInput.value = localStorage.getItem('eggthonyName') || '';
  nameOverlay.style.display = '';
  setTimeout(() => nameInput.focus(), 50);
}

export function hideNameInput() {
  nameOverlay.style.display = 'none';
  S.leaderboardInputActive = false;
}

async function handleNameSubmit() {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  localStorage.setItem('eggthonyName', name);
  hideNameInput();
  S.gameOverPhase = 'submitted';
  await submitScore(name, S.score, S.round);
  await fetchLeaderboard();
  const savedName = localStorage.getItem('eggthonyName') || '';
  const isChampion = S.leaderboardData.length > 0 &&
    S.leaderboardData[0].name === savedName &&
    S.leaderboardData[0].score === S.score &&
    S.leaderboardData[0].round === S.round;
  if (isChampion) {
    S.crownAnimActive = true;
    S.crownAnimTimer = 0;
    playSound('powerup');
  }
  S.gameOverPhase = 'showing';
}

function skipLeaderboardInput() {
  hideNameInput();
  fetchLeaderboard();
  S.gameOverPhase = 'showing';
}

// ============================================================
// HUD
// ============================================================
export function drawHUD() {
  const ctx = S.ctx;
  const { player } = S;

  // HP Bar
  const barX = 12, barY = 12, barW = 140, barH = 16;
  ctx.fillStyle = '#330000';
  ctx.fillRect(barX, barY, barW, barH);
  const gearMaxHp = S.gear.totalBuffs ? S.gear.totalBuffs.maxHp : 0;
  const effectiveMaxHp = PLAYER_MAX_HP + gearMaxHp;
  const hpRatio = Math.max(0, player.hp / effectiveMaxHp);
  const hpColor = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#cccc22' : '#cc2222';
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`HP: ${Math.max(0, Math.ceil(player.hp))}/${effectiveMaxHp}`, barX + 4, barY + 12);

  // Round
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc44';
  ctx.fillText(`ROUND ${S.round}`, W / 2, 22);

  // Enemy count
  if (S.bossActive) {
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('BOSS FIGHT', W / 2, 40);
  } else {
    const alive = S.enemies.filter(e => !e.dying).length;
    const remaining = (S.waveEnemiesTotal - S.waveEnemiesSpawned) + alive;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Enemies: ${remaining}`, W / 2, 40);
  }

  // Score
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Score: ${S.score}`, W - 12, 22);

  // Metal mode indicator
  if (player.metalTimer > 0) {
    const bw = 100;
    const bh = 10;
    const bx = W / 2 - bw / 2;
    const by = 50;
    const ratio = player.metalTimer / METAL_DURATION;
    ctx.fillStyle = '#223';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = ratio < 0.3 ? '#667' : '#aabbdd';
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = '#88aaff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ddeeff';
    ctx.fillText('METAL', W / 2, by + 10);
  }

  // Muscle mode indicator
  if (player.muscleTimer > 0) {
    const mBarW = 100;
    const mBarH = 10;
    const mbx = W / 2 - mBarW / 2;
    const mby = player.metalTimer > 0 ? 64 : 50;
    const mRatio = player.muscleTimer / MUSCLE_DURATION;
    ctx.fillStyle = '#221133';
    ctx.fillRect(mbx, mby, mBarW, mBarH);
    ctx.fillStyle = mRatio < 0.3 ? '#664488' : '#bb66ff';
    ctx.fillRect(mbx, mby, mBarW * mRatio, mBarH);
    ctx.strokeStyle = '#aa66ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mbx, mby, mBarW, mBarH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#eeccff';
    ctx.fillText('MUSCLE', W / 2, mby + 10);
  }

  // Wings mode indicator
  if (player.wingsTimer > 0) {
    const wBarW = 100;
    const wBarH = 10;
    const wbx = W / 2 - wBarW / 2;
    let wby = 50;
    if (player.metalTimer > 0) wby += 14;
    if (player.muscleTimer > 0) wby += 14;
    const wRatio = player.wingsTimer / WINGS_DURATION;
    ctx.fillStyle = '#332200';
    ctx.fillRect(wbx, wby, wBarW, wBarH);
    ctx.fillStyle = wRatio < 0.3 ? '#997744' : '#ffdd88';
    ctx.fillRect(wbx, wby, wBarW * wRatio, wBarH);
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth = 1;
    ctx.strokeRect(wbx, wby, wBarW, wBarH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ffeeaa';
    ctx.fillText('WINGS', W / 2, wby + 10);
  }

  // Dwyer ally indicator
  if (S.dwyer) {
    const dBarW = 100;
    const dBarH = 10;
    const dbx = W / 2 - dBarW / 2;
    let dby = 50;
    if (player.metalTimer > 0) dby += 14;
    if (player.muscleTimer > 0) dby += 14;
    if (player.wingsTimer > 0) dby += 14;
    const dRatio = S.dwyer.timer / DWYER_DURATION;
    ctx.fillStyle = '#332200';
    ctx.fillRect(dbx, dby, dBarW, dBarH);
    ctx.fillStyle = dRatio < 0.3 ? '#886633' : '#ddaa44';
    ctx.fillRect(dbx, dby, dBarW * dRatio, dBarH);
    ctx.strokeStyle = '#ddaa44';
    ctx.lineWidth = 1;
    ctx.strokeRect(dbx, dby, dBarW, dBarH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ffddaa';
    ctx.fillText('DWYER', W / 2, dby + 10);
  }

  // Snot Storm mode indicator
  if (player.snotStormTimer > 0) {
    const ssBarW = 100;
    const ssBarH = 10;
    const ssbx = W / 2 - ssBarW / 2;
    let ssby = 50;
    if (player.metalTimer > 0) ssby += 14;
    if (player.muscleTimer > 0) ssby += 14;
    if (player.wingsTimer > 0) ssby += 14;
    if (S.dwyer) ssby += 14;
    const ssRatio = player.snotStormTimer / SNOT_STORM_DURATION;
    let barVisible = true;
    if (ssRatio < 0.3) {
      const flashSpeed = 0.008 + (1 - ssRatio / 0.3) * 0.03;
      barVisible = Math.sin(performance.now() * flashSpeed) > -0.3;
    }
    if (barVisible) {
      ctx.fillStyle = '#112200';
      ctx.fillRect(ssbx, ssby, ssBarW, ssBarH);
      ctx.fillStyle = ssRatio < 0.3 ? '#448822' : '#88ff44';
      ctx.fillRect(ssbx, ssby, ssBarW * ssRatio, ssBarH);
      ctx.strokeStyle = '#88ff44';
      ctx.lineWidth = 1;
      ctx.strokeRect(ssbx, ssby, ssBarW, ssBarH);
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ccffaa';
      ctx.fillText('SNOT STORM', W / 2, ssby + 10);
    }
  }

  // Stomp chain counter (airborne, chain > 0)
  if (player.stompChain > 0 && !player.onGround) {
    const cx = player.x + PLAYER_W / 2;
    const cy = player.y - 18;
    const chain = player.stompChain;
    const pulse = 1.0 + 0.1 * Math.sin(performance.now() * 0.01);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    const pipW = 10, pipH = 6, pipGap = 3;
    const totalW = 3 * pipW + 2 * pipGap;
    const startX = -totalW / 2;
    for (let p = 0; p < 3; p++) {
      const px = startX + p * (pipW + pipGap);
      ctx.fillStyle = p < chain ? '#88ff44' : 'rgba(136,255,68,0.2)';
      ctx.shadowColor = p < chain ? '#88ff44' : 'transparent';
      ctx.shadowBlur = p < chain ? 6 : 0;
      ctx.fillRect(px, -pipH / 2, pipW, pipH);
      ctx.strokeStyle = '#88ff44';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, -pipH / 2, pipW, pipH);
    }
    ctx.shadowBlur = 0;
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#88ff44';
    ctx.fillText(chain + '/3', 0, pipH / 2 + 12);
    ctx.restore();
  }

  // "SNOT STORM!" activation flash
  if (S.snotStormFlash > 0) {
    const alpha = S.snotStormFlash > 1.0 ? (1.5 - S.snotStormFlash) * 2 : Math.min(1, S.snotStormFlash / 1.0);
    const bob = Math.sin(performance.now() * 0.008) * 3;
    const scale = 1.0 + (1.5 - S.snotStormFlash) * 0.15;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = `rgba(136,255,68,${alpha})`;
    ctx.shadowColor = '#88ff44';
    ctx.shadowBlur = 12;
    ctx.translate(W / 2, 120 + bob);
    ctx.scale(scale, scale);
    ctx.fillText('SNOT STORM!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Snot rocket cooldown / charge indicator
  if (player.snotHolding) {
    const sBarW = 80;
    const sBarH = 8;
    const sbx = W - sBarW - 12;
    const sby = 36;
    const chargeRatio = Math.min(player.snotChargeTime / SNOT_MAX_CHARGE, 1);
    ctx.fillStyle = '#1a2210';
    ctx.fillRect(sbx, sby, sBarW, sBarH);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(sbx, sby, sBarW * chargeRatio, sBarH);
    ctx.strokeStyle = '#88cc22';
    ctx.lineWidth = 1;
    ctx.strokeRect(sbx, sby, sBarW, sBarH);
    ctx.textAlign = 'right';
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('AIMING...', sbx + sBarW, sby + 7);
  } else if (player.snotCooldown > 0) {
    const sBarW = 80;
    const sBarH = 8;
    const sbx = W - sBarW - 12;
    const sby = 36;
    const sRatio = 1 - player.snotCooldown / SNOT_COOLDOWN;
    ctx.fillStyle = '#1a2210';
    ctx.fillRect(sbx, sby, sBarW, sBarH);
    ctx.fillStyle = sRatio >= 1 ? '#88cc22' : '#556622';
    ctx.fillRect(sbx, sby, sBarW * sRatio, sBarH);
    ctx.strokeStyle = '#88cc22';
    ctx.lineWidth = 1;
    ctx.strokeRect(sbx, sby, sBarW, sBarH);
    ctx.textAlign = 'right';
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#aaddaa';
    ctx.fillText('SNOT', sbx + sBarW, sby + 7);
  } else {
    ctx.textAlign = 'right';
    ctx.font = 'bold 8px monospace';
    const readyPulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);
    ctx.fillStyle = `rgba(136,204,34,${readyPulse})`;
    ctx.fillText(isMobile ? 'SNOT: HOLD TO AIM' : 'SNOT [Q]: HOLD TO AIM', W - 12, 43);
  }
}

// ============================================================
// TITLE SCREEN
// ============================================================
export function drawTitleScreen() {
  const ctx = S.ctx;
  const cy = H * 0.12;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 42px monospace';
  ctx.fillText('EGGTHONY', W / 2, cy);

  ctx.fillStyle = '#4488ff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('Lightning Egg', W / 2, cy + 38);

  // Splash text
  const splashes = [['NOW WITH', 'SNOT STOMP!']];
  const splash = splashes[Math.floor(S.titleBlink * 0.01) % splashes.length];
  const splashScale = 1.0 + 0.05 * Math.sin(performance.now() * 0.005);
  ctx.save();
  ctx.translate(W / 2 + 130, cy + 24);
  ctx.rotate(0.3);
  ctx.scale(splashScale, splashScale);
  ctx.fillStyle = '#ffff00';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  for (let l = 0; l < splash.length; l++) {
    ctx.fillText(splash[l], 0, l * 18);
  }
  ctx.restore();
  ctx.textAlign = 'center';

  // Draw Eggthony (big) with equipped gear
  if (spriteLoaded) {
    const eggX = W / 2 - 60, eggY = cy + 50, eggW = 120, eggH = 274;
    ctx.drawImage(eggSprite, eggX, eggY, eggW, eggH);
    drawGearOnPlayer(eggX, eggY, eggW, eggH);
  }

  // Controls
  ctx.fillStyle = '#ccc';
  ctx.font = '14px monospace';
  const controls = [
    ...(isMobile ? [
      'Drag left side to move',
      'JUMP button to jump',
      'Hold ZAP to shoot (auto-aims)',
      'HOLD SNOT to aim booger mortar, release!',
    ] : [
      'WASD - Move / Jump',
      'Click - Shoot lightning toward cursor',
      'HOLD Q/E - Aim snot mortar, release to fire!',
    ])
  ];
  const ctrlY = cy + 470;
  controls.forEach((line, i) => {
    ctx.fillText(line, W / 2, ctrlY + i * 24);
  });

  // Top scores on title
  if (S.leaderboardData.length > 0) {
    const lbY = ctrlY + controls.length * 24 + 20;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(S.devLeaderboard ? 'TOP SCORES (DEV)' : 'TOP SCORES', W / 2, lbY);
    for (let i = 0; i < Math.min(S.leaderboardData.length, 5); i++) {
      const e = S.leaderboardData[i];
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      const rank = String(i + 1).padStart(2, ' ');
      const nm = e.name.length > 10 ? e.name.slice(0, 10) : e.name.padEnd(10, ' ');
      const sc = String(e.score).padStart(6, ' ');
      ctx.fillText(`${rank}. ${nm} ${sc} R${e.round}`, W / 2, lbY + 18 + i * 16);
    }
  }

  // GEAR button (only show if player has gear)
  if (S.gear.inventory.length > 0) {
    const gearBtnX = W - 110, gearBtnY = PLATFORM_Y - 90, gearBtnW = 100, gearBtnH = 36;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(gearBtnX, gearBtnY, gearBtnW, gearBtnH);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.strokeRect(gearBtnX, gearBtnY, gearBtnW, gearBtnH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('GEAR', gearBtnX + gearBtnW / 2, gearBtnY + 23);
  }

  // Blink
  S.titleBlink += 0.03;
  const alpha = 0.5 + 0.5 * Math.sin(S.titleBlink * 3);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(isMobile ? 'Tap to Start' : 'Click to Start', W / 2, PLATFORM_Y - 40);

  // Dev menu overlay
  if (S.devMenuOpen) {
    drawDevMenu(ctx);
  }
}

// ============================================================
// DEV MENU
// ============================================================
function drawDevMenu(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('DEV MENU', W / 2, 60);
  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText('Select round to start', W / 2, 85);

  const cols = 5, rows = 3;
  const btnW = 70, btnH = 50, gap = 10;
  const gridW = cols * btnW + (cols - 1) * gap;
  const startX = (W - gridW) / 2;
  const startY = 110;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const r = row * cols + col + 1;
      const bx = startX + col * (btnW + gap);
      const by = startY + row * (btnH + gap);
      const isBoss = r >= 3 && r % 3 === 0;
      const isQPRound = isBoss && bossAppearance(r) >= 3;
      ctx.fillStyle = isQPRound ? '#224422' : (isBoss ? '#442222' : '#333');
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = isQPRound ? '#44ff44' : (isBoss ? '#ff4444' : '#666');
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, btnW, btnH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`R${r}`, bx + btnW / 2, by + 22);
      if (isBoss) {
        ctx.fillStyle = isQPRound ? '#44ff44' : '#ff6644';
        ctx.font = '10px monospace';
        ctx.fillText(isQPRound ? 'QP' : 'BOSS', bx + btnW / 2, by + 40);
      }
    }
  }

  // Close button
  ctx.fillStyle = '#444';
  ctx.fillRect(W / 2 - 50, startY + rows * (btnH + gap) + 20, 100, 36);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(W / 2 - 50, startY + rows * (btnH + gap) + 20, 100, 36);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('CLOSE', W / 2, startY + rows * (btnH + gap) + 43);

  // Dev powerup toggles
  const pwY = startY + rows * (btnH + gap) + 72;
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.fillText('START WITH POWERUP:', W / 2, pwY);
  const pwNames = ['NONE', 'METAL', 'MUSCLE', 'WINGS'];
  const pwKeys = ['', 'metal', 'muscle', 'wings'];
  const pwColors = ['#666', '#aaccff', '#cc66ff', '#ffdd88'];
  const pwBtnW = 60, pwGap = 6;
  const pwTotalW = pwNames.length * pwBtnW + (pwNames.length - 1) * pwGap;
  const pwStartX = (W - pwTotalW) / 2;
  for (let i = 0; i < pwNames.length; i++) {
    const bx = pwStartX + i * (pwBtnW + pwGap);
    const by = pwY + 8;
    const active = S.devSpawnPowerup === pwKeys[i];
    ctx.fillStyle = active ? '#224433' : '#333';
    ctx.fillRect(bx, by, pwBtnW, 26);
    ctx.strokeStyle = active ? pwColors[i] : '#555';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(bx, by, pwBtnW, 26);
    ctx.fillStyle = active ? pwColors[i] : '#aaa';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(pwNames[i], bx + pwBtnW / 2, by + 17);
  }

  // Dev leaderboard controls
  const dlY = startY + rows * (btnH + gap) + 116;
  const dlX = W / 2 - 130;
  ctx.fillStyle = S.devLeaderboard ? '#224422' : '#333';
  ctx.fillRect(dlX, dlY, 260, 36);
  ctx.strokeStyle = S.devLeaderboard ? '#44ff44' : '#666';
  ctx.lineWidth = 2;
  ctx.strokeRect(dlX, dlY, 260, 36);
  ctx.fillStyle = S.devLeaderboard ? '#44ff44' : '#aaa';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('DEV LEADERBOARD: ' + (S.devLeaderboard ? 'ON' : 'OFF'), W / 2, dlY + 22);

  if (S.devLeaderboard) {
    ctx.fillStyle = '#333';
    ctx.fillRect(dlX, dlY + 46, 120, 32);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(dlX, dlY + 46, 120, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('ADD FAKES', dlX + 60, dlY + 66);

    ctx.fillStyle = '#442222';
    ctx.fillRect(dlX + 140, dlY + 46, 120, 32);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(dlX + 140, dlY + 46, 120, 32);
    ctx.fillStyle = '#ff6644';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CLEAR ALL', dlX + 200, dlY + 66);

    ctx.fillStyle = '#333';
    ctx.fillRect(dlX, dlY + 88, 260, 32);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1;
    ctx.strokeRect(dlX, dlY + 88, 260, 32);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('SET LOW #1 (100 pts)', W / 2, dlY + 108);

    ctx.fillStyle = '#666';
    ctx.font = '11px monospace';
    ctx.fillText(getDevScores().length + ' local scores', W / 2, dlY + 135);
  }

  // Dev gear controls
  const gY = S.devLeaderboard ? dlY + 155 : dlY + 50;
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GEAR:', W / 2, gY);

  const gBtnW = 120, gBtnH = 32, gGap = 10;
  const gStartX = W / 2 - gBtnW - gGap / 2;

  // GIVE ALL button
  ctx.fillStyle = '#223322';
  ctx.fillRect(gStartX, gY + 8, gBtnW, gBtnH);
  ctx.strokeStyle = '#44ff44';
  ctx.lineWidth = 1;
  ctx.strokeRect(gStartX, gY + 8, gBtnW, gBtnH);
  ctx.fillStyle = '#44ff44';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('GIVE ALL', gStartX + gBtnW / 2, gY + 28);

  // CLEAR button
  const clearX = gStartX + gBtnW + gGap;
  ctx.fillStyle = '#332222';
  ctx.fillRect(clearX, gY + 8, gBtnW, gBtnH);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(clearX, gY + 8, gBtnW, gBtnH);
  ctx.fillStyle = '#ff6644';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('CLEAR', clearX + gBtnW / 2, gY + 28);

  // Gear count
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText(S.gear.inventory.length + ' items in inventory', W / 2, gY + 54);
}

export function handleDevMenuClick(cx, cy) {
  const cols = 5, rows = 3;
  const btnW = 70, btnH = 50, gap = 10;
  const gridW = cols * btnW + (cols - 1) * gap;
  const startX = (W - gridW) / 2;
  const startY = 110;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const r = row * cols + col + 1;
      const bx = startX + col * (btnW + gap);
      const by = startY + row * (btnH + gap);
      if (cx >= bx && cx <= bx + btnW && cy >= by && cy <= by + btnH) {
        S.devMenuOpen = false;
        S.gameState = 'playing';
        playVoice('start', true);
        musicClip.currentTime = 0;
        musicClip.play().catch(() => {});
        resetGameState(r);
        S.currentThemeIndex = getThemeIndex(r);
        initAmbientParticles();
        initBgDetails();
        if (S.devSpawnPowerup === 'metal') S.player.metalTimer = METAL_DURATION;
        if (S.devSpawnPowerup === 'muscle') S.player.muscleTimer = MUSCLE_DURATION;
        if (S.devSpawnPowerup === 'wings') S.player.wingsTimer = WINGS_DURATION;
        startRound(r);
        return true;
      }
    }
  }
  // Close button
  const closeY = startY + rows * (btnH + gap) + 20;
  if (cx >= W / 2 - 50 && cx <= W / 2 + 50 && cy >= closeY && cy <= closeY + 36) {
    S.devMenuOpen = false;
    return true;
  }
  // Dev powerup toggles
  const pwY = startY + rows * (btnH + gap) + 72;
  const pwNames = ['', 'metal', 'muscle', 'wings'];
  const pwBtnW = 60, pwGap = 6;
  const pwTotalW = 4 * pwBtnW + 3 * pwGap;
  const pwStartX = (W - pwTotalW) / 2;
  for (let i = 0; i < 4; i++) {
    const bx = pwStartX + i * (pwBtnW + pwGap);
    const by = pwY + 8;
    if (cx >= bx && cx <= bx + pwBtnW && cy >= by && cy <= by + 26) {
      S.devSpawnPowerup = pwNames[i];
      return true;
    }
  }
  // Dev leaderboard controls
  const dlY = startY + rows * (btnH + gap) + 116;
  const dlX = W / 2 - 130;
  if (cx >= dlX && cx <= dlX + 260 && cy >= dlY && cy <= dlY + 36) {
    S.devLeaderboard = !S.devLeaderboard;
    localStorage.setItem('eggthonyDevLB', S.devLeaderboard ? 'true' : 'false');
    fetchLeaderboard();
    return true;
  }
  if (S.devLeaderboard) {
    if (cx >= dlX && cx <= dlX + 120 && cy >= dlY + 46 && cy <= dlY + 78) {
      const fakes = [
        { name: 'ZapMaster', score: 4200, round: 12 },
        { name: 'EggLord', score: 3800, round: 11 },
        { name: 'StormyBoi', score: 3100, round: 9 },
        { name: 'XenoSlayer', score: 2600, round: 8 },
        { name: 'BoltQueen', score: 2100, round: 7 },
        { name: 'FryGuy', score: 1500, round: 6 },
        { name: 'ShellShock', score: 900, round: 4 },
        { name: 'Noob123', score: 350, round: 2 },
      ];
      const scores = getDevScores().concat(fakes);
      scores.sort((a, b) => b.score - a.score);
      scores.length = Math.min(scores.length, 20);
      saveDevScores(scores);
      S.leaderboardData = scores;
      return true;
    }
    if (cx >= dlX + 140 && cx <= dlX + 260 && cy >= dlY + 46 && cy <= dlY + 78) {
      saveDevScores([]);
      S.leaderboardData = [];
      return true;
    }
    if (cx >= dlX && cx <= dlX + 260 && cy >= dlY + 88 && cy <= dlY + 120) {
      const low = [
        { name: 'EasyBeat', score: 100, round: 1 },
        { name: 'AlsoEasy', score: 50, round: 1 },
      ];
      saveDevScores(low);
      S.leaderboardData = low;
      return true;
    }
  }
  // Dev gear controls
  const dlYBase = startY + rows * (btnH + gap) + 116;
  const gY = S.devLeaderboard ? dlYBase + 155 : dlYBase + 50;
  const gBtnW = 120, gBtnH = 32, gGap = 10;
  const gStartX = W / 2 - gBtnW - gGap / 2;
  const clearX = gStartX + gBtnW + gGap;

  // GIVE ALL
  if (cx >= gStartX && cx <= gStartX + gBtnW && cy >= gY + 8 && cy <= gY + 8 + gBtnH) {
    for (const id of Object.keys(GEAR_ITEMS)) {
      awardDrop(id);
    }
    return true;
  }
  // CLEAR
  if (cx >= clearX && cx <= clearX + gBtnW && cy >= gY + 8 && cy <= gY + 8 + gBtnH) {
    S.gear.inventory = [];
    for (const slot of Object.keys(S.gear.equipped)) {
      S.gear.equipped[slot] = null;
    }
    recalcBuffs();
    saveGear();
    return true;
  }

  return false;
}

// ============================================================
// ROUND TRANSITION
// ============================================================
export function drawRoundTransition() {
  const ctx = S.ctx;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#44ff44';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`ROUND ${S.round} COMPLETE!`, W / 2, H / 2 - 30);

  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`Round ${S.round + 1} incoming...`, W / 2, H / 2 + 15);

  // Show theme name announcement if crossing a boundary
  const nextThemeIdx = getThemeIndex(S.round + 1);
  if (nextThemeIdx !== S.currentThemeIndex) {
    const nextTheme = THEMES[nextThemeIdx];
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.005);
    const themeColors = {
      'SPACE STATION': `rgba(100,160,255,${pulse})`,
      'XENO JUNGLE': `rgba(80,255,100,${pulse})`,
      'VOLCANIC CORE': `rgba(255,120,40,${pulse})`
    };
    ctx.fillStyle = themeColors[nextTheme.name] || '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`~ ${nextTheme.name} ~`, W / 2, H / 2 + 95);
  }

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`Score: ${S.score}`, W / 2, H / 2 + 60);

  if (isBossRound(S.round + 1)) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.008);
    ctx.fillStyle = `rgba(255,40,40,${pulse})`;
    ctx.font = 'bold 26px monospace';
    ctx.fillText('! BOSS BATTLE !', W / 2, H / 2 + 130);
  }
}

// ============================================================
// CROWN ANIMATION
// ============================================================
function drawCrown(x, y, size) {
  const ctx = S.ctx;
  const w = size * 1.2;
  const h = size * 0.7;
  const bandH = h * 0.35;
  const pointH = h * 0.65;

  ctx.save();
  ctx.fillStyle = '#ffd700';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.fillRect(x - w / 2, y - bandH / 2, w, bandH);
  ctx.strokeRect(x - w / 2, y - bandH / 2, w, bandH);

  const points = [-w * 0.35, 0, w * 0.35];
  for (let i = 0; i < 3; i++) {
    const px = x + points[i];
    const baseY = y - bandH / 2;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(px - w * 0.13, baseY);
    ctx.lineTo(px, baseY - pointH);
    ctx.lineTo(px + w * 0.13, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = i === 1 ? '#ff2244' : '#2266ff';
    ctx.beginPath();
    ctx.arc(px, baseY - pointH + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCrownAnimation() {
  if (!S.crownAnimActive) return;
  const ctx = S.ctx;
  const t = S.crownAnimTimer;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);

  const eggW = 80;
  const eggH = 180;
  const eggX = W / 2 - eggW / 2;
  const eggY = H / 2 - 20 - eggH / 2;
  ctx.drawImage(eggSprite, eggX, eggY, eggW, eggH);

  const crownSize = 40;
  const crownTargetY = eggY - 8;
  const crownStartY = eggY - 150;

  let crownY;
  if (t < 1.5) {
    const p = t / 1.5;
    const ease = 1 - Math.pow(1 - p, 3);
    crownY = crownStartY + (crownTargetY - crownStartY) * ease;
  } else {
    const bobT = t - 1.5;
    crownY = crownTargetY + Math.sin(bobT * 4) * 2;
  }

  drawCrown(W / 2, crownY, crownSize);
  drawParticles();

  if (t > 1.5) {
    const textAlpha = Math.min(1, (t - 1.5) / 0.5);
    const pulse = 1 + Math.sin((t - 1.5) * 4) * 0.05;

    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.translate(W / 2, eggY + eggH + 40);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('NEW CHAMPION!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('NEW CHAMPION!', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================
// GAME OVER
// ============================================================
export function drawGameOver() {
  const ctx = S.ctx;
  ctx.textAlign = 'center';

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 60);

  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`Score: ${S.score}`, W / 2, H / 2);

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`Reached Round ${S.round}`, W / 2, H / 2 + 40);

  if (S.gameOverPhase === 'showing' && S.leaderboardData.length > 0) {
    const startY = H / 2 + 80;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(S.devLeaderboard ? 'TOP SCORES (DEV)' : 'TOP SCORES', W / 2, startY);

    const savedName = localStorage.getItem('eggthonyName') || '';
    for (let i = 0; i < Math.min(S.leaderboardData.length, 10); i++) {
      const e = S.leaderboardData[i];
      const isPlayer = e.name === savedName && e.score === S.score && e.round === S.round;
      ctx.fillStyle = isPlayer ? '#ffcc00' : '#ccc';
      ctx.font = '14px monospace';
      const rank = String(i + 1).padStart(2, ' ');
      const nm = e.name.length > 10 ? e.name.slice(0, 10) : e.name.padEnd(10, ' ');
      const sc = String(e.score).padStart(6, ' ');
      ctx.fillText(`${rank}. ${nm} ${sc} R${e.round}`, W / 2, startY + 22 + i * 18);
    }
  }

  if (S.gameOverPhase === 'showing') {
    // GEAR button (only show if player has gear)
    if (S.gear.inventory.length > 0) {
      const goGearX = 14, goGearY = H - 60, goGearW = 80, goGearH = 36;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(goGearX, goGearY, goGearW, goGearH);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.strokeRect(goGearX, goGearY, goGearW, goGearH);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('GEAR', goGearX + goGearW / 2, goGearY + 23);
    }

    S.titleBlink += 0.03;
    const alpha = 0.5 + 0.5 * Math.sin(S.titleBlink * 3);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(isMobile ? 'Tap to Restart' : 'Click to Restart', W / 2, H - 40);
  }

  drawCrownAnimation();
}
