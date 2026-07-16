import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => readFile(new URL(path, root), 'utf8');

test('shared chat format prompt requires atomic bubbles for single and group chat', async () => {
    const source = await readWorkspaceFile('js/imessage/4_chat_ai.js');

    assert.match(source, /每一个对象只对应一条原子消息/);
    assert.match(source, /连续说三句不同的话，就输出三个 text 对象/);
    assert.match(source, /\$\{chatBubbleFormatGuardPrompt\}/);
    assert.ok((source.match(/\$\{chatBubbleFormatGuardPrompt\}/g) || []).length >= 2);
});

test('batch deletion is available from the header instead of a bottom action bar', async () => {
    const source = await readWorkspaceFile('js/imessage/4_chat_interface.js');

    assert.match(source, /chat-batch-header[\s\S]*class="batch-delete-btn"[\s\S]*>删除<\/button>/);
    assert.doesNotMatch(source, /chat-batch-action-bar/);
    assert.match(source, /batchDeleteBtn\.addEventListener\('click'/);
});

test('offline prompt settings retain order, expose streaming, and keep reasoning internal', async () => {
    const [source, coreSource, cssSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('js/imessage/2_core.js'),
        readWorkspaceFile('css/imessage.css'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(source, /if \(source\.length === 0\) return orderOfflinePromptsForHistoryAnchor/);
    assert.match(source, /id: 'role_identity',[\s\S]*presetVersion: 3,[\s\S]*Output language: Simplified Chinese \(plain text\)\./);
    assert.match(source, /return historyAnchorOrderVersion >= 3[\s\S]*\? normalized[\s\S]*: orderOfflinePromptsForHistoryAnchor\(normalized\);\s*};\s*\n\s*const serializeOfflinePrompts/);
    assert.match(source, /actionGroup\.appendChild\(deleteBtn\)[\s\S]*actionGroup\.appendChild\(toggleLabel\)/);
    assert.match(source, /offline-settings-expand-btn/);
    assert.match(source, /expandBtn\.setAttribute\('aria-expanded'/);
    assert.match(source, /listEl\.appendChild\(wbBtnDiv\);[\s\S]*streamRow\.className = 'offline-settings-streaming'[\s\S]*listEl\.appendChild\(streamRow\);[\s\S]*offline-settings-variable-hint/);
    assert.match(source, /streamCheckbox\.checked = activeFriend\.offlineStreamEnabled !== false/);
    assert.match(source, /streamCheckbox\.addEventListener\('change', async \(\) => \{[\s\S]*const saved = await commitSheetFriendChange[\s\S]*targetFriend\.offlineStreamEnabled = enabled/);
    assert.doesNotMatch(source, /activeFriend\.offlineStreamEnabled = enabled/);
    assert.match(source, /if \(!saved\) \{[\s\S]*streamCheckbox\.checked = !enabled/);
    assert.match(source, /stream: activeFriend\.offlineStreamEnabled !== false/g);
    assert.doesNotMatch(source, /请求模型思考|reasoningCheckbox|reasoningToggle/);
    assert.doesNotMatch(source, /maxTokensInput|最大回复 Token<\/strong>/);
    assert.match(source, /requestReasoning: true/g);
    assert.match(source, /const OFFLINE_MAX_RESPONSE_TOKENS = 30000/);
    assert.match(source, /maxTokens: OFFLINE_MAX_RESPONSE_TOKENS/);
    assert.doesNotMatch(source, /maxResponseTokens: activeFriend\.offlineMaxResponseTokens/);
    assert.match(source, /if \(!useStreaming \|\| returnedJsonInsteadOfStream\) \{[\s\S]*response\.json\(\)[\s\S]*responseMessage\.content/);
    assert.match(coreSource, /normalized\.offlineStreamEnabled = normalized\.offlineStreamEnabled !== false/);
    assert.match(coreSource, /normalized\.offlineRequestReasoning = true/);
    assert.match(coreSource, /normalized\.offlineMaxResponseTokens = 30000/);
    assert.match(coreSource, /normalized\.offlineMaxResponseTokensVersion = 2/);
    assert.match(cssSource, /\.offline-settings-expand-btn \{[\s\S]*border-radius: 50%/);
    assert.match(cssSource, /\.offline-settings-streaming \{/);
    assert.match(cssSource, /\.offline-settings-number-input \{/);
    assert.match(indexSource, /css\/imessage\.css\?v=20260716-status-prompt-v3/);
});

test('offline prompts use one global work copy with named preset import and migration', async () => {
    const [source, coreSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('js/imessage/2_core.js')
    ]);

    for (const field of ['offlinePrompts', 'offlinePromptPresets', 'offlinePromptActivePresetId', 'offlinePromptsInitialized']) {
        assert.match(coreSource, new RegExp(`${field}:`));
        assert.match(source, new RegExp(`window\\.imData\\.${field}`));
    }
    assert.match(source, /buildOfflineApiMessages[\s\S]*ensureGlobalOfflinePrompts\(activeFriend\)/);
    assert.match(source, /isOfflineBarragePromptEnabled[\s\S]*ensureGlobalOfflinePrompts\(friend\)/);
    assert.match(source, /isOfflineChoicesPromptEnabled[\s\S]*ensureGlobalOfflinePrompts\(friend\)/);
    assert.doesNotMatch(source, /targetFriend\.offlinePrompts\s*=/);
    assert.match(source, /signatureToPreset\.has\(signature\)/);
    assert.match(source, /preferredFriend \|\| window\.imData\.currentActiveFriend/);
    assert.match(source, /delete targetFriend\.offlinePrompts/);
    assert.match(source, /offlinePromptMigrationSavePromise[\s\S]*scheduleLegacyOfflinePromptCleanup/);
    assert.match(source, /window\.imApp\.saveGlobalOfflinePrompts = persistGlobalOfflinePromptState/);
    assert.match(source, /所有角色和群聊共用当前线下提示词/);
    assert.match(source, /type: 'u2-offline-prompts',[\s\S]*version: 1/);
    assert.match(source, /const sourcePrompts = Array\.isArray\(payload\) \? payload : payload\?\.prompts/);
    assert.match(source, /preset\.name\.toLocaleLowerCase\(\) === name\.toLocaleLowerCase\(\)/);
    assert.match(source, /markPromptWorkCopyCustom\(\);[\s\S]*scheduleOfflinePromptsPersist\(prompts\)/);
    assert.match(source, /提示词预设已删除，当前提示词保持不变/);
});

test('offline reasoning remains separated from prose and visible in a disclosure panel', async () => {
    const [source, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(source, /reasoning: rawMessage\.role === 'assistant' \? String\(rawMessage\.reasoning \|\| ''\) : ''/);
    assert.match(source, /class="offline-tavern-thinking-toggle" aria-expanded=/);
    assert.match(source, />思考过程<\/span>/);
    assert.match(source, /renderOfflineThinkingState\(bubbleDiv, parsed\.reasoning, \{ expanded: !generationFinished \}\)/);
    assert.match(source, /renderOfflineThinkingState\(bubble, parsed\.reasoning, \{ expanded: streaming && !!parsed\.reasoning \}\)/);
    assert.match(source, /finish: \(\) => \{[\s\S]*renderStreamState\(false\)/);
    assert.match(source, /renderOfflineCurrentMessages\(activeFriend\);[\s\S]*console\.error\('Offline reroll failed'/);
    assert.match(indexSource, /js\/imessage\/4_chat_sheet\.js\?v=20260716-offline-cot-v5/);
});
