"use client";

import { useEffect, useRef } from "react";
import { FEATURE_CARDS } from "@/data/homeData";

export function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".feature-card"));
    cards.forEach((card, index) => {
      card.style.transitionDelay = `${index * 0.1}s`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        cards.forEach((card) => card.classList.add("visible"));
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="features-header">
          <h2>
            Thiết kế dành riêng cho bạn
            <br className="d-none d-md-inline" />&nbsp;để làm được nhiều hơn
          </h2>
          <p className="lead">
            Giúp bạn làm việc hiệu quả và nạp lại năng lượng mỗi ngày, theo cách thật đơn giản.
          </p>
        </div>
        <div className="features-grid" ref={gridRef}>
          {FEATURE_CARDS.map((feature) => {
            const contents = (
              <>
                <span className="feature-icon">{feature.emoji}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </>
            );

            return feature.href ? (
              <a className="feature-card" href={feature.href.replace("./", "#")} data-emoji={feature.emoji} key={feature.title}>
                {contents}
              </a>
            ) : (
              <div className="feature-card" data-emoji={feature.emoji} key={feature.title}>
                {contents}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
