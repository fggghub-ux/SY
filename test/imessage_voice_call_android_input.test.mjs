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

test('single and group call Enter sends keep keyboard focus', () => {
    assert.match(voiceCallSource, /const dismissAfterSend = options\.dismissAfterSend !== false/);
    assert.match(voiceCallSource, /if \(dismissAfterSend && sent !== false\) input\.blur\(\)/);
    assert.match(voiceCallSource, /if \(!String\(input\.value \|\| ''\)\.trim\(\)\) return;\s*sendAndMaybeDismiss\(\)/);
    assert.match(voiceCallSource, /singleCallInputCleanup = registerCallSendInput\(newInput, \{[\s\S]*?collapseElements: \[infoArea, newActionsRow\],[\s\S]*?dismissAfterSend: false,[\s\S]*?onSend:/);
    assert.match(voiceCallSource, /bindCallFocusPreservingAction\(newSendBtn, async \(\) => \{[\s\S]*?newInput\.value = ''/);
    assert.match(voiceCallSource, /groupCallInputCleanup = registerCallSendInput\(inputEl, \{[\s\S]*?collapseElements: \[avatarsGrid\],[\s\S]*?dismissAfterSend: false,[\s\S]*?onSend:/);
});

test('voice call input handlers are removed on reopen and hangup', () => {
    assert.ok((voiceCallSource.match(/singleCallInputCleanup\(\)/g) || []).length >= 2);
    assert.ok((voiceCallSource.match(/groupCallInputCleanup\(\)/g) || []).length >= 2);
});

test('voice-call script is cache-busted after the Android input change', () => {
    assert.match(indexSource, /js\/imessage\/4_chat_voice_call\.js\?v=[^"']*call-keyboard-minimize-v2/);
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
    assert.match(voiceCallSource, /const keyboardOpen = focused && restingHeight - viewportHeight > 100/);
    assert.match(voiceCallSource, /if \(!keyboardOpen\) \{[\s\S]*restoreLayout\(shouldScroll\);[\s\S]*return;/);
    assert.match(voiceCallSource, /root\.style\.height = `\$\{viewportHeight\}px`/);
    assert.match(voiceCallSource, /root\.classList\.add\('im-call-keyboard-open'\)/);
    assert.match(voiceCallSource, /input\.addEventListener\('focus', handleFocus\)/);
    assert.match(voiceCallSource, /input\.addEventListener\('blur', handleBlur\)/);
    assert.doesNotMatch(voiceCallSource, /input\.addEventListener\('focus', applyViewport\)/);
    assert.match(voiceCallSource, /collapseElements: \[infoArea, newActionsRow\]/);
    assert.match(voiceCallSource, /collapseElements: \[avatarsGrid\]/);
});

test('call actions preserve focus and keyboard-sized layouts remain until keyboard retreat', () => {
    assert.match(voiceCallSource, /function bindCallFocusPreservingAction\(element, handler\)/);
    assert.match(voiceCallSource, /element\.addEventListener\('pointerdown', handlePointerDown, \{ passive: false \}\)/);
    assert.match(voiceCallSource, /bindCallFocusPreservingAction\(newSendBtn, async \(\) =>/);
    assert.match(voiceCallSource, /bindCallFocusPreservingAction\(newAiBtn, async \(\) =>/);
    assert.match(voiceCallSource, /bindCallFocusPreservingAction\(sendBtn, \(\) =>/);
    assert.match(voiceCallSource, /bindCallFocusPreservingAction\(aiBtn, async \(\) =>/);
    assert.match(voiceCallSource, /const keyboardStillRetreating = keyboardWasOpen && !focused/);
    assert.match(voiceCallSource, /function waitForCallKeyboardToClose\(input, timeout = 460\)/);
});

test('minimized calls release their fullscreen background hit target', () => {
    assert.match(voiceCallSource, /newMinimizeBtn\.addEventListener\('click', async \(\) => \{[\s\S]*?bgEl\.style\.pointerEvents = 'none'/);
    assert.match(voiceCallSource, /minimizedFloat\.addEventListener\('click',[\s\S]*?bgEl\.style\.pointerEvents = 'auto'/);
    assert.match(voiceCallSource, /minimizeBtn\.addEventListener\('click', async \(\) => \{[\s\S]*?groupBgEl\.style\.pointerEvents = 'none'/);
});

test('single calls expose connected minimized state only to the matching friend', () => {
    assert.match(voiceCallSource, /window\.imChat\.getActiveSingleCallContext = function\(friendOrId\)/);
    assert.match(voiceCallSource, /if \(!activeSingleCallContext\?\.connected\) return null/);
    assert.match(voiceCallSource, /String\(friendId \?\? ''\) !== activeSingleCallContext\.friendId/);
    assert.match(voiceCallSource, /activeSingleCallContext\.connected = true/);
    assert.match(voiceCallSource, /newMinimizeBtn\.addEventListener\('click', async \(\) => \{[\s\S]*?activeSingleCallContext\.minimized = true/);
    assert.match(voiceCallSource, /minimizedFloat\.addEventListener\('click',[\s\S]*?activeSingleCallContext\.minimized = false/);
    assert.match(voiceCallSource, /activeSingleCallContext = null/);
});

test('ordinary single-chat API receives minimized ongoing-call context without affecting groups', async () => {
    const aiSource = await fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8');
    assert.match(aiSource, /function buildMinimizedSingleCallContextPrompt\(friend\)/);
    assert.match(aiSource, /if \(!friend \|\| friend\.type === 'group'\) return ''/);
    assert.match(aiSource, /window\.imChat\.getActiveSingleCallContext\(friend\)/);
    assert.match(aiSource, /!callContext\?\.active \|\| !callContext\.connected \|\| !callContext\.minimized/);
    assert.match(aiSource, /单人语音通话尚未挂断/);
    assert.match(aiSource, /通着电话却又打字/);
    assert.match(aiSource, /不要机械复述/);
    assert.match(aiSource, /<active_single_call_context priority="immediate">/);
    assert.match(aiSource, /if \(minimizedSingleCallContextPrompt\) \{[\s\S]*?role: 'system',[\s\S]*?content: minimizedSingleCallContextPrompt/);
    assert.doesNotMatch(aiSource, /\$\{singleChatHumanPrompt\}\$\{minimizedSingleCallContextPrompt\}/);

    const temporalContextIndex = aiSource.indexOf('if (String(temporalContext');
    const activeCallContextIndex = aiSource.indexOf('if (minimizedSingleCallContextPrompt)', temporalContextIndex);
    const finalFormatIndex = aiSource.indexOf('const finalChatJsonFormatReminder', activeCallContextIndex);
    assert.ok(temporalContextIndex >= 0 && temporalContextIndex < activeCallContextIndex);
    assert.ok(activeCallContextIndex < finalFormatIndex);
});
