import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRoomScene } from './roomScene.ts';

const scenes = [
  ['rainy.jpg', 'Study', 'rain'], ['midnight.png', 'Gaming', 'library'],
  ['autumn.png', 'Nature', 'forest'], ['sunset.jpg', 'Chill', 'ocean'],
];

test('resolve four presets by artwork, even when API theme differs', () => {
  for (const [file, , preset] of scenes) {
    const image = `/room-assets/${file}`;
    assert.deepEqual(resolveRoomScene({ image, theme: 'Custom' }, ''), { image, fallback: image, effect: preset, preset });
  }
  assert.equal(resolveRoomScene({ image: '/room-assets/midnight.png', theme: 'Study' }, '').preset, 'library');
});

test('missing or unsafe artwork falls back to theme, unknown to static default', () => {
  for (const [file, theme, preset] of scenes) {
    const result = resolveRoomScene({ image: '/room-assets/rainy.jpg', usesFallbackImage: true, theme }, '');
    assert.equal(result.image, `/room-assets/${file}`);
    assert.equal(result.preset, preset);
  }
  const staticScene = { image: '/room-assets/bg.png', fallback: '/room-assets/bg.png', effect: undefined, preset: 'rain' };
  assert.deepEqual(resolveRoomScene({ image: 'https://example.test/unknown.png', theme: 'Custom' }, ''), staticScene);
  const missing = resolveRoomScene({ image: '/room-assets/missing.png', theme: 'Nature' }, '');
  assert.equal(missing.fallback, '/room-assets/autumn.png');
});

test('wallpaper changes the scene and its automatic sound; untrusted overrides are ignored', () => {
  const room = { image: '/room-assets/rainy.jpg', theme: 'Study' };
  assert.equal(resolveRoomScene(room, '/room-assets/sunset.jpg').preset, 'ocean');
  assert.equal(resolveRoomScene(room, '//example.test/sunset.jpg').preset, 'rain');
  assert.equal(resolveRoomScene(room, '/room-assets/bg.png').effect, undefined);
});
