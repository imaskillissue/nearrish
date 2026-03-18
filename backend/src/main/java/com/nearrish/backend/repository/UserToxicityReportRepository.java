package com.nearrish.backend.repository;

import com.nearrish.backend.entity.UserToxicityReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserToxicityReportRepository extends JpaRepository<UserToxicityReport, String> {

    Optional<UserToxicityReport> findByUserId(String userId);
}
