import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Image } from "@/components/common/Image";
import { EmojiButton } from "./EmojiButton";

const features = [
  {
    href: "#features",
    emoji: "🍅",
    title: "Đồng hồ tập trung",
    description: "Tùy chỉnh linh hoạt với nhiều chế độ",
  },
  {
    href: "#features",
    emoji: "🎨",
    title: "Giao diện",
    description: "Không gian làm việc mang dấu ấn riêng",
  },
  {
    href: "#features",
    emoji: "✔️",
    title: "Việc cần làm",
    description: "Đơn giản, ưu tiên đúng việc",
  },
  {
    href: "#features",
    emoji: "🏝️",
    title: "Âm thanh không gian",
    description: "Kết hợp âm thanh để tập trung hoặc thư giãn",
  },
  {
    href: "#features",
    emoji: "📊",
    title: "Thống kê tập trung",
    description: "Theo dõi tiến độ theo ngày, tuần và tháng",
  },
  {
    href: "#features",
    emoji: "🎧",
    title: "Âm nhạc",
    description: "Danh sách nhạc chọn lọc hoặc nhạc của bạn",
  },
];

const navLinks = [
  { href: "#pricing", label: "Gói dịch vụ" },
  { href: "#help", label: "Trợ giúp" },
  { href: "#newsletter", label: "Bản tin" },
  { href: "mailto:support@example.com", label: "Liên hệ" },
];

const themeToggleLabel = "Đổi giao diện sáng/tối";
const navigationToggleLabel = "Mở hoặc đóng điều hướng";

const logo = "/assets/images/logo.svg";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 100);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setFeaturesOpen(false);
    document.getElementById("menuToggle")?.focus();
  }

  function toggleMenu() {
    if (menuOpen) closeMenu();
    else setMenuOpen(true);
  }

  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.hasAttribute("data-theme");
    if (isDark) {
      root.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    } else {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
  }

  return (
    <>
      <nav className={`navbar navbar-expand-lg sticky-top${scrolled ? " scrolled" : ""}`} id="nav">
        <div className="nav-container container">
          <Link to="/" className="logo navbar-brand" aria-label="Focoya - trang chủ">
            <Image className="logo-img" src={logo} alt="Focoya" width={119} height={22} priority />
          </Link>
          <ul className="nav-links">
            <li className="dropdown">
              <a className="dropdown-toggle" href="#features">
                Tính năng
              </a>
              <div className="dropdown-menu">
                {features.map((feature) => (
                  <a href={feature.href} className="dropdown-item" key={feature.title}>
                    <span className="dropdown-icon">{feature.emoji}</span>
                    <span className="dropdown-text">
                      <h4>{feature.title}</h4>
                      <p>
                        {feature.description} <span className="arrow">→</span>
                      </p>
                    </span>
                  </a>
                ))}
              </div>
            </li>
            {navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="nav-buttons">
            <button className="theme-toggle" onClick={toggleTheme} aria-label={themeToggleLabel} title={themeToggleLabel}>
              <svg className="theme-toggle-icon theme-toggle-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
              </svg>
              <svg className="theme-toggle-icon theme-toggle-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 1 0 20.354 15.354Z" />
              </svg>
            </button>
            <EmojiButton className="nav-cta" href="#dashboard">
              Mở Focoya
            </EmojiButton>
          </div>
          <button
            className={`navbar-toggler${menuOpen ? " active" : ""}`}
            type="button"
            id="menuToggle"
            aria-label={navigationToggleLabel}
            aria-expanded={menuOpen}
            aria-controls="mobileMenu"
            onClick={toggleMenu}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? " active" : ""}`} id="mobileMenu" aria-hidden={!menuOpen}>
        <div className="mobile-menu-header">
          <Link to="/" className="logo" onClick={closeMenu} aria-label="Focoya - trang chủ">
            <Image className="logo-img" src={logo} alt="Focoya" width={119} height={22} />
          </Link>
          <button type="button" className="mobile-menu-close" aria-label="Đóng menu" onClick={closeMenu}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-menu-body">
          <div className="mobile-menu-section">
            <button
              className={`mobile-features-toggle${featuresOpen ? " active" : ""}`}
              id="featuresToggle"
              onClick={() => setFeaturesOpen((open) => !open)}
              aria-expanded={featuresOpen}
              aria-controls="featuresList"
            >
              Tính năng
              <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className={`mobile-features-list${featuresOpen ? " active" : ""}`} id="featuresList">
              <ul className="mobile-menu-links">
                {features.map((feature) => (
                  <li key={feature.title}>
                    <a href={feature.href} onClick={closeMenu}>
                      <span className="emoji">{feature.emoji}</span> {feature.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mobile-menu-section">
            <ul className="mobile-menu-links">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} onClick={closeMenu}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mobile-menu-footer">
          <EmojiButton href="#dashboard" onClick={closeMenu}>
            Mở Focoya
          </EmojiButton>
        </div>
      </div>
    </>
  );
}
