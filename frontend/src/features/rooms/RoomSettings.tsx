import { useEffect, useRef, useState } from 'react';
import './settings.css';

// ponytail: temporary client state; wire to REST API when backend ready.

export type SettingsTab = 'theme' | 'stats' | 'account' | 'help';

interface WallpaperOption {
  id: string;
  name: string;
  src: string;
  preview: string;
}

const WALLPAPERS: WallpaperOption[] = [
  { id: 'default', name: 'Mặc định', src: '', preview: '/room-assets/bg.png' },
  { id: 'rainy', name: 'Mưa', src: '/room-assets/rainy.jpg', preview: '/room-assets/rainy.jpg' },
  { id: 'autumn', name: 'Mùa thu', src: '/room-assets/autumn.png', preview: '/room-assets/autumn.png' },
  { id: 'midnight', name: 'Đêm', src: '/room-assets/midnight.png', preview: '/room-assets/midnight.png' },
];

const DAYS_OF_WEEK = [
  { key: 'T2', label: 'T2', isToday: false },
  { key: 'T3', label: 'T3', isToday: false },
  { key: 'T4', label: 'T4', isToday: false },
  { key: 'T5', label: 'T5', isToday: false },
  { key: 'T6', label: 'T6', isToday: false },
  { key: 'T7', label: 'T7', isToday: false },
  { key: 'CN', label: 'CN', isToday: true },
];

const HEATMAP_HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00', '20:00', '22:00'];

const HEATMAP_ROWS: Array<{ day: string; levels: number[] }> = [
  { day: 'Thứ 2', levels: [2, 3, 0, 2, 1, 0, 0] },
  { day: 'Thứ 3', levels: [3, 3, 0, 2, 3, 1, 1] },
  { day: 'Thứ 4', levels: [1, 3, 0, 3, 2, 0, 0] },
  { day: 'Thứ 5', levels: [3, 3, 0, 2, 3, 1, 0] },
  { day: 'Thứ 6', levels: [2, 3, 0, 3, 1, 0, 0] },
  { day: 'Thứ 7', levels: [0, 1, 0, 1, 0, 2, 3] },
  { day: 'Chủ Nhật', levels: [0, 1, 0, 2, 0, 1, 2] },
];

const HEAT_LEVEL_LABELS: Record<number, string> = {
  0: 'Nghỉ (0 phiên)',
  1: 'Nhẹ (1 phiên ~25p)',
  2: 'Trung bình (2 phiên ~50p)',
  3: 'Cao (3+ phiên ~90p+)',
};

export function RoomSettings(props: {
  initialTab: SettingsTab;
  wallpaper: string;
  onWallpaperChange: (src: string) => void;
  notifications: boolean;
  onNotificationsChange: (value: boolean) => void;
  autoStart: boolean;
  onAutoStartChange: (value: boolean) => void;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onClose: () => void;
  onSignOut: () => void;
  notify: (message: string) => void;
}) {
  const {
    initialTab,
    wallpaper,
    onWallpaperChange,
    notifications,
    onNotificationsChange,
    autoStart,
    onAutoStartChange,
    displayName,
    onDisplayNameChange,
    onClose,
    onSignOut,
    notify,
  } = props;

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [localDisplayName, setLocalDisplayName] = useState(displayName);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pushStatus = (msg: string) => {
    setStatusMessage(msg);
    notify(msg);
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (!dialog.open) {
      dialog.showModal();
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) {
        dialog.close();
      }
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!isInside) {
      onClose();
    }
  };

  const isWallpaperSelected = (opt: WallpaperOption) => {
    if (opt.src === '') {
      return !wallpaper || wallpaper === '' || wallpaper === '/room-assets/bg.png';
    }
    return wallpaper === opt.src;
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localDisplayName.trim();
    if (!trimmed) {
      pushStatus('Tên hiển thị không được để trống.');
      return;
    }
    onDisplayNameChange(trimmed);
    pushStatus('Đã cập nhật tên hiển thị tạm thời');
  };

  return (
    <dialog
      ref={dialogRef}
      className="room-settings"
      onClick={handleBackdropClick}
      aria-label="Cài đặt phòng học"
    >
      <div className="room-settings-layout">
        <button
          type="button"
          className="room-settings-close-btn"
          onClick={onClose}
          aria-label="Đóng cài đặt"
        >
          <span aria-hidden="true">&times;</span>
        </button>

        {statusMessage && (
          <div role="status" aria-live="polite" className="room-settings-status-toast">
            {statusMessage}
          </div>
        )}

        <aside className="room-settings-sidebar" aria-label="Danh mục cài đặt">
          <h2 className="room-settings-sidebar-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Cài đặt</span>
          </h2>
          <nav className="room-settings-nav" aria-label="Các mục thiết lập">
            <button
              type="button"
              aria-pressed={activeTab === 'theme'}
              className={`room-settings-tab-btn ${activeTab === 'theme' ? 'room-settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              Chủ đề
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'stats'}
              className={`room-settings-tab-btn ${activeTab === 'stats' ? 'room-settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Thống kê
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'account'}
              className={`room-settings-tab-btn ${activeTab === 'account' ? 'room-settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              Tài khoản
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'help'}
              className={`room-settings-tab-btn ${activeTab === 'help' ? 'room-settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('help')}
            >
              Trợ giúp
            </button>
          </nav>
        </aside>

        <main className="room-settings-content">
          {activeTab === 'theme' && (
            <section aria-label="Chủ đề và giao diện">
              <div className="room-settings-panel-header">
                <h3 className="room-settings-title">Chủ đề &amp; Giao diện</h3>
                <p className="room-settings-desc">
                  Tùy biến không gian làm việc theo cảm xúc và sở thích của bạn
                </p>
              </div>

              <hr className="room-settings-divider" />

              <h4 className="room-settings-section-title">Bộ hình nền không gian</h4>
              <div className="room-settings-wall-grid" aria-label="Lựa chọn hình nền">
                {WALLPAPERS.map((item) => {
                  const selected = isWallpaperSelected(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      className={`room-settings-wall-btn ${selected ? 'room-settings-wall-btn--active' : ''}`}
                      onClick={() => {
                        onWallpaperChange(item.src);
                        pushStatus(`Đã chuyển hình nền: ${item.name}`);
                      }}
                    >
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt=""
                          className="room-settings-wall-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="room-settings-wall-fallback" />
                      )}
                      <span className="room-settings-wall-label">{item.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="room-settings-toggle-group">
                <div className="room-settings-toggle-row">
                  <div className="room-settings-toggle-text">
                    <span className="room-settings-toggle-label">Thông báo hoàn thành</span>
                    <span className="room-settings-toggle-hint">
                      Hiển thị thông báo khi một phiên tập trung kết thúc
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications}
                    className="room-settings-switch"
                    onClick={() => {
                      const next = !notifications;
                      onNotificationsChange(next);
                      pushStatus(next ? 'Đã bật thông báo' : 'Đã tắt thông báo');
                    }}
                    aria-label="Bật hoặc tắt thông báo hoàn thành phiên"
                  >
                    <span className="room-settings-switch-thumb" />
                  </button>
                </div>

                <div className="room-settings-toggle-row">
                  <div className="room-settings-toggle-text">
                    <span className="room-settings-toggle-label">Bộ hẹn giờ tự động</span>
                    <span className="room-settings-toggle-hint">
                      Bộ hẹn giờ tự động khởi động khi kết thúc phân đoạn
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoStart}
                    className="room-settings-switch"
                    onClick={() => {
                      const next = !autoStart;
                      onAutoStartChange(next);
                      pushStatus(next ? 'Đã bật tự động chuyển phiên' : 'Đã tắt tự động chuyển phiên');
                    }}
                    aria-label="Bật hoặc tắt tự động bắt đầu phiên kế tiếp"
                  >
                    <span className="room-settings-switch-thumb" />
                  </button>
                </div>
              </div>

              <div className="room-settings-sound-section">
                <h4 className="room-settings-subheading">Âm thanh thông báo</h4>
                <p className="room-settings-desc">Phát chuông báo khi một phiên tập trung hoàn tất.</p>
                <div className="room-settings-sound-card">
                  <div className="room-settings-sound-info">
                    <span className="room-settings-sound-label">Mẫu giao diện:</span>
                    <span className="room-settings-sound-value">Lấp lánh (Sparkle) — Xem trước (tắt)</span>
                  </div>
                  <button
                    type="button"
                    className="room-settings-btn-secondary"
                    disabled
                    aria-disabled="true"
                  >
                    Thay đổi
                  </button>
                </div>

                <div className="room-settings-field">
                  <label htmlFor="room-settings-vol" className="room-settings-field-label">
                    Âm lượng thông báo
                  </label>
                  <input
                    id="room-settings-vol"
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="45"
                    disabled
                    aria-disabled="true"
                    className="room-settings-range"
                  />
                </div>

                <p className="room-settings-truth-note">
                  Âm thanh chuông báo và điều chỉnh âm lượng chưa khả dụng trong bản thử nghiệm này (chưa tích hợp Web Audio API).
                </p>
              </div>
            </section>
          )}

          {activeTab === 'stats' && (
            <section aria-label="Thống kê học tập">
              <div className="room-settings-panel-header">
                <h3 className="room-settings-title">Thống kê học tập</h3>
                <p className="room-settings-desc">
                  Tổng hợp các chỉ số tập trung và bản đồ nhiệt theo giờ
                </p>
              </div>

              <div className="room-settings-demo-banner">
                <span className="room-settings-demo-tag">Số liệu minh họa</span>
                <span>Dữ liệu thống kê mẫu phục vụ đánh giá UI đồ án SE347, chưa kết nối cơ sở dữ liệu thật.</span>
              </div>

              <div className="room-settings-stat-grid">
                <div className="room-settings-stat-card">
                  <div className="room-settings-stat-header">
                    <span className="room-settings-stat-label">Chuỗi học liên tiếp</span>
                    <span className="room-settings-stat-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                      </svg>
                    </span>
                  </div>
                  <div className="room-settings-stat-value">
                    18<span className="room-settings-stat-unit">ngày</span>
                  </div>
                  <p className="room-settings-stat-sub">Kỷ lục: 18 ngày liên tục</p>
                  <div className="room-settings-week-indicators" aria-label="Tiến độ học 7 ngày gần nhất">
                    {DAYS_OF_WEEK.map((item) => (
                      <span key={item.key} className="room-settings-week-day">
                        <span>{item.label}</span>
                        <i
                          className={`room-settings-week-dot ${item.isToday ? 'room-settings-week-dot--today' : ''}`}
                          title={item.isToday ? 'Hôm nay: Đã học' : `${item.label}: Đã học`}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="room-settings-stat-card">
                  <div className="room-settings-stat-header">
                    <span className="room-settings-stat-label">Tổng thời gian tuần này</span>
                    <span className="room-settings-stat-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </span>
                  </div>
                  <div className="room-settings-stat-value">34h 20m</div>
                  <p className="room-settings-stat-sub">
                    <b className="room-settings-badge-up">+14%</b> so với tuần trước
                  </p>
                  <div
                    className="room-settings-progress-track"
                    role="progressbar"
                    aria-valuenow={100}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext="114% mục tiêu (34h 20m / 30 giờ)"
                    aria-label="Tiến độ mục tiêu tuần"
                  >
                    <div className="room-settings-progress-fill" style={{ width: '100%' }} />
                  </div>
                  <p className="room-settings-stat-sub">114% mục tiêu (30 giờ)</p>
                </div>

                <div className="room-settings-stat-card room-settings-stat-card--full">
                  <div className="room-settings-stat-header">
                    <span className="room-settings-stat-label">Khung giờ hiệu quả nhất</span>
                    <span className="room-settings-stat-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
                      </svg>
                    </span>
                  </div>
                  <div className="room-settings-highlight-time">
                    08:00 – 11:30 &nbsp;|&nbsp; 14:00 – 17:00
                  </div>
                  <p className="room-settings-highlight-hint">
                    Năng suất tập trung đạt hiệu quả cao nhất vào các buổi học sáng và đầu chiều.
                  </p>
                </div>
              </div>

              <div className="room-settings-heatmap-wrapper">
                <div className="room-settings-heatmap-header">
                  <h4 className="room-settings-subheading">Bản đồ tập trung theo giờ (Demo)</h4>
                  <span className="room-settings-demo-tag">Số liệu minh họa</span>
                </div>

                <div className="room-settings-heatmap-scroll">
                  <table
                    className="room-settings-heatmap-table"
                    aria-label="Bản đồ mức độ tập trung theo khung giờ trong tuần"
                  >
                    <caption className="room-settings-sr-only">
                      Bản đồ nhiệt thể hiện mật độ phiên tập trung theo ngày và khung giờ (Demo SE347)
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="room-settings-heatmap-corner">KHUNG GIỜ</th>
                        {HEATMAP_HOURS.map((hour) => (
                          <th key={hour} scope="col" className="room-settings-heatmap-th">
                            {hour}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HEATMAP_ROWS.map((row) => (
                        <tr key={row.day}>
                          <th scope="row" className="room-settings-heatmap-rowhead">
                            {row.day}
                          </th>
                          {row.levels.map((lvl, colIdx) => {
                            const hourStr = HEATMAP_HOURS[colIdx];
                            const descStr = HEAT_LEVEL_LABELS[lvl];
                            return (
                              <td key={colIdx} className="room-settings-heatmap-cell">
                                <div
                                  className={`room-settings-heat-box room-settings-heat-lvl-${lvl}`}
                                  title={`${row.day} ${hourStr}: ${descStr}`}
                                  aria-label={`${row.day} ${hourStr}: ${descStr}`}
                                >
                                  <span className="room-settings-heat-indicator" aria-hidden="true">
                                    {lvl === 0 ? '·' : lvl}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="room-settings-heatmap-legend" aria-label="Chú thích mức độ tập trung">
                  <span className="room-settings-legend-label">Mức độ:</span>
                  <span className="room-settings-legend-item">
                    <span className="room-settings-heat-box room-settings-heat-lvl-0" aria-hidden="true">
                      <span className="room-settings-heat-indicator">·</span>
                    </span>{' '}
                    0 phiên
                  </span>
                  <span className="room-settings-legend-item">
                    <span className="room-settings-heat-box room-settings-heat-lvl-1" aria-hidden="true">
                      <span className="room-settings-heat-indicator">1</span>
                    </span>{' '}
                    1 phiên (~25p)
                  </span>
                  <span className="room-settings-legend-item">
                    <span className="room-settings-heat-box room-settings-heat-lvl-2" aria-hidden="true">
                      <span className="room-settings-heat-indicator">2</span>
                    </span>{' '}
                    2 phiên (~50p)
                  </span>
                  <span className="room-settings-legend-item">
                    <span className="room-settings-heat-box room-settings-heat-lvl-3" aria-hidden="true">
                      <span className="room-settings-heat-indicator">3</span>
                    </span>{' '}
                    3+ phiên (~90p+)
                  </span>
                </div>

                <p className="room-settings-tip">
                  Khuyến nghị: Nghỉ giải lao 10 phút sau chuỗi học 90 phút
                </p>
              </div>
            </section>
          )}

          {activeTab === 'account' && (
            <section aria-label="Tài khoản người dùng">
              <div className="room-settings-panel-header">
                <h3 className="room-settings-title">Tài khoản người dùng</h3>
                <p className="room-settings-desc">
                  Quản lý thông tin cá nhân và múi giờ học tập
                </p>
              </div>

              <div className="room-settings-account-card">
                <form className="room-settings-form" onSubmit={handleAccountSubmit}>
                  <div className="room-settings-form-row">
                    <label htmlFor="room-settings-email" className="room-settings-input-label">
                      Địa chỉ E-mail (Demo cố định)
                    </label>
                    <input
                      id="room-settings-email"
                      type="email"
                      value="se347@gmail.com"
                      readOnly
                      className="room-settings-input room-settings-input-readonly"
                    />
                  </div>

                  <div className="room-settings-form-row">
                    <label htmlFor="room-settings-name" className="room-settings-input-label">
                      Tên hiển thị (Lưu tạm trong phiên)
                    </label>
                    <input
                      id="room-settings-name"
                      type="text"
                      value={localDisplayName}
                      onChange={(e) => setLocalDisplayName(e.target.value)}
                      className="room-settings-input"
                      placeholder="Nhập tên hiển thị..."
                    />
                  </div>

                  <div className="room-settings-form-row">
                    <label htmlFor="room-settings-fullname" className="room-settings-input-label">
                      Họ và tên đệm
                    </label>
                    <input
                      id="room-settings-fullname"
                      type="text"
                      value="UIT Student"
                      readOnly
                      className="room-settings-input room-settings-input-readonly"
                    />
                  </div>

                  <div className="room-settings-form-row">
                    <label htmlFor="room-settings-tz" className="room-settings-input-label">
                      Múi giờ học tập
                    </label>
                    <select
                      id="room-settings-tz"
                      defaultValue="Asia/Ho_Chi_Minh"
                      disabled
                      aria-disabled="true"
                      className="room-settings-select room-settings-select-readonly"
                    >
                      <option value="Asia/Ho_Chi_Minh">Việt Nam (GMT+7)</option>
                    </select>
                  </div>

                  <div className="room-settings-form-actions">
                    <button type="submit" className="room-settings-btn-primary">
                      Lưu thay đổi
                    </button>
                    <button
                      type="button"
                      className="room-settings-btn-danger"
                      onClick={() => {
                        onSignOut();
                        onClose();
                      }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                </form>
              </div>

              <p className="room-settings-demo-note">
                Tài khoản dùng thử cho đồ án SE347. Các thay đổi chỉ có hiệu lực tạm thời trong phiên làm việc hiện tại và không lưu vào máy chủ.
              </p>
            </section>
          )}

          {activeTab === 'help' && (
            <section aria-label="Trung tâm trợ giúp">
              <div className="room-settings-panel-header">
                <h3 className="room-settings-title">Trung tâm trợ giúp</h3>
                <p className="room-settings-desc">
                  Hướng dẫn sử dụng và câu hỏi thường gặp về Focoya
                </p>
              </div>

              <div className="room-settings-help-container">
                <details className="room-settings-accordion">
                  <summary className="room-settings-accordion-summary">
                    <span className="room-settings-accordion-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                        <path d="M6 6h10" />
                        <path d="M6 10h10" />
                      </svg>
                    </span>
                    <span>Hướng dẫn học tập hiệu quả</span>
                  </summary>
                  <div className="room-settings-accordion-body">
                    <ul className="room-settings-guide-list">
                      <li>Lập kế hoạch các công việc cần hoàn thành trong danh sách Công việc.</li>
                      <li>Khởi động chu kỳ Pomodoro chuẩn (25 phút tập trung, 5 phút giải lao).</li>
                      <li>Lựa chọn không gian và hình nền làm việc phù hợp với tâm trạng.</li>
                      <li>Theo dõi tiến độ hoàn thành các phân đoạn tập trung trong phiên.</li>
                    </ul>
                  </div>
                </details>

                <details className="room-settings-accordion" open>
                  <summary className="room-settings-accordion-summary">
                    <span className="room-settings-accordion-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </span>
                    <span>Câu hỏi thường gặp (FAQ)</span>
                  </summary>
                  <div className="room-settings-accordion-body">
                    <div className="room-settings-faq-list">
                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">1</span> Tại sao đồng hồ đếm ngược không chạy?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Hãy nhấn nút &quot;Bắt đầu&quot; (Play) trên thanh điều khiển Pomodoro. Bộ đếm thời gian được thực thi trực tiếp trên trình duyệt của bạn.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">2</span> Hoàn thành phiên nhưng không nhận được XP?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Hệ thống hiện là bản thử nghiệm giao diện (Mock UI) của đề tài SE347, chưa kết nối máy chủ cơ sở dữ liệu nên tính năng điểm kinh nghiệm và bảng xếp hạng chưa hoạt động.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">3</span> Tại sao chưa thấy camera của thành viên khác?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Phiên bản thử nghiệm tập trung hoàn thiện giao diện người dùng, chưa tích hợp WebRTC Media Server để truyền phát luồng video thời gian thực giữa các thành viên.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">4</span> Trạng thái STUDYING / BREAK nghĩa là gì?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Trạng thái này phản ánh chế độ làm việc (STUDYING) hoặc nghỉ ngơi (BREAK) theo chu kỳ Pomodoro cục bộ hiện tại của bạn.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">5</span> Cách bật âm thanh nền thiên nhiên (Ambient)?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Bản thử nghiệm giao diện chưa tích hợp phát tệp âm thanh thực tế. Nút điều khiển âm thanh hiện chỉ mang tính chất minh họa thao tác giao diện.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">6</span> Dữ liệu học tập có được lưu khi tải lại trang?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Không. Mọi dữ liệu công việc và trạng thái đều lưu tạm trong bộ nhớ React state của phiên làm việc. Khi tải lại trang (F5), dữ liệu sẽ trở về mặc định do không có backend lưu trữ.
                        </p>
                      </details>
                    </div>
                  </div>
                </details>

                <div className="room-settings-contact-box">
                  <div className="room-settings-contact-text">
                    <h5 className="room-settings-contact-title">Đồ án môn học SE347 - UIT</h5>
                    <p className="room-settings-contact-desc">
                      Không gian tự học trực tuyến Focoya — Phát triển bởi nhóm sinh viên Trường Đại học Công nghệ Thông tin (ĐHQG-HCM).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="room-settings-btn-feedback"
                    onClick={() => pushStatus('Cảm ơn bạn đã trải nghiệm bản thử nghiệm đồ án SE347!')}
                  >
                    Gửi phản hồi nhanh
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </dialog>
  );
}
