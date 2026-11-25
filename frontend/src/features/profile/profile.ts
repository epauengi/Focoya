export type ProfileUpdate = {
  displayName: string;
  bio: string | null;
  avatarKey: string | null;
};

export type UserProfile = ProfileUpdate & {
  id: string;
  email: string;
  role: string;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyHours: number;
  badgesCount: number;
};

export function parseProfile(value: unknown): UserProfile {
  const invalid = () => new Error("Dữ liệu hồ sơ không hợp lệ.");
  if (!value || typeof value !== "object") throw invalid();
  const data = value as Record<string, unknown>;
  const text = (key: string) => {
    const field = data[key];
    if (typeof field !== "string" || !field.trim()) throw invalid();
    return field;
  };
  const optional = (key: string) => {
    const field = data[key];
    if (field !== null && typeof field !== "string") throw invalid();
    return field;
  };
  const number = (key: string, minimum = 0, integer = true) => {
    const field = data[key];
    if (typeof field !== "number" || !Number.isFinite(field) || field < minimum || (integer && !Number.isSafeInteger(field))) throw invalid();
    return field;
  };
  return {
    id: text("id"), email: text("email"), role: text("role"), displayName: text("displayName"),
    bio: optional("bio"), avatarKey: optional("avatarKey"),
    totalXp: number("totalXp"), level: number("level", 1), currentStreak: number("currentStreak"),
    longestStreak: number("longestStreak"), totalStudyHours: number("totalStudyHours", 0, false),
    badgesCount: number("badgesCount"),
  };
}

export function profileUpdate(draft: ProfileUpdate): ProfileUpdate {
  return {
    displayName: draft.displayName.trim(),
    bio: draft.bio?.trim() || null,
    avatarKey: draft.avatarKey?.trim() || null,
  };
}

export function validateProfile(draft: ProfileUpdate) {
  const errors: Partial<Record<keyof ProfileUpdate, string>> = {};
  const length = draft.displayName.trim().length;
  if (length < 2 || length > 50) errors.displayName = "Tên hiển thị phải có từ 2 đến 50 ký tự.";
  if ((draft.bio?.length ?? 0) > 200) errors.bio = "Giới thiệu không được vượt quá 200 ký tự.";
  if ((draft.avatarKey?.length ?? 0) > 50) errors.avatarKey = "Ảnh đại diện không hợp lệ. Hãy chọn ảnh khác.";
  return errors;
}

export const avatarChoices = [
  { key: "avatar-1", label: "Tách cà phê" },
  { key: "avatar-2", label: "Sách mở" },
  { key: "avatar-3", label: "Trăng đêm" },
  { key: "avatar-4", label: "Lá mùa thu" },
  { key: "avatar-5", label: "Mây mưa" },
  { key: "avatar-6", label: "Đèn bàn" },
  { key: "avatar-7", label: "Sóng biển" },
  { key: "avatar-8", label: "Hạt mầm" },
] as const;

export function getAvatarKey(value: string | null | undefined) {
  return avatarChoices.find(({ key }) => key === value)?.key ?? null;
}

export function xpProgress(totalXp: number, level: number) {
  const currentThreshold = 100 * (level - 1) ** 2;
  const nextThreshold = 100 * level ** 2;
  const xpIntoLevel = totalXp - currentThreshold;
  const xpRequiredForLevel = nextThreshold - currentThreshold;
  return {
    xpIntoLevel,
    xpRequiredForLevel,
    progress: Math.min(100, Math.max(0, xpIntoLevel / xpRequiredForLevel * 100)),
    remainingXp: Math.max(0, nextThreshold - totalXp),
  };
}
