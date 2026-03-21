package com.nearrish.backend.repository;

import com.nearrish.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    User getByIdAndUsername(String id, String username);

    User getByEmailOrUsername(String email, String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    Optional<User> findByOauthProviderAndOauthId(String oauthProvider, String oauthId);

    Optional<User> findByEmail(String email);

    @Query("SELECT DISTINCT u FROM User u")
    List<User> findAllDistinct();

}
