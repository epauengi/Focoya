import React from "react";
import "@/styles/auth.css";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, id, ...props }) => {
  return (
    <label className="auth-checkbox-label" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        className="auth-checkbox-input"
        {...props}
      />
      {label}
    </label>
  );
};

export default Checkbox;
