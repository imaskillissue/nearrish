package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Block;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.BlockService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/blocks")
public class BlockController {

    private final BlockService blockService;

    public BlockController(BlockService blockService) {
        this.blockService = blockService;
    }

    @PostMapping("/{userId}")
    public Block blockUser(@PathVariable String userId) {
        return blockService.blockUser(currentUser(), userId);
    }

    @DeleteMapping("/{userId}")
    public void unblockUser(@PathVariable String userId) {
        blockService.unblockUser(currentUser(), userId);
    }

    @GetMapping
    public List<User> getBlockedUsers() {
        return blockService.getBlockedUsers(currentUser());
    }

    @GetMapping("/blocked-by/{userId}")
    public Map<String, Boolean> isBlockedBy(@PathVariable String userId) {
        User me = currentUser();
        boolean blockedByThem = blockService.isBlocked(userId, me.getId());
        return Map.of("blocked", blockedByThem);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
