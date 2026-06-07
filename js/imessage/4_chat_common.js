
// ==========================================
// IMESSAGE: 4_chat_common.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const { apiConfig, userState } = window;
    window.imChat = window.imChat || {};
    const imChat = window.imChat;
    imChat.CHAT_IMAGE_PLACEHOLDER_URL = 'assets/imessage/chat-image-placeholder.jpg';

function createMessageId(prefix = 'msg') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

function ensureMessageId(msg, prefix = 'msg') {
        if (!msg || typeof msg !== 'object') return '';
        if (!msg.id) msg.id = window.imChat.createMessageId(prefix);
        return msg.id;
    }

    window.imChat.createMessageId = createMessageId;
    window.imChat.ensureMessageId = ensureMessageId;

});
