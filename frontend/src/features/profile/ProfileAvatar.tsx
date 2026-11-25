import { getAvatarKey } from "./profile";

const art = {
  "avatar-1": { ground: "#F5DDC9", ink: "#884532", path: "M5 10h12v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-4Zm12 1h2a2 2 0 0 1 0 4h-2M4 21h16M9 7V4m4 3V3" },
  "avatar-2": { ground: "#DAE3FF", ink: "#344D97", path: "M12 7c-2-2-5-3-9-2v13c4-1 7 0 9 2 2-2 5-3 9-2V5c-4-1-7 0-9 2Zm0 0v13M6 9c1.2 0 2.2.3 3 1m6 0c.8-.7 1.8-1 3-1M6 13c1.2 0 2.2.3 3 1m6 0c.8-.7 1.8-1 3-1" },
  "avatar-3": { ground: "#E6DFFD", ink: "#504183", path: "M18.5 15.5A8 8 0 0 1 9 5a8 8 0 1 0 9.5 10.5ZM17 3v6m-3-3h6m1 5v4m-2-2h4" },
  "avatar-4": { ground: "#F8E6BC", ink: "#805119", path: "M18 4c-8 0-12 3-12 8 0 4 3 6 6 5 5-1 7-6 6-13ZM4 21c2-6 6-9 10-12m-4 4 4 1" },
  "avatar-5": { ground: "#D8ECFA", ink: "#2D5878", path: "M6 14a4 4 0 0 1-1-7.9 5.5 5.5 0 0 1 10.5-.4A4.2 4.2 0 1 1 18 14H6Zm2 3-1 2m6-2-1.5 3m6-3-1 2" },
  "avatar-6": { ground: "#F7D9E3", ink: "#8B405C", path: "M3 13 7 5h6l4 8H3Zm7 0v6m-5 1h10m-.5-9V9m5 5 2-1m-3 4 1.5 2" },
  "avatar-7": { ground: "#D3EDEA", ink: "#245F60", path: "M3 14c5 0 6-7 11-7 3 0 4.5 1.5 5 3.5-4-1.5-5 2-2 3.5 1.5.7 3 .5 4.5 0M3 19c3 1.7 6 1.7 9 0 3 1.7 6 1.7 9 0M5 7h2m-1-1v2" },
  "avatar-8": { ground: "#E2EDCF", ink: "#4C642E", path: "M12 17v-5c0-4 3-6 7-6 0 5-2.5 7-7 7-4 0-7-2-7-6 4 0 6.5 2 7 5m-6 6h12m-11 0 1 3h8l1-3" },
};

export function ProfileAvatar({ avatarKey, displayName = "", className }: {
  avatarKey: string | null | undefined;
  displayName?: string;
  className?: string;
}) {
  const key = getAvatarKey(avatarKey);
  if (!key) {
    const initials = Array.from(displayName.trim()).slice(0, 2).join("").toLocaleUpperCase("vi");
    return <span className={className} aria-hidden="true">{initials || "?"}</span>;
  }
  const { ground, ink, path } = art[key];
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" fill={ground} />
      <path d={path} transform="translate(12 12)" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
