package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.LoginRequest;
import com.lofi.studyroombackend.dto.request.RefreshTokenRequest;
import com.lofi.studyroombackend.dto.request.RegisterRequest;
import com.lofi.studyroombackend.dto.response.AuthResponse;
import com.lofi.studyroombackend.dto.response.UserResponse;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {

    // Sai email hay sai mật khẩu đều báo CÙNG 1 câu, để kẻ gian không dò được email nào đã đăng ký.
    private static final String WRONG_LOGIN_MESSAGE = "Email hoặc mật khẩu không đúng";
    private static final String WRONG_REFRESH_MESSAGE = "Refresh token không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    // Spring tự truyền 3 object này vào (dependency injection qua constructor).
    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        // Chuẩn hóa email: bỏ khoảng trắng, viết thường. "Tho@Gmail.com " và "tho@gmail.com" là 1 người.
        String email = request.getEmail().trim().toLowerCase();

        // 1. Email đã có người dùng -> 409 Conflict.
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        // 2. Tạo user mới. Mật khẩu chỉ lưu dạng hash BCrypt.
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(request.getDisplayName().trim());
        // role không set -> dùng mặc định USER trong entity.

        // 3. Lưu vào DB. Sau dòng này user mới có id (DB/Hibernate sinh UUID).
        user = userRepository.save(user);

        // 4. Đăng ký xong coi như đăng nhập luôn: trả về 2 token + thông tin user.
        return createAuthResponse(user);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // 1. Tìm user theo email. Không có -> 401.
        Optional<UserEntity> found = userRepository.findByEmail(email);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_LOGIN_MESSAGE);
        }
        UserEntity user = found.get();

        // 2. So mật khẩu: matches() lấy salt trong hash, hash lại mật khẩu vừa nhập rồi so sánh.
        //    KHÔNG dùng encode() rồi equals(): mỗi lần encode ra chuỗi khác nhau (salt mới).
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_LOGIN_MESSAGE);
        }

        // 3. Đúng -> trả về 2 token + thông tin user.
        return createAuthResponse(user);
    }

    @Override
    public AuthResponse refresh(RefreshTokenRequest request) {
        // 1. Đọc refresh token. Sai chữ ký / hết hạn (quá 7 ngày) -> 401, FE phải cho đăng nhập lại.
        Claims claims;
        try {
            claims = jwtTokenProvider.parseToken(request.getRefreshToken());
        } catch (JwtException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_REFRESH_MESSAGE);
        }

        // 2. Phải đúng là REFRESH token. Đưa access token vào đây -> từ chối.
        if (!JwtTokenProvider.TYPE_REFRESH.equals(claims.get("type"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_REFRESH_MESSAGE);
        }

        // 3. Lấy user mới nhất từ DB (role/email có thể đã đổi). User đã bị xóa -> 401.
        UUID userId = UUID.fromString(claims.getSubject());
        Optional<UserEntity> found = userRepository.findById(userId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, WRONG_REFRESH_MESSAGE);
        }

        // 4. Cấp cặp token mới (access mới 30 phút + refresh mới 7 ngày).
        return createAuthResponse(found.get());
    }

    // Dùng chung cho register, login, refresh.
    private AuthResponse createAuthResponse(UserEntity user) {
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);
        return new AuthResponse(accessToken, refreshToken, new UserResponse(user));
    }
}
