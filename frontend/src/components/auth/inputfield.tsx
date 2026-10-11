import React, { useState } from "react";
import "@/styles/auth.css";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  id,
  type = "text",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="auth-form-group">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className={isPassword ? "auth-password-wrapper" : ""}>
        <input
          id={id}
          type={isPassword && showPassword ? "text" : type}
          className="auth-input"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
          >
            {showPassword ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#767685"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4C4 4 7.20775 8 13.165 8C19.1222 8 22.33 4 22.33 4M5.833 5.645L4 8M22.33 8L20.5007 5.648M10.3367 7.68L9.499 10.5M15.9722 7.688L16.831 10.5"
                  stroke="#767685"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default InputField;
