import { useEffect, useSyncExternalStore } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { ensureSession, getSession, logout, refreshSession, sessionRefreshDelay, subscribeSession } from "./session";

export function ProtectedRoute() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const location = useLocation();

  useEffect(() => {
    void ensureSession();
    const restoreOnFocus = () => { void ensureSession(); };
    window.addEventListener("focus", restoreOnFocus);
    return () => window.removeEventListener("focus", restoreOnFocus);
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    const timer = window.setTimeout(() => { void refreshSession(); }, sessionRefreshDelay());
    return () => window.clearTimeout(timer);
  }, [session]);

  if (session.status === "loading") return <p role="status">Đang khôi phục phiên đăng nhập...</p>;
  if (session.status === "error") return (
    <div role="alert">
      <p>{session.error}</p>
      <button onClick={() => { void refreshSession(); }}>Thử lại</button>{" "}
      <button onClick={logout}>Đăng nhập lại</button>
    </div>
  );
  if (session.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
