import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { ApiError, apiRequest, getSession, getSessionGeneration } from "../../auth/session";
import { parseProfile, profileUpdate, validateProfile, type ProfileUpdate } from "./profile";

const profileKey = (userId: string | undefined) => ["profile", userId] as const;
const isCurrent = (userId: string, generation: number) =>
  getSession().user?.id === userId && getSessionGeneration() === generation;

async function requestProfile(userId: string, generation: number, init?: RequestInit) {
  const requireCurrent = () => {
    if (!isCurrent(userId, generation)) throw new ApiError(401, "Vui lòng đăng nhập lại.");
  };
  requireCurrent();
  const profile = parseProfile(await (await apiRequest("/users/me", init, userId)).json());
  requireCurrent();
  if (profile.id !== userId) throw new Error("Dữ liệu hồ sơ không khớp với tài khoản.");
  return profile;
}

export function profileQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: profileKey(userId),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => {
      if (!userId) throw new ApiError(401, "Vui lòng đăng nhập lại.");
      return requestProfile(userId, getSessionGeneration(), { signal });
    },
  });
}

export function profileMutation(userId: string, generation: number) {
  return mutationOptions({
    mutationFn: (draft: ProfileUpdate) => {
      const errors = validateProfile(draft);
      const firstError = Object.values(errors)[0];
      if (firstError) throw new Error(firstError);
      return requestProfile(userId, generation, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileUpdate(draft)),
      });
    },
    onSuccess: async (profile, _draft, _result, { client }) => {
      if (!isCurrent(userId, generation)) return;
      const queryKey = profileKey(userId);
      await client.cancelQueries({ queryKey, exact: true });
      if (isCurrent(userId, generation)) client.setQueryData(queryKey, profile);
    },
  });
}
