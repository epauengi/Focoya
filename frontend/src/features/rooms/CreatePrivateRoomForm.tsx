import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, getSession, getSessionGeneration, subscribeSession } from "@/auth/session";
import type { Room } from "./rooms";
import {
  ROOM_IMAGES,
  ROOM_THEMES,
  createPrivateRoom,
  isUncertainCreate,
  privateRoomMessage,
  validatePrivateRoom,
  type CreatePrivateRoomInput,
} from "./privateRooms";
import { ownedRoomsKey, ownedRoomsQuery } from "./privateRoomQueries";
import { isCurrentPrivateUser } from "./privateRoomAccess";
import { InviteCodeShare } from "./InviteCodeShare";
import "./private-rooms.css";

type SubmitPhase =
  | "idle"
  | "submitting"
  | "checking_uncertain"
  | "uncertain_check_failed"
  | "uncertain_checked";

type FormState = {
  name: string;
  description: string;
  theme: string;
  image: string;
  maxSlotsDraft: string;
};

const IMAGE_LABELS: Record<string, string> = {
  "rainy.jpg": "Cửa sổ mưa",
  "midnight.png": "Thư viện đêm",
  "autumn.png": "Rừng thu",
  "sunset.jpg": "Hoàng hôn",
  "bg.png": "Pastel mặc định",
};

function imageLabel(path: string): string {
  const file = path.split("/").pop()?.toLowerCase() ?? "";
  return IMAGE_LABELS[file] ?? file;
}

function initialFormState(): FormState {
  return {
    name: "",
    description: "",
    theme: ROOM_THEMES[0] ?? "Study",
    image: ROOM_IMAGES[0] ?? "/room-assets/rainy.jpg",
    maxSlotsDraft: "10",
  };
}

export function CreatePrivateRoomForm({
  userId,
  ownedCount,
  maxOwned = 2,
  autoFocus = false,
  onCancel,
  onCreated,
}: {
  userId?: string;
  ownedCount: number;
  maxOwned?: number;
  autoFocus?: boolean;
  onCancel?: () => void;
  onCreated?: (room: Room) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useSyncExternalStore(subscribeSession, getSession);
  const activeUserId = userId ?? user?.id;

  const baseId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const themeRef = useRef<HTMLSelectElement>(null);
  const maxSlotsRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const errorAlertRef = useRef<HTMLParagraphElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  const [form, setForm] = useState(initialFormState);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [serverError, setServerError] = useState("");
  const [uncertainMessage, setUncertainMessage] = useState("");
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus && !createdRoom) {
      nameRef.current?.focus();
    }
  }, [autoFocus, createdRoom]);

  useEffect(() => {
    if (createdRoom) {
      successHeadingRef.current?.focus();
    }
  }, [createdRoom]);

  const trimmedSlots = form.maxSlotsDraft.trim();
  const parsedMaxSlots = trimmedSlots === "" ? NaN : Number(trimmedSlots);
  const currentInput: CreatePrivateRoomInput = {
    name: form.name,
    description: form.description,
    theme: form.theme,
    image: form.image,
    maxSlots: parsedMaxSlots,
  };

  const fieldErrors = hasSubmitted ? validatePrivateRoom(currentInput) : {};
  const knownErrorKeys = new Set(["name", "theme", "maxSlots", "description", "image"]);
  const extraValidationErrors = Object.entries(fieldErrors)
    .filter(([key, value]) => !knownErrorKeys.has(key) && Boolean(value))
    .map(([, value]) => value);

  const busy = phase === "submitting" || phase === "checking_uncertain";
  const limitReached = ownedCount >= maxOwned;

  function focusFirstInvalid(errors: Record<string, string>) {
    if (errors.name) nameRef.current?.focus();
    else if (errors.theme) themeRef.current?.focus();
    else if (errors.maxSlots) maxSlotsRef.current?.focus();
    else if (errors.description) descriptionRef.current?.focus();
    else if (errors.image) imageRef.current?.focus();
    else errorAlertRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || limitReached || phase === "uncertain_check_failed") return;

    setHasSubmitted(true);
    setServerError("");
    setUncertainMessage("");

    const validation = validatePrivateRoom(currentInput);
    if (Object.values(validation).some(Boolean)) {
      focusFirstInvalid(validation);
      return;
    }

    const submittedUserId = activeUserId;
    if (!submittedUserId) {
      setServerError("Phiên đăng nhập chưa sẵn sàng. Vui lòng thử lại.");
      errorAlertRef.current?.focus();
      return;
    }
    const submittedGen = getSessionGeneration();

    submittingRef.current = true;
    setPhase("submitting");

    try {
      const room = await createPrivateRoom(currentInput, submittedUserId);
      if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;

      void queryClient.invalidateQueries({
        queryKey: ownedRoomsKey(submittedUserId),
        exact: true,
      });
      setCreatedRoom(room);
      setPhase("idle");
      onCreated?.(room);
    } catch (error) {
      if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;

      const baseMessage = privateRoomMessage(error, "create");
      if (isUncertainCreate(error)) {
        setPhase("checking_uncertain");
        try {
          await queryClient.fetchQuery({
            ...ownedRoomsQuery(submittedUserId),
            staleTime: 0,
          });
          if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;

          setUncertainMessage(
            `${baseMessage} Danh sách phòng của bạn đã được làm mới — hãy kiểm tra xem phòng mới đã xuất hiện bên dưới chưa trước khi thử tạo lại.`,
          );
          setPhase("uncertain_checked");
        } catch {
          if (!mountedRef.current || !isCurrentPrivateUser(submittedUserId, submittedGen)) return;

          setUncertainMessage(
            `${baseMessage} Không thể kiểm tra lại danh sách phòng lúc này; chưa rõ phòng đã được tạo hay chưa. Hãy kiểm tra lại danh sách trước khi thử tạo lại.`,
          );
          setPhase("uncertain_check_failed");
        }
      } else {
        if (error instanceof ApiError && error.status === 400) {
          void queryClient.invalidateQueries({
            queryKey: ownedRoomsKey(submittedUserId),
            exact: true,
          });
        }
        setServerError(baseMessage);
        setPhase("idle");
        errorAlertRef.current?.focus();
      }
    } finally {
      if (mountedRef.current) {
        submittingRef.current = false;
      }
    }
  }

  async function handleRecheckOwned() {
    if (submittingRef.current || phase !== "uncertain_check_failed") return;
    const checkUserId = activeUserId;
    if (!checkUserId) {
      setServerError("Phiên đăng nhập chưa sẵn sàng. Vui lòng thử lại.");
      errorAlertRef.current?.focus();
      return;
    }
    const checkGen = getSessionGeneration();

    submittingRef.current = true;
    setServerError("");
    setPhase("checking_uncertain");

    try {
      await queryClient.fetchQuery({
        ...ownedRoomsQuery(checkUserId),
        staleTime: 0,
      });
      if (!mountedRef.current || !isCurrentPrivateUser(checkUserId, checkGen)) return;

      setUncertainMessage(
        "Đã làm mới danh sách phòng của bạn. Hãy kiểm tra xem phòng mới đã xuất hiện bên dưới chưa trước khi thử tạo lại.",
      );
      setPhase("uncertain_checked");
    } catch {
      if (!mountedRef.current || !isCurrentPrivateUser(checkUserId, checkGen)) return;

      setUncertainMessage(
        "Vẫn chưa thể kiểm tra lại danh sách phòng. Vui lòng kiểm tra kết nối rồi bấm Kiểm tra lại danh sách phòng.",
      );
      setPhase("uncertain_check_failed");
    } finally {
      if (mountedRef.current) {
        submittingRef.current = false;
      }
    }
  }

  function resetForm() {
    setForm(initialFormState());
    setHasSubmitted(false);
    setPhase("idle");
    setServerError("");
    setUncertainMessage("");
    setCreatedRoom(null);
  }

  if (createdRoom) {
    return (
      <section className="prooms-success-banner" aria-labelledby={`${baseId}-created-title`}>
        <div>
          <h3 id={`${baseId}-created-title`} ref={successHeadingRef} tabIndex={-1}>
            Đã tạo phòng riêng: {createdRoom.name}
          </h3>
          <div className="prooms-success-meta">
            <span>Chủ đề: {createdRoom.theme}</span>
            <span>Tối đa: {createdRoom.maxSlots} người</span>
          </div>
        </div>

        <InviteCodeShare inviteCode={createdRoom.inviteCode} roomName={createdRoom.name} />

        <div className="prooms-actions">
          <Link className="rooms-button" to={`/rooms/${createdRoom.id}`}>
            Vào phòng ngay
          </Link>
          <Link className="prooms-secondary" to={`/rooms/${createdRoom.id}/preview`}>
            Xem trước phòng
          </Link>
          {ownedCount < maxOwned && (
            <button type="button" className="prooms-secondary" onClick={resetForm}>
              Tạo thêm phòng
            </button>
          )}
          {onCancel && (
            <button type="button" className="prooms-secondary" onClick={onCancel}>
              Đóng
            </button>
          )}
        </div>
      </section>
    );
  }

  const nameId = `${baseId}-name`;
  const nameErrorId = `${baseId}-name-error`;
  const themeId = `${baseId}-theme`;
  const themeErrorId = `${baseId}-theme-error`;
  const slotsId = `${baseId}-slots`;
  const slotsHintId = `${baseId}-slots-hint`;
  const slotsErrorId = `${baseId}-slots-error`;
  const descId = `${baseId}-desc`;
  const descErrorId = `${baseId}-desc-error`;
  const imageErrorId = `${baseId}-image-error`;

  return (
    <form
      className="prooms-form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      noValidate
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="prooms-panel-head">
        <div>
          <h2 id={`${baseId}-heading`}>Tạo phòng học riêng</h2>
          <p>
            Phòng riêng không xuất hiện trên trang Explore công khai; chỉ người có mã mời mới có thể
            tham gia. Mỗi tài khoản tạo tối đa {maxOwned} phòng riêng.
          </p>
        </div>
        <span className="prooms-count">
          {ownedCount}/{maxOwned} phòng
        </span>
      </div>

      {limitReached && (
        <p className="prooms-limit-note" role="status">
          Bạn đã đạt giới hạn {maxOwned}/{maxOwned} phòng riêng. Không thể tạo thêm phòng mới trên
          tài khoản này.
        </p>
      )}

      <fieldset className="prooms-fieldset" disabled={busy || limitReached}>
        <div className="prooms-field">
          <label className="prooms-label" htmlFor={nameId}>
            Tên phòng
          </label>
          <input
            id={nameId}
            ref={nameRef}
            className="prooms-input"
            type="text"
            required
            maxLength={100}
            placeholder="Ví dụ: Ôn thi cuối kỳ nhóm A"
            value={form.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? nameErrorId : undefined}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, name: event.target.value }));
              if (serverError) setServerError("");
            }}
          />
          {fieldErrors.name && (
            <p id={nameErrorId} className="prooms-error" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="prooms-form-row">
          <div className="prooms-field">
            <label className="prooms-label" htmlFor={themeId}>
              Chủ đề
            </label>
            <select
              id={themeId}
              ref={themeRef}
              className="prooms-select"
              value={form.theme}
              aria-invalid={Boolean(fieldErrors.theme)}
              aria-describedby={fieldErrors.theme ? themeErrorId : undefined}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, theme: event.target.value }));
                if (serverError) setServerError("");
              }}
            >
              {ROOM_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
            {fieldErrors.theme && (
              <p id={themeErrorId} className="prooms-error" role="alert">
                {fieldErrors.theme}
              </p>
            )}
          </div>

          <div className="prooms-field">
            <label className="prooms-label" htmlFor={slotsId}>
              Số người tối đa
            </label>
            <input
              id={slotsId}
              ref={maxSlotsRef}
              className="prooms-input prooms-input--tabular"
              type="number"
              inputMode="numeric"
              min={10}
              max={30}
              step={1}
              value={form.maxSlotsDraft}
              aria-invalid={Boolean(fieldErrors.maxSlots)}
              aria-describedby={
                fieldErrors.maxSlots ? `${slotsHintId} ${slotsErrorId}` : slotsHintId
              }
              onChange={(event) => {
                setForm((prev) => ({ ...prev, maxSlotsDraft: event.target.value }));
                if (serverError) setServerError("");
              }}
            />
            <p id={slotsHintId} className="prooms-hint">
              Từ 10 đến 30 chỗ
            </p>
            {fieldErrors.maxSlots && (
              <p id={slotsErrorId} className="prooms-error" role="alert">
                {fieldErrors.maxSlots}
              </p>
            )}
          </div>
        </div>

        <div className="prooms-field">
          <div className="prooms-field-top">
            <label className="prooms-label" htmlFor={descId}>
              Mô tả <span className="prooms-hint">(không bắt buộc)</span>
            </label>
          </div>
          <textarea
            id={descId}
            ref={descriptionRef}
            className="prooms-textarea"
            rows={3}
            maxLength={500}
            placeholder="Ghi chú lịch học hoặc quy tắc của phòng…"
            value={form.description}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? descErrorId : undefined}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, description: event.target.value }));
              if (serverError) setServerError("");
            }}
          />
          {fieldErrors.description && (
            <p id={descErrorId} className="prooms-error" role="alert">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <fieldset
          className="prooms-image-fieldset"
          aria-describedby={fieldErrors.image ? imageErrorId : undefined}
        >
          <legend>Ảnh không gian</legend>
          <div className="prooms-image-grid">
            {ROOM_IMAGES.map((imagePath, index) => (
              <label key={imagePath} className="prooms-image-option">
                <input
                  ref={index === 0 ? imageRef : undefined}
                  className="rooms-sr-only"
                  type="radio"
                  name={`${baseId}-image`}
                  value={imagePath}
                  checked={form.image === imagePath}
                  onChange={() => {
                    setForm((prev) => ({ ...prev, image: imagePath }));
                    if (serverError) setServerError("");
                  }}
                />
                <img src={imagePath} alt="" width="320" height="200" loading="lazy" />
                <span>{imageLabel(imagePath)}</span>
              </label>
            ))}
          </div>
          {fieldErrors.image && (
            <p id={imageErrorId} className="prooms-error" role="alert">
              {fieldErrors.image}
            </p>
          )}
        </fieldset>
      </fieldset>

      {extraValidationErrors.length > 0 && (
        <p className="prooms-alert" role="alert" ref={errorAlertRef} tabIndex={-1}>
          {extraValidationErrors[0]}
        </p>
      )}

      {phase === "submitting" && (
        <p className="prooms-status" role="status">
          Đang tạo phòng riêng…
        </p>
      )}

      {phase === "checking_uncertain" && (
        <p className="prooms-status" role="status">
          Kết nối gián đoạn — đang kiểm tra lại danh sách phòng của bạn trước khi cho phép thử lại…
        </p>
      )}

      {uncertainMessage && (
        <p className="prooms-warning" role="alert">
          {uncertainMessage}
        </p>
      )}

      {serverError && (
        <p className="prooms-alert" role="alert" ref={errorAlertRef} tabIndex={-1}>
          {serverError}
        </p>
      )}

      <div className="prooms-actions">
        <button
          className="rooms-button"
          type="submit"
          disabled={busy || limitReached || phase === "uncertain_check_failed"}
        >
          {phase === "submitting"
            ? "Đang tạo phòng…"
            : phase === "checking_uncertain"
              ? "Đang kiểm tra danh sách…"
              : phase === "uncertain_checked"
                ? "Thử tạo lại"
                : "Tạo phòng riêng"}
        </button>
        {phase === "uncertain_check_failed" && !limitReached && (
          <button
            className="prooms-secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              void handleRecheckOwned();
            }}
          >
            Kiểm tra lại danh sách phòng
          </button>
        )}
        {onCancel && (
          <button
            className="prooms-secondary"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
