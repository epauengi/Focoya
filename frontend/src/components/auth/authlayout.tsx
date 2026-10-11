import React from "react";
import "@/styles/auth.css";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <main className="auth-container">
      <a href="/" className="auth-logo">
        Focoya
      </a>

      {/* Thẻ Card */}
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
};

export default AuthLayout;
