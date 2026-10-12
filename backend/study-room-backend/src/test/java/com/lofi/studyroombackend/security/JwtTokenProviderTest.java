package com.lofi.studyroombackend.security;

import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

// Unit test thuần: không chạy Spring, không cần DB. Tự new JwtTokenProvider với giá trị test.
class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-key-for-unit-test-at-least-32-bytes";

    private UserEntity createUser() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("tho@example.com");
        user.setRole(UserRole.USER);
        return user;
    }

    @Test
    void accessToken_parseBackCorrectInfo() {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 30, 7);
        UserEntity user = createUser();

        String token = provider.generateAccessToken(user);
        Claims claims = provider.parseToken(token);

        assertEquals(user.getId().toString(), claims.getSubject());
        assertEquals("tho@example.com", claims.get("email"));
        assertEquals("USER", claims.get("role"));
        assertEquals(JwtTokenProvider.TYPE_ACCESS, claims.get("type"));
    }

    @Test
    void refreshToken_hasTypeRefresh() {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 30, 7);

        String token = provider.generateRefreshToken(createUser());

        assertEquals(JwtTokenProvider.TYPE_REFRESH, provider.parseToken(token).get("type"));
    }

    @Test
    void tokenSignedWithOtherSecret_isRejected() {
        // Kẻ gian tự tạo token bằng secret khác -> server phải từ chối.
        JwtTokenProvider hacker = new JwtTokenProvider("another-secret-key-that-the-server-does-not-know", 30, 7);
        JwtTokenProvider server = new JwtTokenProvider(SECRET, 30, 7);

        String fakeToken = hacker.generateAccessToken(createUser());

        assertThrows(JwtException.class, () -> server.parseToken(fakeToken));
    }

    @Test
    void editedToken_isRejected() {
        // Sửa 1 ký tự ở giữa phần payload (giả vờ đổi nội dung, ví dụ đổi role) -> chữ ký không còn khớp.
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 30, 7);
        String token = provider.generateAccessToken(createUser());

        String[] parts = token.split("\\.");   // [header, payload, signature]
        String payload = parts[1];
        int middle = payload.length() / 2;
        char changed = (payload.charAt(middle) == 'A') ? 'B' : 'A';
        String editedPayload = payload.substring(0, middle) + changed + payload.substring(middle + 1);
        String editedToken = parts[0] + "." + editedPayload + "." + parts[2];

        assertThrows(JwtException.class, () -> provider.parseToken(editedToken));
    }

    @Test
    void expiredToken_isRejected() {
        // Mẹo: hạn -1 phút -> token vừa tạo ra đã hết hạn.
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, -1, 7);

        String token = provider.generateAccessToken(createUser());

        assertThrows(ExpiredJwtException.class, () -> provider.parseToken(token));
    }
}
