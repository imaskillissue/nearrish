package com.nearrish.backend.service;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
import com.nearrish.backend.repository.PostRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class PostService {

    private final PostRepository postRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final ModerationClient moderationClient;
    private final SimpMessagingTemplate messagingTemplate;

    public PostService(PostRepository postRepository, FriendRequestRepository friendRequestRepository,
                       ModerationClient moderationClient, SimpMessagingTemplate messagingTemplate) {
        this.postRepository = postRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.moderationClient = moderationClient;
        this.messagingTemplate = messagingTemplate;
    }

    public Post createPost(User author, String text, String respondingToId, Double latitude, Double longitude, String imageUrl, Post.Visibility visibility) {
        if (respondingToId != null && !postRepository.existsById(respondingToId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent post not found");
        }

        Post post = new Post(text, author.getId(), respondingToId, latitude, longitude);
        post.setImageUrl(imageUrl);
        post.setVisibility(visibility != null ? visibility : Post.Visibility.PUBLIC);
        Post saved = postRepository.save(post);

        String savedId = saved.getId();
        CompletableFuture.runAsync(() -> {
            ModerationClient.Result mod = moderationClient.moderateText(text);
            postRepository.findById(savedId).ifPresent(p -> {
                p.setModerationSeverity(mod.severity());
                p.setModerationCategory(mod.category());
                if (mod.isBlocked()) {
                    String reason = mod.reason() != null ? mod.reason() : "Content removed by moderation";
                    p.setModerated(true);
                    p.setModerationReason(reason);
                    postRepository.save(p);
                    messagingTemplate.convertAndSend("/topic/posts",
                            "MODERATED_POST:" + savedId + ":" + reason);
                } else {
                    postRepository.save(p);
                }
            });
        });
        return saved;
    }

    @Transactional
    public List<Post> getFeed(User currentUser) {
        return postRepository.findFeedForUser(friendAndSelfIds(currentUser));
    }

    @Transactional
    public List<Post> getGeoFeed(User currentUser) {
        return postRepository.findGeoFeedForUser(friendAndSelfIds(currentUser));
    }

    public List<Post> getPublicFeed() {
        return postRepository.findPublicFeed();
    }

    public List<Post> getPublicGeoFeed() {
        return postRepository.findPublicGeoFeed();
    }

    public Post getPost(String postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
    }

    public List<Post> getPostsByAuthor(String authorId) {
        return postRepository.findByAuthorId(authorId);
    }

    public List<Post> getReplies(String postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return postRepository.findByRespondingToId(postId);
    }

    public void deletePost(User currentUser, String postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (!post.getAuthorId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete someone else's post");
        }

        postRepository.delete(post);
    }

    // Build list of IDs that includes the user themselves + all accepted friends.
    // Used for FRIENDS_ONLY visibility filtering.
    private List<String> friendAndSelfIds(User user) {
        List<String> ids = new ArrayList<>();
        ids.add(user.getId());
        for (FriendRequest fr : friendRequestRepository.findAcceptedFriendships(user.getId())) {
            String friendId = fr.getSender().getId().equals(user.getId())
                    ? fr.getReceiver().getId()
                    : fr.getSender().getId();
            ids.add(friendId);
        }
        return ids;
    }
}
