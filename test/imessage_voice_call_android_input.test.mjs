import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [voiceCallSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/imessage/4_chat_voice_call.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('single and group call inputs expose Android send keyboard hints', () => {
    for (const id of ['voice-call-input', 'group-call-input']) {
        assert.match(indexSource, new RegExp(`id="${id}"[^>]*inputmode="text"[^>]*enterkeyhint="send"[^>]*autocomplete="off"[^>]*autocapitalize="sentences"`));
    }
});

test('voice calls use the shared Android input compatibility layer', () => {
    assert.match(voiceCallSource, /function registerCallSendInput\(input, options = \{\}\)/);
    assert.match(voiceCallSource, /window\.mobileInputCompat\.register\(\{/);
    assert.match(voiceCallSource, /singleCallInputCleanup = registerCallSendInput\(newInput,/);
    assert.match(voiceCallSource, /groupCallInputCleanup = registerCallSendInput\(inputEl,/);
    assert.doesNotMatch(voiceCallSource, /newInput\.addEventListener\('keydown'/);
    assert.doesNotMatch(voiceCallSource, /inputEl\.addEventListener\('keydown'/);
});

test('voice call input handlers are removed on reopen and hangup', () => {
    assert.ok((voiceCallSource.match(/singleCallInputCleanup\(\)/g) || []).length >= 2);
    assert.ok((voiceCallSource.match(/groupCallInputCleanup\(\)/g) || []).length >= 2);
});

test('voice-call script is cache-busted after the Android input change', () => {
    assert.match(indexSource, /js\/imessage\/4_chat_voice_call\.js\?v=20260718-android-single-resize-v3/);
    assert.ok(indexSource.indexOf('js/mobile_input_compat.js') < indexSource.indexOf('js/imessage/4_chat_voice_call.js'));
});

test('narrow call inputs cannot push action buttons outside the viewport', () => {
    for (const id of ['voice-call-input', 'group-call-input']) {
        assert.match(indexSource, new RegExp(`id="${id}"[^>]*style="[^"]*width: 0; min-width: 0;`));
    }
    assert.match(indexSource, /id="voice-call-input-row"[^>]*width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box/);
});

test('Android calls follow visualViewport and compact nonessential call chrome', () => {
    assert.match(voiceCallSource, /function bindCallVisualViewport\(input, root, options = \{\}\)/);
    assert.match(voiceCallSource, /const layoutAlreadyResized = restingLayoutHeight - layoutHeight > 100/);
    assert.match(voiceCallSource, /const viewportHeight = layoutAlreadyResized \? layoutHeight : visualHeight/);
    assert.match(voiceCallSource, /const viewportTop = layoutAlreadyResized \? 0 :/);
    assert.match(voiceCallSource, /root\.style\.height = `\$\{viewportHeight\}px`/);
    assert.match(voiceCallSource, /root\.classList\.toggle\('im-call-keyboard-open', keyboardOpen\)/);
    assert.match(voiceCallSource, /collapseElements: \[infoArea, newActionsRow\]/);
    assert.match(voiceCallSource, /collapseElements: \[avatarsGrid\]/);
});
