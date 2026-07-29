import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => readFile(new URL(path, root), 'utf8');

test('virtual image composer keeps the iMessage modal implementation and focuses its prompt', async () => {
    const [coreSource, legacySource, sheetSource] = await Promise.all([
        readWorkspaceFile('js/imessage/2_core.js'),
        readWorkspaceFile('script.js'),
        readWorkspaceFile('js/imessage/4_chat_sheet.js')
    ]);

    assert.match(coreSource, /setTimeout\(\(\) => modalInput\.focus\(\), 300\)/);
    assert.match(
        legacySource,
        /if \(typeof window\.showCustomModal !== 'function'\) \{\s*window\.showCustomModal = function/
    );
    assert.match(
        sheetSource,
        /const showModal = window\.imApp\?\.showCustomModal \|\| window\.showCustomModal/
    );
});

test('image sends stay bound to the chat that opened the attachment sheet', async () => {
    const [sheetSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(sheetSource, /sheet\.dataset\.friendId = String\(activeFriend\.id\)/);
    assert.match(sheetSource, /const targetFriend = getAttachmentTargetFriend\(\)/);
    assert.match(sheetSource, /imageSource: 'virtual',\s*friendId: targetFriend\.id/);
    assert.match(sheetSource, /imageSource: 'real',\s*fileName: file\.name,\s*friendId: targetFriend\.id/);
    assert.match(
        sheetSource,
        /const friendId = options\.friendId \?\? window\.imData\.currentActiveFriend\?\.id/
    );
    assert.match(sheetSource, /未找到当前聊天对象，图片发送失败/);
    assert.match(indexSource, /4_chat_sheet\.js\?v=20260718-offline-cot-v1-chat-image-send-v1/);
    assert.match(indexSource, /script\.js\?v=20260725-modal-owner-v1/);
});
