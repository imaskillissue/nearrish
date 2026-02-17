package com.nearrish.backend.user;

import org.springframework.boot.data.autoconfigure.metrics.DataMetricsProperties;
import org.springframework.boot.webmvc.autoconfigure.WebMvcProperties;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends CrudRepository<User, Long> {
    public User getByIdAndUsername(long id, String username);

    public User getByEmailOrUsername(String email, String username);

    public boolean existsByEmail(String email);

    public boolean existsByUsername(String username);
}
