package com.nearrish.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(
        exclude = {
				SecurityAutoConfiguration.class,
				UserDetailsServiceAutoConfiguration.class
		}
)
@EntityScan(basePackages = {"com.nearrish.backend.entity"})
@EnableJpaRepositories(basePackages = {"com.nearrish.backend.repository"})
public class NearrishApplication {

	public static void main(String[] args) {
        SpringApplication.run(NearrishApplication.class, args);
	}

}
