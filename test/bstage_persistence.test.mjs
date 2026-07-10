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
    assert.match(indexSource, /js\/bstage\.js\?v=20260710-storage-ready-v1/);
});
