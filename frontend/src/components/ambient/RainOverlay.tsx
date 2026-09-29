export function RainOverlay({ count = 8 }: { count?: number }) {
  const drops = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${i * (100 / count) + 2}%`,
    delay: `${(i * 0.3) % 1.5}s`,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map((drop) => (
        <span
          key={drop.id}
          className="ambient-rain-line"
          style={{ left: drop.left, animationDelay: drop.delay }}
        />
      ))}
    </div>
  );
}
