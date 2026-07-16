import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [coreSource, playerSource, communitySource, cssSource, indexSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/5_player.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/6_community.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/youtube.css', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

function loadYtLanguageHelpers() {
    const start = coreSource.indexOf('    function normalizeYtChatLanguage');
    const end = coreSource.indexOf('    function getYtChannelRelationshipContext', start);
    assert.ok(start >= 0 && end > start, 'YTB language helper block should be discoverable');
    const window = {};
    const sandbox = {
        window,
        resolveYtExplicitImChar(channel) {
            return channel?.imCharId ? { id: channel.imCharId, language: channel.language || 'zh' } : null;
        }
    };
    vm.runInNewContext(coreSource.slice(start, end), sandbox);
    return window;
}

test('linked YTB channels resolve the current iMessage language while unlinked channels opt out', () => {
    const helpers = loadYtLanguageHelpers();
    const cases = [
        ['zh', 'zh', 'Chinese'],
        ['en', 'en', 'English'],
        ['jp', 'ja', 'Japanese'],
        ['kr', 'ko', 'Korean'],
        ['fr', 'fr', 'French']
    ];
    for (const [input, language, languageName] of cases) {
        const context = helpers.getYtChannelLanguageContext({ imCharId: 'char-1', language: input });
        assert.equal(context.enabled, true);
        assert.equal(context.language, language);
        assert.equal(context.languageName, languageName);
    }
    assert.deepEqual(
        JSON.parse(JSON.stringify(helpers.getYtChannelLanguageContext({ id: 'custom-channel' }))),
        { enabled: false, linkedChar: null, language: '', languageName: '' }
    );
});

test('localized content keeps legacy strings compatible and suppresses duplicate Chinese translations', () => {
    const helpers = loadYtLanguageHelpers();
    assert.deepEqual(
        JSON.parse(JSON.stringify(helpers.normalizeYtLocalizedContent('legacy bubble'))),
        { text: 'legacy bubble', translationZh: '' }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(helpers.normalizeYtLocalizedContent(
            { text: 'Good evening', translationZh: '晚上好' },
            { enabled: true, language: 'en' }
        ))),
        { text: 'Good evening', translationZh: '晚上好' }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(helpers.normalizeYtLocalizedContent(
            { text: '晚上好', translationZh: '重复译文' },
            { enabled: true, language: 'zh' }
        ))),
        { text: '晚上好', translationZh: '' }
    );
});

test('viewer metrics are numeric inputs formatted by the frontend with Chinese units', () => {
    const helpers = loadYtLanguageHelpers();
    assert.match(helpers.formatYtLiveViewerCount(15000), /万 人正在观看$/);
    assert.match(helpers.formatYtVideoViewCount(450000), /万 次观看$/);
    assert.equal(helpers.formatYtLiveViewerCount(undefined, 'legacy views'), 'legacy views');
    assert.match(playerSource, /viewerCount\(当前观看人数，必须是纯整数/);
    assert.match(playerSource, /viewCount\(观看次数，必须是纯整数/);
    assert.match(playerSource, /UI 指标固定规则[\s\S]*不受角色默认语言影响/);
});

test('homepage, live continuation, user replies, comments, and centered history modal use the localized contract', () => {
    assert.match(playerSource, /buildYtLocalizedJsonContract\(\s*currentSubChannelData,[\s\S]*currentLive\.title/);
    assert.match(playerSource, /initialBubbles: 对象数组/);
    assert.match(playerSource, /getCharResponse\(\s*latestUserMessage\?\.text \|\| '',\s*false,\s*0,\s*!latestUserMessage,/);
    assert.match(playerSource, /getCharResponse\('', false, 0, true\)/);
    assert.match(playerSource, /Use this exact localized object schema even if the editable prompt above requests strings/);
    assert.match(playerSource, /class="yt-comment-translation-toggle" role="button" tabindex="0"/);
    assert.doesNotMatch(playerSource, /<button[^>]+yt-comment-translation/);
    assert.match(playerSource, /safeTranslation \?[\s\S]*storedComment\.translationZh/);
    assert.match(communitySource, /buildYtLocalizedJsonContract\(currentSubChannelData, 'every generated comment and thread reply text field'\)/);
    assert.match(communitySource, /yt-post-comment-translation-toggle[^>]+role="button"[^>]+tabindex="0"/);
    assert.doesNotMatch(communitySource, /<button[^>]+yt-post-comment-translation-toggle/);
    assert.match(communitySource, /yt-post-comment-reply-action[\s\S]*>回复<\/span>[\s\S]*yt-post-comment-translation-toggle/);
    assert.match(communitySource, /yt-community-content-translation-toggle[^>]+role="button"[^>]+tabindex="0"[^>]+aria-expanded="false"/);
    assert.match(communitySource, /yt-community-detail-post-translation" hidden/);
    assert.doesNotMatch(playerSource, /renderYtSecondaryTranslation\(postTranslationZh, 'yt-community-post-translation'\)/);
    assert.doesNotMatch(playerSource, /yt-community-card-translation-/);
    assert.match(cssSource, /\.yt-post-comment-translation\s*\{[\s\S]*padding:\s*7px 9px;[\s\S]*background:\s*#f2f2f7;/);
    assert.match(cssSource, /\.yt-post-comment-translation\.is-root\s*\{[\s\S]*font-size:\s*14px;/);
    assert.match(cssSource, /\.yt-char-all-content-modal-overlay\s*\{[\s\S]*justify-content:\s*center;[\s\S]*align-items:\s*center;/);
    assert.match(cssSource, /\.yt-char-all-content-modal-card\s*\{[\s\S]*border-radius:\s*24px;/);
    assert.match(indexSource, /css\/youtube\.css\?v=20260717-char-lottery-consistency-v18/);
    assert.match(indexSource, /js\/youtube\/5_player\.js\?v=20260717-char-lottery-consistency-v18/);
});
