package org.example.realtimenotify.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.example.realtimenotify.model.Notification;
import org.example.realtimenotify.repo.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

  private final NotificationRepository repo;
  private final StringRedisTemplate redis;
  private final ConcurrentHashMap<String, AtomicLong> seqMap = new ConcurrentHashMap<>();
  private final Logger log = LoggerFactory.getLogger(NotificationService.class);

  public NotificationService(NotificationRepository repo, StringRedisTemplate redis) {
    this.repo = repo;
    this.redis = redis;
  }

  @Transactional
  public Notification saveNotification(String toUserId, String payload) {
    Long seq = 0L;
    if (toUserId != null) {
      if (redis != null) {
        String key = "seq:" + toUserId;
        seq = redis.opsForValue().increment(key);
      } else {
        seq = seqMap.computeIfAbsent(toUserId, k -> new AtomicLong(0)).incrementAndGet();
      }
    }
    Notification n = new Notification(toUserId, payload, seq, Instant.now());
    Notification saved = repo.save(n);
    if (redis != null && toUserId != null) {
      redis.opsForList().rightPush("pending:" + toUserId, saved.getId().toString());
    }
    return saved;
  }

  public void deliverIfOnline(
      String toUserId,
      Notification n,
      SimpMessagingTemplate template,
      PresenceService presenceService) {
    boolean online = presenceService.isOnline(toUserId);
    if (online) {
      template.convertAndSendToUser(toUserId, "/queue/notifications", n);
    } else {
      log.warn("User {} is offline", toUserId);
    }
  }

  public void replayMissed(String userId, long lastSeenSeq, SimpMessagingTemplate template) {
    List<Notification> missed =
        repo.findByToUserIdAndSeqGreaterThanOrderBySeqAsc(userId, lastSeenSeq);
    for (Notification n : missed) {
      if (!n.isDelivered()) {
        template.convertAndSendToUser(userId, "/queue/notifications", n);
      }
    }
  }

  public void replayPendingUndelivered(String userId, SimpMessagingTemplate template) {
    List<Notification> pending = repo.findByToUserIdAndDeliveredFalseOrderBySeqAsc(userId);
    for (Notification n : pending) {
      template.convertAndSendToUser(userId, "/queue/notifications", n);
    }
  }

  @Transactional
  public Notification markDelivered(Long notificationId) {
    Optional<Notification> opt = repo.findById(notificationId);
    if (opt.isEmpty()) {
      log.warn("markDelivered: notification id={} not found", notificationId);
      return null;
    }
    Notification n = opt.get();
    if (n.isDelivered()) {
      log.debug("markDelivered: already delivered id={}", notificationId);
      return n;
    }
    n.setDelivered(true);
    Notification saved = repo.save(n);
    try {
      if (redis != null && saved.getToUserId() != null) {
        redis.opsForList().remove("pending:" + saved.getToUserId(), 0, saved.getId().toString());
      }
    } catch (Exception e) {
      log.warn(
          "markDelivered: failed to remove pending from redis for id={} err={}",
          notificationId,
          e.toString());
    }
    log.info("markDelivered: notification id={} marked delivered", notificationId);
    return saved;
  }

  public List<String> getRedisPendingIds(String userId) {
    if (redis == null) return List.of();
    return redis.opsForList().range("pending:" + userId, 0, -1);
  }
}
