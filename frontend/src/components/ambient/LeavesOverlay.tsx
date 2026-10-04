export function LeavesOverlay({ count = 6 }: { count?: number }) {
  const leaves = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${i * (100 / count) + 5}%`,
    delay: `${i * 1.2}s`,
    duration: `${6 + (i % 3)}s`,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {leaves.map((leaf) => (
        <span
          key={leaf.id}
          className="ambient-leaf"
          style={{
            left: leaf.left,
            animationDelay: leaf.delay,
            animationDuration: leaf.duration,
          }}
        />
      ))}
    </div>
  );
}
