package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.*;
import com.nearrish.backend.repository.*;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.AdminStatsService;
import com.nearrish.backend.service.ModerationClient;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final MessageRepository messageRepository;
    private final LikeRepository likeRepository;
    private final UserToxicityReportRepository toxicityReportRepository;
    private final ModerationClient moderationClient;
    private final AdminStatsService adminStatsService;

    public AdminController(UserRepository userRepository,
                           PostRepository postRepository,
                           CommentRepository commentRepository,
                           MessageRepository messageRepository,
                           LikeRepository likeRepository,
                           UserToxicityReportRepository toxicityReportRepository,
                           ModerationClient moderationClient,
                           AdminStatsService adminStatsService) {
        this.userRepository = userRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.messageRepository = messageRepository;
        this.likeRepository = likeRepository;
        this.toxicityReportRepository = toxicityReportRepository;
        this.moderationClient = moderationClient;
        this.adminStatsService = adminStatsService;
    }

    // ── Verify ─────────────────────────────────────────────────────────────────

    @PostMapping("/verify")
    public Map<String, String> verify() {
        requireAdmin();
        return Map.of("status", "ok");
    }

    // ── Users ──────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public List<Map<String, Object>> getUsers() {
        requireAdmin();
        List<User> users = userRepository.findAll();
        return users.stream().map(u -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", u.getId());
            row.put("username", u.getUsername());
            row.put("name", u.getName());
            row.put("nickname", u.getNickname());
            row.put("email", u.getEmail());
            row.put("address", u.getAddress());
            row.put("avatarUrl", u.getAvatarUrl());
            toxicityReportRepository.findByUserId(u.getId()).ifPresent(r -> {
                row.put("toxicityScore", r.getScore());
                row.put("toxicitySummary", r.getSummary());
                row.put("toxicityGeneratedAt", r.getGeneratedAt().toString());
            });
            return row;
        }).collect(Collectors.toList());
    }

    @DeleteMapping("/users/{id}")
    public Map<String, String> deleteUser(@PathVariable String id) {
        requireAdmin();
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        userRepository.delete(user);
        return Map.of("status", "deleted");
    }

    // ── Moderation queue ───────────────────────────────────────────────────────

    @GetMapping("/moderation/queue")
    public Map<String, Object> getModerationQueue() {
        requireAdmin();

        List<Post> flaggedPosts = postRepository.findAll().stream()
                .filter(p -> p.isModerated() || (p.getModerationSeverity() != null && p.getModerationSeverity() >= 2))
                .sorted(Comparator.comparingLong(Post::getTimestamp).reversed())
                .collect(Collectors.toList());

        List<Comment> flaggedComments = commentRepository.findAll().stream()
                .filter(Comment::isModerated)
                .collect(Collectors.toList());

        // Build authorId → username map to avoid N+1 lookups
        Set<String> authorIds = flaggedPosts.stream()
                .map(Post::getAuthorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, String> idToUsername = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getUsername));

        List<Map<String, Object>> postRows = flaggedPosts.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.getId());
            row.put("type", "post");
            row.put("authorId", p.getAuthorId());
            row.put("authorName", idToUsername.getOrDefault(p.getAuthorId(), "unknown"));
            row.put("content", p.getText());
            row.put("severity", p.getModerationSeverity());
            row.put("category", p.getModerationCategory());
            row.put("moderated", p.isModerated());
            row.put("reason", p.getModerationReason());
            row.put("timestamp", p.getTimestamp());
            return row;
        }).collect(Collectors.toList());

        List<Map<String, Object>> commentRows = flaggedComments.stream().map(c -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", c.getId());
            row.put("type", "comment");
            row.put("authorId", c.getAuthor() != null ? c.getAuthor().getId() : null);
            row.put("authorName", c.getAuthor() != null ? c.getAuthor().getUsername() : null);
            row.put("content", c.getContent());
            row.put("severity", null);
            row.put("category", null);
            row.put("moderated", c.isModerated());
            row.put("reason", c.getModerationReason());
            row.put("timestamp", c.getCreatedAtMs());
            return row;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("posts", postRows);
        result.put("comments", commentRows);
        return result;
    }

    // ── Toxicity analysis ──────────────────────────────────────────────────────

    @GetMapping("/users/{id}/toxicity")
    public Map<String, Object> getToxicity(@PathVariable String id) {
        requireAdmin();
        return toxicityReportRepository.findByUserId(id)
                .map(r -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userId", r.getUserId());
                    row.put("score", r.getScore());
                    row.put("summary", r.getSummary());
                    row.put("generatedAt", r.getGeneratedAt().toString());
                    row.put("triggeredBy", r.getTriggeredBy());
                    row.put("postsTotal", r.getPostsTotal());
                    row.put("postsBlocked", r.getPostsBlocked());
                    row.put("commentsTotal", r.getCommentsTotal());
                    row.put("commentsBlocked", r.getCommentsBlocked());
                    row.put("messagesTotal", r.getMessagesTotal());
                    row.put("messagesBlocked", r.getMessagesBlocked());
                    return row;
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No report found"));
    }

    @PostMapping("/users/{id}/analyse")
    public Map<String, Object> analyseUser(@PathVariable String id) {
        User admin = requireAdmin();
        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // ── Gather raw content ────────────────────────────────────────────────

        List<Post> posts = postRepository.findByAuthorId(id);
        List<Comment> comments = commentRepository.findByAuthor_Id(id);
        List<Message> messages = messageRepository.findBySender_Id(id);
        List<Like> likes = likeRepository.findByUser_Id(id);

        // ── Compute toxicity score ────────────────────────────────────────────
        //
        // Posts are the primary anchor — low comment/message block-rates must
        // not drag a highly-toxic post score downward.
        //
        // Formula:
        //   score = postBase + commentBonus + messageBonus + likedBonus
        //
        // postBase  (0-100): non-linear step mapping of avg post severity
        //   sev 0→0, 1→20, 2→50, 3→88, 4→100
        //   (severity 3 = "harmful/blocked" is treated as 88 % of max)
        //
        // commentBonus (0-20): blocked-comment ratio × 20
        // messageBonus (0-15): blocked-message ratio × 15
        // likedBonus   (0- 5): avg liked-post severity / 4 × 5
        //
        // If the user has no posts at all the comment/message signal takes over.

        // 1. Post base
        double postBase = 0;
        if (!posts.isEmpty()) {
            OptionalDouble optAvg = posts.stream()
                    .filter(p -> p.getModerationSeverity() != null)
                    .mapToInt(Post::getModerationSeverity)
                    .average();
            if (optAvg.isPresent()) {
                double avg = optAvg.getAsDouble();
                // Breakpoints: 0→0, 1→20, 2→50, 3→88, 4→100
                if      (avg <= 0) postBase = 0;
                else if (avg <= 1) postBase = 20.0 * avg;
                else if (avg <= 2) postBase = 20.0 + 30.0 * (avg - 1);
                else if (avg <= 3) postBase = 50.0 + 38.0 * (avg - 2);
                else               postBase = 88.0 + 12.0 * (avg - 3);
            }
        }

        // 2. Comment bonus
        double commentBonus = 0;
        if (!comments.isEmpty()) {
            double ratio = (double) comments.stream().filter(Comment::isModerated).count() / comments.size();
            commentBonus = ratio * 20.0;
        }

        // 3. Message bonus
        double messageBonus = 0;
        if (!messages.isEmpty()) {
            double ratio = (double) messages.stream().filter(Message::isModerated).count() / messages.size();
            messageBonus = ratio * 15.0;
        }

        // 4. Liked-posts bonus
        List<Post> likedPosts = likes.stream()
                .map(Like::getPost)
                .filter(p -> p != null && p.getModerationSeverity() != null)
                .collect(Collectors.toList());
        double likedBonus = likedPosts.isEmpty() ? 0
                : likedPosts.stream().mapToInt(Post::getModerationSeverity).average().orElse(0) / 4.0 * 5.0;

        // 5. Fallback when user has no posts: promote comment/message signal
        double rawScore;
        if (posts.stream().anyMatch(p -> p.getModerationSeverity() != null)) {
            rawScore = postBase + commentBonus + messageBonus + likedBonus;
        } else {
            // No post severity data — use comments + messages as primary (0-100)
            double fallback = commentBonus / 20.0 * 60.0 + messageBonus / 15.0 * 40.0;
            rawScore = fallback + likedBonus;
        }

        int score = (int) Math.round(Math.min(100, Math.max(0, rawScore)));

        // ── Build sample content for LLM ─────────────────────────────────────

        List<String> sampleContent = new ArrayList<>();
        posts.stream()
                .filter(p -> p.getModerationSeverity() != null && p.getModerationSeverity() >= 2)
                .sorted(Comparator.comparingInt(Post::getModerationSeverity).reversed())
                .limit(10)
                .forEach(p -> sampleContent.add(p.getText()));

        if (sampleContent.size() < 10) {
            comments.stream()
                    .filter(Comment::isModerated)
                    .limit(10 - sampleContent.size())
                    .forEach(c -> sampleContent.add(c.getContent()));
        }

        // ── Compute LLM summary inputs ────────────────────────────────────────

        int blockedPosts    = (int) posts.stream().filter(Post::isModerated).count();
        int blockedComments = (int) comments.stream().filter(Comment::isModerated).count();
        int blockedMessages = (int) messages.stream().filter(Message::isModerated).count();

        double avgSeverity = posts.stream()
                .filter(p -> p.getModerationSeverity() != null)
                .mapToInt(Post::getModerationSeverity)
                .average()
                .orElse(0.0);

        ModerationClient.UserSummary userSummary = new ModerationClient.UserSummary(
                target.getUsername(),
                avgSeverity,
                posts.size(),
                blockedPosts,
                comments.size(),
                blockedComments,
                messages.size(),
                blockedMessages,
                sampleContent
        );

        String llmSummary = moderationClient.analyseUser(userSummary);

        // ── Persist report ────────────────────────────────────────────────────

        UserToxicityReport report = toxicityReportRepository.findByUserId(id)
                .orElse(new UserToxicityReport());
        report.setUserId(id);
        report.setScore(score);
        report.setSummary(llmSummary);
        report.setGeneratedAt(LocalDateTime.now());
        report.setTriggeredBy(admin.getId());
        report.setPostsTotal(posts.size());
        report.setPostsBlocked(blockedPosts);
        report.setCommentsTotal(comments.size());
        report.setCommentsBlocked(blockedComments);
        report.setMessagesTotal(messages.size());
        report.setMessagesBlocked(blockedMessages);
        toxicityReportRepository.save(report);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", id);
        result.put("score", score);
        result.put("summary", llmSummary);
        result.put("generatedAt", report.getGeneratedAt().toString());
        result.put("postsTotal", report.getPostsTotal());
        result.put("postsBlocked", report.getPostsBlocked());
        result.put("commentsTotal", report.getCommentsTotal());
        result.put("commentsBlocked", report.getCommentsBlocked());
        result.put("messagesTotal", report.getMessagesTotal());
        result.put("messagesBlocked", report.getMessagesBlocked());
        return result;
    }

    // ── Analytics ──────────────────────────────────────────────────────────────

    @GetMapping("/stats/snapshot")
    public Map<String, Object> getStatsSnapshot() {
        requireAdmin();
        return adminStatsService.buildLiveSnapshot();
    }

    @GetMapping("/stats/post-activity")
    public List<Map<String, Object>> getPostActivity() {
        requireAdmin();
        return adminStatsService.postActivityLast7Days();
    }

    @GetMapping("/stats/severity-breakdown")
    public Map<String, Long> getSeverityBreakdown() {
        requireAdmin();
        return adminStatsService.moderationSeverityBreakdown();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private User requireAdmin() {
        ApiAuthentication auth = (ApiAuthentication)
                SecurityContextHolder.getContext().getAuthentication();
        DecodedJWT jwt = (DecodedJWT) auth.getPrincipal();
        List<String> roles = jwt.getClaim("roles").asList(String.class);
        if (roles == null || !roles.contains("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required");
        }
        return auth.getUser();
    }
}
