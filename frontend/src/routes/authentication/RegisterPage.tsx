import React, { useState } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '@/components/auth/authlayout';
import { InputField } from '@/components/auth/inputfield';
import { Checkbox } from '@/components/auth/checkbox';
import { PrimaryButton } from '@/components/auth/primarybutton';
import '@/styles/auth.css';

export const RegisterPage: React.FC = () => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (!formData.agreeTerms) {
      setError('Vui lòng đồng ý với điều khoản dịch vụ.');
      return;
    }

    setIsLoading(true);
    // Giả lập gọi API đăng ký
    setTimeout(() => {
      setIsLoading(false);
      alert('Đăng ký tài khoản thành công!');
    }, 1000);
  };

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Tham gia Focoya ngay hôm nay">
      {error && <div className="auth-error-alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <InputField
          label="Họ và tên"
          id="name"
          type="text"
          placeholder="Nguyễn Văn A"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <InputField
          label="Email"
          id="email"
          type="email"
          placeholder="example@gmail.com"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <InputField
          label="Mật khẩu"
          id="password"
          type="password"
          placeholder="••••••••••••"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <InputField
          label="Xác nhận mật khẩu"
          id="confirmPassword"
          type="password"
          placeholder="••••••••••••"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />

        <div style={{ margin: '16px 0' }}>
          <Checkbox
            label="Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật"
            id="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
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