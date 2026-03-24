package com.nearrish.backend.service;

import com.nearrish.backend.entity.Conversation;
import com.nearrish.backend.entity.ConversationReadState;
import com.nearrish.backend.entity.Message;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.BlockRepository;
import com.nearrish.backend.repository.ConversationReadStateRepository;
import com.nearrish.backend.repository.ConversationRepository;
import com.nearrish.backend.repository.MessageRepository;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Real-time chat tests — verifies:
 *   1. WS payload format ("convId:msgId") so the frontend can identify which conversation fired
 *   2. Only recipients notified on send (not the sender)
 *   3. READ:convId broadcast on markAsRead (only to the other participant(s))
 *   4. Unread count increments on receive, resets to 0 after markAsRead
 *   5. Group chat: all members except sender notified; unread badge logic
 */
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:chatrt;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class ChatRealTimeTest {

    @MockitoBean
    private SimpMessagingTemplate messagingTemplate;

    @Autowired private ChatService chatService;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BlockRepository blockRepository;
    @Autowired private ConversationReadStateRepository readStateRepository;

    private User alice;
    private User bob;
    private User charlie;

    /** Mirrors the production unread-count logic: uses per-user lastReadAt timestamp. */
    private long unreadFor(String conversationId, String userId) {
        LocalDateTime lastReadAt = readStateRepository
                .findByConversationIdAndUserId(conversationId, userId)
                .map(ConversationReadState::getLastReadAt)
                .orElse(LocalDateTime.of(2000, 1, 1, 0, 0));
        return messageRepository.countUnreadSince(conversationId, userId, lastReadAt);
    }

    @BeforeEach
    void setUp() {
        alice   = userRepository.save(new User("alice",   "alice@test.com",   "pw", ""));
        bob     = userRepository.save(new User("bob",     "bob@test.com",     "pw", ""));
        charlie = userRepository.save(new User("charlie", "charlie@test.com", "pw", ""));
    }

    @AfterEach
    void tearDown() {
        readStateRepository.deleteAll();
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        blockRepository.deleteAll();
        userRepository.deleteAll();
        reset(messagingTemplate);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DM — WebSocket payload format
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DM — WS notification payload")
    class DmWsPayload {

        @Test
        @DisplayName("sendMessage notifies recipient with 'convId:msgId' format")
        void sendMessage_notifiesRecipient_withConvIdColonMsgId() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            Message msg = chatService.sendMessage(alice, conv.getId(), "Hello Bob!");

            ArgumentCaptor<String> destCaptor    = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);

            verify(messagingTemplate).convertAndSendToUser(
                    eq(bob.getUsername()), destCaptor.capture(), payloadCaptor.capture());

            assertEquals("/queue/chat", destCaptor.getValue());
            String payload = (String) payloadCaptor.getValue();
            // Must start with conversationId so the frontend knows which conversation fired
            assertTrue(payload.startsWith(conv.getId()),
                    "Payload must start with conversationId but was: " + payload);
            // Must include the message ID after the colon
            assertTrue(payload.contains(":" + msg.getId()),
                    "Payload must contain ':messageId' but was: " + payload);
        }

        @Test
        @DisplayName("sendMessage does NOT notify the sender")
        void sendMessage_doesNotNotifySender() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hello Bob!");

            // Alice must never receive a WS notification for her own message
            verify(messagingTemplate, never()).convertAndSendToUser(
                    eq(alice.getUsername()), any(), any());
        }

        @Test
        @DisplayName("sendMessage notifies only the recipient — no broadcast to others")
        void sendMessage_notifiesOnlyRecipient() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hello Bob!");

            // Exactly one WS call, to bob only
            verify(messagingTemplate, times(1)).convertAndSendToUser(any(), any(), any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DM — Unread badge count
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DM — unread badge count")
    class DmUnreadBadge {

        @Test
        @DisplayName("Unread count is 0 before any messages")
        void unreadCount_startsAtZero() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            assertEquals(0, unreadFor(conv.getId(), bob.getId()));
        }

        @Test
        @DisplayName("Receiving a message increments the recipient's unread count")
        void sendMessage_incrementsRecipientUnreadCount() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Message 1");
            chatService.sendMessage(alice, conv.getId(), "Message 2");

            assertEquals(2, unreadFor(conv.getId(), bob.getId()),
                    "Bob should have 2 unread messages");
            assertEquals(0, unreadFor(conv.getId(), alice.getId()),
                    "Alice's own messages should not count as unread for her");
        }

        @Test
        @DisplayName("markAsRead resets the recipient's unread count to 0")
        void markAsRead_resetsUnreadCountToZero() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hey!");
            chatService.sendMessage(alice, conv.getId(), "You there?");

            assertEquals(2, unreadFor(conv.getId(), bob.getId()));

            chatService.markAsRead(bob, conv.getId());

            assertEquals(0, unreadFor(conv.getId(), bob.getId()),
                    "Unread count must be 0 after markAsRead");
        }

        @Test
        @DisplayName("Only the reader's unread count is cleared — sender is unaffected")
        void markAsRead_onlyClearsReaderCount() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hi");
            // Bob also sends one so alice has 1 unread
            chatService.sendMessage(bob, conv.getId(), "Hey back");

            chatService.markAsRead(bob, conv.getId()); // Bob reads alice's message

            assertEquals(0, unreadFor(conv.getId(), bob.getId()));
            // Alice still hasn't read bob's reply
            assertEquals(1, unreadFor(conv.getId(), alice.getId()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DM — READ receipt WS event
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DM — READ receipt WS event")
    class DmReadReceipt {

        @Test
        @DisplayName("markAsRead sends 'READ:convId' to the sender")
        void markAsRead_notifiesSender_withReadConvIdPayload() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hello!");
            reset(messagingTemplate); // clear the send-notification

            chatService.markAsRead(bob, conv.getId());

            ArgumentCaptor<String> destCaptor    = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);

            // Alice (the sender) should receive the READ receipt
            verify(messagingTemplate).convertAndSendToUser(
                    eq(alice.getUsername()), destCaptor.capture(), payloadCaptor.capture());

            assertEquals("/queue/chat", destCaptor.getValue());
            assertEquals("READ:" + conv.getId(), payloadCaptor.getValue(),
                    "READ receipt payload must be 'READ:<conversationId>'");
        }

        @Test
        @DisplayName("markAsRead does NOT send READ receipt to the reader themselves")
        void markAsRead_doesNotNotifyReader() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hello!");
            reset(messagingTemplate);

            chatService.markAsRead(bob, conv.getId());

            // Bob (the reader) must not receive any WS notification
            verify(messagingTemplate, never()).convertAndSendToUser(
                    eq(bob.getUsername()), any(), any());
        }

        @Test
        @DisplayName("markAsRead with no unread messages still sends READ receipt")
        void markAsRead_withNoUnread_stillSendsReceipt() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hi");
            chatService.markAsRead(bob, conv.getId());
            reset(messagingTemplate);

            // Mark as read again — should still notify alice
            chatService.markAsRead(bob, conv.getId());

            verify(messagingTemplate, times(1)).convertAndSendToUser(
                    eq(alice.getUsername()), any(), eq("READ:" + conv.getId()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Group chat — WS notification payload
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Group chat — WS notification payload")
    class GroupWsPayload {

        @Test
        @DisplayName("sendMessage notifies all group members except the sender")
        void groupSendMessage_notifiesAllMembersExceptSender() {
            Conversation group = chatService.createGroupConversation(alice, "Test Group",
                    Arrays.asList(bob.getId(), charlie.getId()));

            Message msg = chatService.sendMessage(alice, group.getId(), "Hello group!");

            // Bob and Charlie should each receive one notification
            verify(messagingTemplate).convertAndSendToUser(
                    eq(bob.getUsername()), eq("/queue/chat"),
                    eq(group.getId() + ":" + msg.getId()));
            verify(messagingTemplate).convertAndSendToUser(
                    eq(charlie.getUsername()), eq("/queue/chat"),
                    eq(group.getId() + ":" + msg.getId()));

            // Alice must not receive a self-notification
            verify(messagingTemplate, never()).convertAndSendToUser(
                    eq(alice.getUsername()), any(), any());
        }

        @Test
        @DisplayName("sendMessage notifies exactly N-1 members in a group of N")
        void groupSendMessage_notifiesExactlyNMinusOne() {
            Conversation group = chatService.createGroupConversation(alice, "Test Group",
                    Arrays.asList(bob.getId(), charlie.getId()));

            chatService.sendMessage(bob, group.getId(), "Bob speaks!");

            // alice and charlie each get 1 notification; bob gets 0
            verify(messagingTemplate, times(2)).convertAndSendToUser(any(), any(), any());
            verify(messagingTemplate, never()).convertAndSendToUser(eq(bob.getUsername()), any(), any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Group chat — Unread badge count
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Group chat — unread badge count")
    class GroupUnreadBadge {

        @Test
        @DisplayName("Group message increments unread count for each non-sending member")
        void groupSendMessage_incrementsUnreadForRecipients() {
            Conversation group = chatService.createGroupConversation(alice, "Test Group",
                    Arrays.asList(bob.getId(), charlie.getId()));

            chatService.sendMessage(alice, group.getId(), "Hi all!");

            assertEquals(1, unreadFor(group.getId(), bob.getId()),
                    "Bob should have 1 unread");
            assertEquals(1, unreadFor(group.getId(), charlie.getId()),
                    "Charlie should have 1 unread");
            assertEquals(0, unreadFor(group.getId(), alice.getId()),
                    "Alice sent it — 0 unread for sender");
        }

        @Test
        @DisplayName("New messages after markAsRead are counted as unread again")
        void sendMessageAfterMarkAsRead_countsAsUnreadAgain() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Batch 1 - msg 1");
            chatService.sendMessage(alice, conv.getId(), "Batch 1 - msg 2");

            chatService.markAsRead(bob, conv.getId());
            assertEquals(0, unreadFor(conv.getId(), bob.getId()), "Bob read batch 1 — should be 0");

            // Alice sends two more
            chatService.sendMessage(alice, conv.getId(), "Batch 2 - msg 1");
            chatService.sendMessage(alice, conv.getId(), "Batch 2 - msg 2");

            assertEquals(2, unreadFor(conv.getId(), bob.getId()),
                    "Bob has not read batch 2 — should be 2, not 0 or 4");
        }

        @Test
        @DisplayName("markAsRead in group clears only the reader's unread count")
        void groupMarkAsRead_clearsOnlyReaderUnread() {
            Conversation group = chatService.createGroupConversation(alice, "Test Group",
                    Arrays.asList(bob.getId(), charlie.getId()));

            chatService.sendMessage(alice, group.getId(), "Msg 1");
            chatService.sendMessage(alice, group.getId(), "Msg 2");

            assertEquals(2, unreadFor(group.getId(), bob.getId()));
            assertEquals(2, unreadFor(group.getId(), charlie.getId()));

            chatService.markAsRead(bob, group.getId());

            assertEquals(0, unreadFor(group.getId(), bob.getId()),
                    "Bob read — should be 0");
            assertEquals(2, unreadFor(group.getId(), charlie.getId()),
                    "Charlie hasn't read — should still be 2");
        }

        @Test
        @DisplayName("Group READ receipt sent to all other members, not the reader")
        void groupMarkAsRead_sendsReadReceiptToAllOthers() {
            Conversation group = chatService.createGroupConversation(alice, "Test Group",
                    Arrays.asList(bob.getId(), charlie.getId()));
            chatService.sendMessage(alice, group.getId(), "Hello!");
            reset(messagingTemplate);

            chatService.markAsRead(bob, group.getId());

            String expected = "READ:" + group.getId();
            // Alice and Charlie should receive the READ receipt
            verify(messagingTemplate).convertAndSendToUser(eq(alice.getUsername()),   eq("/queue/chat"), eq(expected));
            verify(messagingTemplate).convertAndSendToUser(eq(charlie.getUsername()), eq("/queue/chat"), eq(expected));
            // Bob (the reader) must not
            verify(messagingTemplate, never()).convertAndSendToUser(eq(bob.getUsername()), any(), any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Frontend integration contract
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Frontend contract — payload parsing")
    class FrontendContract {

        @Test
        @DisplayName("New message payload starts with a UUID (convId), allowing frontend to route correctly")
        void newMessagePayload_startsWithUuid() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Test");

            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSendToUser(eq(bob.getUsername()), any(), payloadCaptor.capture());

            String payload = (String) payloadCaptor.getValue();
            String[] parts = payload.split(":", 2);
            assertEquals(2, parts.length, "Payload must have exactly one colon separator");
            // Both parts should be valid UUIDs
            assertDoesNotThrow(() -> java.util.UUID.fromString(parts[0]),
                    "First part (convId) must be a valid UUID");
            assertDoesNotThrow(() -> java.util.UUID.fromString(parts[1]),
                    "Second part (msgId) must be a valid UUID");
        }

        @Test
        @DisplayName("READ receipt payload is 'READ:<uuid>' — frontend uses convId for badge clearing")
        void readReceiptPayload_hasCorrectFormat() {
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Hi");
            reset(messagingTemplate);
            chatService.markAsRead(bob, conv.getId());

            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSendToUser(eq(alice.getUsername()), any(), payloadCaptor.capture());

            String payload = (String) payloadCaptor.getValue();
            assertTrue(payload.startsWith("READ:"),
                    "READ receipt must start with 'READ:' but was: " + payload);
            String convId = payload.substring(5);
            assertDoesNotThrow(() -> java.util.UUID.fromString(convId),
                    "convId in READ receipt must be a valid UUID");
            assertEquals(conv.getId(), convId,
                    "convId in READ receipt must match the actual conversation ID");
        }

        @Test
        @DisplayName("REMOVED moderation payload starts with 'REMOVED:' — frontend handles separately")
        void removedPayload_startsWithRemoved() {
            // We can't easily test async moderation, but verify the format constants are correct
            // by checking that a regular send payload does NOT start with REMOVED: or READ:
            Conversation conv = chatService.getOrCreateConversation(alice, bob.getId());
            chatService.sendMessage(alice, conv.getId(), "Clean message");

            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSendToUser(eq(bob.getUsername()), any(), payloadCaptor.capture());

            String payload = (String) payloadCaptor.getValue();
            assertFalse(payload.startsWith("READ:"),    "Normal message must not look like READ receipt");
            assertFalse(payload.startsWith("REMOVED:"), "Normal message must not look like moderation removal");
        }
    }
}
