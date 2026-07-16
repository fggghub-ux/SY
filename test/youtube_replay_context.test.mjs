import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [coreSource, playerSource, communitySource, cssSource, indexSource, userLiveSource, channelSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/6_community.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/8_user_live.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/3_channel.js', import.meta.url), 'utf8')
]);

test('YTB private messages, business messages, and groups use all non-system history', () => {
    assert.doesNotMatch(indexSource, /yt-dm-context-limit-input|yt-group-context-limit-input/);
    assert.doesNotMatch(communitySource, /promptHistory\.slice\(/);
    assert.match(communitySource, /const promptHistory = targetHistory\.filter\(message => message\?\.type !== 'system'\);/);
    assert.match(communitySource, /const historyStr = promptHistory\.map\(/);
    assert.doesNotMatch(coreSource, /dmContextLimit:\s*clampYtContextLimit|contextLimit:\s*clampYtContextLimit/);
    assert.doesNotMatch(userLiveSource, /dmContextLimit:\s*80/);
});

test('Char live archives retain replay identity, transcript, and realtime comment boundary', () => {
    assert.match(playerSource, /id: createYtLiveReplayId\(channel\.id\)/);
    assert.match(playerSource, /isLiveReplay:\s*true/);
    assert.match(playerSource, /realtimeCommentCount:\s*archivedComments\.length/);
    assert.match(playerSource, /liveTranscript:\s*archivedTranscript/);
    assert.match(playerSource, /String\(video\.time \|\| ''\)\.trim\(\) === '刚刚直播结束'/);
    assert.match(playerSource, /index \+ 1 === realtimeCommentCount[\s\S]*appendYtRealtimeCommentsDivider/);
    assert.match(playerSource, /以上为实时评论/);
    assert.match(cssSource, /\.yt-replay-realtime-divider\s*\{[\s\S]*display:\s*flex;/);
});

test('past-video details share comment search, deletion, and replay boundaries for Char and user videos', () => {
    assert.match(indexSource, /id="yt-player-replay-comments-btn"[\s\S]*fa-search/);
    assert.match(indexSource, /id="yt-player-delete-video-btn"[\s\S]*fa-trash-alt/);
    assert.match(indexSource, /yt-player-replay-comments-btn[\s\S]*yt-player-delete-video-btn/);
    assert.match(playerSource, /const isPastVideo = !video\.isLive/);
    assert.match(playerSource, /setYtReplayCommentsButtonState\(isPastVideo,/);
    assert.match(playerSource, /这是普通往期视频，不是直播回放/);
    assert.match(playerSource, /不要声称自己看过直播，也不要表达错过直播/);
    assert.match(playerSource, /请生成 12–16 条与本场直播内容直接相关的回放评论/);
    assert.match(playerSource, /至少一半评论必须使用非中文[\s\S]*至少自然混合 3 种语言/);
    assert.match(playerSource, /comments\.length < 10 \|\| translatedCount < Math\.ceil\(comments\.length \/ 2\)/);
    assert.match(playerSource, /currentVideoData\.id && v\.id === currentVideoData\.id/);
    assert.match(playerSource, /existingComments\.concat\(comments\.map/);
    assert.doesNotMatch(playerSource, /class="yt-history-delete-btn"/);
    assert.match(playerSource, /pastVideos\.splice\(fallbackIndex, 1\)/);
    assert.match(playerSource, /channel\.id === 'user_channel_id'[\s\S]*channelState\?\.pastVideos/);
    assert.match(channelSource, /video\.isLiveReplay = true/);
    assert.match(channelSource, /realtimeCommentCount: Number\(v\.realtimeCommentCount\) \|\| 0/);
    assert.doesNotMatch(channelSource, /class="yt-history-delete-btn"/);
    assert.match(userLiveSource, /isLiveReplay: true[\s\S]*realtimeCommentCount: archivedUserComments\.length/);
    assert.match(indexSource, /js\/youtube\/6_community\.js\?v=20260717-char-lottery-consistency-v18/);
});
