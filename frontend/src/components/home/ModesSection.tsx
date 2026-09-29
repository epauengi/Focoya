import { useLayoutEffect, useRef, useState } from "react";
import { MODES } from "@/data/homeData";

export function ModesSection() {
  const [activeMode, setActiveMode] = useState("home");
  const [indicator, setIndicator] = useState({ x: 60, width: 56 });
  const tabsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    function updateIndicator() {
      const tabs = tabsRef.current;
      const active = tabs?.querySelector<HTMLElement>(`[data-mode="${activeMode}"]`);
      if (!tabs || !active) return;
      const paddingLeft = Number.parseFloat(getComputedStyle(tabs).paddingLeft) || 0;
      setIndicator({ x: active.offsetLeft - paddingLeft, width: active.offsetWidth });
    }

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeMode]);

  const active = MODES.find((mode) => mode.id === activeMode) ?? MODES[1];

  return (
    <section className="modes-section">
      <div className="container">
        <div className="modes-header">
          <h2>Đổi không gian, đổi tâm trạng</h2>
          <p className="lead">
            Chuyển đổi linh hoạt giữa không gian riêng, phiên tập trung và những phút thư giãn.
          </p>
          <p className="mode-hint">Chọn không gian phù hợp với bạn:</p>
        </div>
        <div className="mode-switcher">
          <div className="mode-tabs" ref={tabsRef}>
            <span
              className="mode-tab-indicator"
              aria-hidden="true"
              style={{ transform: `translateX(${indicator.x}px)`, width: indicator.width }}
            />
            {MODES.map((mode) => (
              <button
                className={`mode-tab${mode.id === activeMode ? " active" : ""}`}
                data-mode={mode.id}
                aria-label={mode.label}
                aria-pressed={mode.id === activeMode}
                onClick={() => setActiveMode(mode.id)}
                key={mode.id}
              >
                <span className="mode-tab-icon">{mode.icon}</span>
              </button>
            ))}
          </div>
          <p className="mode-label" id="mode-label" aria-live="polite">
            {active.label}
          </p>
        </div>
      </div>
    </section>
  );
}
