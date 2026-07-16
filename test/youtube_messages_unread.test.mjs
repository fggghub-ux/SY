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

test('friend threads without DM history render safely before their first message', () => {
    assert.match(coreSource, /const dmHistory = Array\.isArray\(sub\.dmHistory\) \? sub\.dmHistory : \[\]/);
    assert.match(coreSource, /const lastMsg = dmHistory\.length > 0 \? dmHistory\[dmHistory\.length - 1\] : null/);
    assert.match(coreSource, /lastMsg\?\.isOffer[\s\S]*lastMsg\?\.text \|\| '暂无消息'/);
    assert.doesNotMatch(coreSource, /const lastMsg = sub\.dmHistory\[sub\.dmHistory\.length - 1\]/);
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

test('YTB private messages receive bounded public context from both sides past videos', () => {
    assert.match(communitySource, /function summarizeYtDmPastVideos\(videos, ownerLabel\)/);
    assert.match(communitySource, /\.slice\(0, 6\)/);
    assert.match(communitySource, /char\?\.generatedContent\?\.pastVideos/);
    assert.match(communitySource, /channelState\?\.pastVideos/);
    assert.match(communitySource, /liveTranscript[\s\S]*initialBubbles[\s\S]*comments/);
    assert.match(communitySource, /【双方往期视频公开内容】/);
    assert.match(communitySource, /不能声称看过这里没有记录的内容/);
    assert.match(communitySource, /if \(isDM\)[\s\S]*dmPastVideoContext/);
});
