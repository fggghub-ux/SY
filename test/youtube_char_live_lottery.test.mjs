import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [playerSource, indexSource, cssSource, coreSource, userLiveSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/8_user_live.js', import.meta.url), 'utf8')
]);

test('Char live exposes a persistent join-or-skip lottery modal', () => {
    assert.match(indexSource, /id="yt-char-live-lottery-modal"/);
    assert.match(indexSource, /id="yt-char-live-lottery-prize"/);
    assert.match(indexSource, /id="yt-char-live-lottery-skip"[^>]*>不参与</);
    assert.match(indexSource, /id="yt-char-live-lottery-join"[^>]*>参与抽奖</);
    assert.match(cssSource, /\.yt-char-live-lottery-overlay\s*\{[\s\S]*justify-content:\s*center/);
    assert.match(cssSource, /\.yt-char-live-lottery-card\s*\{[\s\S]*border-radius:\s*24px/);
});

test('successful Char API turns only trigger one lottery at a small frontend probability', () => {
    assert.match(playerSource, /const YT_CHAR_LOTTERY_TRIGGER_RATE = 0\.03/);
    assert.match(playerSource, /lotterySuggestion=\{[^\n]*prize[^\n]*durationSec/);
    assert.match(playerSource, /resolved\.live\.charLottery\?\.status === 'active'\) return false/);
    assert.match(playerSource, /else if \(Math\.random\(\) >= YT_CHAR_LOTTERY_TRIGGER_RATE\)/);
    assert.match(playerSource, /maybeStartYtCharLiveLottery\(responseObj\)/);
    assert.match(playerSource, /resolved\.live\.charLottery = lottery/);
    assert.match(playerSource, /endAt: now \+ durationSec \* 1000/);
});

test('explicit user lottery requests let the Char decide from persona instead of using random chance', () => {
    assert.match(playerSource, /function isExplicitYtCharLotteryRequest\(userMessage\)/);
    assert.match(playerSource, /mentionsLottery[\s\S]*asksForAction[\s\S]*return mentionsLottery && asksForAction/);
    assert.match(playerSource, /【User 明确请求抽奖｜由 Char 自主决定】/);
    assert.match(playerSource, /根据主播完整人设、与 User 的关系、当前情绪和本场直播内容/);
    assert.match(playerSource, /礼物抽奖示例 lotterySuggestion=\{"shouldStart":true/);
    assert.match(playerSource, /拒绝示例 lotterySuggestion=\{"shouldStart":false/);
    assert.match(playerSource, /禁止把 shouldStart 返回成字符串/);
    assert.match(playerSource, /function normalizeYtCharLotteryDecision\(value\)/);
    assert.match(playerSource, /suggestion\.shouldStart[\s\S]*suggestion\.accepted[\s\S]*suggestion\.hasLottery/);
    assert.match(playerSource, /function inferYtCharLotteryAcceptance\(responseObj\)/);
    assert.match(playerSource, /shouldStart !== true && !explicitPrize && !inferYtCharLotteryAcceptance\(responseObj\)/);
    assert.match(playerSource, /_explicitLotteryRequest: explicitLotteryRequest/);
});

test('a Char blocks only an active lottery and can start another after archiving the completed round', () => {
    assert.match(playerSource, /charLiveState\?\.charLottery\?\.status === 'active'[\s\S]*当前已有一轮抽奖正在进行/);
    assert.match(playerSource, /"shouldStart":false,"prize":"","prizeType":"gift","cashAmount":0,"durationSec":30/);
    assert.match(playerSource, /resolved\.live\.charLottery\?\.status === 'active'\) return false/);
    assert.match(playerSource, /resolved\.live\.charLotteryHistory\.push\(/);
    assert.match(playerSource, /charLotteryHistory: Array\.isArray\(currentLive\.charLotteryHistory\)/);
});

test('Char lottery restores, resolves probabilistically and remains in the replay', () => {
    assert.match(playerSource, /participants\[Math\.floor\(Math\.random\(\) \* participants\.length\)\]/);
    assert.match(playerSource, /lottery\.userWon = Boolean\(lottery\.joined && winner\?\.id === 'user_channel_id'\)/);
    assert.match(playerSource, /participants\.push\(\{ id: 'user_channel_id'/);
    assert.match(playerSource, /if \(currentLive\.charLottery\?\.status === 'active'\) finalizeYtCharLiveLottery\(\)/);
    assert.match(playerSource, /charLottery: currentLive\.charLottery \? \{/);
    assert.match(playerSource, /recordCharContent\(resultText, false\)/);
});

test('joining closes the popup and reuses the live lottery status above comments', () => {
    assert.match(indexSource, /id="yt-char-live-lottery-inline-status"[\s\S]*id="yt-char-live-lottery-participants"[\s\S]*id="yt-char-live-lottery-status-countdown"/);
    assert.ok(indexSource.indexOf('id="yt-char-live-lottery-inline-status"') < indexSource.indexOf('class="yt-player-chat-shell"'));
    assert.match(cssSource, /\.yt-live-lottery-status,[\s\S]*#yt-user-live-lottery-status\s*\{/);
    assert.match(playerSource, /ytCharLiveLotteryModal\?\.classList\.remove\('active'\);\s*renderYtCharLiveLotteryInlineStatus\(lottery\)/);
    assert.match(playerSource, /function positionYtCharLiveLotteryStatus\(\)[\s\S]*\.yt-player-chat-shell/);
    assert.match(playerSource, /function renderYtCharLiveLotteryInlineStatus\(lottery/);
    assert.match(playerSource, /lottery\.joined !== true[\s\S]*style\.display = 'none'/);
});

test('a winning User receives cash in Pay or a gift in Data Center exactly once', () => {
    assert.match(playerSource, /function parseYtCharLotteryCashAmount\(value\)/);
    assert.match(playerSource, /function grantYtCharLotteryUserReward\(lottery, resolved\)/);
    assert.match(playerSource, /if \(!lottery\?\.userWon \|\| lottery\.rewardGrantedAt\) return false/);
    assert.match(playerSource, /window\.addPayTransaction\(cashAmount,[\s\S]*'income'\)/);
    assert.match(playerSource, /channelState\.dataCenter\.receivedGifts\.unshift\(/);
    assert.match(playerSource, /lottery\.rewardGrantedAt = receivedAt/);
    assert.match(indexSource, />获得礼物<\/div>[\s\S]*id="dc-received-gifts-list"/);
    assert.match(coreSource, /receivedGifts:\s*\[\]/);
    assert.match(coreSource, /receivedGifts:\s*Array\.isArray\(rawDataCenter\.receivedGifts\)/);
    assert.match(userLiveSource, /const dcReceivedGiftsList = document\.getElementById\('dc-received-gifts-list'\)/);
    assert.match(userLiveSource, /暂无获得的礼物/);
    assert.match(userLiveSource, /已收入 Pay/);
});
