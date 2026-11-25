import assert from 'node:assert/strict';
import test from 'node:test';
import { createAmbientAudio, readAmbientVolume } from './ambientAudio.ts';

function fakeAudio() {
  const param = () => ({ value: 0, setTargetAtTime(value) { this.value = value; } });
  const nodes = [];
  const node = () => {
    const result = {
      gain: param(), frequency: param(), Q: param(),
      starts: 0, stops: 0, disconnected: false,
      connect(target) { return target; }, disconnect() { this.disconnected = true; },
      start() { this.starts++; }, stop() { this.stops++; },
    };
    nodes.push(result);
    return result;
  };
  const context = {
    state: 'suspended', currentTime: 0, sampleRate: 10, onstatechange: null, destination: {},
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    createBufferSource: node, createBiquadFilter: node, createGain: node, createOscillator: node,
    async resume() { this.state = 'running'; this.onstatechange?.(); },
    async suspend() { this.state = 'suspended'; this.onstatechange?.(); },
    async close() { this.state = 'closed'; },
  };
  return { context, nodes };
}

test('validate stored volume without restoring playback', () => {
  for (const value of [null, '', ' ', 'NaN', 'Infinity', '-1', '101', '3.5']) {
    assert.equal(readAmbientVolume(value), 35);
  }
  for (const volume of [0, 35, 100]) assert.equal(readAmbientVolume(String(volume)), volume);
});

test('only explicit play starts one graph; presets retune it, mute and pause silence it', async () => {
  const { context, nodes } = fakeAudio();
  const states = [];
  const audio = createAmbientAudio((state) => states.push(state), () => context);
  audio.setVolume(60, false);
  audio.setPreset('rain');
  assert.equal(nodes.length, 0);
  assert.deepEqual(states, []);
  const started = audio.play('rain');
  assert.deepEqual(states, ['starting']);
  assert.equal(nodes[4].gain.value, 0);
  await started;
  assert.deepEqual(states, ['starting', 'playing']);
  assert.equal(nodes[4].gain.value, 0.36);
  audio.setVolume(90, true);
  assert.equal(nodes[4].gain.value, 0);
  audio.setVolume(50, false);
  assert.equal(nodes[4].gain.value, 0.25);
  const rainFrequency = nodes[2].frequency.value;
  audio.setPreset('ocean');
  assert.notEqual(nodes[2].frequency.value, rainFrequency);
  audio.pause();
  assert.equal(states.at(-1), 'paused');
  assert.equal(context.state, 'suspended');
  assert.equal(nodes[4].gain.value, 0);
  await audio.play('forest');
  assert.equal(states.at(-1), 'playing');
  assert.equal(nodes.length, 7);
  assert.equal(nodes[0].starts, 1);
  audio.dispose();
  assert.equal(context.state, 'closed');
  assert.equal(context.onstatechange, null);
  assert.ok(nodes.every((entry) => entry.disconnected));
});

test('failed initialization and rejected resume report error and allow retry', async () => {
  const first = fakeAudio();
  const retry = fakeAudio();
  const contexts = [null, first.context, retry.context];
  first.context.resume = async () => { throw new Error('Autoplay blocked'); };
  const states = [];
  const audio = createAmbientAudio((state) => states.push(state), () => {
    const context = contexts.shift();
    if (!context) throw new Error('Web Audio unavailable');
    return context;
  });
  await audio.play('library');
  await audio.play('library');
  assert.deepEqual(states, ['starting', 'error', 'starting', 'error']);
  assert.equal(first.context.state, 'closed');
  await audio.play('library');
  assert.equal(states.at(-1), 'playing');
  audio.dispose();
});

test('room unmount and pause invalidate pending resume', async () => {
  for (const action of ['pause', 'dispose']) {
    const { context, nodes } = fakeAudio();
    const states = [];
    let resolve;
    context.resume = () => new Promise((done) => { resolve = done; });
    const audio = createAmbientAudio((state) => states.push(state), () => context);
    const pending = audio.play('ocean');
    audio[action]();
    resolve();
    await pending;
    assert.equal(nodes[4].gain.value, 0);
    assert.deepEqual(states, action === 'pause' ? ['starting', 'paused'] : ['starting']);
    if (action === 'dispose') assert.equal(context.state, 'closed');
    audio.dispose();
  }
});
