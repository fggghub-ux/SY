import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [coreSource, channelSource, playerSource, communitySource, cssSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/3_channel.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/6_community.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('Char live menu ends a stable live session and archives it before returning home', () => {
    assert.match(indexSource, /id="yt-player-action-end"[\s\S]*结束直播/);
    assert.match(playerSource, /id="yt-player-live-end-btn"[\s\S]*结束直播/);
    assert.match(playerSource, /function archiveYtCurrentCharLive\(channel\)/);
    assert.match(playerSource, /sourceLiveId,[\s\S]*realtimeCommentCount: archivedComments\.length/);
    assert.match(playerSource, /archiveYtCurrentCharLive\(channel\);[\s\S]*generatedContent\.currentLive = null/);
    assert.match(playerSource, /mockVideos = mockVideos\.filter\(item => !\(item\?\.isLive/);
    assert.match(playerSource, /currentLive\?\.id !== requestedLiveId|currentLive\.id !== requestedLiveId/);
    assert.match(playerSource, /renderGeneratedContent\('live'\)/);
});

test('Char header search opens one centered modal configured by the active tab', () => {
    assert.match(indexSource, /id="yt-char-generate-modal"/);
    assert.match(indexSource, /id="yt-char-generate-requirement"/);
    assert.match(indexSource, /id="yt-char-generate-count" value="3" min="1" max="10"/);
    assert.match(playerSource, /getActiveYtCharGenerationTab\(\)/);
    assert.match(playerSource, /live: \{ title: '开始直播'/);
    assert.match(playerSource, /past: \{ title: '生成往期视频'/);
    assert.match(playerSource, /community: \{ title: '生成社区帖子'/);
    assert.match(playerSource, /ytCharGenerateMode === 'live' \? 'none' : 'flex'/);
    assert.match(playerSource, /当前正在直播，请先进入直播间结束本场直播/);
    assert.match(cssSource, /\.yt-char-generate-modal-overlay\s*\{[\s\S]*justify-content:\s*center;[\s\S]*align-items:\s*center;/);
});

test('tab generation validates requested counts and mutates only its target collection', () => {
    assert.match(playerSource, /Math\.max\(1, Math\.min\(10, Math\.round\(Number\(value\) \|\| 3\)\)\)/);
    assert.match(playerSource, /if \(normalized\.length < count\) throw new Error\('INSUFFICIENT_RESULTS'\)/);
    assert.match(playerSource, /return normalized\.slice\(0, count\)/);
    assert.match(playerSource, /generatedContent\.currentLive = live/);
    assert.match(playerSource, /generatedContent\.pastVideos = videos\.concat\(generatedContent\.pastVideos \|\| \[\]\)/);
    assert.match(playerSource, /generatedContent\.communityPosts = posts\.concat\(generatedContent\.communityPosts \|\| \[\]\)/);
    assert.match(playerSource, /openNewYtCharLive\(live, channel\)/);
    assert.match(playerSource, /用户要求不得覆盖 JSON、语言、翻译、数量和安全协议/);
});

test('every non-user Char owns a fixed frontend-counted fan group', () => {
    assert.match(coreSource, /function ensureYtFixedCharFanGroup\(channel\)/);
    assert.match(coreSource, /channel\.id === 'user_channel_id' \|\| channel\.isUserOwnedCommunity \|\| channel\.isBusiness/);
    assert.match(coreSource, /name: `\$\{String\(channel\.name \|\| 'Char'\)[\s\S]*\}的粉丝群`/);
    assert.match(coreSource, /Math\.floor\(Math\.random\(\) \* \(50000 - 500 \+ 1\)\) \+ 500/);
    assert.match(coreSource, /memberCountSource: 'frontend'/);
    assert.match(channelSource, /ensureYtFixedCharFanGroup\(sub\)/);
    assert.match(communitySource, /groupNameInput\.readOnly = !currentSubChannelData\.isUserOwnedCommunity/);
    assert.match(communitySource, /currentSubChannelData\.isUserOwnedCommunity && groupNameInput/);
    assert.match(indexSource, /js\/youtube\/3_channel\.js\?v=20260715-user-vod-parity-v2/);
});
