// ============================================================
// AUDIO ENGINE (Web Audio API - procedural SFX)
// ============================================================
import { random } from './rng.js';

export let audioCtx = null;
let audioUnlocked = false;

export function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!audioUnlocked) {
    audioUnlocked = true;
    for (const clip of [...Object.values(voiceClips), snotSniffleClip, snotLaunchClip, quentinFartClip, dwyerClip, gulpClip, throwClip, melodicaClip]) {
      clip.load();
    }
  }
}

export function playSound(type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case 'punch':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
      break;
    case 'lightning':
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
      break;
    case 'hit':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.08);
      break;
    case 'kill':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
      break;
    case 'hurt':
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.2);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      break;
    case 'roundStart':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(550, t + 0.1);
      osc.frequency.setValueAtTime(660, t + 0.2);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
      break;
    case 'gameOver':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(50, t + 0.8);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.start(t); osc.stop(t + 0.8);
      break;
    case 'spitterShoot':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.12);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
      break;
    case 'slam':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      break;
    case 'stomp':
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      break;
    case 'smoothiePickup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.setValueAtTime(440, t + 0.08);
      osc.frequency.setValueAtTime(550, t + 0.16);
      osc.frequency.setValueAtTime(660, t + 0.24);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t); osc.stop(t + 0.35);
      break;
    case 'bossRoar':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
      break;
    case 'bossSlam':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
      break;
    case 'bossDeath':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 1.0);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      osc.start(t); osc.stop(t + 1.0);
      break;
    case 'platAppear':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
      break;
    case 'platCrumble':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      break;
    case 'poopDrop':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      break;
    case 'poopSplat':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
      break;
    case 'wingsPickup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
      break;
    case 'spiderWarn':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
      break;
    case 'beerGulp':
      // Use real gulp sound clip
      gulpClip.currentTime = 0;
      gulpClip.play().catch(() => {});
      osc.start(t); osc.stop(t + 0.01);
      gain.gain.setValueAtTime(0, t);
      break;
    case 'beerThrow':
      // Use real whoosh sound clip
      throwClip.currentTime = 0;
      throwClip.play().catch(() => {});
      osc.start(t); osc.stop(t + 0.01);
      gain.gain.setValueAtTime(0, t);
      break;
    case 'beerSplash': {
      // Wet crunchy splat
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
      // Splash noise layer
      playNoise(0.15, 0.15);
      break;
    }
    // 'powerup' reuses roundStart
    case 'powerup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(550, t + 0.1);
      osc.frequency.setValueAtTime(660, t + 0.2);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
      break;
  }
}

export function playNoise(duration, volume) {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (random() * 2 - 1) * volume;
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  source.start();
}

// ============================================================
// VOICE CLIPS
// ============================================================
export const voiceClips = {
  bad: new Audio(encodeURI('data/sounds/Bad - Freakin dilbert.m4a')),
  good1: new Audio(encodeURI('data/sounds/Good - bobert mcdoobenger.m4a')),
  good2: new Audio(encodeURI('data/sounds/Good - hammanado.m4a')),
  lose: new Audio(encodeURI('data/sounds/Lose - eh maybe next time.m4a')),
  win: new Audio(encodeURI('data/sounds/Win \u2014 let\u2019s freaking go boys.m4a')),
  start: new Audio(encodeURI('data/sounds/Start game trimmed.m4a')),
  boss: new Audio(encodeURI('data/sounds/Boss_eat_trimmed.m4a')),
  chris: new Audio(encodeURI('data/sounds/eager_chris.m4a'))
};
export const snotSniffleClip = new Audio(encodeURI('data/sounds/Snot rocket sniffle.m4a'));
snotSniffleClip.preload = 'auto';
snotSniffleClip.loop = true;
export const snotLaunchClip = new Audio(encodeURI('data/sounds/Snot rocket launch.m4a'));
snotLaunchClip.preload = 'auto';
export const quentinFartClip = new Audio(encodeURI('data/sounds/quentin_fart_trimmed.m4a'));
quentinFartClip.preload = 'auto';
export const dwyerClip = new Audio(encodeURI('data/sounds/dwyer.m4a'));
dwyerClip.preload = 'auto';
export const gulpClip = new Audio('data/sounds/freesound_community-gulp-37759.mp3');
gulpClip.preload = 'auto';
export const throwClip = new Audio('data/sounds/denielcz-bamboo-whoosh-429156.mp3');
throwClip.preload = 'auto';
export const melodicaClip = new Audio('data/sounds/freesound_community-melodica-one-note-88607.mp3');
melodicaClip.preload = 'auto';
export const musicClip = new Audio(encodeURI('data/sounds/music.m4a'));
musicClip.preload = 'auto';
musicClip.loop = true;
musicClip.volume = 0.1;

for (const [name, clip] of Object.entries(voiceClips)) {
  clip.preload = 'auto';
  clip.addEventListener('error', () => console.warn('Audio load failed:', name, clip.error));
}

let startClipBuffer = null;
fetch(encodeURI('data/sounds/Start game trimmed.m4a'))
  .then(r => r.arrayBuffer())
  .then(buf => { startClipBuffer = buf; })
  .catch(() => {});

let activeVoice = null;

export function isVoicePlaying() {
  return activeVoice && !activeVoice.paused && !activeVoice.ended;
}

export function playVoice(name, force) {
  if (!audioCtx) return;
  if (!force && isVoicePlaying()) return;
  if (activeVoice) {
    activeVoice.pause();
    activeVoice.currentTime = 0;
  }

  if (name === 'start' && startClipBuffer) {
    audioCtx.decodeAudioData(startClipBuffer.slice(0), (decoded) => {
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.destination);
      source.start(0);
    }, () => {});
    startClipBuffer = null;
    activeVoice = voiceClips[name];
    return;
  }

  const clip = voiceClips[name];
  if (!clip) return;
  clip.currentTime = 0;
  clip.play().catch(() => {});
  activeVoice = clip;
}

export function playClip(clip) {
  if (!audioCtx) return;
  clip.currentTime = 0;
  clip.play().catch(() => {});
}