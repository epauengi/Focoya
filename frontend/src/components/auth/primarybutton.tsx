import React from "react";
import "@/styles/auth.css";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  ...props
}) => {
  return (
    <button className="auth-primary-btn" {...props}>
      {children}
    </button>   
  );
};

export default PrimaryButton;
