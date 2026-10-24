package com.lofi.studyroombackend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

// "Trạm gác" chạy ở MỌI request, trước controller.
// Việc duy nhất: nếu request có access token hợp lệ thì ghi "đây là user X" vào SecurityContext.
// Filter này KHÔNG tự trả 401. Ai được vào URL nào là do luật trong SecurityConfig quyết định.
// Không gắn @Component: SecurityConfig tự new filter này (tránh Spring đăng ký filter 2 lần).
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // 1. Lấy header. FE gửi dạng: Authorization: Bearer eyJhbGciOi...
        String header = request.getHeader("Authorization");

        // 2. Không có token -> cho đi tiếp như khách (chưa đăng nhập).
        //    Route public (/api/auth/**) vẫn vào được, route cần đăng nhập sẽ bị 401 ở bước sau.
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Cắt bỏ chữ "Bearer " (7 ký tự) để lấy token.
        String token = header.substring(7);

        try {
            // 4. Kiểm tra chữ ký + hạn dùng. Sai -> ném JwtException (nhảy xuống catch).
            Claims claims = jwtTokenProvider.parseToken(token);

            // 5. Chỉ nhận ACCESS token. Refresh token không được dùng để gọi API.
            if (JwtTokenProvider.TYPE_ACCESS.equals(claims.get("type"))) {
                UUID userId = UUID.fromString(claims.getSubject());
                String role = claims.get("role", String.class);

                // Spring quy ước quyền có tiền tố "ROLE_", ví dụ ROLE_USER.
                List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));

                // 6. Tạo "thẻ ra vào": principal = userId, không cần mật khẩu (null), kèm quyền.
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userId, null, authorities);

                // 7. Ghi vào SecurityContext. Từ giờ tới hết request, Spring biết đây là user nào.
                //    Controller lấy ra bằng @AuthenticationPrincipal UUID userId.
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (JwtException | IllegalArgumentException e) {
            // Token sai chữ ký / hết hạn / sai định dạng: không ghi gì -> coi như chưa đăng nhập.
        }

        // 8. Luôn cho request đi tiếp tới filter sau (và cuối cùng là controller).
        filterChain.doFilter(request, response);
    }
}
