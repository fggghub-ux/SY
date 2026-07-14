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

test('offline prompt settings retain order and expose streaming beneath world books', async () => {
    const [source, coreSource, cssSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('js/imessage/2_core.js'),
        readWorkspaceFile('css/imessage.css'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(source, /if \(source\.length === 0\) return groupOfflinePerspectivePrompts/);
    assert.match(source, /id: 'role_identity',[\s\S]*presetVersion: 3,[\s\S]*Output language: Simplified Chinese \(plain text\)\./);
    assert.match(source, /return normalized;\s*};\s*\n\s*const serializeOfflinePrompts/);
    assert.match(source, /actionGroup\.appendChild\(deleteBtn\)[\s\S]*actionGroup\.appendChild\(toggleLabel\)/);
    assert.match(source, /offline-settings-expand-btn/);
    assert.match(source, /expandBtn\.setAttribute\('aria-expanded'/);
    assert.match(source, /listEl\.appendChild\(wbBtnDiv\);[\s\S]*streamRow\.className = 'offline-settings-streaming'[\s\S]*listEl\.appendChild\(streamRow\);[\s\S]*offline-settings-variable-hint/);
    assert.match(source, /streamCheckbox\.checked = activeFriend\.offlineStreamEnabled !== false/);
    assert.match(source, /streamCheckbox\.addEventListener\('change', async \(\) => \{[\s\S]*const saved = await commitSheetFriendChange[\s\S]*targetFriend\.offlineStreamEnabled = enabled/);
    assert.doesNotMatch(source, /activeFriend\.offlineStreamEnabled = enabled/);
    assert.match(source, /if \(!saved\) \{[\s\S]*streamCheckbox\.checked = !enabled/);
    assert.match(source, /stream: activeFriend\.offlineStreamEnabled !== false/g);
    assert.match(source, /if \(!useStreaming\) \{[\s\S]*response\.json\(\)[\s\S]*choices\?\.\[0\]\?\.message\?\.content/);
    assert.match(coreSource, /normalized\.offlineStreamEnabled = normalized\.offlineStreamEnabled !== false/);
    assert.match(cssSource, /\.offline-settings-expand-btn \{[\s\S]*border-radius: 50%/);
    assert.match(cssSource, /\.offline-settings-streaming \{/);
    assert.match(indexSource, /css\/imessage\.css\?v=20260714-offline-global-theme-v8/);
});
