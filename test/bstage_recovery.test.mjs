import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const bridgeSource = await fs.readFile(new URL('../js/app_state_bridge.js', import.meta.url), 'utf8');

test('durable b.stage Char chat survives an early default runtime write', async () => {
    let resolveStorageReady;
    const durableBstage = {
        updatedAt: 100,
        bstageUserTeamState: {
            id: '__bstage_user_team__',
            members: [{ id: 'char-1', chatHistory: [{ id: 'message-1', text: '已保存的聊天' }] }]
        }
    };
    const appStorage = {
        ready: new Promise((resolve) => {
            resolveStorageReady = resolve;
        }),
        readDomain(key, fallback) {
            return key === 'bstage' ? durableBstage : fallback;
        },
        async loadGlobalData() {
            return {};
        },
        async commitDomain() {
            return true;
        }
    };
    const scheduledTasks = [];
    const window = {
        appStorage,
        addEventListener() {},
        setTimeout(callback) {
            scheduledTasks.push(callback);
            return scheduledTasks.length;
        },
        clearTimeout() {}
    };
    const context = {
        window,
        document: { addEventListener() {} },
        console,
        structuredClone,
        setTimeout: window.setTimeout,
        clearTimeout: window.clearTimeout
    };

    vm.runInNewContext(bridgeSource, context, { filename: 'app_state_bridge.js' });
    window.setAppState('bstage', {});
    resolveStorageReady();
    await window.globalDataReadyPromise;

    const recovered = window.getAppState('bstage');
    assert.equal(recovered.bstageUserTeamState.members[0].chatHistory.length, 1);
    assert.equal(recovered.bstageUserTeamState.members[0].chatHistory[0].text, '已保存的聊天');
});
