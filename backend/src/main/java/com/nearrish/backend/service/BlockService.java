package com.nearrish.backend.service;

import com.nearrish.backend.entity.Block;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.BlockRepository;
import com.nearrish.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;

    public BlockService(BlockRepository blockRepository, UserRepository userRepository) {
        this.blockRepository = blockRepository;
        this.userRepository = userRepository;
    }

    public Block blockUser(User blocker, String blockedId) {
        if (blocker.getId().equals(blockedId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot block yourself");
        }

        User blocked = userRepository.findById(blockedId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (blockRepository.existsByBlockerIdAndBlockedId(blocker.getId(), blockedId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already blocked");
        }

        return blockRepository.save(new Block(blocker, blocked));
    }

    public void unblockUser(User blocker, String blockedId) {
        Block block = blockRepository.findByBlockerIdAndBlockedId(blocker.getId(), blockedId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found"));

        blockRepository.delete(block);
    }

    public List<User> getBlockedUsers(User blocker) {
        return blockRepository.findByBlockerId(blocker.getId()).stream()
                .map(Block::getBlocked)
                .toList();
    }

    public boolean isBlocked(String blockerId, String blockedId) {
        return blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId);
    }
}
