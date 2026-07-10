import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [bstageSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/bstage.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('b.stage waits for durable state before initializing subscriber growth', () => {
    assert.match(bstageSource, /\/\/ Load data on init\s*loadBstageData\(\);\s*\/\/ Hook window functions/);
    assert.match(bstageSource, /window\.bstageDataReadyPromise\s*=\s*window\.globalDataReadyPromise\.then\(\(\) => \{\s*loadBstageData\(\);\s*startFanSubscriberGrowth\(\);/);
    assert.match(bstageSource, /window\.addEventListener\('pagehide', flushBstageDataNow\)/);
    assert.match(bstageSource, /if \(document\.visibilityState === 'hidden'\) flushBstageDataNow\(\)/);
    assert.match(indexSource, /js\/bstage\.js\?v=20260710-storage-ready-v2/);
});

test('b.stage char chat persists a generated batch before replaying message bubbles', () => {
    assert.match(bstageSource, /function saveBstageData\(options = \{\}\)/);
    assert.match(bstageSource, /const playbackItems = \[\];/);
    assert.match(bstageSource, /const persisted = await saveBstageData\(\{ flush: true \}\);\s*if \(!persisted\) throw new Error\('storage_write_failed'\);/);
    assert.match(bstageSource, /for \(const item of playbackItems\) \{\s*const waitMs = Math\.max\(0, item\.delay - previousDelay\);/);
    assert.match(bstageSource, /inputArea\.disabled = true;[\s\S]*inputArea\.disabled = false;/);
});
