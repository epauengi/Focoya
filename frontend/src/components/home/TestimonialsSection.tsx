import { useEffect, useRef } from "react";
import { Image } from "@/components/common/Image";
import { TESTIMONIAL_COLORS, TESTIMONIALS, type TestimonialItem } from "@/data/homeData";
import { EmojiButton } from "./EmojiButton";

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ReviewCard({ review, colorIndex }: { review: TestimonialItem; colorIndex: number }) {
  const color = TESTIMONIAL_COLORS[colorIndex % TESTIMONIAL_COLORS.length];
  return (
    <div className="testimonial-card">
      {review.photo ? (
        <div className="testimonial-avatar">
          <Image src={review.photo} alt={review.name} width={60} height={60} />
        </div>
      ) : (
        <div
          className="testimonial-avatar testimonial-avatar--initials"
          style={{ background: color.bg, color: color.fg, borderColor: color.fg }}
          aria-label={review.name}
        >
          {initials(review.name)}
        </div>
      )}
      <div className="testimonial-bubble">
        <div className="testimonial-stars" aria-label="5 trên 5 sao">
          ★★★★★
        </div>
        <p className="testimonial-text">{review.text}</p>
        <p className="testimonial-name">{review.name}</p>
      </div>
    </div>
  );
}

const colorIndexes = (() => {
  let next = 0;
  return TESTIMONIALS.map((review) => (review.photo ? 0 : next++));
})();

export function TestimonialsSection() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const marquee = marqueeRef.current;
    const track = trackRef.current;
    if (!marquee || !track) return;

    let animation = 0;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let running = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let offset = 0;
    let loopHeight = 0;
    let last = performance.now();

    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(track).rowGap) || 24;
      loopHeight = (track.scrollHeight + gap) / 2;
    };

    const frame = (now: number) => {
      const delta = Math.min(now - last, 100);
      last = now;
      offset -= (delta / 1000) * 17;
      if (loopHeight > 0 && -offset >= loopHeight) offset += loopHeight;
      track.style.transform = `translate3d(0, ${offset}px, 0)`;
      animation = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduceMotion.matches) return;
      running = true;
      last = performance.now();
      animation = requestAnimationFrame(frame);
    };

    measure();
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(track);
    }
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          start();
          observer?.disconnect();
        },
        { threshold: 0.1 },
      );
      observer.observe(marquee);
    } else {
      start();
    }

    return () => {
      cancelAnimationFrame(animation);
      observer?.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <section className="testimonials-section testimonials-section--home">
      <div className="container">
        <div className="testimonials-section-row">
          <div className="testimonials-section-header">
            <h2>Hơn 1 triệu người chọn Focoya để tập trung tốt hơn.</h2>
            <p className="testimonials-section-subtitle">
              Dù bạn là người đi làm, sinh viên hay luôn muốn tiến về phía trước, Focoya đồng hành
              để hành trình học tập và làm việc hiệu quả hơn, theo cách của riêng bạn.
            </p>
            <EmojiButton href="#dashboard">Khám phá Focoya</EmojiButton>
          </div>
          <div className="testimonials-marquee" ref={marqueeRef}>
            <div className="testimonials-track" ref={trackRef}>
              {[...TESTIMONIALS, ...TESTIMONIALS].map((review, index) => {
                const sourceIndex = index % TESTIMONIALS.length;
                return (
                  <ReviewCard
                    review={review}
                    colorIndex={colorIndexes[sourceIndex]}
                    key={`${sourceIndex}-${index >= TESTIMONIALS.length ? "copy" : "original"}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
