// JSON-lines bridge: stdin/stdout protocol for Python ↔ Node.js
// Usage: node rl/bridge.js   (then send JSON commands via stdin)
import { createInterface } from 'node:readline';
import { createEnv } from '../src/headless.js';

let env = null;
let episodeSeed = 42;

const rl = createInterface({ input: process.stdin });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ error: 'invalid JSON' });
    return;
  }

  const { cmd } = msg;

  if (cmd === 'reset') {
    episodeSeed = msg.seed ?? episodeSeed + 1;
    env = createEnv({ seed: episodeSeed });
    const obs = env.reset({ seed: episodeSeed, startRound: msg.startRound ?? 1 });
    send({ obs });
  } else if (cmd === 'step') {
    if (!env) {
      send({ error: 'env not initialized, send reset first' });
      return;
    }
    const n = msg.n ?? 1;
    let result;
    let totalReward = 0;
    for (let i = 0; i < n; i++) {
      result = env.step(msg.action ?? {});
      totalReward += result.reward;
      if (result.done) break;
    }
    result.reward = totalReward;
    send(result);
  } else if (cmd === 'close') {
    process.exit(0);
  } else {
    send({ error: `unknown cmd: ${cmd}` });
  }
});

rl.on('close', () => process.exit(0));
