import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.window = { imChat: {} };
globalThis.document = {
    addEventListener(eventName, callback) {
        if (eventName === 'DOMContentLoaded') callback();
    }
};

await import('../js/imessage/4_chat_link.js');

test('extracts the first URL from common Chinese share text', () => {
    const input = '复制这条消息，打开小红书 https://xhslink.com/aBc123，查看笔记。';
    assert.equal(window.imChat.extractFirstExternalUrl(input), 'https://xhslink.com/aBc123');
});

test('rejects non-http input and recognizes supported host aliases', () => {
    assert.equal(window.imChat.extractFirstExternalUrl('javascript:alert(1)'), '');
    assert.equal(window.imChat.detectLinkPlatform('https://www.xiaohongshu.com/explore/1').id, 'xiaohongshu');
    assert.equal(window.imChat.detectLinkPlatform('https://v.douyin.com/abc').id, 'douyin');
    assert.equal(window.imChat.detectLinkPlatform('https://b23.tv/abc').id, 'bilibili');
    assert.equal(window.imChat.detectLinkPlatform('https://m.weibo.cn/status/abc').id, 'weibo');
    assert.equal(window.imChat.detectLinkPlatform('https://example.com/a').id, 'web');
});

test('keeps resolver configuration in the iMessage link composer instead of API settings', async () => {
    const [html, settingsSource, linkSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_link.js', import.meta.url), 'utf8')
    ]);
    assert.equal(html.includes('id="link-resolver-endpoint-input"'), false);
    assert.equal(settingsSource.includes('linkResolverEndpoint:'), false);
    assert.match(linkSource, /im-link-resolver-input/);
    assert.match(linkSource, /setLinkResolverConfig/);
    assert.match(linkSource, /saveGlobalData/);
});
