import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { getSession, getSessionGeneration, subscribeSession } from "@/auth/session";
import { isRoomId, type Room } from "./rooms";
import { normalizeInviteCode, privateRoomMessage, validateInviteCode } from "./privateRooms";
import { grantPrivateRoomAccess, isCurrentPrivateUser } from "./privateRoomAccess";
import "./private-rooms.css";

export function JoinByCodeForm({
  targetRoomId,
  userId,
  headingId,
  autoFocus = false,
  onCancel,
  onJoined,
}: {
  targetRoomId?: string;
  userId?: string;
  headingId?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onJoined?: (room: Room) => void;
}) {
  const navigate = useNavigate();
  const { user } = useSyncExternalStore(subscribeSession, getSession);
  const activeUserId = userId ?? user?.id;
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const internalHeadingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFieldError("");
    setServerError("");

    let normalizedCode: string;
    try {
      normalizedCode = normalizeInviteCode(code);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Mã mời không hợp lệ.");
      inputRef.current?.focus();
      return;
    }

    const submittedUserId = activeUserId;
    if (!submittedUserId) {
      setServerError("Phiên đăng nhập chưa sẵn sàng. Vui lòng thử lại.");
      inputRef.current?.focus();
      return;
    }
    const submittedGen = getSessionGeneration();

    submittingRef.current = true;
    setPending(true);

    try {
      const room = await validateInviteCode(normalizedCode, submittedUserId);
      if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;

      if (targetRoomId !== undefined) {
        if (!isRoomId(targetRoomId) || room.id.toLowerCase() !== targetRoomId.toLowerCase()) {
          setFieldError("Mã mời không khớp với phòng riêng hiện tại.");
          inputRef.current?.focus();
          return;
        }
      }

      grantPrivateRoomAccess(room, normalizedCode, submittedUserId, submittedGen);
      onJoined?.(room);
      navigate(`/rooms/${room.id}/preview`);
    } catch (error) {
      if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;
      setServerError(privateRoomMessage(error, "join"));
      inputRef.current?.focus();
    } finally {
      if (mountedRef.current) {
        submittingRef.current = false;
        setPending(false);
      }
    }
  }

  const describedBy = fieldError ? `${hintId} ${errorId}` : hintId;
  const showHeader = !targetRoomId;
  const formHeadingId = headingId ?? (showHeader ? internalHeadingId : undefined);

  return (
    <form
      className="prooms-form"
      onSubmit={(event) => { void handleSubmit(event); }}
      noValidate
      aria-labelledby={formHeadingId}
      aria-label={formHeadingId ? undefined : "Nhập lại mã mời để truy cập phòng"}
    >
      {showHeader && (
        <div className="prooms-panel-head">
          <div>
            <h2 id={internalHeadingId}>Tham gia phòng bằng mã mời</h2>
            <p>Nhập mã mời nhận từ chủ phòng để xem trước và vào phòng riêng.</p>
          </div>
        </div>
      )}

      <fieldset className="prooms-fieldset" disabled={pending}>
        <div className="prooms-join-row">
          <div className="prooms-field">
            <label className="prooms-label" htmlFor={inputId}>
              Mã mời
            </label>
            <input
              id={inputId}
              ref={inputRef}
              className="prooms-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              placeholder="Ví dụ: AB12CD"
              value={code}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={describedBy}
              onChange={(event) => {
                setCode(event.target.value);
                if (fieldError) setFieldError("");
                if (serverError) setServerError("");
              }}
            />
            <p id={hintId} className="prooms-hint">
              Gồm 6 ký tự chữ A–Z hoặc số 0–9; chuẩn hóa khi bấm Tham gia.
            </p>
            {fieldError && (
              <p id={errorId} className="prooms-error" role="alert">
                {fieldError}
              </p>
            )}
          </div>

          <div className="prooms-join-actions">
            <button className="rooms-button" type="submit">
              {pending ? "Đang kiểm tra…" : "Tham gia"}
            </button>
            {onCancel && (
              <button
                className="prooms-secondary"
                type="button"
                disabled={pending}
                onClick={onCancel}
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      </fieldset>

      {pending && (
        <p className="prooms-status" role="status">
          Đang xác thực mã mời…
        </p>
      )}
      {serverError && (
        <p className="prooms-alert" role="alert">
          {serverError}
        </p>
      )}
    </form>
  );
}
