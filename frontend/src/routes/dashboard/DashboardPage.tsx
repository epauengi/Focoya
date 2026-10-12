import { useNavigate } from "react-router";
import { endDemoSession } from "@/auth/demoSession";

export function DashboardPage() {
  const navigate = useNavigate();

  function signOut() {
    endDemoSession();
    navigate("/");
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold text-[var(--color-text)]">
        Chào mừng đến Focoya
      </h1>
      <p className="mt-3 text-[var(--color-text-muted)]">
        Dashboard đang được xây dựng. Đây là phiên đăng nhập demo.
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={signOut}>
        Đăng xuất
      </button>
    </main>
  );
}