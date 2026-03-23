package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, String> {

    List<Comment> findByPost_IdOrderByCreatedAt(String postId);

    long countByPost_Id(String postId);

    List<Comment> findByAuthor_Id(String authorId);
}
