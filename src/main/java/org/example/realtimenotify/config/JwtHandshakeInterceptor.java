package org.example.realtimenotify.config;


import org.example.realtimenotify.service.JwtService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;


import java.util.List;
import java.util.Map;


public class JwtHandshakeInterceptor implements HandshakeInterceptor {


    private final JwtService jwtService = new JwtService(); // simple service


    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        List<String> auth = request.getHeaders().get(HttpHeaders.AUTHORIZATION);
        if (auth == null || auth.isEmpty()) {
            return false;
        }
        String token = auth.get(0).replace("Bearer ", "");
        String username = jwtService.validateAndGetUsername(token);
        if (username == null) return false;
        attributes.put("username", username);
        return true;
    }


    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
}
