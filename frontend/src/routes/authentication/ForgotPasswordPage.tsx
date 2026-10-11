import React, { useState } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '@/components/auth/authlayout';
import { InputField } from '@/components/auth/inputfield';
import { PrimaryButton } from '@/components/auth/primarybutton';
import '@/styles/auth.css';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1000);
  };

  return (
    <AuthLayout 
      title="Quên mật khẩu?" 
      subtitle="Đừng lo lắng, chúng tôi sẽ gửi hướng dẫn khôi phục cho bạn."
    >
      {error && <div className="auth-error-alert">{error}</div>}

      {isSubmitted ? (
        <div className="auth-success-container">
          <div className="auth-success-message">
            Email hướng dẫn đặt lại mật khẩu đã được gửi đến <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến của bạn!
          </div>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <PrimaryButton type="button">
              Quay lại đăng nhập
            </PrimaryButton>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="auth-form-spacing">
            <InputField
              label="Email"
              id="email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <PrimaryButton type="submit" disabled={isLoading}>
            {isLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </PrimaryButton>

          <div className="auth-footer-text">
            Nhớ mật khẩu?{' '}
            <Link to="/login" className="auth-link">
              Đăng nhập ngay
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;