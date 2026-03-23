package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Like;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
