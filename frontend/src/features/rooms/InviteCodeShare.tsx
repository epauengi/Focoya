import { useEffect, useId, useRef, useState } from "react";
import "./private-rooms.css";

type CopyState = "idle" | "copied" | "fallback";

export function InviteCodeShare({
  inviteCode,
  roomName,
  compact = false,
}: {
  inviteCode: string | null | undefined;
  roomName?: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    attemptRef.current += 1;
    setCopyState("idle");
  }, [inviteCode]);

  if (!inviteCode) {
    return <p className="prooms-hint">Chưa có mã mời cho phòng này.</p>;
  }

  const code = inviteCode;

  async function handleCopy() {
    const attemptId = ++attemptRef.current;
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopyState("fallback");
      codeRef.current?.focus();
      codeRef.current?.select();
      return;
    }

    try {
      await clipboard.writeText(code);
      if (!mountedRef.current || attemptRef.current !== attemptId) return;
      setCopyState("copied");
    } catch {
      if (!mountedRef.current || attemptRef.current !== attemptId) return;
      setCopyState("fallback");
      codeRef.current?.focus();
      codeRef.current?.select();
    }
  }

  const inputLabel = roomName ? `Mã mời của phòng ${roomName}` : "Mã mời phòng riêng";

  return (
    <div className="prooms-share">
      {!compact && (
        <label className="prooms-label" htmlFor={inputId}>
          Mã mời phòng riêng
        </label>
      )}
      <div className="prooms-share-row">
        <input
          id={inputId}
          ref={codeRef}
          className="prooms-code-input"
          type="text"
          readOnly
          value={code}
          aria-label={inputLabel}
          aria-describedby={hintId}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="prooms-secondary prooms-button-sm"
          onClick={() => {
            void handleCopy();
          }}
        >
          {copyState === "copied" ? "Đã sao chép" : "Sao chép mã"}
        </button>
      </div>
      {copyState === "copied" && (
        <p className="prooms-share-feedback" role="status">
          Đã sao chép mã mời vào bộ nhớ tạm.
        </p>
      )}
      {copyState === "fallback" && (
        <p className="prooms-share-feedback prooms-share-feedback--fallback" role="status">
          Không thể tự sao chép. Hãy chọn ô mã mời phía trên và nhấn Ctrl+C để sao chép.
        </p>
      )}
      <p id={hintId} className="prooms-privacy-hint">
        Chỉ chia sẻ mã mời với người bạn tin tưởng — bất kỳ ai có mã đều có thể vào phòng riêng này.
      </p>
    </div>
  );
}
