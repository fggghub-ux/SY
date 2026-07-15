import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [coreSource, communitySource, liveSource, indexSource, cssSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/6_community.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/8_user_live.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8')
]);

test('YTB message navigation and unread threads render red dots', () => {
    assert.match(indexSource, /id="yt-messages-nav-item"[\s\S]*id="yt-messages-nav-unread"/);
    assert.match(cssSource, /\.yt-messages-nav-unread\s*\{[\s\S]*background:\s*#ff3b30/);
    assert.match(cssSource, /\.yt-message-thread-unread\s*\{[\s\S]*background:\s*#ff3b30/);
    assert.match(coreSource, /unreadCount > 0 \? '<span class="yt-message-thread-unread"/);
});

test('new incoming and lottery winner DMs persist unread counts until their thread opens', () => {
    assert.match(coreSource, /unreadDmCount:\s*Math\.max\(0, Math\.round\(Number\(sub\.unreadDmCount\)/);
    assert.match(coreSource, /newSub\.unreadDmCount = Math\.max\(1, newSub\.dmHistory\.length\)/);
    assert.match(liveSource, /window\.markYtMessagesUnread\(contact, batch\.messages\.length\)/);
    assert.match(coreSource, /currentSubChannelData = sub;[\s\S]*sub\.unreadDmCount = 0;[\s\S]*saveYoutubeData\(\);[\s\S]*updateYtMessageUnreadIndicators\(\);[\s\S]*renderMessagesList\(\)/);
    assert.match(coreSource, /openDMChat\(currentSubChannelData\)/);
    assert.match(communitySource, /groupChatView\.classList\.remove\('active'\);[\s\S]*renderMessagesList\(\)/);
    assert.match(coreSource, /ytMessagesNavUnread\?\.classList\.toggle\('is-visible', unreadCount > 0\)/);
});
