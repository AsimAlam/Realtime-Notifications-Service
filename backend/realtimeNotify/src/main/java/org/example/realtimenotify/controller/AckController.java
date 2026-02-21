package org.example.realtimenotify.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.realtimenotify.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class AckController {
  private static final Logger log = LoggerFactory.getLogger(AckController.class);
  private final NotificationService notificationService;
  private final SimpMessagingTemplate template;
  private final ObjectMapper mapper = new ObjectMapper();

  public AckController(NotificationService notificationService, SimpMessagingTemplate template) {
    this.notificationService = notificationService;
    this.template = template;
  }

  public static class AckMessage {
    public Long notificationId;
    public Long seq;
    public String toUserId;
  }
}
