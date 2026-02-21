package org.example.realtimenotify.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import org.example.realtimenotify.model.Notification;
import org.example.realtimenotify.service.NotificationService;
import org.example.realtimenotify.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class MessagingController {

  private static final Logger log = LoggerFactory.getLogger(MessagingController.class);

  private final NotificationService notificationService;
  private final PresenceService presenceService;
  private final SimpMessagingTemplate template;
  private final ObjectMapper mapper = new ObjectMapper();

  public MessagingController(
      NotificationService notificationService,
      PresenceService presenceService,
      SimpMessagingTemplate template) {
    this.notificationService = notificationService;
    this.presenceService = presenceService;
    this.template = template;
  }

  public static class ClientMessage {
    public String toUserId;
    public String content;
  }

  public static class AckMessage {
    public Long notificationId;
    public Long seq;
    public String toUserId;
  }

  public static class RecoverMessage {
    public Long lastSeenSeq;
  }

  @MessageMapping("/send")
  public void handleSend(@Payload ClientMessage msg, Principal principal) {
    String from = principal != null ? principal.getName() : "anonymous";
    String to = msg.toUserId;
    String content = msg.content;
    log.info("STOMP /send from={} to={} content={}", from, to, content);

    try {
      Map<String, Object> payloadMap = new HashMap<>();
      payloadMap.put("from", from);
      payloadMap.put("content", content);
      String payloadJson = mapper.writeValueAsString(payloadMap);

      Notification n = notificationService.saveNotification(to, payloadJson);

      template.convertAndSendToUser(to, "/queue/notifications", n);
      log.info("Delivered notification id={} to user={}", n.getId(), to);
    } catch (Exception ex) {
      log.error("handleSend failed", ex);
    }
  }

  @MessageMapping("/ack")
  public void handleAck(@Payload AckMessage ack) {
    if (ack == null || ack.notificationId == null) {
      log.warn("ACK without id: {}", ack);
      return;
    }
    log.info("ACK received id={} seq={} toUser={}", ack.notificationId, ack.seq, ack.toUserId);

    Notification updated = notificationService.markDelivered(ack.notificationId);
    if (updated == null) return;

    try {
      String payload = updated.getPayload();
      if (payload != null) {
        var node = mapper.readTree(payload);
        if (node.has("from")) {
          String originalSender = node.get("from").asText();
          template.convertAndSendToUser(
              originalSender,
              "/queue/delivery-confirm",
              mapper
                  .createObjectNode()
                  .put("notificationId", updated.getId())
                  .put("toUserId", updated.getToUserId())
                  .put("delivered", true));
          log.info("Sent delivery-confirm to {}", originalSender);
        }
      }
    } catch (Exception e) {
      log.warn(
          "Failed to notify original sender of delivery for id={}: {}",
          ack.notificationId,
          e.toString());
    }
  }

  @MessageMapping("/recover")
  public void handleRecover(@Payload RecoverMessage rmsg, Principal principal) {
    if (principal == null) {
      log.debug("Recover requested without principal");
      return;
    }
    String user = principal.getName();
    long lastSeen = rmsg != null && rmsg.lastSeenSeq != null ? rmsg.lastSeenSeq : 0L;
    log.info("Recover for user={} lastSeenSeq={}", user, lastSeen);
    notificationService.replayMissed(user, lastSeen, template);
  }

  @MessageMapping("/heartbeat")
  public void heartbeat(Principal principal, StompHeaderAccessor sha) {
    if (principal == null) return;
    String user = principal.getName();
    String sessionId = sha.getSessionId();
    presenceService.markOnline(user, sessionId);
  }
}
