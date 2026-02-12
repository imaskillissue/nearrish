package com.example.demo.controller;

import com.example.demo.dto.CreatePostRequest;
import com.example.demo.dto.ModerationResult;
import com.example.demo.dto.PostResponse;
import com.example.demo.model.Post;
import com.example.demo.repository.PostRepository;
import com.example.demo.service.ModerationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    private static final Logger log = LoggerFactory.getLogger(PostController.class);
    private final PostRepository postRepository;
    private final ModerationService moderationService;

    public PostController(PostRepository postRepository, ModerationService moderationService) {
        this.postRepository = postRepository;
        this.moderationService = moderationService;
    }

    @PostMapping
    public ResponseEntity<?> createPost(@Valid @RequestBody CreatePostRequest request) {
        // Run content through moderation
        ModerationResult moderation = moderationService.moderate(
                request.content(), request.authorId(), "post");

        log.info("Moderation result: severity={}, category={}", moderation.severity(), moderation.category());

        // Block if severity >= 9
        if (moderation.blocked()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Content blocked by moderation",
                    "category", moderation.category(),
                    "reason", moderation.reason()
            ));
        }

        // Save the post with moderation metadata and location
        Post post = new Post(
                request.content(),
                request.authorId(),
                moderation.severity(),
                moderation.category(),
                request.latitude(),
                request.longitude()
        );
        post = postRepository.save(post);

        return ResponseEntity.status(HttpStatus.CREATED).body(PostResponse.from(post));
    }

    @GetMapping
    public List<PostResponse> getAllPosts(
            @RequestParam(required = false) Double south,
            @RequestParam(required = false) Double north,
            @RequestParam(required = false) Double west,
            @RequestParam(required = false) Double east) {
        if (south != null && north != null && west != null && east != null) {
            return postRepository.findWithinBounds(south, north, west, east)
                    .stream()
                    .map(PostResponse::from)
                    .toList();
        }
        return postRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(PostResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PostResponse> getPost(@PathVariable Long id) {
        return postRepository.findById(id)
                .map(PostResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/user/{authorId}")
    public List<PostResponse> getPostsByUser(@PathVariable String authorId) {
        return postRepository.findByAuthorIdOrderByCreatedAtDesc(authorId)
                .stream()
                .map(PostResponse::from)
                .toList();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id) {
        if (!postRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        postRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
