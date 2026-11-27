import {
  ApiError,
  apiRequest,
  getSession,
  getSessionGeneration,
} from "../../auth/session";
import { isRoomId } from "./rooms";

export type StudySessionStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type StudySession = {
  id: string;
  userId: string;
  roomId: string;
  status: StudySessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  xpEarned: number;
};

export type StudyIdentity = {
  userId: string;
  generation: number;
  roomId: string;
};

export class StudySessionError extends Error {
  readonly uncertain: boolean;
  readonly status?: number;

  constructor(message: string, uncertain: boolean, status?: number) {
    super(message);
    this.name = "StudySessionError";
    this.uncertain = uncertain;
    this.status = status;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isStudyStatus(value: unknown): value is StudySessionStatus {
  return value === "IN_PROGRESS" || value === "COMPLETED" || value === "CANCELLED";
}

function toVietnameseMessage(message: string | undefined, fallback: string): string {
  return typeof message === "string" && message.trim().length > 0 ? message.trim() : fallback;
}

export function captureStudyIdentity(roomId: string): StudyIdentity {
  if (!isRoomId(roomId)) {
    throw new StudySessionError("Phòng học không hợp lệ.", false);
  }
  const session = getSession();
  const userId = session.user?.id;
  if (session.status !== "authenticated" || typeof userId !== "string" || !userId.trim()) {
    throw new StudySessionError("Vui lòng đăng nhập để bắt đầu phiên học.", false);
  }
  return {
    userId,
    generation: getSessionGeneration(),
    roomId,
  };
}

export function isStudyIdentityCurrent(identity: StudyIdentity | null | undefined): boolean {
  if (!identity || typeof identity !== "object") return false;
  if (typeof identity.userId !== "string" || !identity.userId.trim()) return false;
  if (!Number.isInteger(identity.generation)) return false;
  if (!isRoomId(identity.roomId)) return false;
  const session = getSession();
  return (
    session.status === "authenticated" &&
    session.user?.id === identity.userId &&
    getSessionGeneration() === identity.generation
  );
}

function parseStudySession(value: unknown, httpStatus: number): StudySession {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StudySessionError("Dữ liệu phiên học từ máy chủ không hợp lệ.", true, httpStatus);
  }
  const raw = value as Record<string, unknown>;
  if (
    !isUuid(raw.id) ||
    !isUuid(raw.userId) ||
    !isUuid(raw.roomId) ||
    !isStudyStatus(raw.status) ||
    !isIsoTimestamp(raw.startedAt) ||
    typeof raw.xpEarned !== "number" ||
    !Number.isInteger(raw.xpEarned) ||
    raw.xpEarned < 0
  ) {
    throw new StudySessionError("Dữ liệu phiên học từ máy chủ không hợp lệ.", true, httpStatus);
  }

  if (raw.status === "IN_PROGRESS") {
    if (raw.endedAt !== null || raw.durationMinutes !== null || raw.xpEarned !== 0) {
      throw new StudySessionError("Dữ liệu phiên học từ máy chủ không hợp lệ.", true, httpStatus);
    }
    return {
      id: raw.id,
      userId: raw.userId,
      roomId: raw.roomId,
      status: raw.status,
      startedAt: raw.startedAt,
      endedAt: null,
      durationMinutes: null,
      xpEarned: raw.xpEarned,
    };
  }

  if (
    !isIsoTimestamp(raw.endedAt) ||
    Date.parse(raw.endedAt) < Date.parse(raw.startedAt) ||
    typeof raw.durationMinutes !== "number" ||
    !Number.isInteger(raw.durationMinutes) ||
    raw.durationMinutes < 0 ||
    (raw.status === "CANCELLED" && raw.xpEarned !== 0)
  ) {
    throw new StudySessionError("Dữ liệu phiên học từ máy chủ không hợp lệ.", true, httpStatus);
  }

  return {
    id: raw.id,
    userId: raw.userId,
    roomId: raw.roomId,
    status: raw.status,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    durationMinutes: raw.durationMinutes,
    xpEarned: raw.xpEarned,
  };
}

async function parseStudySessionResponse(response: Response): Promise<StudySession> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StudySessionError(
      "Phản hồi phiên học từ máy chủ không hợp lệ.",
      true,
      response.status,
    );
  }
  return parseStudySession(payload, response.status);
}

function mapRequestError(error: unknown, operation: "start" | "finish"): StudySessionError {
  if (error instanceof StudySessionError) return error;

  if (error instanceof ApiError) {
    if (error.status >= 500 || error.status === 408) {
      return new StudySessionError(
        "Máy chủ gặp sự cố khi đồng bộ phiên học. Trạng thái phiên học chưa được xác nhận.",
        true,
        error.status,
      );
    }
    if (operation === "finish" && error.status === 404) {
      return new StudySessionError(
        "Không tìm thấy phiên học đang chạy trên máy chủ. Trạng thái phiên học chưa được xác nhận.",
        true,
        404,
      );
    }
    if (error.status === 401) {
      return new StudySessionError(
        toVietnameseMessage(error.message, "Vui lòng đăng nhập lại."),
        false,
        401,
      );
    }
    if (error.status === 403) {
      return new StudySessionError(
        toVietnameseMessage(error.message, "Bạn không có quyền thực hiện thao tác này."),
        false,
        403,
      );
    }
    if (error.status === 404) {
      return new StudySessionError(
        toVietnameseMessage(error.message, "Phòng không tồn tại hoặc đã đóng."),
        false,
        404,
      );
    }
    return new StudySessionError(
      toVietnameseMessage(error.message, "Yêu cầu phiên học bị từ chối."),
      false,
      error.status,
    );
  }

  return new StudySessionError(
    "Không thể kết nối máy chủ. Trạng thái phiên học chưa được xác nhận.",
    true,
  );
}

export async function startStudySession(identity: StudyIdentity): Promise<StudySession> {
  if (!isStudyIdentityCurrent(identity)) {
    throw new StudySessionError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", false);
  }

  // apiRequest base already includes /api; pass expectedUserId and never retry potentially committed POSTs on network/5xx.
  let response: Response;
  try {
    response = await apiRequest(
      "/study-sessions/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: identity.roomId }),
      },
      identity.userId,
    );
  } catch (error) {
    throw mapRequestError(error, "start");
  }

  if (!isStudyIdentityCurrent(identity)) {
    throw new StudySessionError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", false);
  }

  const session = await parseStudySessionResponse(response);
  if (
    session.userId.toLowerCase() !== identity.userId.toLowerCase() ||
    session.roomId.toLowerCase() !== identity.roomId.toLowerCase() ||
    session.status !== "IN_PROGRESS"
  ) {
    throw new StudySessionError(
      "Phiên học trả về không khớp với thông tin phòng hoặc tài khoản.",
      true,
      response.status,
    );
  }
  return session;
}

export async function finishStudySession(
  identity: StudyIdentity,
  expectedSessionId: string,
): Promise<StudySession> {
  if (!isStudyIdentityCurrent(identity)) {
    throw new StudySessionError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", false);
  }
  if (!isUuid(expectedSessionId)) {
    throw new StudySessionError("Mã phiên học không hợp lệ.", false);
  }

  let response: Response;
  try {
    response = await apiRequest(
      "/study-sessions/finish",
      {
        method: "POST",
      },
      identity.userId,
    );
  } catch (error) {
    throw mapRequestError(error, "finish");
  }

  if (!isStudyIdentityCurrent(identity)) {
    throw new StudySessionError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", false);
  }

  const session = await parseStudySessionResponse(response);
  if (
    session.id.toLowerCase() !== expectedSessionId.toLowerCase() ||
    session.userId.toLowerCase() !== identity.userId.toLowerCase() ||
    session.roomId.toLowerCase() !== identity.roomId.toLowerCase() ||
    (session.status !== "COMPLETED" && session.status !== "CANCELLED")
  ) {
    throw new StudySessionError(
      "Phiên học kết thúc không khớp với phiên đang theo dõi.",
      true,
      response.status,
    );
  }
  return session;
}

export async function acquireStudyLock(userId: string): Promise<() => void> {
  const normalizedUserId = typeof userId === "string" ? userId.trim().toLowerCase() : "";
  if (!normalizedUserId) {
    throw new StudySessionError("Phiên đăng nhập không hợp lệ.", false);
  }

  const locks = globalThis.navigator?.locks;
  if (!locks || typeof locks.request !== "function") {
    throw new StudySessionError(
      "Trình duyệt không hỗ trợ đồng bộ phiên học giữa các tab. Bạn vẫn có thể dùng chế độ nghỉ.",
      false,
    );
  }

  const lockName = `focoya:study-session:${normalizedUserId}`;
  return new Promise<() => void>((resolveAcquire, rejectAcquire) => {
    let settled = false;
    let released = false;
    let releaseLock: (() => void) | undefined;

    const release = () => {
      if (released) return;
      released = true;
      releaseLock?.();
    };

    try {
      Promise.resolve(
        locks.request(lockName, { ifAvailable: true }, (lock) => {
          if (!lock) {
            if (!settled) {
              settled = true;
              rejectAcquire(
                new StudySessionError(
                  "Bạn đang có phiên học hoạt động ở một tab hoặc cửa sổ khác.",
                  false,
                ),
              );
            }
            return Promise.resolve();
          }
          return new Promise<void>((resolveHold) => {
            releaseLock = resolveHold;
            if (released) {
              resolveHold();
              return;
            }
            settled = true;
            resolveAcquire(release);
          });
        }),
      ).catch(() => {
        if (!settled) {
          settled = true;
          rejectAcquire(
            new StudySessionError(
              "Không thể khóa phiên học giữa các tab. Bạn vẫn có thể dùng chế độ nghỉ.",
              false,
            ),
          );
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        rejectAcquire(
          new StudySessionError(
            "Không thể khóa phiên học giữa các tab. Bạn vẫn có thể dùng chế độ nghỉ.",
            false,
          ),
        );
      }
    }
  });
}
