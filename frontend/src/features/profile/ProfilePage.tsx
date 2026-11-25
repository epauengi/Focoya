import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useBlocker } from "react-router";
import { ApiError, getSession, getSessionGeneration, subscribeSession } from "@/auth/session";
import { ProfileAvatar } from "./ProfileAvatar";
import { avatarChoices, profileUpdate, validateProfile, xpProgress, type ProfileUpdate, type UserProfile } from "./profile";
import { profileMutation, profileQuery } from "./profileQueries";
import "./profile.css";

const formatNumber = new Intl.NumberFormat("vi-VN").format;

function StudyProgress({ profile }: { profile: UserProfile }) {
  const { xpIntoLevel, xpRequiredForLevel, progress, remainingXp } = xpProgress(profile.totalXp, profile.level);
  return (
    <section className="profile-panel profile-study" aria-labelledby="profile-study-title">
      <h2 id="profile-study-title">Tiến độ học tập</h2>
      <div className="profile-xp">
        <div className="profile-xp-line">
          <h3>Cấp {formatNumber(profile.level)}</h3>
          <p><strong>{formatNumber(profile.totalXp)} XP</strong> tích lũy</p>
        </div>
        <progress aria-label="Tiến độ lên cấp tiếp theo" value={progress} max={100} />
        <div className="profile-xp-line profile-muted">
          <span>{formatNumber(Math.max(0, xpIntoLevel))} / {formatNumber(xpRequiredForLevel)} XP</span>
          <span>Còn {formatNumber(remainingXp)} XP lên cấp {formatNumber(profile.level + 1)}</span>
        </div>
      </div>
      <h3 className="profile-stats-title">Thống kê học tập</h3>
      <dl className="profile-stats">
        <div><dt>Chuỗi hiện tại</dt><dd>{formatNumber(profile.currentStreak)} ngày</dd></div>
        <div><dt>Chuỗi dài nhất</dt><dd>{formatNumber(profile.longestStreak)} ngày</dd></div>
        <div><dt>Tổng thời gian học</dt><dd>{formatNumber(profile.totalStudyHours)} giờ</dd></div>
        <div><dt>Huy hiệu đã mở khóa</dt><dd>{formatNumber(profile.badgesCount)}</dd></div>
      </dl>
    </section>
  );
}

function EditProfileForm({ profile, generation, onClose }: {
  profile: UserProfile;
  generation: number;
  onClose: (saved?: boolean) => void;
}) {
  const [initial] = useState(() => profileUpdate(profile));
  const [draft, setDraft] = useState<ProfileUpdate>(initial);
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const mutation = useMutation(profileMutation(profile.id, generation));
  const update = profileUpdate(draft);
  const dirty = update.displayName !== initial.displayName || update.bio !== initial.bio || update.avatarKey !== initial.avatarKey;
  const errors = submitted ? validateProfile(draft) : {};
  const bioLength = draft.bio?.length ?? 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && getSession().user?.id === profile.id && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (!saving.current && window.confirm("Bỏ các thay đổi chưa lưu?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = true; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving.current) return;
    setSubmitted(true);
    const invalid = validateProfile(draft);
    if (invalid.displayName || invalid.bio || invalid.avatarKey) {
      (invalid.displayName ? nameRef : invalid.bio ? bioRef : avatarRef).current?.focus();
      return;
    }
    saving.current = true;
    mutation.mutate(draft, {
      onSuccess: () => onClose(true),
      onSettled: () => { saving.current = false; },
    });
  }

  return (
    <form className="profile-form" onSubmit={save} noValidate aria-labelledby="profile-edit-title">
      <h3 id="profile-edit-title">Chỉnh sửa hồ sơ</h3>
      <fieldset className="profile-fields" disabled={mutation.isPending}>
        <div className="profile-field">
          <label htmlFor="profile-name">Tên hiển thị</label>
          <input id="profile-name" ref={nameRef} required autoComplete="nickname" value={draft.displayName}
            aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "profile-name-error" : undefined}
            onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
          {errors.displayName && <p className="profile-error" id="profile-name-error" role="alert">{errors.displayName}</p>}
        </div>
        <div className="profile-field">
          <div className="profile-xp-line">
            <label htmlFor="profile-bio">Giới thiệu <span className="profile-muted">(không bắt buộc)</span></label>
            <span className={bioLength > 200 ? "profile-error" : "profile-muted"} id="profile-bio-count">{bioLength}/200</span>
          </div>
          <textarea id="profile-bio" ref={bioRef} rows={3} value={draft.bio ?? ""} placeholder="Bạn thích học gì?"
            aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? "profile-bio-count profile-bio-error" : "profile-bio-count"}
            onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
          {errors.bio && <p className="profile-error" id="profile-bio-error" role="alert">{errors.bio}</p>}
        </div>
        <fieldset className="profile-avatars" aria-describedby={errors.avatarKey ? "profile-avatar-error" : undefined}>
          <legend>Ảnh đại diện</legend>
          <div className="profile-choices">
            {avatarChoices.map(({ key, label }) => (
              <label key={key} className="profile-choice" title={label}>
                <input className="rooms-sr-only" type="radio" name="profile-avatar" value={key} checked={draft.avatarKey === key}
                  onChange={() => setDraft({ ...draft, avatarKey: key })} />
                <ProfileAvatar avatarKey={key} />
                <span className="rooms-sr-only">{label}</span>
              </label>
            ))}
          </div>
          <label className="profile-default-avatar">
            <input type="radio" name="profile-avatar" ref={avatarRef} checked={draft.avatarKey === null}
              onChange={() => setDraft({ ...draft, avatarKey: null })} />
            Dùng chữ cái đầu tên
          </label>
          {errors.avatarKey && <p className="profile-error" id="profile-avatar-error" role="alert">{errors.avatarKey}</p>}
        </fieldset>
        <div className="profile-actions">
          <button className="rooms-button" disabled={!dirty} type="submit">Lưu thay đổi</button>
          <button className="profile-secondary" type="button" onClick={() => {
            if (!dirty || window.confirm("Bỏ các thay đổi chưa lưu?")) onClose();
          }}>Hủy</button>
        </div>
      </fieldset>
      <p className="profile-muted" role="status">{mutation.isPending ? "Đang lưu thay đổi…" : ""}</p>
      {mutation.isError && <p className="profile-error" role="alert">
        Không thể lưu hồ sơ. {mutation.error instanceof ApiError && mutation.error.status === 400
          ? "Kiểm tra lại thông tin rồi thử lại." : "Vui lòng thử lại."}
      </p>}
    </form>
  );
}

function ProfileOverview({ profile, generation }: { profile: UserProfile; generation: number }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const restoreFocus = useRef(false);
  return (
    <section className="profile-panel profile-overview" aria-labelledby="profile-overview-title">
      <div className="profile-cover" aria-hidden="true" />
      <div className="profile-identity">
        <ProfileAvatar className="profile-portrait" avatarKey={profile.avatarKey} displayName={profile.displayName} />
        <div className="profile-identity-line">
          <div>
            <h2 id="profile-overview-title">{profile.displayName}</h2>
            <p className="profile-muted">{profile.email}</p>
          </div>
          <span className="profile-level">Cấp {formatNumber(profile.level)}</span>
        </div>
        <div className="profile-bio">
          <h3>Giới thiệu</h3>
          <p className="profile-muted">{profile.bio?.trim() || "Chưa có giới thiệu. Hãy thêm vài dòng về bạn."}</p>
        </div>
        {editing ? (
          <EditProfileForm profile={profile} generation={generation} onClose={(updated) => {
            restoreFocus.current = true;
            setSaved(Boolean(updated));
            setEditing(false);
          }} />
        ) : (
          <button className="rooms-button" type="button" ref={(button) => {
            if (button && restoreFocus.current) {
              restoreFocus.current = false;
              button.focus();
            }
          }} onClick={() => { setSaved(false); setEditing(true); }}>Chỉnh sửa hồ sơ</button>
        )}
        <p className="profile-success" role="status">{saved ? "Đã lưu thay đổi hồ sơ." : ""}</p>
      </div>
    </section>
  );
}

export function ProfilePage() {
  const { user } = useSyncExternalStore(subscribeSession, getSession);
  const result = useQuery(profileQuery(user?.id));
  const generation = getSessionGeneration();
  return (
    <main className="rooms-container profile-page" id="room-main" tabIndex={-1} aria-labelledby="profile-title" aria-busy={result.isPending}>
      <header className="rooms-intro">
        <div><h1 id="profile-title">Hồ sơ của tôi</h1><p>Thông tin cá nhân và tiến độ học tập của bạn.</p></div>
      </header>
      {result.data ? (
        <div className="profile-grid">
          <ProfileOverview key={`${result.data.id}:${generation}`} profile={result.data} generation={generation} />
          <StudyProgress profile={result.data} />
        </div>
      ) : result.isPending ? (
        <div className="rooms-empty" role="status">Đang tải hồ sơ…</div>
      ) : (
        <section className="rooms-empty" aria-labelledby="profile-load-error">
          <h2 id="profile-load-error">Không thể tải hồ sơ</h2>
          <p>Kiểm tra kết nối rồi thử lại.</p>
          <button className="rooms-button" type="button" disabled={result.isFetching} onClick={() => { void result.refetch(); }}>
            {result.isFetching ? "Đang thử lại…" : "Thử lại"}
          </button>
        </section>
      )}
    </main>
  );
}
