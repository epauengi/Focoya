import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router";
import { endDemoSession, isDemoAuthenticated } from "@/auth/demoSession";
import { RoomSettings, type SettingsTab } from "./RoomSettings";
import "./rooms.css";

type RoomPreferences = {
  wallpaper: string;
  displayName: string;
  notifications: boolean;
  autoStart: boolean;
  openSettings: (tab?: SettingsTab) => void;
  notify: (message: string) => void;
};

export function useRoomPreferences() {
  return useOutletContext<RoomPreferences>();
}

export function RoomsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [wallpaper, setWallpaper] = useState("");
  const [displayName, setDisplayName] = useState("SE347");
  const [notifications, setNotifications] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [settings, setSettings] = useState<SettingsTab | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const inFocusRoom = /^\/rooms\/[^/]+\/?$/.test(pathname);
  const authenticated = isDemoAuthenticated();

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      } else if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) {
        menu.current.open = false;
      }
    }
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  function openSettings(tab: SettingsTab = "theme") {
    if (menu.current?.open) {
      menu.current.querySelector("summary")?.focus();
      menu.current.open = false;
    }
    setSettings(tab);
  }

  const closeSettings = useCallback(() => setSettings(null), []);

  function signOut() {
    endDemoSession();
    navigate("/");
  }

  return (
    <div className={`rooms-shell${inFocusRoom ? " rooms-shell--focus" : ""}`}>
      <a className="rooms-skip" href="#room-main">Đến nội dung chính</a>
      {!inFocusRoom && <header className="rooms-header">
        <Link to="/" className="rooms-brand" aria-label="Focoya — Trang chủ">Focoya</Link>
        <nav className="rooms-nav" aria-label="Điều hướng phòng học">
          <Link to="/">Home</Link>
          <NavLink to="/rooms">Explore</NavLink>
          <NavLink to="/my-rooms">My Rooms</NavLink>
        </nav>
        <div className="rooms-account-wrap">
          {!authenticated && <Link className="rooms-login" to="/login">Đăng nhập</Link>}
          <details className="rooms-account" ref={menu}>
            <summary aria-label="Mở tài khoản và cài đặt"><span className="rooms-avatar">{displayName.slice(0, 2).toUpperCase()}</span><b>{displayName}</b></summary>
            <div className="rooms-account-menu">
              <strong>{displayName}</strong>
              <small>{authenticated ? "Phiên đăng nhập demo" : "Khách · Chế độ demo"}</small>
              <Link to="/my-rooms" onClick={() => { if (menu.current) menu.current.open = false; }}>My Rooms</Link>
              <button onClick={() => openSettings("theme")}>Cài đặt</button>
              <button onClick={() => openSettings("stats")}>Thống kê</button>
              <button onClick={() => openSettings("account")}>Tài khoản</button>
              <button onClick={() => openSettings("help")}>Trợ giúp</button>
              {authenticated ? <button className="rooms-danger" onClick={signOut}>Đăng xuất</button> : <Link to="/login">Đăng nhập</Link>}
            </div>
          </details>
        </div>
      </header>}
      <Outlet context={{ wallpaper, displayName, notifications, autoStart, openSettings, notify } satisfies RoomPreferences} />
      {settings !== null && <RoomSettings
        initialTab={settings}
        wallpaper={wallpaper}
        onWallpaperChange={setWallpaper}
        notifications={notifications}
        onNotificationsChange={setNotifications}
        autoStart={autoStart}
        onAutoStartChange={setAutoStart}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onClose={closeSettings}
        onSignOut={signOut}
        notify={notify}
      />}
      <div className="rooms-toast" role="status" aria-live="polite" hidden={!toast}>{toast}</div>
    </div>
  );
}
