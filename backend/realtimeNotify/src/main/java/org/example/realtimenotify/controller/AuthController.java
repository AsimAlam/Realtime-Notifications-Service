package org.example.realtimenotify.controller;

import java.util.Map;
import org.example.realtimenotify.service.JwtService;
import org.example.realtimenotify.service.PresenceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthController {

  private final JwtService jwtService;
  private final PresenceService presenceService;

  public AuthController(JwtService jwtService, PresenceService presenceService) {
    this.jwtService = jwtService;
    this.presenceService = presenceService;
  }

  @GetMapping("/auth/token")
  public ResponseEntity<Map<String, String>> token(@RequestParam String username) {
    if (username == null || username.trim().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is required");
    }

    String normalized = username.trim();

    if (normalized.length() < 3 || normalized.length() > 30) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username length must be 3..30");
    }

    if (presenceService.isOnline(normalized)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "username already in use");
    }

    String token = jwtService.generateToken(normalized);

    return ResponseEntity.ok(Map.of("token", token));
  }
}
