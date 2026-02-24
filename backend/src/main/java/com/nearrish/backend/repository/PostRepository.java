package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostRepository extends JpaRepository<com.nearrish.backend.entity.Post, String> {
    // Last 30 post by author, sorted by timestamp
    List<Post> findTopByAuthorIdAOrderByTimestampDesc(String authorId);
    List<Post> findByRespondingToId(String respondingToId);
}
