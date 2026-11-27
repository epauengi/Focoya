import { useEffect, useRef, useState } from 'react';
import { PomodoroSettings } from './PomodoroSettings';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  type NotificationPermissionState,
  type PomodoroDurations,
} from './pomodoroPreferences';
import './settings.css';

// ponytail: temporary client state; wire to REST API when backend ready.

export type SettingsTab = 'theme' | 'timer' | 'stats' | 'account' | 'help';

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
  { id: 'sunset', name: 'Hoàng hôn', src: '/room-assets/sunset.jpg', preview: '/room-assets/sunset.jpg' },
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
  durations: PomodoroDurations;
  onDurationsChange: (next: PomodoroDurations) => void;
  timerPending?: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
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
    durations,
    onDurationsChange,
    timerPending = false,
    onClose,
    onOpenProfile,
    onSignOut,
    notify,
  } = props;

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => getNotificationPermissionState());
  const [requestingPermission, setRequestingPermission] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pushStatus = (msg: string) => {
    setStatusMessage(msg);
    notify(msg);
  };

  async function handleNotificationsToggle() {
    if (requestingPermission) return;
    const next = !notifications;
    onNotificationsChange(next);
    if (!next) {
      pushStatus('Đã tắt thông báo');
      return;
    }

    const current = getNotificationPermissionState();
    setNotificationPermission(current);
    if (current === 'default') {
      setRequestingPermission(true);
      try {
        const nextPermission = await requestNotificationPermission();
        setNotificationPermission(nextPermission);
        if (nextPermission === 'granted') {
          pushStatus('Đã bật thông báo hệ thống và trong ứng dụng');
        } else if (nextPermission === 'denied') {
          pushStatus('Thông báo trình duyệt bị chặn; chỉ hiển thị trong ứng dụng');
        } else {
          pushStatus('Đã bật thông báo trong ứng dụng');
        }
      } finally {
        setRequestingPermission(false);
      }
      return;
    }

    if (current === 'denied') {
      pushStatus('Thông báo trình duyệt đang bị chặn; chỉ hiển thị trong ứng dụng');
      return;
    }

    if (current === 'unsupported') {
      pushStatus('Đã bật thông báo trong ứng dụng (trình duyệt không hỗ trợ thông báo hệ thống)');
      return;
    }

    pushStatus('Đã bật thông báo');
  }

  const notificationGuidance =
    notificationPermission === 'granted'
      ? 'Đã cấp quyền thông báo hệ thống.'
      : notificationPermission === 'denied'
        ? 'Quyền thông báo trình duyệt đang bị chặn. Hãy bật lại trong cài đặt trang web; thông báo trong ứng dụng vẫn hiển thị.'
        : notificationPermission === 'default'
          ? 'Chưa cấp quyền thông báo hệ thống. Bật công tắc để trình duyệt hỏi quyền.'
          : 'Trình duyệt không hỗ trợ thông báo hệ thống; thông báo trong ứng dụng vẫn hoạt động.';

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
              aria-pressed={activeTab === 'timer'}
              className={`room-settings-tab-btn ${activeTab === 'timer' ? 'room-settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('timer')}
            >
              Hẹn giờ
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
                    <span
                      className={`room-settings-toggle-guidance${
                        notificationPermission === 'denied' || notificationPermission === 'unsupported'
                          ? ' room-settings-toggle-guidance--warn'
                          : ''
                      }`}
                    >
                      {notificationGuidance}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications}
                    disabled={requestingPermission}
                    className="room-settings-switch"
                    onClick={() => {
                      void handleNotificationsToggle();
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
                      {timerPending
                        ? 'Đang tạm khóa khi bộ hẹn giờ đang chạy hoặc xử lý.'
                        : 'Bộ hẹn giờ tự động khởi động khi kết thúc phân đoạn'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoStart}
                    disabled={timerPending}
                    className="room-settings-switch"
                    onClick={() => {
                      if (timerPending) return;
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
                  Chuông báo Pomodoro chưa khả dụng. Âm thanh nền có bộ điều khiển riêng ở nút hình mây trong phòng.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'timer' && (
            <PomodoroSettings
              durations={durations}
              onDurationsChange={onDurationsChange}
              disabled={timerPending}
              onStatus={pushStatus}
            />
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
                  Cập nhật tên hiển thị, giới thiệu và ảnh đại diện trong hồ sơ.
                </p>
              </div>

              <div className="room-settings-account-card">
                <div className="room-settings-form-actions">
                  <button type="button" className="room-settings-btn-primary" onClick={onOpenProfile}>
                    Mở hồ sơ
                  </button>
                  <button type="button" className="room-settings-btn-danger" onClick={onSignOut}>
                    Đăng xuất
                  </button>
                </div>
              </div>
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
                          Máy chủ chỉ cấp XP cho phiên Focus ghi nhận từ 5 phút, tối đa 60 phút; mỗi phút được ghi nhận tương ứng 1 XP. Break không có XP. Tạm dừng đồng hồ không dừng thời gian máy chủ. Kết quả chưa xác nhận không được coi là đã lưu; xem thông báo của Pomodoro và hồ sơ sau khi kết thúc.
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
                          Pomodoro điều khiển trạng thái khi có phiên: Focus đang chạy là STUDYING, nghỉ là BREAK, tạm dừng hoặc kết thúc là IDLE. Ngoài phiên bạn có thể chọn thủ công trong bảng thành viên. Avatar chỉ hiển thị snapshot đã được máy chủ xác nhận; trạng thái dùng chung giữa các tab của cùng tài khoản.
                        </p>
                      </details>

                      <details className="room-settings-faq-item">
                        <summary className="room-settings-faq-summary">
                          <span className="room-settings-faq-badge">5</span> Cách bật âm thanh nền thiên nhiên (Ambient)?
                        </summary>
                        <p className="room-settings-faq-answer">
                          Trong phòng học, mở nút hình mây rồi chọn Phát. Bạn có thể đổi âm thanh, chỉnh âm lượng hoặc tắt tiếng; rời phòng sẽ dừng âm thanh.
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
