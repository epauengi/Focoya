package com.lofi.studyroombackend.config;

import com.lofi.studyroombackend.realtime.StompSecurityInterceptor;
import com.lofi.studyroombackend.realtime.OutboundPresenceGuard;
import com.lofi.studyroombackend.realtime.SanitizedStompErrorHandler;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final StompSecurityInterceptor securityInterceptor;
    private final OutboundPresenceGuard outboundPresenceGuard;
    private final ThreadPoolTaskScheduler heartbeatScheduler;
    private final String allowedOrigin;
    private final SanitizedStompErrorHandler errorHandler;

    public WebSocketConfig(StompSecurityInterceptor securityInterceptor,
                           OutboundPresenceGuard outboundPresenceGuard,
                           @Qualifier("webSocketHeartbeatScheduler") ThreadPoolTaskScheduler heartbeatScheduler,
                           @Value("${cors.allowed-origin}") String allowedOrigin,
                           SanitizedStompErrorHandler errorHandler) {
        this.securityInterceptor = securityInterceptor;
        this.outboundPresenceGuard = outboundPresenceGuard;
        this.heartbeatScheduler = heartbeatScheduler;
        this.allowedOrigin = allowedOrigin;
        this.errorHandler = errorHandler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-room").setAllowedOrigins(allowedOrigin);
        registry.setPreserveReceiveOrder(true);
        registry.setErrorHandler(errorHandler);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10_000, 10_000})
                .setTaskScheduler(heartbeatScheduler);
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(securityInterceptor);
        registration.taskExecutor().corePoolSize(1).maxPoolSize(1);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(outboundPresenceGuard);
    }

    @org.springframework.context.annotation.Bean
    public static ThreadPoolTaskScheduler webSocketHeartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.setRemoveOnCancelPolicy(true);
        return scheduler;
    }
}
