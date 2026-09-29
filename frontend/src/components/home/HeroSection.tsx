import { EmojiButton } from "./EmojiButton";

export function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-grid hero-grid--text-only container">
        <div className="hero-text">
          <div className="hero-content">
            <h1>Không gian nhỏ, tập trung lớn</h1>
            <div className="subhead">
              <p className="lead">
                <strong>Focoya giúp bạn tập trung sâu và học tập hiệu quả hơn.</strong>{" "}
                Tùy chỉnh theo cách của bạn. Miễn phí mãi mãi.
              </p>
            </div>
            <div className="hero-cta">
              <EmojiButton href="#dashboard" arrow>
                Khám phá Focoya
              </EmojiButton>
            </div>
            <div className="user-badges">
              <span className="user-count">Bắt đầu hành trình tập trung của bạn</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
