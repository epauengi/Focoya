import { LightingOverlay } from "./LightingOverlay";
import { RainOverlay } from "./RainOverlay";
import { LeavesOverlay } from "./LeavesOverlay";

// ponytail: Ambient overlay mặc định; nâng cấp lên preset tương tác từ user state
export function AmbientLayer() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <LightingOverlay />
      <RainOverlay count={12} />
      <LeavesOverlay count={6} />
    </div>
  );
}
