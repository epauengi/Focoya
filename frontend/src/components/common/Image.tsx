import type { ImgHTMLAttributes } from "react";

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  priority?: boolean;
  preload?: boolean;
  fill?: boolean;
}

// ponytail: Image shim tương thích props next/image; upgrade nếu cần responsive srcset tự động
export function Image({
  priority,
  preload,
  fill,
  className = "",
  style,
  ...props
}: ImageProps) {
  const isHighPriority = Boolean(priority || preload);
  const fillStyle = fill
    ? {
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover" as const,
      }
    : undefined;

  return (
    <img
      loading={isHighPriority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={isHighPriority ? "high" : "auto"}
      className={className}
      style={{ ...fillStyle, ...style }}
      {...props}
    />
  );
}

export default Image;
