import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => readFile(new URL(path, root), 'utf8');

test('Loves acceptance markers are removed before structured chat parsing', async () => {
    const source = await readWorkspaceFile('js/imessage/4_chat_ai.js');
    const markerHandler = source.indexOf('const inviteAcceptance = consumeLovesInviteAcceptanceMarker(fullReply);');
    const chatJsonParser = source.indexOf("const chatJsonBlock = window.imChat.extractTaggedBlock(fullReply, 'chat_json');", markerHandler);
    const cardHandler = source.indexOf('await window.lovesApp.handleInviteAccepted(friend);');

    assert.ok(markerHandler >= 0, 'acceptance marker must be consumed');
    assert.ok(chatJsonParser > markerHandler, 'cleaned reply must be parsed into chat items');
    assert.ok(cardHandler > chatJsonParser, 'accepted invitations must still create the card');
    assert.match(source, /if \(!hasPrimaryChatBubble\(queueItems\) && !inviteAccepted\)/);
    assert.match(source, /reply: accepted \? reply\.replace\(\/\\\[ACCEPT_INVITE\\\]\/g, ''\) : reply/);
});

test('the page loads the cache-busted Loves invite parser', async () => {
    const index = await readWorkspaceFile('index.html');
    assert.match(index, /js\/imessage\/4_chat_ai\.js\?v=[^"']*single-chat-prompt-v8/);
});

test('the black Loves invite button keeps its label white', async () => {
    const [index, css] = await Promise.all([
        readWorkspaceFile('index.html'),
        readWorkspaceFile('css/loves.css')
    ]);

    assert.match(index, /css\/loves\.css\?v=20260719-friend-phone-bilingual-v8/);
    assert.match(css, /\.loves-note-action-invite\s*\{[\s\S]*?background:\s*var\(--loves-accent\);[\s\S]*?color:\s*#fff\s*!important;[\s\S]*?-webkit-text-fill-color:\s*#fff;/);
});
