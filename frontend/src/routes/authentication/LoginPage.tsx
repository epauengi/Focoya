import React, { useState } from "react";
import { useNavigate } from "react-router";
import { startDemoSession } from "@/auth/demoSession";
import { AuthLayout } from "../../components/auth/authlayout";
import { InputField } from "../../components/auth/inputfield";
import { PrimaryButton } from "../../components/auth/primarybutton";
import { Checkbox } from "../../components/auth/checkbox";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Kiểm tra trạng thái Empty state
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ Email và Mật khẩu!");
      return;
    }

    // Trạng thái Loading state
    setIsLoading(true);
    setTimeout(() => {
      startDemoSession();
      setIsLoading(false);
      navigate("/dashboard");
    }, 1500);
  };

  return (
    <AuthLayout
      title="Chào mừng trở lại!"
      subtitle="Đăng nhập tài khoản vào Focoya"
    >
      {/* Nút đăng nhập Google */}
      <button type="button" className="auth-btn-google" disabled={isLoading}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.3 7.22 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.24c-.25-.72-.39-1.5-.39-2.24s.14-1.52.39-2.24V6.61H1.18C.43 8.13 0 9.85 0 12s.43 3.87 1.18 5.39l4.09-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.15 2.7 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
          />
        </svg>
        <span>Google</span>
      </button>

      <div className="auth-divider">
        <span>HOẶC</span>
      </div>

      {/* Trạng thái Error state */}
      {errorMessage && <div className="auth-error-alert">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <InputField
          label="Email"
          id="email"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />

        <InputField
          label="Mật khẩu"
          id="password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <Checkbox
            label="Ghi nhớ"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
          />
          <a href="/forgot-password" className="auth-link">
            Quên mật khẩu?
          </a>
        </div>

        <PrimaryButton type="submit" disabled={isLoading}>
          {isLoading ? "Đang xử lý..." : "Đăng nhập"}
        </PrimaryButton>

        <p className="auth-footer-text">
          Chưa có tài khoản?{" "}
          <a href="/register" className="auth-link">
            Tạo tài khoản
          </a>
        </p>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
