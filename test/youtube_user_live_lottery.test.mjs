import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [liveSource, indexSource, cssSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/8_user_live.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8')
]);

function loadLotteryDrawHelpers() {
    const start = liveSource.indexOf('    function shuffleUserLiveLotteryParticipants');
    const end = liveSource.indexOf('    function renderUserLiveLotteryResult', start);
    assert.ok(start >= 0 && end > start, 'lottery draw helpers should be discoverable');
    const sandbox = {
        window: {
            crypto: {
                getRandomValues(values) {
                    values[0] = 0;
                    return values;
                }
            }
        },
        Uint32Array
    };
    vm.runInNewContext(liveSource.slice(start, end), sandbox);
    return sandbox;
}

test('user live toolbar places the lottery gift immediately before minimize', () => {
    assert.match(indexSource, /id="yt-user-live-lottery-btn"[\s\S]*?id="yt-user-live-minimize-btn"/);
    assert.match(indexSource, /id="yt-user-live-lottery-duration"[^>]+min="5"[^>]+max="3600"[^>]+value="30"/);
    assert.match(indexSource, /id="yt-user-live-lottery-status"[\s\S]*yt-user-live-lottery-participants[\s\S]*yt-user-live-lottery-countdown/);
    assert.match(indexSource, /id="yt-user-live-lottery-status"[\s\S]*class="yt-user-live-chat-shell"/);
    assert.match(liveSource, /chatHeightFromBottom[\s\S]*style\.bottom = `\$\{Math\.round\(chatHeightFromBottom \+ 8\)\}px`/);
    assert.match(indexSource, /id="yt-user-live-lottery-status"[\s\S]*直播抽奖进行中[\s\S]*距开奖/);
    assert.match(cssSource, /\.yt-user-live-lottery-modal-overlay\s*\{[\s\S]*justify-content:\s*center;[\s\S]*align-items:\s*center;/);
});

test('lottery persistence uses an absolute deadline and restores or finalizes from saved state', () => {
    assert.match(liveSource, /endAt:\s*now \+ config\.durationSec \* 1000/);
    assert.match(liveSource, /Date\.now\(\) >= Number\(lottery\.endAt\)[\s\S]*finalizeUserLiveLottery\(\)/);
    assert.match(liveSource, /restoredLottery\?\.status === 'active'[\s\S]*startUserLiveLotteryTimer\(\)/);
    assert.match(liveSource, /persistActiveUserLive\(\{ lottery \}\)/);
    assert.match(liveSource, /抽奖进行中，请等待开奖后再结束直播/);
});

test('participants are explicit, deduplicated, and never include the host', () => {
    assert.match(liveSource, /"participates":true/);
    assert.match(liveSource, /comments 不少于 10 条/);
    assert.match(liveSource, /normalizedName === hostName/);
    assert.match(liveSource, /participants\.some\(item =>[\s\S]*toLocaleLowerCase\(\) === normalizedName\)/);
    assert.match(liveSource, /ev\.data\.participates === true[\s\S]*addUserLiveLotteryParticipant/);
});

test('frontend participation grows toward a random target without exceeding online viewers', () => {
    assert.match(liveSource, /const ratio = 0\.35 \+ Math\.random\(\) \* 0\.3/);
    assert.match(liveSource, /Math\.min\(onlineLimit[\s\S]*simulatedTargetParticipants/);
    assert.match(liveSource, /lottery\.participants\.length < onlineLimit/);
    assert.match(liveSource, /source:\s*'frontend-random'/);
    assert.match(liveSource, /growSimulatedUserLiveLotteryParticipants\(lottery\)[\s\S]*renderUserLiveLotteryStatus/);
    assert.match(liveSource, /lottery\.participants\.length >= onlineLimit\) return false/);
});

test('cash prizes use a native select and charge the real Pay balance before starting', () => {
    assert.match(liveSource, /<select class="yt-lottery-prize-type"/);
    assert.match(liveSource, /<option value="cash"[^>]*>金额<\/option>/);
    assert.match(liveSource, /<option value="custom"[^>]*>自定义<\/option>/);
    assert.match(liveSource, /amount \* winnerCount/);
    assert.match(liveSource, /window\.getPayBalance\(\)/);
    assert.match(liveSource, /window\.addPayTransaction\(config\.totalCashAmount, 'YouTube 直播抽奖奖金', 'expense'\)/);
    assert.match(liveSource, /payAmountCharged:\s*config\.totalCashAmount/);
});

test('user live comments require foreign originals with clickable Chinese translations', () => {
    assert.match(liveSource, /comments 至少一半来自使用英语、日语、韩语、法语、西班牙语/);
    assert.match(liveSource, /translationZh.*participates/);
    assert.match(liveSource, /class="yt-user-live-comment-translation-toggle" role="button" tabindex="0"/);
    assert.match(liveSource, /event\.key !== 'Enter' && event\.key !== ' '/);
    assert.match(liveSource, /addUserLiveChatMessage\(ev\.data\.name, ev\.data\.text, null, null, ev\.data\.translationZh\)/);
});

test('winner allocation is unique and fills higher tiers first when participants are scarce', () => {
    const helpers = loadLotteryDrawHelpers();
    const lottery = {
        participants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        prizes: [
            { id: 'first', name: '一等奖', prize: 'A奖品', winnerCount: 2 },
            { id: 'second', name: '二等奖', prize: 'B奖品', winnerCount: 2 }
        ]
    };
    const winners = helpers.drawUserLiveLotteryWinners(lottery);
    assert.equal(winners.length, 3);
    assert.equal(new Set(winners.map(winner => winner.name)).size, 3);
    assert.equal(winners.filter(winner => winner.prizeId === 'first').length, 2);
    assert.equal(winners.filter(winner => winner.prizeId === 'second').length, 1);
});

test('draw follow-up is marked before one automatic API request and requires ten comments', () => {
    assert.match(liveSource, /lottery\.followupStatus = 'requesting'/);
    assert.match(liveSource, /lottery\.followupRequestedAt = Date\.now\(\)/);
    assert.match(liveSource, /requestUserLiveLotteryFollowup\(lottery\)/);
    assert.match(liveSource, /comments\.length < 10[\s\S]*TOO_FEW_LOTTERY_FOLLOWUP_COMMENTS/);
    assert.match(liveSource, /中奖者的惊喜回应、未中奖者的反应和围观观众/);
    assert.match(liveSource, /每一位实际中奖者都要给主播发送 2 至 5 条连续私信/);
    assert.match(liveSource, /"winnerDMs":\[\{"winnerName":"中奖者原昵称"/);
    assert.match(liveSource, /messages\.length < 2[\s\S]*TOO_FEW_WINNER_DMS/);
    assert.match(liveSource, /appendUserLiveLotteryWinnerDms\(lottery, winnerDmBatches\)/);
    assert.match(liveSource, /contact\.dmHistory\.push\(\{[\s\S]*lotteryId/);
    assert.match(indexSource, /js\/youtube\/8_user_live\.js\?v=20260715-user-vod-parity-v2/);
});
