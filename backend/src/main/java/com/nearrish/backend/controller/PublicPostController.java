package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.service.PostService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/posts")
public class PublicPostController {

    private final PostService postService;

    public PublicPostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping("/feed")
    public List<Post> getPublicFeed() {
        return postService.getPublicFeed();
    }

    @GetMapping("/feed/geo")
    public List<Post> getPublicGeoFeed() {
        return postService.getPublicGeoFeed();
    }
}
