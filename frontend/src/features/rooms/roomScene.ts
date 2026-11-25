import type { AmbientPreset } from './ambientAudio';
import type { Room } from './rooms';

const scenes = {
  rain: '/room-assets/rainy.jpg',
  library: '/room-assets/midnight.png',
  forest: '/room-assets/autumn.png',
  ocean: '/room-assets/sunset.jpg',
} satisfies Record<AmbientPreset, string>;
const defaultImage = '/room-assets/bg.png';
const sceneByTheme = new Map<string, AmbientPreset>([
  ['café', 'rain'], ['cafe', 'rain'], ['study', 'rain'], ['rainy café', 'rain'],
  ['gaming', 'library'], ['midnight library', 'library'],
  ['nature', 'forest'], ['autumn forest', 'forest'],
  ['chill', 'ocean'], ['sunset beach', 'ocean'],
]);
const sceneByImage = new Map(Object.entries(scenes).map(([preset, image]) => [image, preset as AmbientPreset]));

export function resolveRoomScene(room: Pick<Room, 'image' | 'theme' | 'usesFallbackImage'>, wallpaper: string) {
  const override = sceneByImage.has(wallpaper) || wallpaper === defaultImage ? wallpaper : '';
  const image = override || (!room.usesFallbackImage && /^\/room-assets\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(room.image) ? room.image : '');
  const scene = sceneByImage.get(image.toLowerCase()) ?? sceneByTheme.get(room.theme.trim().toLowerCase());
  return {
    image: image || (scene ? scenes[scene] : defaultImage),
    fallback: scene ? scenes[scene] : defaultImage,
    effect: image === defaultImage ? undefined : scene,
    preset: scene ?? 'rain',
  };
}
