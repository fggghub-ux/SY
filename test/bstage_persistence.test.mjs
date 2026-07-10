import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [bstageSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/bstage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('b.stage waits for durable state before initializing subscriber growth', () => {
    assert.match(bstageSource, /\/\/ Load data on init\s*loadBstageData\(\{ persistNormalized: false \}\);\s*\/\/ Hook window functions/);
    assert.match(bstageSource, /let bstageHydrationComplete = false;/);
    assert.match(bstageSource, /function saveBstageData\(options = \{\}\) \{\s*if \(!bstageHydrationComplete\) return false;/);
    assert.match(bstageSource, /window\.bstageDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then\(async \(\) => \{\s*const normalized = loadBstageData\(\{ persistNormalized: true \}\);\s*bstageHydrationComplete = true;/);
    assert.match(bstageSource, /startFanSubscriberGrowth\(\);\s*initAllAutoActivities\(\);/);
    assert.doesNotMatch(bstageSource, /setTimeout\(initAllAutoActivities, 1000\)/);
    assert.match(bstageSource, /window\.addEventListener\('pagehide', flushBstageDataNow\)/);
    assert.match(bstageSource, /if \(document\.visibilityState === 'hidden'\) flushBstageDataNow\(\)/);
    assert.match(indexSource, /js\/bstage\.js\?v=20260710-bstage-idb-only-v4/);
    assert.match(indexSource, /js\/storage\/app_storage\.js\?v=20260710-storage-idb-only-v9/);
});

test('b.stage recovery signature includes member chat history changes', () => {
    assert.match(bstageSource, /teamChatHistoryCounts: teams\.map\(team => getMemberChatHistoryCounts\(team\?\.members\)\)/);
    assert.match(bstageSource, /userTeamChatHistoryCounts: getMemberChatHistoryCounts\(userTeam\.members\)/);
});

test('b.stage char chat persists a generated batch before replaying message bubbles', () => {
    assert.match(bstageSource, /function saveBstageData\(options = \{\}\)/);
    assert.match(bstageSource, /const playbackItems = \[\];/);
    assert.match(bstageSource, /const persisted = await saveBstageData\(\{ flush: true \}\);\s*if \(!persisted\) throw new Error\('storage_write_failed'\);/);
    assert.match(bstageSource, /for \(const item of playbackItems\) \{\s*const waitMs = Math\.max\(0, item\.delay - previousDelay\);/);
    assert.match(bstageSource, /inputArea\.disabled = true;[\s\S]*inputArea\.disabled = false;/);
});

test('b.stage resolves the canonical member before generating and before saving generated replies', () => {
    assert.match(bstageSource, /function findCanonicalBstageMember\(memberId, preferredTeamId = null\)/);
    assert.match(bstageSource, /async function triggerChatApi[\s\S]*const initialCanonical = findCanonicalBstageMember\(member\?\.id, currentTeam\?\.id\)/);
    assert.match(bstageSource, /const resolvedMember = findCanonicalBstageMember\(member\.id, currentTeam\?\.id\);\s*if \(!resolvedMember\) \{\s*throw new Error\('chat_member_removed'\);/);
    assert.match(bstageSource, /function rebindActiveBstageReferences\(\)/);
});
