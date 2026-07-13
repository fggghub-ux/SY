import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [bstageSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/bstage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('all b.stage message inputs expose Android send keyboard hints', () => {
    for (const id of ['bstage-chat-input', 'bstage-fan-chat-input', 'bstage-vid-comment-input']) {
        assert.match(bstageSource, new RegExp(`id="${id}"[^>]*inputmode="text"[^>]*enterkeyhint="send"[^>]*autocomplete="off"`));
    }
});

test('b.stage routes character, fan, and video Enter through the shared compatibility helper', () => {
    assert.match(bstageSource, /function registerBstageSendInput\(input, onSend, options = \{\}\)/);
    assert.match(bstageSource, /window\.mobileInputCompat\.register\(\{/);
    assert.match(bstageSource, /activeCharacterChatInputCleanup = registerBstageSendInput\(inputArea, sendMsg,/);
    assert.match(bstageSource, /registerBstageSendInput\(fanChatInput, sendFanChatMessage,/);
    assert.match(bstageSource, /registerBstageSendInput\(vidInput, sendVideoComment,/);
    assert.doesNotMatch(bstageSource, /inputArea\.onkeydown\s*=/);
});

test('dynamic character chat registration removes the previous handler', () => {
    assert.match(bstageSource, /if \(activeCharacterChatInputCleanup\) activeCharacterChatInputCleanup\(\);/);
});

test('the Android compatibility layer loads before b.stage', () => {
    assert.ok(indexSource.indexOf('js/mobile_input_compat.js') < indexSource.indexOf('js/bstage.js'));
});
