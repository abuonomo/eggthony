import { S, resetPlayer, resetGameState } from './state.js';
import {
  W, H, PLATFORM_Y, PLAYER_W, PLAYER_H, PLAYER_MAX_HP,
  METAL_DURATION, MUSCLE_DURATION, WINGS_DURATION,
  SNOT_COOLDOWN, SNOT_MAX_CHARGE, SNOT_STORM_DURATION,
  DWYER_DURATION, CHRIS_DURATION, CROWN_ANIM_DURATION, THEMES,
  LEADERBOARD_API,
} from './constants.js';
import { ensureAudio, playSound, playVoice, musicClip } from './audio.js';
import { eggSprite, spriteLoaded } from './sprites.js';
import { spawnParticles, drawParticles } from './effects.js';
import { isMobile } from './input.js';
import { isBossRound, bossAppearance } from './boss.js';
import { spawnMetalHat, spawnSmoothie, spawnWings, spawnChestplate,
         createDwyer, spawnBeerCan, createChris } from './powerups.js';
import { getThemeIndex, initAmbientParticles, initBgDetails } from './world.js';
import { startRound } from './waves.js';
import { GEAR_ITEMS, awardDrop, recalcBuffs, saveGear, drawGearOnPlayer } from './gear.js';

// ============================================================
// LEADERBOARD
// ============================================================
const platform = isMobile ? 'mobile' : 'desktop';
const otherPlat = platform === 'desktop' ? 'mobile' : 'desktop';
function ownPlatformData() { return platform === 'desktop' ? S.leaderboardDesktop : S.leaderboardMobile; }
function otherPlatformData() { return platform === 'desktop' ? S.leaderboardMobile : S.leaderboardDesktop; }
function otherPlatformName() { return otherPlat.toUpperCase(); }

export async function fetchLeaderboard() {
  if (S.devLeaderboard) {
    S.leaderboardDesktop = getDevScores('desktop');
    S.leaderboardMobile = getDevScores('mobile');
    return;
  }
  try {
    const [dRes, mRes] = await Promise.all([
      fetch(LEADERBOARD_API + '/scores?platform=desktop'),
      fetch(LEADERBOARD_API + '/scores?platform=mobile'),
    ]);
    if (dRes.ok) S.leaderboardDesktop = await dRes.json();
    if (mRes.ok) S.leaderboardMobile = await mRes.json();
  } catch {}
}

async function submitScore(name, score, round) {
  if (S.devLeaderboard) {
    const scores = getDevScores();
    scores.push({ name, score, round });
    scores.sort((a, b) => b.score - a.score);
    scores.length = Math.min(scores.length, 20);
    saveDevScores(scores);
    // Refresh both arrays
    S.leaderboardDesktop = getDevScores('desktop');
    S.leaderboardMobile = getDevScores('mobile');
    return;
  }
  try {
    const res = await fetch(LEADERBOARD_API + '/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, round, platform }),
    });
    if (res.ok) {
      const updated = await res.json();
      if (platform === 'desktop') S.leaderboardDesktop = updated;
      else S.leaderboardMobile = updated;
    }
  } catch {}
}

export function getDevScores(plat = platform) {
  // One-time migration from old key
  const old = localStorage.getItem('eggthonyDevScores');
  if (old !== null) {
    localStorage.setItem('eggthonyDevScores:desktop', old);
    localStorage.removeItem('eggthonyDevScores');
  }
  try { return JSON.parse(localStorage.getItem(`eggthonyDevScores:${plat}`) || '[]'); }
  catch { return []; }
}

export function saveDevScores(scores, plat = platform) {
  localStorage.setItem(`eggthonyDevScores:${plat}`, JSON.stringify(scores));
}

function formatLeaderboardNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function fitLeaderboardText(ctx, text, maxWidth) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let clipped = raw;
  while (clipped.length > 0 && ctx.measureText(`${clipped}..`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped ? `${clipped}..` : '';
}

function drawLeaderboardTable({ topY, maxRows, rowStep, rowFont, highlightEntry, data }) {
  const ctx = S.ctx;
  const rows = (data || []).slice(0, maxRows);
  if (rows.length <= 0) return topY;

  // Keep columns compact and centered as a single block beneath the section title.
  const rankW = 24;
  const nameMaxW = 128;
  const nameToScoreGap = 22;
  const scoreToRoundGap = 52;
  const blockWidth = rankW + nameMaxW + nameToScoreGap + scoreToRoundGap;
  const rankX = Math.floor(W / 2 - blockWidth / 2);
  const nameX = rankX + rankW;
  const scoreX = nameX + nameMaxW + nameToScoreGap;
  const roundX = scoreX + scoreToRoundGap;

  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'left';
  ctx.fillText('#', rankX, topY);
  ctx.fillText('NAME', nameX, topY);
  ctx.textAlign = 'right';
  ctx.fillText('SCORE', scoreX, topY);
  ctx.fillText('ROUND', roundX, topY);

  let bottomY = topY;
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const rowY = topY + 14 + i * rowStep;
    const isHighlight = highlightEntry ? highlightEntry(e) : false;
    const rankText = `${i + 1}.`;
    const nameText = fitLeaderboardText(ctx, e.name, nameMaxW);
    const scoreText = formatLeaderboardNumber(e.score);
    const roundText = `R${e.round || 0}`;

    ctx.fillStyle = isHighlight ? '#ffcc00' : '#ccc';
    ctx.font = rowFont;
    ctx.textAlign = 'left';
    ctx.fillText(rankText, rankX, rowY);
    ctx.fillText(nameText, nameX, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(scoreText, scoreX, rowY);
    ctx.fillText(roundText, roundX, rowY);
    bottomY = rowY;
  }
  ctx.restore();
  return bottomY;
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
  const ownData = ownPlatformData();
  const isChampion = ownData.length > 0 &&
    ownData[0].name === savedName &&
    ownData[0].score === S.score &&
    ownData[0].round === S.round;
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

  // Chris ally indicator
  if (S.chris && !S.chris.entering) {
    const cBarW = 100;
    const cBarH = 10;
    const cbx = W / 2 - cBarW / 2;
    let cby = 50;
    if (player.metalTimer > 0) cby += 14;
    if (player.muscleTimer > 0) cby += 14;
    if (player.wingsTimer > 0) cby += 14;
    if (S.dwyer) cby += 14;
    const cRatio = S.chris.timer / CHRIS_DURATION;
    ctx.fillStyle = '#332200';
    ctx.fillRect(cbx, cby, cBarW, cBarH);
    ctx.fillStyle = cRatio < 0.3 ? '#886633' : '#dd8822';
    ctx.fillRect(cbx, cby, cBarW * cRatio, cBarH);
    ctx.strokeStyle = '#dd8822';
    ctx.lineWidth = 1;
    ctx.strokeRect(cbx, cby, cBarW, cBarH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ffcc88';
    ctx.fillText('CHRIS', W / 2, cby + 10);
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
    if (S.chris && !S.chris.entering) ssby += 14;
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

  // Top scores on title — desktop first, then mobile
  if (S.leaderboardDesktop.length > 0 || S.leaderboardMobile.length > 0) {
    let lbY = ctrlY + controls.length * 24 + 20;
    const isOwn = platform === 'desktop';
    if (S.leaderboardDesktop.length > 0) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      const dLabel = S.devLeaderboard ? 'TOP SCORES · DESKTOP (DEV)' : 'TOP SCORES · DESKTOP';
      ctx.fillText(dLabel, W / 2, lbY);
      lbY = drawLeaderboardTable({ topY: lbY + 18, maxRows: 3, rowStep: 16, rowFont: '12px monospace', data: S.leaderboardDesktop }) + 26;
    }
    if (S.leaderboardMobile.length > 0) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      const mLabel = S.devLeaderboard ? 'TOP SCORES · MOBILE (DEV)' : 'TOP SCORES · MOBILE';
      ctx.fillText(mLabel, W / 2, lbY);
      drawLeaderboardTable({ topY: lbY + 18, maxRows: 3, rowStep: 16, rowFont: '12px monospace', data: S.leaderboardMobile });
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
  ctx.fillText(S.devPowerupDrop ? 'DROP POWERUP ITEM:' : 'START WITH POWERUP:', W / 2, pwY);
  const pwNames = ['NONE', 'METAL', 'MUSCLE', 'WINGS', 'DWYER', 'CHRIS'];
  const pwKeys = ['', 'metal', 'muscle', 'wings', 'dwyer', 'chris'];
  const pwColors = ['#666', '#aaccff', '#cc66ff', '#ffdd88', '#ddaa44', '#dd8822'];
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

  // Instant / Drop toggle
  const togY = pwY + 40;
  const togW = 80, togGap = 8;
  const togStartX = W / 2 - togW - togGap / 2;
  for (let i = 0; i < 2; i++) {
    const bx = togStartX + i * (togW + togGap);
    const isActive = i === 0 ? !S.devPowerupDrop : S.devPowerupDrop;
    const label = i === 0 ? 'INSTANT' : 'DROP';
    ctx.fillStyle = isActive ? '#223344' : '#222';
    ctx.fillRect(bx, togY, togW, 22);
    ctx.strokeStyle = isActive ? '#88bbff' : '#444';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.strokeRect(bx, togY, togW, 22);
    ctx.fillStyle = isActive ? '#aaddff' : '#666';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(label, bx + togW / 2, togY + 15);
  }

  // Dev leaderboard controls
  const dlY = startY + rows * (btnH + gap) + 146;
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
    ctx.fillText(getDevScores('desktop').length + ' desktop / ' + getDevScores('mobile').length + ' mobile scores', W / 2, dlY + 135);
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

  // Jump to game over button
  const goY = gY + 68;
  ctx.fillStyle = '#442222';
  ctx.fillRect(dlX, goY, 260, 36);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(dlX, goY, 260, 36);
  ctx.fillStyle = '#ff6644';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('JUMP TO GAME OVER', W / 2, goY + 22);
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
        if (S.devSpawnPowerup) {
          if (S.devPowerupDrop) {
            // Drop the pickup item immediately
            if (S.devSpawnPowerup === 'metal') spawnMetalHat();
            if (S.devSpawnPowerup === 'muscle') spawnSmoothie();
            if (S.devSpawnPowerup === 'wings') spawnWings();
            if (S.devSpawnPowerup === 'dwyer') spawnChestplate();
            if (S.devSpawnPowerup === 'chris') spawnBeerCan();
          } else {
            // Apply instantly
            if (S.devSpawnPowerup === 'metal') S.player.metalTimer = METAL_DURATION;
            if (S.devSpawnPowerup === 'muscle') S.player.muscleTimer = MUSCLE_DURATION;
            if (S.devSpawnPowerup === 'wings') S.player.wingsTimer = WINGS_DURATION;
            if (S.devSpawnPowerup === 'dwyer') S.dwyer = createDwyer();
            if (S.devSpawnPowerup === 'chris') S.chris = createChris();
          }
        }
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
  const pwKeys = ['', 'metal', 'muscle', 'wings', 'dwyer', 'chris'];
  const pwBtnW = 60, pwGap = 6;
  const pwTotalW = pwKeys.length * pwBtnW + (pwKeys.length - 1) * pwGap;
  const pwStartX = (W - pwTotalW) / 2;
  for (let i = 0; i < pwKeys.length; i++) {
    const bx = pwStartX + i * (pwBtnW + pwGap);
    const by = pwY + 8;
    if (cx >= bx && cx <= bx + pwBtnW && cy >= by && cy <= by + 26) {
      S.devSpawnPowerup = pwKeys[i];
      return true;
    }
  }
  // Instant / Drop toggle
  const togY = pwY + 40;
  const togW = 80, togGap = 8;
  const togStartX = W / 2 - togW - togGap / 2;
  for (let i = 0; i < 2; i++) {
    const bx = togStartX + i * (togW + togGap);
    if (cx >= bx && cx <= bx + togW && cy >= togY && cy <= togY + 22) {
      S.devPowerupDrop = i === 1;
      return true;
    }
  }
  // Dev leaderboard controls
  const dlY = startY + rows * (btnH + gap) + 146;
  const dlX = W / 2 - 130;
  if (cx >= dlX && cx <= dlX + 260 && cy >= dlY && cy <= dlY + 36) {
    S.devLeaderboard = !S.devLeaderboard;
    localStorage.setItem('eggthonyDevLB', S.devLeaderboard ? 'true' : 'false');
    fetchLeaderboard();
    return true;
  }
  if (S.devLeaderboard) {
    if (cx >= dlX && cx <= dlX + 120 && cy >= dlY + 46 && cy <= dlY + 78) {
      const desktopFakes = [
        { name: 'ZapMaster', score: 4200, round: 12 },
        { name: 'EggLord', score: 3800, round: 11 },
        { name: 'StormyBoi', score: 3100, round: 9 },
        { name: 'XenoSlayer', score: 2600, round: 8 },
        { name: 'BoltQueen', score: 2100, round: 7 },
        { name: 'FryGuy', score: 1500, round: 6 },
        { name: 'ShellShock', score: 900, round: 4 },
        { name: 'Noob123', score: 350, round: 2 },
      ];
      const mobileFakes = [
        { name: 'TapKing', score: 3900, round: 11 },
        { name: 'SwipeGod', score: 3200, round: 10 },
        { name: 'ThumbWar', score: 2700, round: 8 },
        { name: 'PhoneFry', score: 2000, round: 7 },
        { name: 'PinchZap', score: 1400, round: 5 },
        { name: 'MobNoob', score: 600, round: 3 },
      ];
      const dScores = getDevScores('desktop').concat(desktopFakes);
      dScores.sort((a, b) => b.score - a.score);
      dScores.length = Math.min(dScores.length, 20);
      saveDevScores(dScores, 'desktop');
      const mScores = getDevScores('mobile').concat(mobileFakes);
      mScores.sort((a, b) => b.score - a.score);
      mScores.length = Math.min(mScores.length, 20);
      saveDevScores(mScores, 'mobile');
      S.leaderboardDesktop = dScores;
      S.leaderboardMobile = mScores;
      return true;
    }
    if (cx >= dlX + 140 && cx <= dlX + 260 && cy >= dlY + 46 && cy <= dlY + 78) {
      saveDevScores([], 'desktop');
      saveDevScores([], 'mobile');
      S.leaderboardDesktop = [];
      S.leaderboardMobile = [];
      return true;
    }
    if (cx >= dlX && cx <= dlX + 260 && cy >= dlY + 88 && cy <= dlY + 120) {
      const low = [
        { name: 'EasyBeat', score: 100, round: 1 },
        { name: 'AlsoEasy', score: 50, round: 1 },
      ];
      saveDevScores(low);
      // Only own platform — refresh both arrays from storage
      S.leaderboardDesktop = getDevScores('desktop');
      S.leaderboardMobile = getDevScores('mobile');
      return true;
    }
  }
  // Dev gear controls
  const dlYBase = startY + rows * (btnH + gap) + 146;
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

  // Jump to game over
  const goBtnY = gY + 68;
  if (cx >= dlX && cx <= dlX + 260 && cy >= goBtnY && cy <= goBtnY + 36) {
    S.devMenuOpen = false;
    S.score = 1337;
    S.round = 7;
    S.gameState = 'gameOver';
    S.gameOverCooldown = 0;
    S.gameOverPhase = 'showing';
    fetchLeaderboard();
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

  if (S.gameOverPhase === 'showing') {
    if (S.leaderboardDesktop.length > 0 || S.leaderboardMobile.length > 0) {
      let goY = H / 2 + 80;
      const savedName = localStorage.getItem('eggthonyName') || '';
      const hlFn = e => e.name === savedName && e.score === S.score && e.round === S.round;
      const isOwn = platform === 'desktop';
      if (S.leaderboardDesktop.length > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        const dLabel = S.devLeaderboard ? 'TOP SCORES · DESKTOP (DEV)' : 'TOP SCORES · DESKTOP';
        ctx.fillText(dLabel, W / 2, goY);
        goY = drawLeaderboardTable({
          topY: goY + 22, maxRows: 5, rowStep: 18, rowFont: '14px monospace',
          highlightEntry: isOwn ? hlFn : null, data: S.leaderboardDesktop,
        }) + 30;
      }
      if (S.leaderboardMobile.length > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        const mLabel = S.devLeaderboard ? 'TOP SCORES · MOBILE (DEV)' : 'TOP SCORES · MOBILE';
        ctx.fillText(mLabel, W / 2, goY);
        drawLeaderboardTable({
          topY: goY + 22, maxRows: 5, rowStep: 18, rowFont: '14px monospace',
          highlightEntry: !isOwn ? hlFn : null, data: S.leaderboardMobile,
        });
      }
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
