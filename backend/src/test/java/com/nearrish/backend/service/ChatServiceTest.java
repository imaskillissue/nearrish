package com.nearrish.backend.service;

import com.nearrish.backend.entity.Conversation;
import com.nearrish.backend.entity.Message;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.BlockRepository;
import com.nearrish.backend.repository.ConversationRepository;
import com.nearrish.backend.repository.MessageRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.service.BlockService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class ChatServiceTest {

    @MockitoBean
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChatService chatService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private BlockRepository blockRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "password", ""));
        bob = userRepository.save(new User("bob", "bob@example.com", "password", ""));
    }

    @AfterEach
    void tearDown() {
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        blockRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void getOrCreateConversation_createsNewConversation() {
        // Act
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());

        // Assert
        assertNotNull(conversation.getId());
        assertEquals(2, conversation.getParticipants().size());
    }

    @Test
    void getOrCreateConversation_returnsExistingConversation() {
        // Arrange
        Conversation first = chatService.getOrCreateConversation(alice, bob.getId());

        // Act
        Conversation second = chatService.getOrCreateConversation(alice, bob.getId());

        // Assert
        assertEquals(first.getId(), second.getId());
        assertEquals(1, conversationRepository.count());
    }

    @Test
    void getOrCreateConversation_toSelf_throwsBadRequest() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.getOrCreateConversation(alice, alice.getId()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void getOrCreateConversation_toNonExistentUser_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.getOrCreateConversation(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void sendMessage_savesMessageToDatabase() {
        // Arrange
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());

        // Act
        Message message = chatService.sendMessage(alice, conversation.getId(), "Hello Bob!");

        // Assert
        assertNotNull(message.getId());
        assertEquals("Hello Bob!", message.getContent());
        assertEquals(alice.getId(), message.getSender().getId());
        assertFalse(message.isRead());
    }

    @Test
    void sendMessage_notMember_throwsForbidden() {
        // Arrange
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.sendMessage(charlie, conversation.getId(), "Hey!"));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void sendMessage_nonExistentConversation_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.sendMessage(alice, "non-existent-id", "Hello!"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getMessages_returnsMessagesInOrder() {
        // Arrange
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());
        chatService.sendMessage(alice, conversation.getId(), "First");
        chatService.sendMessage(bob, conversation.getId(), "Second");
        chatService.sendMessage(alice, conversation.getId(), "Third");

        // Act
        List<Message> messages = chatService.getMessages(alice, conversation.getId());

        // Assert
        assertEquals(3, messages.size());
        assertEquals("First", messages.get(0).getContent());
        assertEquals("Second", messages.get(1).getContent());
        assertEquals("Third", messages.get(2).getContent());
    }

    @Test
    void getMessages_notMember_throwsForbidden() {
        // Arrange
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.getMessages(charlie, conversation.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void getConversations_returnsUserConversations() {
        // Arrange
        chatService.getOrCreateConversation(alice, bob.getId());

        // Act
        List<Conversation> conversations = chatService.getConversations(alice);

        // Assert
        assertEquals(1, conversations.size());
    }

    @Test
    void getConversations_emptyWhenNoConversations() {
        // Act
        List<Conversation> conversations = chatService.getConversations(alice);

        // Assert
        assertTrue(conversations.isEmpty());
    }

    // --- Block enforcement ---

    @Test
    void getOrCreateConversation_blockerCannotStartConversation() {
        // Arrange
        blockService.blockUser(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.getOrCreateConversation(alice, bob.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void getOrCreateConversation_blockedUserCannotStartConversation() {
        // Arrange — alice blocks bob, bob tries to message alice
        blockService.blockUser(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.getOrCreateConversation(bob, alice.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void sendMessage_blockedAfterConversationStarted_throwsForbidden() {
        // Arrange — conversation exists, then alice blocks bob
        Conversation conversation = chatService.getOrCreateConversation(alice, bob.getId());
        blockService.blockUser(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.sendMessage(bob, conversation.getId(), "Hey!"));
        assertEquals(403, ex.getStatusCode().value());
    }

    // --- Group chat ---

    @Test
    void createGroupConversation_createsGroup() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        assertNotNull(group.getId());
        assertTrue(group.isGroup());
        assertEquals("Test Group", group.getName());
        assertEquals(3, group.getParticipants().size());
    }

    @Test
    void createGroupConversation_tooFewMembers_throwsBadRequest() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.createGroupConversation(alice, "Test Group",
                        List.of(bob.getId())));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void createGroupConversation_noName_throwsBadRequest() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.createGroupConversation(alice, "",
                        Arrays.asList(bob.getId(), charlie.getId())));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void addGroupMember_addsUser() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));
        User dave = userRepository.save(new User("dave", "dave@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        Conversation updated = chatService.addGroupMember(alice, group.getId(), dave.getId());
        assertEquals(4, updated.getParticipants().size());
    }

    @Test
    void addGroupMember_toDM_throwsBadRequest() {
        Conversation dm = chatService.getOrCreateConversation(alice, bob.getId());

        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.addGroupMember(alice, dm.getId(), charlie.getId()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void removeGroupMember_removesUser() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        Conversation updated = chatService.removeGroupMember(alice, group.getId(), bob.getId());
        assertEquals(2, updated.getParticipants().size());
    }

    @Test
    void leaveGroupConversation_removesSelf() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        Conversation updated = chatService.leaveGroupConversation(bob, group.getId());
        assertEquals(2, updated.getParticipants().size());
    }

    @Test
    void renameGroupConversation_updatesName() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Old Name",
                Arrays.asList(bob.getId(), charlie.getId()));

        Conversation updated = chatService.renameGroupConversation(alice, group.getId(), "New Name");
        assertEquals("New Name", updated.getName());
    }

    @Test
    void sendMessage_inGroupChat_worksEvenWithBlocks() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        blockService.blockUser(alice, bob.getId());

        // bob can still message in the group even though alice blocked him
        Message message = chatService.sendMessage(bob, group.getId(), "Hello group!");
        assertNotNull(message.getId());
        assertEquals("Hello group!", message.getContent());
    }

    @Test
    void nonMember_cannotAddToGroup() {
        User charlie = userRepository.save(new User("charlie", "charlie@example.com", "password", ""));
        User dave = userRepository.save(new User("dave", "dave@example.com", "password", ""));

        Conversation group = chatService.createGroupConversation(alice, "Test Group",
                Arrays.asList(bob.getId(), charlie.getId()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> chatService.addGroupMember(dave, group.getId(), dave.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }
}
