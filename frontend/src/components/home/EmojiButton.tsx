"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { BUTTON_EMOJI_PAIRS } from "@/data/homeData";

type EmojiButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  arrow?: boolean;
};

export function EmojiButton({
  arrow = false,
  children,
  className = "",
  onMouseEnter,
  ...props
}: EmojiButtonProps) {
  function rotateEmoji(event: MouseEvent<HTMLAnchorElement>) {
    const button = event.currentTarget;
    const next = (Number(button.dataset.emojiIndex ?? "0") + 1) % BUTTON_EMOJI_PAIRS.length;
    button.dataset.emojiIndex = String(next);
    button.dataset.emoji1 = BUTTON_EMOJI_PAIRS[next][0];
    button.dataset.emoji2 = BUTTON_EMOJI_PAIRS[next][1];
    onMouseEnter?.(event);
  }

  return (
    <a
      {...props}
      className={`btn btn-primary ${className}`.trim()}
      data-emoji-index="0"
      data-emoji1={BUTTON_EMOJI_PAIRS[0][0]}
      data-emoji2={BUTTON_EMOJI_PAIRS[0][1]}
      onMouseEnter={rotateEmoji}
    >
      {children}
      {arrow ? <span className="arrow" aria-hidden="true" /> : null}
    </a>
  );
}
