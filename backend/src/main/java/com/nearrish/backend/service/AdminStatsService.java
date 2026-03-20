package com.nearrish.backend.service;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.repository.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminStatsService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MessageRepository messageRepository;
    private final OnlineStatusService onlineStatusService;
    private final SimpMessagingTemplate messagingTemplate;

    public AdminStatsService(UserRepository userRepository,
                             PostRepository postRepository,
                             CommentRepository commentRepository,
                             MessageRepository messageRepository,
                             OnlineStatusService onlineStatusService,
                             SimpMessagingTemplate messagingTemplate) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.messageRepository = messageRepository;
        this.onlineStatusService = onlineStatusService;
        this.messagingTemplate = messagingTemplate;
    }

    // ── Live snapshot broadcast (every 5 s) ───────────────────────────────────

    @Scheduled(fixedDelay = 5000)
    public void broadcastLiveStats() {
        messagingTemplate.convertAndSend("/topic/admin/stats", (Object) buildLiveSnapshot());
    }

    public Map<String, Object> buildLiveSnapshot() {
        long totalUsers    = userRepository.count();
        long totalPosts    = postRepository.count();
        long totalComments = commentRepository.count();
        long totalMessages = messageRepository.count();
        long onlineNow     = onlineStatusService.getOnlineUsers().size();

        long flaggedPosts = postRepository.findAll().stream()
                .filter(p -> p.getModerationSeverity() != null && p.getModerationSeverity() >= 2)
                .count();
        long blockedPosts = postRepository.findAll().stream()
                .filter(Post::isModerated)
                .count();
        long blockedComments = commentRepository.findAll().stream()
                .filter(c -> c.isModerated())
                .count();

        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("totalUsers",      totalUsers);
        snap.put("totalPosts",      totalPosts);
        snap.put("totalComments",   totalComments);
        snap.put("totalMessages",   totalMessages);
        snap.put("onlineNow",       onlineNow);
        snap.put("flaggedPosts",    flaggedPosts);
        snap.put("blockedPosts",    blockedPosts);
        snap.put("blockedComments", blockedComments);
        snap.put("timestamp",       System.currentTimeMillis());
        return snap;
    }

    // ── Historical data for charts ────────────────────────────────────────────

    public List<Map<String, Object>> postActivityLast7Days() {
        long now = System.currentTimeMillis();
        long dayMs = 86_400_000L;

        List<Post> posts = postRepository.findAll();

        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            long dayStart = now - (i + 1) * dayMs;
            long dayEnd   = now - i * dayMs;
            String label  = dayLabel(i);

            long total   = posts.stream().filter(p -> p.getTimestamp() >= dayStart && p.getTimestamp() < dayEnd).count();
            long blocked = posts.stream().filter(p -> p.getTimestamp() >= dayStart && p.getTimestamp() < dayEnd && p.isModerated()).count();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("day",     label);
            row.put("posts",   total);
            row.put("blocked", blocked);
            result.add(row);
        }
        return result;
    }

    public Map<String, Long> moderationSeverityBreakdown() {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        breakdown.put("clean",        0L);
        breakdown.put("borderline",   0L);
        breakdown.put("inappropriate",0L);
        breakdown.put("harmful",      0L);
        breakdown.put("severe",       0L);

        postRepository.findAll().stream()
                .filter(p -> p.getModerationSeverity() != null)
                .forEach(p -> {
                    String key = switch (p.getModerationSeverity()) {
                        case 0 -> "clean";
                        case 1 -> "borderline";
                        case 2 -> "inappropriate";
                        case 3 -> "harmful";
                        default -> "severe";
                    };
                    breakdown.merge(key, 1L, Long::sum);
                });
        return breakdown;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String dayLabel(int daysAgo) {
        if (daysAgo == 0) return "Today";
        if (daysAgo == 1) return "Yesterday";
        String[] days = {"Sun","Mon","Tue","Wed","Thu","Fri","Sat"};
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, -daysAgo);
        return days[cal.get(Calendar.DAY_OF_WEEK) - 1];
    }
}
