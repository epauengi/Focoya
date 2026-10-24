import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useRoomPreferences } from './RoomsLayout';
import {
  getRoom,
  TIMER_MODES,
  remainingSeconds,
  formatCountdown,
  type Room,
} from './rooms';
import './focus-room.css';

type TimerModeKey = keyof typeof TIMER_MODES;

type TaskItem = {
  id: string;
  text: string;
  completed: boolean;
};

// ponytail: local-only task list and client-side timer; replace with persistent sync backend when multi-user study sessions land.
function nextTimerMode(current: TimerModeKey): TimerModeKey {
  if (current === 'focus') return 'short';
  return 'focus';
}

export function FocusRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const room: Room | undefined = getRoom(roomId);
  const {
    wallpaper,
    displayName,
    notifications,
    autoStart,
    openSettings,
    notify,
  } = useRoomPreferences();

  const [activeView, setActiveView] = useState<'live' | 'timer'>('live');
  const [liveTimeString, setLiveTimeString] = useState('');
  const [greetingText, setGreetingText] = useState('');
  const [greetingSubtext, setGreetingSubtext] = useState('');

  // Pomodoro timer state
  const [timerMode, setTimerMode] = useState<TimerModeKey>('focus');
  const [timerRemaining, setTimerRemaining] = useState<number>(TIMER_MODES.focus.seconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completionNotice, setCompletionNotice] = useState<string>('');

  const deadlineRef = useRef<number | null>(null);
  const timerModeRef = useRef<TimerModeKey>(timerMode);
  timerModeRef.current = timerMode;
  const autoStartRef = useRef<boolean>(autoStart);
  autoStartRef.current = autoStart;
  const notificationsRef = useRef<boolean>(notifications);
  notificationsRef.current = notifications;

  // Task list state
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: 'task-1', text: 'SE347 UI/UX', completed: false },
  ]);
  const nextTaskId = useRef(1);
  const [isTasksOpen, setIsTasksOpen] = useState<boolean>(false);
  const [taskInput, setTaskInput] = useState<string>('');
  const [taskError, setTaskError] = useState<string>('');
  const taskInputId = useId();

  // Live time ticker
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setLiveTimeString(`${hours}:${minutes}`);

      if (hours < 11) {
        setGreetingText(`Chào buổi sáng, ${displayName}!`);
        setGreetingSubtext('Bắt đầu ngày mới thật năng suất!');
      } else if (hours < 14) {
        setGreetingText(`Chào buổi trưa, ${displayName}!`);
        setGreetingSubtext('Nạp năng lượng cho buổi chiều nào!');
      } else if (hours < 18) {
        setGreetingText(`Chào buổi chiều, ${displayName}!`);
        setGreetingSubtext('Cùng tập trung học tập nào!');
      } else {
        setGreetingText(`Chào buổi tối, ${displayName}!`);
        setGreetingSubtext('Thư giãn và tập trung nhé!');
      }
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [displayName]);

  // Pomodoro ticker (timestamp-resilient)
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (deadlineRef.current === null) return;
      const now = Date.now();
      const secondsLeft = remainingSeconds(deadlineRef.current, now);
      setTimerRemaining(secondsLeft);

      if (secondsLeft <= 0) {
        const finishedMode = timerModeRef.current;
        const alertMsg = `Hết giờ ${TIMER_MODES[finishedMode].name}!`;
        setCompletionNotice(alertMsg);

        if (notificationsRef.current) {
          notify(alertMsg);
        }

        if (autoStartRef.current) {
          const next = nextTimerMode(finishedMode);
          timerModeRef.current = next;
          setTimerMode(next);
          const nextSec = TIMER_MODES[next].seconds;
          setTimerRemaining(nextSec);
          deadlineRef.current = Date.now() + nextSec * 1000;
        } else {
          setIsRunning(false);
          deadlineRef.current = null;
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, notify]);

  const handleStartTimer = useCallback(() => {
    setCompletionNotice('');
    const seconds = timerRemaining > 0 ? timerRemaining : TIMER_MODES[timerMode].seconds;
    setTimerRemaining(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
    setIsRunning(true);
  }, [timerRemaining, timerMode]);

  const handlePauseTimer = useCallback(() => {
    if (deadlineRef.current !== null) {
      const secondsLeft = remainingSeconds(deadlineRef.current, Date.now());
      setTimerRemaining(secondsLeft);
    }
    deadlineRef.current = null;
    setIsRunning(false);
  }, []);

  const handleResetTimer = useCallback(() => {
    deadlineRef.current = null;
    setIsRunning(false);
    setCompletionNotice('');
    setTimerRemaining(TIMER_MODES[timerMode].seconds);
  }, [timerMode]);

  const handleSelectMode = useCallback((mode: TimerModeKey) => {
    deadlineRef.current = null;
    setIsRunning(false);
    setCompletionNotice('');
    setTimerMode(mode);
    setTimerRemaining(TIMER_MODES[mode].seconds);
  }, []);

  // Tasks actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskInput.trim();
    if (!trimmed) {
      setTaskError('Vui lòng nhập nội dung công việc.');
      return;
    }
    if (trimmed.length > 240) {
      setTaskError('Tối đa 240 ký tự.');
      return;
    }
    const task = { id: `local-task-${nextTaskId.current++}`, text: trimmed, completed: false };
    setTasks((prev) => [...prev, task]);
    setTaskInput('');
    setTaskError('');
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Tool actions
  const handleAmbientClick = () => {
    notify('Âm thanh tự nhiên đang tạm tắt trong bản demo.');
  };

  const handleTipsClick = () => {
    notify('Mẹo: Dành 25 phút tập trung sâu, sau đó đứng dậy vận động nhẹ 5 phút.');
  };

  const handleFullscreenClick = () => {
    const notifyFail = () =>
      notify('Trình duyệt không cho phép toàn màn hình hoặc cần tương tác người dùng.');
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(notifyFail);
      } else if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(notifyFail);
      } else {
        notifyFail();
      }
    } catch {
      notifyFail();
    }
  };

  // Missing or unknown room
  if (!room) {
    return (
      <main className="focus-room focus-room--not-found" id="room-main" tabIndex={-1}>
        <div className="focus-room__overlay" />
        <div className="focus-room__card-nf">
          <h1>Phòng không tồn tại</h1>
          <p>Phòng bạn tìm kiếm không có sẵn hoặc đã đóng.</p>
          <Link to="/rooms" className="focus-room__back-link">
            Khám phá phòng học khác
          </Link>
        </div>
      </main>
    );
  }

  const bgImage = wallpaper || room.image || '/room-assets/rainy.jpg';

  return (
    <main
      className="focus-room"
      style={{ backgroundImage: `url('${bgImage}')` }}
      id="room-main"
    >
      <div className="focus-room__overlay" aria-hidden="true" />

      {/* Screen reader only announcement for Pomodoro completion */}
      <div className="focus-sr-only" aria-live="polite" role="status">
        {completionNotice}
      </div>

      {/* Top Bar */}
      <header className="focus-room__top">
        <Link to="/rooms" className="focus-room__logo" aria-label="Focoya — Về danh sách phòng">
          Focoya
        </Link>
        <div className="focus-room__meta">
          <div className="focus-room__badge">
            <span className="focus-room__status-dot" aria-hidden="true" />
            <span>{room.name}</span>
            <span aria-hidden="true">·</span>
            <span>{room.online} online (demo)</span>
          </div>
        </div>
      </header>

      {/* Center Display */}
      <section className="focus-room__center">
        {activeView === 'live' ? (
          <div className="focus-live">
            <h1 className="focus-live__greet">{greetingText}</h1>
            <p className="focus-live__subtext">{greetingSubtext}</p>
            <div className="focus-live__digits" aria-label={`Giờ hiện tại: ${liveTimeString}`}>
              {liveTimeString}
            </div>
            <button
              type="button"
              className="focus-toggle-btn"
              onClick={() => setActiveView('timer')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Hẹn giờ Pomodoro</span>
            </button>
          </div>
        ) : (
          <div className="focus-timer">
            <div className="focus-timer__modes" role="group" aria-label="Chế độ hẹn giờ">
              {(Object.keys(TIMER_MODES) as TimerModeKey[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={timerMode === mode}
                  className={`focus-timer__mode-btn ${
                    timerMode === mode ? 'focus-timer__mode-btn--active' : ''
                  }`}
                  onClick={() => handleSelectMode(mode)}
                >
                  {TIMER_MODES[mode].name}
                </button>
              ))}
            </div>

            <div className="focus-timer__card">
              <div
                className="focus-timer__digits"
                aria-label={`Thời gian còn lại: ${formatCountdown(timerRemaining)}`}
              >
                {formatCountdown(timerRemaining)}
              </div>
              <div className="focus-timer__controls">
                {isRunning ? (
                  <button
                    type="button"
                    className="focus-timer__ctrl-btn focus-timer__ctrl-btn--primary"
                    aria-label="Tạm dừng hẹn giờ"
                    onClick={handlePauseTimer}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="focus-timer__ctrl-btn focus-timer__ctrl-btn--primary"
                    aria-label="Bắt đầu hẹn giờ"
                    onClick={handleStartTimer}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="focus-timer__ctrl-btn"
                  aria-label="Đặt lại thời gian"
                  onClick={handleResetTimer}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="button"
              className="focus-toggle-btn"
              onClick={() => setActiveView('live')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Xem giờ thực tế</span>
            </button>
          </div>
        )}
      </section>

      {/* Bottom Bar: Tasks & Dock */}
      <footer className="focus-room__bottom">
        {/* Tasks Corner */}
        <div className="focus-tasks">
          <button
            type="button"
            className="focus-tasks__toggle"
            aria-expanded={isTasksOpen}
            aria-controls="focus-tasks-panel"
            aria-label="Danh sách công việc"
            onClick={() => setIsTasksOpen((v) => !v)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>Công việc</span>
          </button>

          {isTasksOpen && (
            <div id="focus-tasks-panel" className="focus-tasks__panel">
              <div className="focus-tasks__header">
                <h2 className="focus-tasks__title">Công việc hôm nay</h2>
                <small className="focus-tasks__sub">Tạm thời · mất khi rời phòng</small>
              </div>

              {tasks.length === 0 ? (
                <p className="focus-tasks__empty">Chưa có công việc nào.</p>
              ) : (
                <ul className="focus-tasks__list">
                  {tasks.map((task) => (
                    <li key={task.id} className="focus-tasks__item">
                      <label className="focus-tasks__label">
                        <input
                          type="checkbox"
                          className="focus-tasks__checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.id)}
                        />
                        <span
                          className={`focus-tasks__text ${
                            task.completed ? 'focus-tasks__text--completed' : ''
                          }`}
                        >
                          {task.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="focus-tasks__del-btn"
                        aria-label={`Xóa công việc "${task.text}"`}
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form className="focus-tasks__form" onSubmit={handleAddTask}>
                <div className="focus-tasks__input-row">
                  <input
                    id={taskInputId}
                    type="text"
                    maxLength={240}
                    className="focus-tasks__input"
                    placeholder="Thêm việc cần làm..."
                    aria-label="Thêm việc cần làm"
                    value={taskInput}
                    onChange={(e) => {
                      setTaskInput(e.target.value);
                      if (taskError) setTaskError('');
                    }}
                  />
                  <button
                    type="submit"
                    className="focus-tasks__add-btn"
                    aria-label="Thêm công việc"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
                {taskError && <p className="focus-tasks__error">{taskError}</p>}
                {taskInput.length > 200 && (
                  <p className="focus-tasks__count">{taskInput.length}/240 ký tự</p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Tools Dock Corner */}
        <div className="focus-tools">
          <div className="focus-tools__dock">
            <button
              type="button"
              className="focus-tool"
              aria-label="Âm thanh tự nhiên"
              title="Âm thanh tự nhiên"
              onClick={handleAmbientClick}
            >
              <img src="/room-assets/cloud.svg" alt="" width="20" height="20" />
            </button>
            <Link
              to="/rooms"
              className="focus-tool"
              aria-label="Khám phá phòng khác"
              title="Khám phá phòng"
            >
              <img src="/room-assets/home.svg" alt="" width="20" height="20" />
            </Link>
            <button
              type="button"
              className="focus-tool"
              aria-label="Mẹo học tập"
              title="Mẹo học tập"
              onClick={handleTipsClick}
            >
              <img src="/room-assets/bulb.svg" alt="" width="20" height="20" />
            </button>
          </div>

          <button
            type="button"
            className="focus-tool focus-tool--standalone"
            aria-label="Cài đặt phòng"
            title="Cài đặt"
            onClick={() => openSettings('theme')}
          >
            <img src="/room-assets/settings.svg" alt="" width="20" height="20" />
          </button>

          <button
            type="button"
            className="focus-tool focus-tool--standalone"
            aria-label="Toàn màn hình"
            title="Toàn màn hình"
            onClick={handleFullscreenClick}
          >
            <img src="/room-assets/fullscreen.svg" alt="" width="20" height="20" />
          </button>
        </div>
      </footer>
    </main>
  );
}
