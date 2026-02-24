package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, String> {
    List<Post> findByAuthorId(String authorId);
    List<Post> findByRespondingToId(String respondingToId);

}
