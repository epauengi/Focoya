import { useId, useState } from 'react';
import {
  DEFAULT_DURATIONS,
  DURATION_RANGES,
  parseDurationInput,
  type PomodoroDurations,
  type PomodoroMode,
} from './pomodoroPreferences';

const MODE_LABELS: Array<{ key: PomodoroMode; label: string }> = [
  { key: 'focus', label: 'Tập trung (phút)' },
  { key: 'short', label: 'Nghỉ ngắn (phút)' },
  { key: 'long', label: 'Nghỉ dài (phút)' },
];

function toDrafts(durations: PomodoroDurations): Record<PomodoroMode, string> {
  return {
    focus: String(durations.focus),
    short: String(durations.short),
    long: String(durations.long),
  };
}

export function PomodoroSettings(props: {
  durations: PomodoroDurations;
  onDurationsChange: (next: PomodoroDurations) => void;
  disabled?: boolean;
  onStatus?: (message: string) => void;
}) {
  const { durations, onDurationsChange, disabled = false, onStatus } = props;
  const baseId = useId();
  const [drafts, setDrafts] = useState<Record<PomodoroMode, string>>(() => toDrafts(durations));
  const [errors, setErrors] = useState<Partial<Record<PomodoroMode, string>>>({});

  const hasErrors = Object.values(errors).some(Boolean);
  const isAtDefault =
    !hasErrors &&
    drafts.focus === String(DEFAULT_DURATIONS.focus) &&
    drafts.short === String(DEFAULT_DURATIONS.short) &&
    drafts.long === String(DEFAULT_DURATIONS.long) &&
    durations.focus === DEFAULT_DURATIONS.focus &&
    durations.short === DEFAULT_DURATIONS.short &&
    durations.long === DEFAULT_DURATIONS.long;

  function handleChange(mode: PomodoroMode, rawValue: string, badInput: boolean) {
    setDrafts((prev) => ({ ...prev, [mode]: rawValue }));
    if (badInput) {
      const { min, max } = DURATION_RANGES[mode];
      setErrors((prev) => ({ ...prev, [mode]: `Nhập số nguyên từ ${min} đến ${max} phút.` }));
      return;
    }
    const result = parseDurationInput(mode, rawValue);
    if (result.error !== null) {
      setErrors((prev) => ({ ...prev, [mode]: result.error }));
      return;
    }
    setErrors((prev) => {
      if (!prev[mode]) return prev;
      const next = { ...prev };
      delete next[mode];
      return next;
    });
    if (result.value !== durations[mode]) {
      onDurationsChange({ ...durations, [mode]: result.value });
    }
  }

  function handleReset() {
    const defaults = { ...DEFAULT_DURATIONS };
    onDurationsChange(defaults);
    setDrafts(toDrafts(defaults));
    setErrors({});
    onStatus?.('Đã khôi phục thời lượng mặc định (25 / 5 / 15 phút)');
  }

  return (
    <section aria-label="Cài đặt hẹn giờ Pomodoro">
      <div className="room-settings-panel-header">
        <h3 className="room-settings-title">Bộ hẹn giờ Pomodoro</h3>
        <p className="room-settings-desc">
          Điều chỉnh thời lượng các phiên tập trung và nghỉ ngơi theo phút.
        </p>
      </div>

      {disabled && (
        <p className="room-settings-truth-note" role="status">
          Bộ hẹn giờ đang cập nhật hoặc đang chạy — tạm khóa chỉnh sửa thời lượng để tránh xung đột.
        </p>
      )}

      <div className="room-settings-timer-grid">
        {MODE_LABELS.map(({ key, label }) => {
          const inputId = `${baseId}-${key}`;
          const hintId = `${inputId}-hint`;
          const errorId = `${inputId}-error`;
          const { min, max } = DURATION_RANGES[key];
          const error = errors[key];

          return (
            <div key={key} className="room-settings-timer-field">
              <label htmlFor={inputId} className="room-settings-input-label">
                {label}
              </label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                step={1}
                disabled={disabled}
                value={drafts[key]}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                className={`room-settings-input room-settings-input--tabular${
                  error ? ' room-settings-input--error' : ''
                }`}
                onChange={(e) =>
                  handleChange(key, e.target.value, Boolean(e.target.validity?.badInput))
                }
              />
              <p id={hintId} className="room-settings-field-hint">
                Giới hạn: {min}–{max} phút
              </p>
              {error && (
                <p id={errorId} className="room-settings-field-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="room-settings-timer-actions">
        <span className="room-settings-field-hint">
          Tùy chọn được lưu cục bộ trên trình duyệt này.
        </span>
        <button
          type="button"
          className="room-settings-timer-reset"
          disabled={disabled || isAtDefault}
          onClick={handleReset}
        >
          Khôi phục mặc định
        </button>
      </div>
    </section>
  );
}
