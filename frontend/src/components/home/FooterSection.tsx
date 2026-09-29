"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const columns = [
  {
    title: "Tính năng",
    links: [
      ["Đồng hồ tập trung", "#features"],
      ["Việc cần làm", "#features"],
      ["Thống kê", "#features"],
      ["Giao diện", "#features"],
      ["Âm thanh thư giãn", "#features"],
      ["Âm nhạc", "#features"],
      ["Đồng hồ Pomodoro", "#features"],
    ],
  },
  {
    title: "Sản phẩm",
    links: [
      ["Focoya Pro", "#pricing"],
      ["Trung tâm trợ giúp", "#help"],
      ["Bản tin", "#newsletter"],
      ["Liên hệ", "mailto:support@example.com"],
    ],
  },
  {
    title: "Kết nối",
    links: [
      ["TikTok", "https://www.tiktok.com"],
      ["Instagram", "https://www.instagram.com"],
      ["Discord", "https://discord.com"],
    ],
  },
  {
    title: "Pháp lý",
    links: [
      ["Điều khoản sử dụng", "#terms"],
      ["Chính sách quyền riêng tư", "#privacy"],
    ],
  },
];

export function FooterSection() {
  const [submitting, setSubmitting] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    timeoutRef.current = window.setTimeout(() => setSubmitting(false), 3000);
  }

  return (
    <footer className="footer">
      <div className="footer-newsletter-section">
        <h2>Bí quyết cân bằng mỗi tuần, gửi thẳng đến bạn</h2>
        <p>Gợi ý tập trung và nghỉ ngơi từ bản tin hằng tuần của Focoya.</p>
        <form className="newsletter-form" onSubmit={submit}>
          <input
            type="email"
            name="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="ban@example.com"
            aria-label="Địa chỉ email"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            Đăng ký
          </button>
        </form>
      </div>
      <div className="footer-grid">
        {columns.map((column) => (
          <div className="footer-column" key={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map(([label, href]) => {
                const external = href.startsWith("http");
                return (
                  <li key={label}>
                    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} Focoya. Đã đăng ký bản quyền.</div>
    </footer>
  );
}
