package com.example.demo.repository;

import com.example.demo.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByAuthorIdOrderByCreatedAtDesc(String authorId);
    List<Post> findAllByOrderByCreatedAtDesc();

    @Query("SELECT p FROM Post p WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.latitude BETWEEN :south AND :north AND p.longitude BETWEEN :west AND :east ORDER BY p.createdAt DESC")
    List<Post> findWithinBounds(
            @Param("south") double south,
            @Param("north") double north,
            @Param("west") double west,
            @Param("east") double east
    );
}
