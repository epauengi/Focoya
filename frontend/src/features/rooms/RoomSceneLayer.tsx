import { memo, useState } from 'react';
import { RainOverlay } from '../../components/ambient/RainOverlay';
import { LeavesOverlay } from '../../components/ambient/LeavesOverlay';
import type { resolveRoomScene } from './roomScene';

export const RoomScene = memo(function RoomScene({ image, fallback, effect }: ReturnType<typeof resolveRoomScene>) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = [image, fallback, '/room-assets/bg.png'].find((url) => !failed.includes(url));

  return (
    <div className="focus-scene" aria-hidden="true">
      {source && <img src={source} alt="" draggable={false} onError={() => setFailed((old) => [...old, source])} />}
      <div className="focus-scene__effect" data-effect={effect}>
        {effect === 'rain' && <RainOverlay count={8} />}
        {effect === 'forest' && <LeavesOverlay count={4} />}
      </div>
    </div>
  );
});
