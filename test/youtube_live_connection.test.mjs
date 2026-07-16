import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [playerSource, userLiveSource, indexSource, cssSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/8_user_live.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8')
]);

test('Char and user live rooms expose the shared right-side call-in controls and animated seats', () => {
    assert.match(indexSource, /id="yt-player-connect-btn"[\s\S]*id="yt-player-chat-input"/);
    assert.match(indexSource, /id="yt-user-live-connect-btn"[\s\S]*id="yt-user-live-chat-input"/);
    assert.match(indexSource, /id="yt-char-live-connection-card"[\s\S]*yt-live-connection-duration/);
    assert.match(indexSource, /id="yt-user-live-connection-card" class="yt-live-connections-stack"/);
    assert.match(cssSource, /@keyframes ytLiveConnectionWave/);
    assert.match(cssSource, /\.yt-live-connection-card\s*\{[\s\S]*right: 14px;[\s\S]*bottom: 14px;/);
    assert.match(cssSource, /\.yt-live-connections-stack\s*\{[\s\S]*flex-direction: column-reverse/);
    assert.match(cssSource, /\.yt-live-connection-bubble\s*\{[\s\S]*border-radius: 999px/);
    assert.match(cssSource, /\.yt-live-connection-narrative\s*\{[\s\S]*font-style: italic/);
    assert.doesNotMatch(indexSource, /id="yt-char-live-connection-card"[\s\S]{0,1000}yt-live-connection-bubbles/);
});

test('Char call-in waits three seconds, persists the user transcript, and requires ten kickoff comments', () => {
    assert.match(playerSource, /status: 'connecting'[\s\S]*requestedAt: Date\.now\(\)/);
    assert.match(playerSource, /Number\(connection\.requestedAt\) \+ 3000/);
    assert.match(playerSource, /speakerType: 'user'[\s\S]*connection\.transcript\.push/);
    assert.match(playerSource, /addCharLiveBubble\(\{[\s\S]*participantName[\s\S]*skipPersist: true/);
    assert.match(playerSource, /fanComments or passerbyComments must generate 10–14 relevant comments|fanComments 或 passerbyComments 必须生成 10–14 条相关评论/);
    assert.match(playerSource, /bubbles\.length < 1 \|\| comments\.length < 10 \|\| !connectionNarrative\.text/);
    assert.match(playerSource, /connection\.kickoffCompleted = true|latest\.kickoffCompleted = true/);
    assert.match(playerSource, /主播私有连线资料[\s\S]*观众可见的公开连线记录[\s\S]*严格信息边界/);
    assert.match(playerSource, /hasManagedConnectionSession[\s\S]*activeConnection\?\.participant \|\| null/);
    assert.match(playerSource, /历史连线均已结束[\s\S]*不得把历史参与者描述成仍在通话/);
});

test('User live supports up to three independent sessions and strictly routes guestTurns', () => {
    assert.match(playerSource, /function getYtSubscribedConnectionOptions\(\)/);
    assert.match(playerSource, /option\.isSubscribed !== false[\s\S]*option\.isBusiness !== true/);
    assert.match(playerSource, /userLiveSelectedGuests[\s\S]*\.slice\(0, 3\)/);
    assert.match(userLiveSource, /live\.connections = live\.connection[\s\S]*\[live\.connection\]/);
    assert.match(userLiveSource, /connections\.length >= 3/);
    assert.match(userLiveSource, /participantName[\s\S]*bubble\.className = 'yt-user-live-bubble'/);
    assert.doesNotMatch(userLiveSource, /seat\.innerHTML = `[\s\S]{0,1600}yt-live-connection-bubbles/);
    assert.match(userLiveSource, /excludeIds: excludedIds/);
    assert.match(userLiveSource, /guestTurns 必须且只能覆盖以下在线 participantId/);
    assert.match(userLiveSource, /hasDuplicateId \|\| hasUnknownId \|\| hasMissingId \|\| hasInvalidTurn/);
    assert.match(userLiveSource, /bubbles\.length < 3 \|\| bubbles\.length > 8 \|\| !narrativeText/);
    assert.match(userLiveSource, /scheduleUserLiveConnectionRestore\(\)/);
    assert.match(userLiveSource, /function renderUserLiveConnections\(\)[\s\S]*stopUserLiveConnectionDurationTimers\(\)/);
    assert.doesNotMatch(userLiveSource, /function renderUserLiveConnections\(\)[\s\S]{0,120}stopUserLiveConnectionTimers\(\)/);
    assert.match(userLiveSource, /initialGuests\.forEach\(beginUserLiveConnection\)/);
    assert.match(userLiveSource, /archiveAllUserLiveConnections\(\)/);
    assert.match(userLiveSource, /transcript: Array\.isArray\(connection\.transcript\)/);
});

test('Video editor no longer owns guest state and connection history remains replay data', () => {
    assert.doesNotMatch(indexSource, /id="yt-edit-video-guest-selector"/);
    assert.doesNotMatch(playerSource, /tempGuestData|ytEditVideoGuest/);
    assert.match(playerSource, /connectionHistory:[\s\S]*transcript:/);
});

test('Char live creation and ending re-resolve canonical channel and live identities', () => {
    assert.match(playerSource, /function resolveCanonicalYtCharLive\(\)/);
    assert.match(playerSource, /requestedLiveId[\s\S]*String\(requestedLiveId\) !== String\(currentLive\.id\)/);
    assert.match(playerSource, /currentSubChannelData = canonicalChannel;[\s\S]*renderGeneratedContent\('live'\);[\s\S]*openNewYtCharLive/);
    assert.match(playerSource, /const channel = \(Array\.isArray\(mockSubscriptions\)[\s\S]*archiveYtCurrentCharLive\(channel\)/);
    assert.match(playerSource, /id: data\.currentLive\.id \|\| ''[\s\S]*liveId: data\.currentLive\.id \|\| ''/);
});
