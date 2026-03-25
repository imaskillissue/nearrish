package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LikeRepository extends JpaRepository<Like, String> {

    Optional<Like> findByUserIdAndPostId(String userId, String postId);

    Optional<Like> findByUserIdAndCommentId(String userId, String commentId);

    long countByPostId(String postId);

    long countByCommentId(String commentId);

    boolean existsByUserIdAndPostId(String userId, String postId);

    boolean existsByUserIdAndCommentId(String userId, String commentId);

    List<Like> findByUser_Id(String userId);

    @Query("SELECT l.post.id, COUNT(l) FROM Like l WHERE l.post IS NOT NULL AND l.post.id IN :ids GROUP BY l.post.id")
    List<Object[]> countLikesByPostIds(@Param("ids") List<String> ids);

    @Query("SELECT l.comment.id, COUNT(l) FROM Like l WHERE l.comment IS NOT NULL AND l.comment.id IN :ids GROUP BY l.comment.id")
    List<Object[]> countLikesByCommentIds(@Param("ids") List<String> ids);
}
