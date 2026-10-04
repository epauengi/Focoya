"use client";

import { useEffect, useRef } from "react";
import { PAIN_POINTS } from "@/data/homeData";

export function PainTickerSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    let animation = 0;
    let resizeObserver: ResizeObserver | null = null;
    let offset = 0;
    let loopHeight = 0;
    let last = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tickerTextRgb = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-ticker-text-rgb")
      .trim() || "236, 253, 245";
    const items = Array.from(track.querySelectorAll<HTMLElement>(".pain-item"));

    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(track).rowGap) || 0;
      loopHeight = (track.scrollHeight + gap) / 2;
    };

    const updateItems = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const center = wrapperRect.top + wrapper.clientHeight / 2;
      const radius = wrapper.clientHeight / 2;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        const ratio = Math.min(distance / radius, 1);
        item.style.opacity = String(1 - 0.7 * Math.pow(ratio, 1.5));
        item.style.color = `rgba(${tickerTextRgb}, ${0.18 + 0.82 * (1 - ratio)})`;
      });
    };

    const frame = (now: number) => {
      const delta = Math.min(now - last, 100);
      last = now;
      offset -= (delta / 1000) * 13;
      if (loopHeight > 0 && -offset >= loopHeight) offset += loopHeight;
      track.style.transform = `translate3d(0, ${offset}px, 0)`;
      updateItems();
      animation = requestAnimationFrame(frame);
    };

    measure();
    if (reduceMotion.matches) updateItems();
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(track);
    }
    document.fonts?.ready.then(() => {
      measure();
    });
    if (!reduceMotion.matches) animation = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <section className="pain-ticker-section">
      <div className="pain-ticker-container container">
        <h2 className="pain-ticker-heading">Nghe có quen không?</h2>
        <p className="pain-ticker-sub">Focoya ra đời để giúp bạn tìm thấy nhịp tập trung của riêng mình.</p>
        <div className="pain-ticker-wrapper" ref={wrapperRef}>
          <div className="pain-ticker" ref={trackRef}>
            {[...PAIN_POINTS, ...PAIN_POINTS].map((point, index) => (
              <span className="pain-item" key={`${point}-${index}`}>
                {point}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
