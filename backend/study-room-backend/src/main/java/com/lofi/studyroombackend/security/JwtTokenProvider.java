package com.lofi.studyroombackend.security;

import com.lofi.studyroombackend.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.JwtParserBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

// Tạo và kiểm tra JWT. Không đụng DB: mọi thông tin cần thiết nằm trong token.
@Component
public class JwtTokenProvider {

    // Giá trị claim "type" để phân biệt 2 loại token.
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKey key;
    private final JwtParser parser;
    private final long accessTokenMinutes;
    private final long refreshTokenDays;

    // @Value lấy giá trị từ application.yml (mục jwt).
    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                            @Value("${jwt.access-token-minutes}") long accessTokenMinutes,
                            @Value("${jwt.refresh-token-days}") long refreshTokenDays) {
        // Biến chuỗi secret thành khóa HMAC-SHA256. Chuỗi ngắn hơn 32 byte sẽ báo lỗi ngay khi app khởi động.
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenMinutes = accessTokenMinutes;
        this.refreshTokenDays = refreshTokenDays;

        // Tạo sẵn "máy đọc token" 1 lần, dùng lại cho mọi request.
        JwtParserBuilder parserBuilder = Jwts.parser();
        parserBuilder.verifyWith(key);
        this.parser = parserBuilder.build();
    }

    // Access token: gửi kèm mọi request, sống ngắn (30 phút).
    public String generateAccessToken(UserEntity user) {
        Instant expiresAt = Instant.now().plus(accessTokenMinutes, ChronoUnit.MINUTES);
        return createToken(user, TYPE_ACCESS, expiresAt);
    }

    // Refresh token: chỉ dùng để xin access token mới, sống lâu (7 ngày).
    public String generateRefreshToken(UserEntity user) {
        Instant expiresAt = Instant.now().plus(refreshTokenDays, ChronoUnit.DAYS);
        return createToken(user, TYPE_REFRESH, expiresAt);
    }

    // Đọc token và trả về phần payload (claims).
    // Ném JwtException nếu token sai chữ ký, sai định dạng, hoặc đã hết hạn (ExpiredJwtException).
    public Claims parseToken(String token) {
        return parser.parseSignedClaims(token).getPayload();
    }

    private String createToken(UserEntity user, String type, Instant expiresAt) {
        // jjwt bắt buộc dùng builder để tạo token, nên tách từng dòng cho dễ đọc.
        JwtBuilder builder = Jwts.builder();
        builder.subject(user.getId().toString());     // "sub": token này của user nào
        builder.claim("email", user.getEmail());
        builder.claim("role", user.getRole().name());
        builder.claim("type", type);                   // access hay refresh
        builder.issuedAt(new Date());                  // "iat": thời điểm tạo
        builder.expiration(Date.from(expiresAt));      // "exp": hết hạn lúc nào
        builder.signWith(key, Jwts.SIG.HS256);         // ký bằng secret, thuật toán HMAC-SHA256
        return builder.compact();                      // ghép thành chuỗi xxxxx.yyyyy.zzzzz
    }
}
