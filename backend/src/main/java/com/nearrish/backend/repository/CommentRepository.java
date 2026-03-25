package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, String> {

    List<Comment> findByPost_IdOrderByCreatedAt(String postId);

    long countByPost_Id(String postId);

    List<Comment> findByAuthor_Id(String authorId);

    @Query("SELECT c FROM Comment c WHERE c.moderated = false AND LOWER(c.content) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY c.createdAt DESC")
    List<Comment> searchComments(@Param("q") String q);

    @Query("SELECT c FROM Comment c WHERE c.moderated = false ORDER BY c.createdAt DESC")
    List<Comment> findAllUnmoderated();

    @Query("SELECT c FROM Comment c WHERE c.moderated = false AND c.author.id IN :ids ORDER BY c.createdAt DESC")
    List<Comment> findByAuthorIds(@Param("ids") List<String> ids);

    @Query("SELECT c FROM Comment c WHERE c.moderated = false AND c.author.id IN :ids AND LOWER(c.content) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY c.createdAt DESC")
    List<Comment> searchByAuthorIds(@Param("q") String q, @Param("ids") List<String> ids);

    @Query("SELECT c.post.id, COUNT(c) FROM Comment c WHERE c.post.id IN :ids GROUP BY c.post.id")
    List<Object[]> countByPostIds(@Param("ids") List<String> ids);
}
