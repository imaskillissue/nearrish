package com.nearrish.backend.service;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.repository.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

@Service
public class AdminStatsService {

    // Rolling 4-hour window of (timestamp, onlineCount) sampled every 5 s
    private static final int ONLINE_HISTORY_MAX = 4 * 60 * 60 / 5; // 2880 entries
    private final Deque<long[]> onlineHistory = new ConcurrentLinkedDeque<>();

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
        Map<String, Object> snap = buildLiveSnapshot();

        // Record online count in rolling history
        long ts = System.currentTimeMillis();
        long online = (long) snap.get("onlineNow");
        onlineHistory.addLast(new long[]{ts, online});
        while (onlineHistory.size() > ONLINE_HISTORY_MAX) onlineHistory.pollFirst();

        messagingTemplate.convertAndSend("/topic/admin/stats", (Object) snap);
    }

    public Map<String, Object> buildLiveSnapshot() {
        List<Post> posts     = postRepository.findAll();
        long totalUsers      = userRepository.count();
        long totalPosts      = posts.size();
        long totalComments   = commentRepository.count();
        long totalMessages   = messageRepository.count();
        long onlineNow       = onlineStatusService.getOnlineUsers().size();

        long flaggedPosts    = posts.stream().filter(p -> p.getModerationSeverity() != null && p.getModerationSeverity() >= 2).count();
        long blockedPosts    = posts.stream().filter(Post::isModerated).count();
        long blockedComments = commentRepository.findAll().stream().filter(c -> c.isModerated()).count();

        long postsLast1h  = countPostsInWindow(posts, 3_600_000L);
        long postsLast24h = countPostsInWindow(posts, 86_400_000L);

        double blockRate = totalPosts == 0 ? 0 : Math.round(blockedPosts * 10000.0 / totalPosts) / 100.0;

        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("totalUsers",      totalUsers);
        snap.put("totalPosts",      totalPosts);
        snap.put("totalComments",   totalComments);
        snap.put("totalMessages",   totalMessages);
        snap.put("onlineNow",       onlineNow);
        snap.put("flaggedPosts",    flaggedPosts);
        snap.put("blockedPosts",    blockedPosts);
        snap.put("blockedComments", blockedComments);
        snap.put("postsLast1h",     postsLast1h);
        snap.put("postsLast24h",    postsLast24h);
        snap.put("blockRatePct",    blockRate);

        Map<String, Long> sentiment = sentimentBreakdown();
        snap.put("sentimentPositive", sentiment.get("positive"));
        snap.put("sentimentNeutral",  sentiment.get("neutral"));
        snap.put("sentimentNegative", sentiment.get("negative"));
        snap.put("timestamp",       System.currentTimeMillis());
        return snap;
    }

    // ── Online history (rolling 4h) ───────────────────────────────────────────

    public List<Map<String, Object>> getOnlineHistory() {
        return onlineHistory.stream().map(entry -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ts",     entry[0]);
            row.put("online", entry[1]);
            return row;
        }).collect(Collectors.toList());
    }

    // ── Historical data for charts ────────────────────────────────────────────

    public List<Map<String, Object>> postActivityLast7Days() {
        long now   = System.currentTimeMillis();
        long dayMs = 86_400_000L;
        List<Post> posts = postRepository.findAll();

        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            long dayStart = now - (long)(i + 1) * dayMs;
            long dayEnd   = now - (long) i * dayMs;

            long total   = posts.stream().filter(p -> p.getTimestamp() >= dayStart && p.getTimestamp() < dayEnd).count();
            long blocked = posts.stream().filter(p -> p.getTimestamp() >= dayStart && p.getTimestamp() < dayEnd && p.isModerated()).count();
            long flagged = posts.stream().filter(p -> p.getTimestamp() >= dayStart && p.getTimestamp() < dayEnd
                    && p.getModerationSeverity() != null && p.getModerationSeverity() >= 2).count();

            String iso = Instant.ofEpochMilli(dayEnd - 1).atZone(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date",    iso);
            row.put("ts",      dayEnd);
            row.put("posts",   total);
            row.put("blocked", blocked);
            row.put("flagged", flagged);
            result.add(row);
        }
        return result;
    }

    public Map<String, Long> moderationSeverityBreakdown() {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        breakdown.put("clean",         0L);
        breakdown.put("borderline",    0L);
        breakdown.put("inappropriate", 0L);
        breakdown.put("harmful",       0L);
        breakdown.put("severe",        0L);

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

    public Map<String, Long> sentimentBreakdown() {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        breakdown.put("positive", 0L);
        breakdown.put("neutral",  0L);
        breakdown.put("negative", 0L);

        postRepository.findAll().stream()
                .filter(p -> p.getSentiment() != null)
                .forEach(p -> breakdown.merge(p.getSentiment(), 1L, Long::sum));

        commentRepository.findAll().stream()
                .filter(c -> c.getSentiment() != null)
                .forEach(c -> breakdown.merge(c.getSentiment(), 1L, Long::sum));

        return breakdown;
    }

    public Map<String, Map<String, Long>> sentimentBreakdownByType() {
        Map<String, Long> posts    = new LinkedHashMap<>();
        Map<String, Long> comments = new LinkedHashMap<>();
        for (Map<String, Long> m : List.of(posts, comments)) {
            m.put("positive", 0L); m.put("neutral", 0L); m.put("negative", 0L);
        }
        postRepository.findAll().stream()
                .filter(p -> p.getSentiment() != null)
                .forEach(p -> posts.merge(p.getSentiment(), 1L, Long::sum));
        commentRepository.findAll().stream()
                .filter(c -> c.getSentiment() != null)
                .forEach(c -> comments.merge(c.getSentiment(), 1L, Long::sum));
        Map<String, Map<String, Long>> result = new LinkedHashMap<>();
        result.put("posts",    posts);
        result.put("comments", comments);
        return result;
    }

    public List<Map<String, Object>> topicBreakdown() {
        Map<String, Long> counts = new LinkedHashMap<>();

        postRepository.findAll().stream()
                .filter(p -> p.getModerationTopic() != null && !p.getModerationTopic().isBlank()
                        && !"general".equals(p.getModerationTopic()))
                .forEach(p -> counts.merge(p.getModerationTopic(), 1L, Long::sum));

        commentRepository.findAll().stream()
                .filter(c -> c.getModerationTopic() != null && !c.getModerationTopic().isBlank()
                        && !"general".equals(c.getModerationTopic()))
                .forEach(c -> counts.merge(c.getModerationTopic(), 1L, Long::sum));

        List<Map.Entry<String, Long>> sorted = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .collect(Collectors.toList());

        long otherCount = sorted.stream().skip(10).mapToLong(Map.Entry::getValue).sum();

        List<Map<String, Object>> result = sorted.stream().limit(10).map(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("topic", e.getKey());
            row.put("count", e.getValue());
            return row;
        }).collect(Collectors.toList());

        if (otherCount > 0) {
            Map<String, Object> other = new LinkedHashMap<>();
            other.put("topic", "other");
            other.put("count", otherCount);
            result.add(other);
        }
        return result;
    }

    // ── Full export payload (for CSV) ─────────────────────────────────────────

    public Map<String, Object> buildFullExport() {
        Map<String, Object> export = new LinkedHashMap<>();
        export.put("snapshot",           buildLiveSnapshot());
        export.put("postActivity7d",     postActivityLast7Days());
        export.put("severityBreakdown",  moderationSeverityBreakdown());
        export.put("sentimentBreakdown", sentimentBreakdown());
        export.put("topicBreakdown",     topicBreakdown());
        export.put("onlineHistory",      getOnlineHistory());
        return export;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static long countPostsInWindow(List<Post> posts, long windowMs) {
        long cutoff = System.currentTimeMillis() - windowMs;
        return posts.stream().filter(p -> p.getTimestamp() >= cutoff).count();
    }
}
