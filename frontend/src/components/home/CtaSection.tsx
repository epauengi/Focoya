import { EmojiButton } from "./EmojiButton";

export function CtaSection() {
  return (
    <section className="cta-section" id="pricing">
      <div className="cta-content container">
        <h2>
          Dù đang cần tập trung làm việc hay muốn nghỉ ngơi, Focoya luôn đồng hành cùng bạn suốt cả ngày.
        </h2>
        <EmojiButton href="#dashboard" arrow>
          Khám phá Focoya
        </EmojiButton>
      </div>
    </section>
  );
}
