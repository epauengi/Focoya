package com.lofi.studyroombackend.config;

import com.lofi.studyroombackend.security.JwtAuthenticationFilter;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final String allowedOrigin;

    public SecurityConfig(JwtTokenProvider jwtTokenProvider,
                          @Value("${cors.allowed-origin}") String allowedOrigin) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.allowedOrigin = allowedOrigin;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // CORS: cho phép trang FE (khác port) gọi API. Cấu hình chi tiết ở hàm corsConfigurationSource() bên dưới.
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()));

        // Tắt CSRF: API dùng JWT trong header, không dùng cookie session nên không bị CSRF.
        http.csrf(csrf -> csrf.disable());

        // STATELESS: server không tạo/giữ session. Mỗi request tự mang token để chứng minh mình là ai.
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // Luật "URL nào cần gì". Spring đọc từ trên xuống, gặp luật khớp đầu tiên thì dùng.
        http.authorizeHttpRequests(auth -> {
            // Đăng ký, đăng nhập, refresh: chưa có token nên phải mở.
            auth.requestMatchers("/api/auth/**").permitAll();
            // Explore + Preview: khách chưa đăng nhập vẫn xem được phòng (giống FE). Chỉ mở GET.
            // "/api/rooms/{roomId}" chỉ khớp đúng 1 đoạn sau /rooms, nên /api/rooms/join/{code} vẫn cần đăng nhập.
            auth.requestMatchers(HttpMethod.GET, "/api/rooms", "/api/rooms/{roomId}").permitAll();
            // File hợp đồng API của Tiên + Swagger UI (sau này).
            auth.requestMatchers("/openapi.yaml", "/swagger-ui/**", "/v3/api-docs/**").permitAll();
            // Spring chuyển lỗi (400, 409...) sang /error để trả JSON. Không mở thì mọi lỗi đều biến thành 401.
            auth.requestMatchers("/error").permitAll();
            // Còn lại: phải đăng nhập. Luật này phải nằm CUỐI.
            auth.anyRequest().authenticated();
        });

        // Chưa đăng nhập mà gọi API cần bảo vệ -> trả 401 dạng JSON.
        // (Không cấu hình thì Spring mặc định trả 403, sai yêu cầu của Excel.)
        http.exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
            response.setStatus(401);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":401,\"message\":\"Bạn chưa đăng nhập hoặc token không hợp lệ\"}");
        }));

        // Chen filter đọc JWT vào dãy filter, đứng TRƯỚC filter đăng nhập mặc định của Spring.
        http.addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Dùng để mã hóa mật khẩu khi đăng ký và so mật khẩu khi đăng nhập.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // CORS: trình duyệt chỉ cho trang ở origin này đọc response của API.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigin));                                  // trang FE, ví dụ http://localhost:5174
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));                // FE được gửi 2 header này

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);                                   // áp dụng cho mọi URL
        return source;
    }
}
