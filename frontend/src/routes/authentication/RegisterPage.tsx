import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { register } from '@/auth/session';
import { AuthLayout } from '@/components/auth/authlayout';
import { InputField } from '@/components/auth/inputfield';
import { Checkbox } from '@/components/auth/checkbox';
import { PrimaryButton } from '@/components/auth/primarybutton';
import '@/styles/auth.css';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.name.trim().length < 2 || formData.name.trim().length > 50) {
      setError('Họ và tên phải từ 2 đến 50 ký tự.');
      return;
    }
    if (formData.password.length < 8 || formData.password.length > 72 || !/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError('Mật khẩu phải từ 8 đến 72 ký tự, gồm ít nhất một chữ cái và một chữ số.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (!formData.agreeTerms) {
      setError('Vui lòng đồng ý với điều khoản dịch vụ.');
      return;
    }

    setIsLoading(true);
    try {
      await register(formData.name, formData.email, formData.password);
      navigate('/login', { replace: true, state: { registered: true, email: formData.email.trim() } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Tham gia Focoya ngay hôm nay">
      {error && <div className="auth-error-alert" role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <InputField
          label="Họ và tên"
          id="name"
          type="text"
          placeholder="Nguyễn Văn A"
          value={formData.name}
          onChange={handleChange}
          disabled={isLoading}
          required
        />

        <InputField
          label="Email"
          id="email"
          type="email"
          placeholder="example@gmail.com"
          value={formData.email}
          onChange={handleChange}
          disabled={isLoading}
          required
        />

        <InputField
          label="Mật khẩu"
          id="password"
          type="password"
          placeholder="••••••••••••"
          value={formData.password}
          onChange={handleChange}
          disabled={isLoading}
          required
        />

        <InputField
          label="Xác nhận mật khẩu"
          id="confirmPassword"
          type="password"
          placeholder="••••••••••••"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={isLoading}
          required
        />

        <div style={{ margin: '16px 0' }}>
          <Checkbox
            label="Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật"
            id="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        <PrimaryButton type="submit" disabled={isLoading}>
          {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
        </PrimaryButton>
      </form>

      <div className="auth-footer-text">
        Đã có tài khoản?{' '}
        <Link to="/login" className="auth-link">
          Đăng nhập
        </Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;