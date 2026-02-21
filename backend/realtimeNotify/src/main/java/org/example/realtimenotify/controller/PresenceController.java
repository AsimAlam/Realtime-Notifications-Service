package org.example.realtimenotify.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.example.realtimenotify.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PresenceController {

  private final Logger log = LoggerFactory.getLogger(PresenceController.class);
  private final PresenceService presenceService;

  public PresenceController(PresenceService presenceService) {
    this.presenceService = presenceService;
  }

  @GetMapping("/presence")
  public PresenceDto getPresence() {
    Set<String> online = presenceService.getOnlineUsers();
    log.debug("GET /presence -> {} users", online.size());
    return new PresenceDto(new ArrayList<>(online));
  }

  public static class PresenceDto {
    private List<String> users;

    public PresenceDto() {}

    public PresenceDto(List<String> users) {
      this.users = users;
    }

    public List<String> getUsers() {
      return users;
    }

    public void setUsers(List<String> users) {
      this.users = users;
    }
  }
}
