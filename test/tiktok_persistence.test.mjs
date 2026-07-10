import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [tiktokCoreSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/tiktok/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('TikTok state is rehydrated after IndexedDB-backed global data becomes ready', () => {
    assert.match(tiktokCoreSource, /window\.tkLoadStateFromStore\s*=\s*function\(\)\s*\{[\s\S]*Object\.assign\(tkState, nextState\)/);
    assert.match(tiktokCoreSource, /window\.globalDataReadyPromise\.then\(\(\) => \{/);
    assert.match(tiktokCoreSource, /window\.tkLoadStateFromStore\(\);\s*refreshTkUiAfterHydration\(\);/);
    assert.match(tiktokCoreSource, /window\.tkDataReadyPromise\s*=/);
    assert.match(indexSource, /js\/tiktok\/2_core\.js\?v=20260710-storage-ready-v1/);
});
