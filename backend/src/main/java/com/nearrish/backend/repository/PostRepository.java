package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, String> {
    List<Post> findByAuthorId(String authorId);

    void deleteByAuthorId(String authorId);

    @Query("SELECT p FROM Post p WHERE p.authorId = :authorId AND p.respondingToId IS NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL) " +
           "ORDER BY p.timestamp DESC")
    List<Post> findPublicByAuthorId(@Param("authorId") String authorId);
    List<Post> findByRespondingToId(String respondingToId);

    // Visibility-aware feed: PUBLIC posts from anyone, or FRIENDS_ONLY posts from user + friends.
    // NULL visibility is treated as PUBLIC for backward compatibility with existing rows.
    @Query("SELECT p FROM Post p WHERE p.respondingToId IS NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL OR p.authorId IN :friendAndSelfIds) " +
           "AND (p.moderated IS NULL OR p.moderated = false) " +
           "ORDER BY p.timestamp DESC")
    List<Post> findFeedForUser(@Param("friendAndSelfIds") List<String> friendAndSelfIds);

    @Query("SELECT p FROM Post p WHERE p.respondingToId IS NULL " +
           "AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL OR p.authorId IN :friendAndSelfIds) " +
           "AND (p.moderated IS NULL OR p.moderated = false) " +
           "ORDER BY p.timestamp DESC")
    List<Post> findGeoFeedForUser(@Param("friendAndSelfIds") List<String> friendAndSelfIds);

    @Query("SELECT p FROM Post p WHERE p.respondingToId IS NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL) " +
           "AND (p.moderated IS NULL OR p.moderated = false) " +
           "ORDER BY p.timestamp DESC")
    List<Post> findPublicFeed();

    @Query("SELECT p FROM Post p WHERE p.respondingToId IS NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL) AND " +
           "LOWER(p.text) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "AND (p.moderated IS NULL OR p.moderated = false) " +
           "ORDER BY p.timestamp DESC")
    List<Post> searchPublicPosts(@Param("q") String q);

    @Query("SELECT p FROM Post p WHERE p.respondingToId IS NULL " +
           "AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND " +
           "(p.visibility = 'PUBLIC' OR p.visibility IS NULL) " +
           "AND (p.moderated IS NULL OR p.moderated = false) " +
           "ORDER BY p.timestamp DESC")
    List<Post> findPublicGeoFeed();
}
