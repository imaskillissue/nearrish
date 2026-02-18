package com.nearrish.backend.repository;

import com.nearrish.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    public User getByIdAndUsername(String id, String username);

    public User getByEmailOrUsername(String email, String username);

    public boolean existsByEmail(String email);

    public boolean existsByUsername(String username);
}
