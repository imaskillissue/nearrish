package com.nearrish.backend.service;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class PostService {

    private final PostRepository postRepository;

    public PostService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    public Post createPost(User author, String text, String respondingToId, Double latitude, Double longitude, String imageUrl) {
        if (respondingToId != null && !postRepository.existsById(respondingToId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent post not found");
        }
        Post post = new Post(text, author.getId(), respondingToId, latitude, longitude);
        post.setImageUrl(imageUrl);
        return postRepository.save(post);
    }

    public List<Post> getFeed() {
        return postRepository.findByRespondingToIdIsNullOrderByTimestampDesc();
    }

    public List<Post> getGeoFeed() {
        return postRepository.findByRespondingToIdIsNullAndLatitudeIsNotNullAndLongitudeIsNotNullOrderByTimestampDesc();
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
}
