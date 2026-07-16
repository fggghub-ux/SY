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

test('normalizes fake-link domain input without fetching real pages', () => {
    assert.equal(window.imChat.normalizeFakeLinkDomain('example.com'), 'example.com');
    assert.equal(window.imChat.normalizeFakeLinkDomain('https://Example.com/a?b=1'), 'example.com/a?b=1');
    const normalized = window.imChat.normalizeFakeLinkInput('example.net/news');
    assert.equal(normalized.domain, 'example.net');
    assert.equal(normalized.displayUrl, 'example.net/news');
    assert.equal(normalized.canonicalUrl, 'https://example.net/news');
});

test('rejects empty, unsafe, and unsupported fake-link inputs', () => {
    assert.equal(window.imChat.normalizeFakeLinkDomain(''), '');
    assert.equal(window.imChat.normalizeFakeLinkDomain('javascript:alert(1)'), '');
    assert.equal(window.imChat.normalizeFakeLinkDomain('example.com/<script>'), '');
    assert.equal(window.imChat.normalizeFakeLinkDomain('https://example.com/' + 'a'.repeat(220)), '');
});

test('builds a strict AI fake-webpage prompt with controlled interactions', () => {
    const prompt = window.imChat.buildFakeLinkPrompt({
        domain: 'xiaohongshu.com/explore/demo',
        prompt: '生成小红书笔记页面，带评论',
        worldBookContext: 'WB: coffee shop is important',
        charPersonaContext: 'Char persona: likes quiet cafes',
        userPersonaContext: 'User persona: photographer',
        includeCharPersona: true,
        includeUserPersona: true
    });
    assert.match(prompt, /webPage/);
    assert.match(prompt, /interactions/);
    assert.match(prompt, /toggleClass/);
    assert.match(prompt, /picsum\.photos/);
    assert.match(prompt, /世界书上下文/);
    assert.match(prompt, /WB: coffee shop is important/);
    assert.match(prompt, /Char persona: likes quiet cafes/);
    assert.match(prompt, /User persona: photographer/);
    assert.match(prompt, /小红书/);
    assert.match(prompt, /禁止输出 <script>/);
    assert.equal(prompt.includes('window.open'), false);
});

test('normalizes generated webpage packages defensively', () => {
    const page = window.imChat.normalizeFakeLinkWebPage({
        theme: 'xiaohongshu',
        html: '<section onclick="bad()"><script>alert(1)</script><a href="https://evil.test">open</a><img src="https://evil.test/a.jpg"><p>ok</p><form><input></form></section>',
        css: '@import url("https://evil.test/a.css"); .x{background:url(https://evil.test/a.png);position:fixed;behavior:url(x)}',
        interactions: [
            { type: 'evil', selector: '[data-fake-action="like"]' },
            { type: 'toggleClass', selector: '<bad>' }
        ]
    }, { domain: 'xiaohongshu.com/demo', prompt: 'coffee' });

    assert.equal(page.theme, 'xiaohongshu');
    assert.equal(page.html.includes('<script'), false);
    assert.equal(page.html.includes('onclick'), false);
    assert.equal(page.html.includes('href='), false);
    assert.equal(page.html.includes('<input'), false);
    assert.match(page.html, /https:\/\/picsum\.photos\/seed\//);
    assert.equal(page.css.includes('@import'), false);
    assert.equal(page.css.includes('url('), false);
    assert.match(page.css, /position:absolute/);
    assert.equal(page.interactions.length, 1);
    assert.equal(page.interactions[0].type, 'toggleClass');
});

test('random image helpers allow only the configured external image host', () => {
    const url = window.imChat.buildRandomFakeLinkImageUrl(['example.com', 'demo'], 2);
    assert.match(url, /^https:\/\/picsum\.photos\/seed\/u2-/);
    assert.equal(window.imChat.isAllowedFakeLinkImageUrl(url), true);
    assert.equal(window.imChat.isAllowedFakeLinkImageUrl('https://evil.test/a.jpg'), false);

    const html = window.imChat.injectRandomFakeLinkImages('<article><img src="https://evil.test/a.jpg"><img></article>', {
        domain: 'example.com',
        prompt: 'demo'
    });
    assert.equal(html.includes('https://evil.test'), false);
    assert.equal((html.match(/https:\/\/picsum\.photos\/seed\//g) || []).length, 2);
});

test('manual mode creates an escaped generic webpage package', () => {
    const page = window.imChat.buildManualFakeLinkWebPage({
        siteName: 'Example',
        title: '<script>title</script>',
        summary: 'Summary',
        bodyText: 'First paragraph\nSecond <img src=x onerror=bad()> paragraph',
        displayUrl: 'example.com/post'
    });

    assert.equal(page.theme, 'generic');
    assert.equal(page.html.includes('<script>'), false);
    assert.equal(page.html.includes('<img'), false);
    assert.match(page.html, /u2-fake-generic-page/);
    assert.ok(page.interactions.some(item => item.type === 'increment'));
});

test('removes the old resolver and real external-opening path', async () => {
    const [packageSource, settingsSource, storageSource, linkSource, bubbleSource] = await Promise.all([
        fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/storage/app_storage.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_link.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8')
    ]);
    const combined = [packageSource, settingsSource, storageSource, linkSource].join('\n');
    assert.equal(combined.includes('link-resolver-worker'), false);
    assert.equal(combined.includes('linkResolverConfig'), false);
    assert.equal(combined.includes('u2_linkResolverConfig'), false);
    assert.equal(combined.includes('/v1/resolve-link'), false);
    assert.equal(linkSource.includes('openLinkComposer'), false);
    assert.equal(bubbleSource.includes('window.open('), false);
});

test('uses fake_link in chat rendering, safe webpage rendering, menu sizing, and API context', async () => {
    const [coreSource, aiSource, bubbleSource, linkSource, interfaceSource, cssSource, sheetSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_link.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_interface.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8')
    ]);
    assert.match(linkSource, /type:\s*'fake_link'/);
    assert.match(linkSource, /data-tab="ai"/);
    assert.match(linkSource, /data-tab="manual"/);
    assert.match(linkSource, /aria-label="发送链接"/);
    assert.match(linkSource, /aria-label="调用 API 生成网页"/);
    assert.match(linkSource, /fa-search/);
    assert.doesNotMatch(linkSource, /fa-wand-magic-sparkles/);
    assert.match(sheetSource, /class="attachment-more-link-label">链接<\/div>/);
    assert.doesNotMatch(sheetSource, /class="attachment-more-link-label">假链接<\/div>/);
    assert.match(linkSource, /webPage/);
    assert.match(linkSource, /im-fake-link-char-persona-toggle/);
    assert.match(linkSource, /im-fake-link-user-persona-toggle/);
    assert.match(linkSource, /resolveFakeLinkWorldBookContext/);
    assert.match(linkSource, /picsum\.photos/);
    assert.match(coreSource, /normalizedMessage\.type === 'fake_link'/);
    assert.match(coreSource, /formatFakeLinkMessageForApiContext/);
    assert.match(coreSource, /stripFakeLinkHtmlForApiContext/);
    assert.match(aiSource, /message\.type === 'fake_link'/);
    assert.match(bubbleSource, /msg\.type === 'fake_link'/);
    assert.match(bubbleSource, /sanitizeFakeLinkPagePackage/);
    assert.match(bubbleSource, /renderFakeLinkWebPage/);
    assert.match(bubbleSource, /scopeFakeLinkCss/);
    assert.match(bubbleSource, /bindFakeLinkInteractions/);
    assert.match(bubbleSource, /isAllowedFakeLinkImageUrlForRender/);
    assert.match(bubbleSource, /overlay\.style\.display\s*=\s*'flex'/);
    assert.match(interfaceSource, /msg-context-card-clone/);
    assert.match(interfaceSource, /fitContextMenuToViewport/);
    assert.match(interfaceSource, /bubbleHeightLimit/);
    assert.match(cssSource, /#msg-context-bubble-clone \.chat-link-card/);
    assert.match(cssSource, /im-fake-link-context-toggle/);
    assert.equal(coreSource.includes("type === 'link'"), false);
    assert.equal(aiSource.includes("type === 'link'"), false);
});

test('supports guided regenerate from the iMessage More sheet', async () => {
    const [sheetSource, aiSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8')
    ]);

    assert.match(sheetSource, /class="regenerate-form-overlay"/);
    assert.match(sheetSource, /class="regenerate-requirement-input"/);
    assert.match(sheetSource, /角色ooc了，注意人设/);
    assert.equal(sheetSource.includes('语气别太冷，多接住我的情绪'), false);
    assert.match(sheetSource, /class="regenerate-reference-btn"[^>]*background:#8e8e93/);
    assert.match(sheetSource, /class="regenerate-direct-btn"/);
    assert.match(sheetSource, /请先输入参考要求/);
    assert.match(sheetSource, /openRegenerateForm\(\)/);
    assert.match(sheetSource, /regenerateLastAiReply\(activeFriend, regenerateEntry, \{ userRequirement \}\)/);
    assert.doesNotMatch(sheetSource, /class="regenerate-reference-btn"[^>]*background:#007aff/);

    assert.match(aiSource, /regenerateLastAiReply\(friend, triggerEl = null, options = \{\}\)/);
    assert.match(aiSource, /normalizedOptions\.userRequirement/);
    assert.match(aiSource, /regenerateContext\.userRequirement/);
    assert.match(aiSource, /User 本次重回额外要求/);
    assert.match(aiSource, /previousReplyForSimilarity: previousReply/);
    assert.doesNotMatch(aiSource, /【上一轮回复：禁止复读的负例】/);
    assert.doesNotMatch(aiSource, /\{ previousReply, userRequirement \}/);
    assert.match(aiSource, /handleAiReply\(latestFriend, container, triggerEl, \{ source: 'regenerate' \}\)/);
    assert.match(aiSource, /captureRegenerateRunSnapshot\(friend, apiRunId\)/);
    assert.match(aiSource, /restoreRegenerateRunSnapshot\(friendKey, targetRunId\)/);
    assert.match(aiSource, /remainingTargetRunMessages/);
    assert.match(aiSource, /buildRegenerateRetrySystemPrompt\(pendingRegenerateContext\)/);
    assert.match(aiSource, /role: 'system',\s*content: buildRegenerateRetrySystemPrompt\(pendingRegenerateContext\)/);
    assert.doesNotMatch(aiSource, /\$\{commonMemorySections \|\| 'None'\}\$\{regenerateRequirement\}/);
    assert.match(aiSource, /function isRegenerateReplyTooSimilar\(previousReply, rawReply\)/);
    assert.match(aiSource, /firstBubbleSame/);
    assert.match(aiSource, /consecutivePairSimilar/);
    assert.match(aiSource, /overallSimilarity >= 0\.76/);
    assert.match(aiSource, /getRegenerateRequestApiConfig\(currentApiConfig, isRegenerateRequest\)/);
    assert.match(aiSource, /Math\.max\(currentTemperature, 0\.85\)/);
    assert.match(aiSource, /regenerateAttempt < 2/);
    assert.match(aiSource, /regenerate reply too similar; retrying once/);

    const regeneratePromptSource = aiSource.slice(
        aiSource.indexOf('function buildRegenerateRetrySystemPrompt'),
        aiSource.indexOf('const linkedAccountBotInFlight')
    );
    assert.doesNotMatch(regeneratePromptSource, /previousReply/);
    assert.match(regeneratePromptSource, /直接根据当前保留下来的聊天上下文/);
    assert.match(regeneratePromptSource, /User 填写的重回额外要求就是本次唯一参考要求/);
});

test('keeps offline meeting summary third-person and context bubble theme scoping', async () => {
    const [sheetSource, interfaceSource, settingsSource, cssSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_sheet.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_interface.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8')
    ]);
    const summarySource = sheetSource.slice(
        sheetSource.indexOf('const requestOfflineMeetingSummary'),
        sheetSource.indexOf('async function endOfflineMeeting')
    );
    const applyFriendCssSource = settingsSource.slice(
        settingsSource.indexOf('function applyFriendCss'),
        settingsSource.indexOf('function applyAllSavedCss')
    );

    assert.doesNotMatch(summarySource, /Char 的第一视角/);
    assert.match(summarySource, /meetingSummary 必须使用第三人称 Char 限定视角/);
    assert.match(summarySource, /shortTermMemory\.event 要作为 \$\{charName\} 自己的短期记忆/);
    assert.match(summarySource, /只(?:描述|写) Char 看到、听到、说出、做出、注意到或能合理推断/);

    assert.match(interfaceSource, /setAttribute\('data-current-friend-id'/);
    assert.match(interfaceSource, /msg-context-row-clone/);
    assert.match(applyFriendCssSource, /data-current-friend-id="\$\{escapeCssAttributeValue\(friend\.id\)\}"/);
    assert.match(applyFriendCssSource, /scopeThemeCss\(friend\.customCss, prefix\)[\s\S]*scopeThemeCss\(friend\.customCss, contextPrefix\)/);
    assert.match(applyFriendCssSource, /scopeThemeCss\(friend\.chatCss, prefix\)/);
    assert.match(applyFriendCssSource, /scopeThemeCss\(friend\.statusCss, prefix\)/);
    assert.doesNotMatch(applyFriendCssSource, /scopeThemeCss\(friend\.statusCss, contextPrefix\)/);
    assert.match(cssSource, /#msg-context-bubble-clone \.msg-context-row-clone\s*\{/);
});

test('restores saved iMessage theme CSS after contact data hydration and chat page reuse', async () => {
    const [indexSource, interfaceSource, settingsSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_interface.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8')
    ]);
    const restoreSource = settingsSource.slice(
        settingsSource.indexOf('async function applyAllSavedCss'),
        settingsSource.indexOf('const saveCssPresetBtn', settingsSource.indexOf('async function applyAllSavedCss'))
    );

    assert.match(restoreSource, /await window\.imApp\.ensureDataReady\(\)/);
    assert.match(restoreSource, /document\.addEventListener\('imessage-data-ready', restoreSavedCss\)/);
    assert.match(restoreSource, /document\.addEventListener\('u2-theme-state-ready', restoreSavedCss\)/);
    assert.match(restoreSource, /restoreSavedCss\(\)/);
    assert.doesNotMatch(restoreSource, /setTimeout\(\(\) => applyAllSavedCss\(\), 100\)/);
    assert.match(restoreSource, /window\.imData\.friends\.forEach\(f => applyFriendCss\(f\)\)/);

    assert.ok((interfaceSource.match(/window\.imApp\.applyFriendCss\(friend\)/g) || []).length >= 2);
    assert.match(indexSource, /js\/imessage\/4_chat_interface\.js\?v=20260715-chat-context-menu-offline-retry-v1/);
    assert.match(indexSource, /js\/imessage\/5_settings\.js\?v=20260716-status-prompt-v3/);
});

test('keeps iOS modal, theme preset, stickers, and private-chat safeguards', async () => {
    const [indexSource, linkSource, bubbleSource, coreSource, settingsSource, cssSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_link.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8')
    ]);
    const fakeDetailSource = bubbleSource.slice(
        bubbleSource.indexOf('function ensureFakeLinkDetailOverlay'),
        bubbleSource.indexOf('function openFakeLinkDetail')
    );

    assert.match(linkSource, /getFakeLinkAppContainer/);
    assert.match(linkSource, /host\.appendChild\(overlay\)/);
    assert.match(linkSource, /focus\(\{ preventScroll: true \}\)/);
    assert.doesNotMatch(linkSource, /setTimeout\(\(\) => aiDomainInput\.focus/);
    assert.doesNotMatch(linkSource, /setTimeout\(\(\) => input\?\.focus/);

    assert.match(fakeDetailSource, /wb-centered-modal-overlay im-fake-link-detail-overlay/);
    assert.match(fakeDetailSource, /wb-centered-modal-card im-fake-link-detail-sheet/);
    assert.match(fakeDetailSource, /host\.appendChild\(overlay\)/);
    assert.doesNotMatch(fakeDetailSource, /document\.body\.appendChild\(overlay\)/);

    assert.match(coreSource, /ensureStickersViewInApp/);
    assert.match(coreSource, /appEl\.appendChild\(stickersViewEl\)/);
    assert.match(settingsSource, /function refreshThemePresetUi\(/);
    assert.ok((settingsSource.match(/refreshThemePresetUi\(/g) || []).length >= 4);
    assert.match(settingsSource, /iconDiv\.classList\.add\('has-custom-app-icon'\)/);
    assert.match(settingsSource, /iconDiv\.style\.setProperty\('background', `url\(\$\{app\.icon\}\) center \/ cover no-repeat`, 'important'\)/);
    assert.match(settingsSource, /iconDiv\.style\.setProperty\('background-image', `url\(\$\{app\.icon\}\)`, 'important'\)/);
    assert.match(settingsSource, /iconDiv\.classList\.remove\('has-custom-app-icon'\)/);
    assert.match(settingsSource, /iconDiv\.style\.removeProperty\('background'\)/);
    assert.match(indexSource, /<div class="app-view im-theme-config-view" id="theme-config-sheet"/);
    assert.doesNotMatch(indexSource, /<div class="bottom-sheet-overlay detail-sheet-overlay" id="theme-config-sheet"/);
    assert.match(indexSource, /id="theme-current-apply-btn"/);
    assert.match(settingsSource, /function applyCurrentThemeCss\(\)/);
    const servicesSource = indexSource.slice(
        indexSource.indexOf('<div class="line-services-grid">'),
        indexSource.indexOf('<!-- Groups Section -->')
    );
    assert.match(servicesSource, /<span>Stickers<\/span>/);
    assert.match(servicesSource, /id="imessage-themes-btn"/);
    assert.match(servicesSource, /<span>Themes<\/span>/);
    assert.doesNotMatch(servicesSource, /im-theme-config-view|line-service-card|service-card/);

    assert.match(cssSource, /\.app-view\.stickers-view,/);
    assert.match(cssSource, /padding-top:\s*0\s*!important/);
    assert.match(cssSource, /\.im-theme-config-view\s*\{/);
    assert.match(cssSource, /\.im-theme-layout\s*\{[\s\S]*grid-template-columns/);
    assert.match(cssSource, /\.im-fake-link-composer-overlay\s*\{[\s\S]*z-index:\s*1230/);
    assert.match(cssSource, /\.im-fake-link-detail-overlay\s*\{[\s\S]*justify-content:\s*center/);
    assert.match(cssSource, /\.im-fake-link-detail-sheet\s*\{[\s\S]*border-radius:\s*24px/);
    assert.match(cssSource, /\.group-private-chat-detail-row\s*\{[\s\S]*width:\s*100%/);
    assert.match(cssSource, /\.group-private-chat-detail-row\s*\{[\s\S]*max-width:\s*100%/);
    assert.match(cssSource, /\.group-private-chat-detail-bubble\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
    assert.match(cssSource, /\.group-private-chat-detail-bubble\s*\{[\s\S]*max-inline-size:\s*min\(78%,\s*300px\)/);
    assert.match(cssSource, /button\.group-private-chat-detail-bubble\s*\{[\s\S]*-webkit-appearance:\s*none/);
    assert.match(cssSource, /button\.group-private-chat-detail-bubble\s*\{[\s\S]*max-inline-size:\s*min\(78%,\s*300px\)/);
    assert.match(cssSource, /\.group-private-chat-detail-original,\s*\n\.group-private-chat-detail-translation\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
    assert.match(cssSource, /\.group-private-chat-detail-original,\s*\n\.group-private-chat-detail-translation\s*\{[\s\S]*hyphens:\s*auto/);
});

test('keeps group time awareness, role recall toggle, Chinese generated thoughts, member removal, and clear-context safeguards', async () => {
    const [indexSource, groupsSource, aiSource, interfaceSource, statusSource, coreSource, settingsSource, contactsSource, builtinWorldBookSource] = await Promise.all([
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/3_groups.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_interface.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_status.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/3_contacts.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/builtin_worldbook.js', import.meta.url), 'utf8')
    ]);

    assert.match(indexSource, /id="group-time-aware-toggle"/);
    assert.match(indexSource, />时间感知</);
    assert.match(indexSource, /id="chat-role-recall-toggle"/);
    assert.match(indexSource, />允许角色撤回</);
    assert.match(groupsSource, /groupTimeAwareToggle/);
    assert.match(groupsSource, /targetGroup\.timeAware\s*=\s*timeAware/);
    assert.match(groupsSource, /gmm-kick-btn/);
    assert.match(groupsSource, /targetGroup\.members\s*=\s*\(Array\.isArray\(targetGroup\.members\)/);
    assert.match(groupsSource, /delete targetGroup\.memory\.mountSettings/);
    assert.match(groupsSource, /delete targetGroup\.memory\.mountLimits/);
    assert.match(groupsSource, /delete targetGroup\.memberProfiles/);

    assert.match(aiSource, /buildGroupTimeRequirement/);
    assert.match(aiSource, /【群聊时间感知】/);
    assert.match(aiSource, /const lastOfflineMeeting = historyMessages[\s\S]*?msg\.type === 'offline_meeting_record'/);
    assert.match(aiSource, /线下见面与公开消息同样算作一次群聊互动/);
    assert.match(aiSource, /线下见面与线上消息同样算作一次互动/);
    assert.match(aiSource, /lastCharOrMeetingBeforeUser/);
    assert.match(aiSource, /thought 字段必须使用自然中文/);
    assert.match(aiSource, /JSON 必须且只能包含字段：thought、affectionChange、events/);
    assert.match(aiSource, /hasCustomStatusPrompt/);
    assert.match(aiSource, /<custom_status_prompt>/);
    assert.doesNotMatch(aiSource, /thought 必须严格输出空字符串/);
    assert.doesNotMatch(aiSource, /JSON 必须包含字段：thought、location、action、mood、expression/);
    assert.match(aiSource, /memberProfiles\[memberProfileKey\]/);
    assert.match(aiSource, /updatedAt\s*=\s*Date\.now\(\)/);
    assert.match(aiSource, /singleChatRoleRecallPrompt/);
    assert.match(aiSource, /friend\.allowRoleRecall\s*!==\s*false/);
    assert.match(aiSource, /\$\{singleChatRoleRecallPrompt\}/);
    assert.match(aiSource, /const userRelationship = String\(friend\.relationship \|\| ''\)\.trim\(\) \|\| '未填写'/);
    assert.match(aiSource, /现在认为与 User 的关系是：\$\{userRelationship\}/);
    assert.equal(aiSource.includes('User 发送的内容/消息为线上打字发送的文字消息，除非上下文明确标注为“语音消息”的才为user发的语音'), true);
    assert.equal((aiSource.match(/\$\{userInputModalityRule\}/g) || []).length, 2);
    assert.match(aiSource, /chatBubbleFormatGuardPrompt/);
    assert.equal((aiSource.match(/\$\{chatBubbleFormatGuardPrompt\}/g) || []).length, 2);
    assert.match(aiSource, /严禁把多条气泡合并进同一个 text 字段/);
    assert.match(aiSource, /严禁输出 JSON 数组以外的正文/);

    const enabledBuiltinWorldBookSource = builtinWorldBookSource.slice(
        builtinWorldBookSource.indexOf('const ENABLED_BUILTIN_WORLD_BOOK_ENTRY_IDS'),
        builtinWorldBookSource.indexOf('window.getBuiltinWorldBookEntries')
    );
    assert.doesNotMatch(enabledBuiltinWorldBookSource, /builtin-anti-format-drop-1-0/);
    assert.doesNotMatch(enabledBuiltinWorldBookSource, /builtin-override-limit/);
    assert.match(indexSource, /js\/builtin_worldbook\.js\?v=20260713-disable-override-limit-v2/);

    assert.match(interfaceSource, /window\.imApp\.getFriendById\(friend\.id\)/);
    assert.match(interfaceSource, /hasHistoricalThought/);
    assert.match(interfaceSource, /groupProfile\.thought \|\| '暂无心声'/);
    assert.match(interfaceSource, /formatStatusLabel/);
    assert.match(interfaceSource, /normalizeStatusForStorage/);
    assert.match(statusSource, /formatProfileStatusLabel/);

    assert.match(coreSource, /targetFriend\.messages\s*=\s*\[\]/);
    assert.match(coreSource, /normalized\.relationship\s*=/);
    assert.match(coreSource, /normalized\.allowRoleRecall\s*=\s*normalized\.allowRoleRecall\s*!==\s*false/);
    assert.match(coreSource, /normalized\.statusPromptEnabled\s*=\s*normalized\.statusPromptEnabled\s*===\s*true/);
    assert.match(coreSource, /migrateSingleChatProfileStatus/);
    assert.match(coreSource, /targetFriend\.memberProfiles\s*=\s*\{\}/);
    assert.match(coreSource, /notes:\s*''/);
    assert.match(coreSource, /cleared\.lastSummaryMessageCount\s*=\s*0/);
    assert.match(coreSource, /cleared\.mountSettings\s*=/);
    assert.match(coreSource, /clearFriendRuntimeMessageContext\(targetFriend\)/);

    assert.match(settingsSource, /chatRoleRecallToggle\.checked\s*=\s*friend\.allowRoleRecall\s*!==\s*false/);
    assert.match(settingsSource, /targetFriend\.allowRoleRecall\s*=\s*nextValue/);
    assert.match(indexSource, /id="status-prompt-btn"/);
    assert.match(indexSource, /id="status-prompt-sheet"/);
    assert.match(indexSource, /id="status-prompt-enabled-toggle"/);
    assert.match(indexSource, /id="status-prompt-input"/);
    assert.doesNotMatch(indexSource, /id="(?:status-simple-type-select|status-style-select|status-preview-host|status-css-input)"/);
    assert.match(settingsSource, /targetFriend\.statusPromptEnabled\s*=\s*nextEnabled/);
    assert.match(settingsSource, /targetFriend\.statusPrompt\s*=\s*nextPrompt/);
    assert.match(indexSource, /id="friend-relationship-input"/);
    assert.match(indexSource, /id="char-relationship-input"/);
    assert.match(indexSource, /Char 认为你们的关系/);
    assert.match(contactsSource, /friendRelationship/);
    assert.match(contactsSource, /relationship:\s*document\.getElementById\('friend-relationship-input'\)/);
    assert.match(settingsSource, /char-relationship-input/);
    assert.match(settingsSource, /relationshipInput\.value\s*=\s*friend\.relationship \|\| ''/);
    assert.match(settingsSource, /targetFriend\.relationship\s*=\s*relationshipInput \? relationshipInput\.value : ''/);
});

test('applies tuned relationship, personality, and time-gap rules to single and group chats', async () => {
    const aiSource = await fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8');

    assert.doesNotMatch(aiSource, /【关系与记忆使用方式】/);
    assert.match(aiSource, /人格基石: \[3-5个核心关键词，例如：温柔稳定、责任感强、细腻敏感、阳光幽默\]/);
    assert.match(aiSource, /当前关系: \$\{isSingleChat \? \(relationship \|\| '未填写'\)/);
    assert.match(aiSource, /\[年下\]：爱情需求度高、黏人/);
    assert.match(aiSource, /\[年上\]：理智的爱恋/);
    assert.match(aiSource, /性格标签:\n外向\/自信:/);
    assert.match(aiSource, /User在分享开心事吗？我是否在用上帝视角贬低？/);
    assert.match(aiSource, /算你识相\/乖\/算你有良心/);
    assert.match(aiSource, /彻底摒弃赛博爹妈感/);
    assert.match(aiSource, /禁止讲大道理、给建议、或者说“早跟你说了吧”吗？/);
    assert.match(aiSource, /\*\*外向\/敏感\*\* ：回复快，主动开启话题并很爱分享感受/);
    assert.match(aiSource, /\*\*内向\/温柔\*\* ：回复偏慢，用词柔软且有分寸/);
    assert.match(aiSource, /现在的时间段是：\$\{currentTimePeriod\}/);
    assert.match(aiSource, /\*\*间隔 < 2小时\*\*/);
    assert.match(aiSource, /\*\*间隔 2-8小时\*\*/);
    assert.match(aiSource, /\*\*隔夜（跨越了凌晨）\*\*/);
    assert.match(aiSource, /\*\*间隔 > 24小时\*\*/);
    assert.match(aiSource, /const rolePsychologyAndEvolutionPrompt = buildRolePsychologyAndEvolutionPrompt\(\)/);
    assert.match(aiSource, /isSingleChat: true,[\s\S]*?relationship: userRelationship/);
    assert.match(aiSource, /与 User 的关系: \$\{String\(member\.relationship/);
    assert.match(aiSource, /根据群聊最近一次互动距离现在的间隔调整承接方式/);
});

test('prioritizes complete chat bubbles and places temporal context immediately before the response trigger', async () => {
    const aiSource = await fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8');

    assert.match(aiSource, /【严格输出顺序｜聊天气泡最高优先级】/);
    assert.match(aiSource, /第一个非空白字符必须是 <chat_json>/);
    assert.match(aiSource, /必须先完整输出并闭合 <chat_json>[\s\S]*?才能输出任何附加标签/);
    assert.equal((aiSource.match(/\$\{chatOutputPriorityPrompt\}/g) || []).length, 2);
    assert.doesNotMatch(aiSource, /\$\{timeRequirement\}/);
    assert.doesNotMatch(aiSource, /\$\{groupTimeRequirement\}/);
    assert.match(aiSource, /content: `<temporal_context>[\s\S]*?<\/temporal_context>[\s\S]*?if \(responseTriggerMessage\) messages\.push\(responseTriggerMessage\)/);
    assert.match(aiSource, /const triggerIndex = messages\.lastIndexOf\(latestDialogueMessage\)[\s\S]*?messages\.splice\(triggerIndex, 1\)/);

    assert.match(aiSource, /function getAiResponseFinishReason\(data\)/);
    assert.match(aiSource, /isLengthFinishReason\(responseFinishReason\)/);
    assert.match(aiSource, /function hasPrimaryChatBubble\(queueItems\)[\s\S]*?music_control[\s\S]*?recall[\s\S]*?call/);
    assert.match(aiSource, /if \(!hasPrimaryChatBubble\(queueItems\) && !inviteAccepted\)/);
    assert.match(aiSource, /模型输出被截断，未得到完整聊天气泡/);
    assert.doesNotMatch(aiSource, /directJsonArray/);

    const primaryValidationIndex = aiSource.indexOf('let queueItems = normalizeStructuredChatItems(structuredItems);');
    const groupAuxiliaryIndex = aiSource.indexOf("window.imChat.extractTaggedBlock(fullReply, 'group_private_messages')");
    const profileCommitIndex = aiSource.indexOf("if (nextProfilePanel && friend.type !== 'group')");
    const lovesMomentIndex = aiSource.indexOf("window.imChat.extractTaggedBlock(fullReply, 'loves_moment')");
    assert.ok(primaryValidationIndex > -1);
    assert.ok(groupAuxiliaryIndex > primaryValidationIndex);
    assert.ok(profileCommitIndex > primaryValidationIndex);
    assert.ok(lovesMomentIndex > primaryValidationIndex);
});

test('uses visible keyword-triggered memory recall for single and group chats', async () => {
    const [aiSource, coreSource, settingsSource, statusSource, bubblesSource, cssSource, indexSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/5_settings.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_status.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);
    const recallNoticeSource = aiSource.slice(
        aiSource.indexOf('function showMemoryRecallNotice'),
        aiSource.indexOf('function resolveMountedSticker')
    );

    assert.match(aiSource, /function normalizeMemoryTriggerKeywords/);
    assert.match(aiSource, /function resolveActiveMemoryRecall/);
    assert.match(aiSource, /const longTermEntries = isGroupChat \? \[\] : pickTriggered/);
    assert.match(aiSource, /const cherishedEntries = isGroupChat \? \[\] : pickTriggered/);
    assert.match(aiSource, /hasUserTriggeredRecallSource \? currentUserRecallSource\.text : ''/);
    assert.match(aiSource, /ensureRecallPresentationBeforeCharReply/);
    assert.match(aiSource, /persistMemoryRecallPresentation/);
    assert.doesNotMatch(aiSource, /showMemoryRecallNotice\(friend, memoryRecall, container, typingRow\)/);
    assert.match(coreSource, /recallPresentation: null/);
    assert.match(bubblesSource, /recallAnchorMessage/);
    assert.match(bubblesSource, /renderMemoryRecallPresentation/);
    assert.match(recallNoticeSource, /chat-row memory-recall-narration/);
    assert.match(recallNoticeSource, /dataset\.transient = 'true'/);
    assert.doesNotMatch(recallNoticeSource, /appendFriendMessage|friend\.messages/);
    assert.match(aiSource, /回忆起了一些事/);
    assert.match(aiSource, /想记住的原因/);
    assert.match(aiSource, /function getShortTermMemoryTags/);
    assert.match(aiSource, /<memory_tags>/);
    assert.doesNotMatch(aiSource, /isGroupChat\s*\?\s*entries\.slice\(-12\)/);

    assert.match(coreSource, /memoryTags: Array\.isArray\(entry\?\.memoryTags\)/);
    assert.match(coreSource, /triggerKeywords: Array\.isArray\(entry\?\.triggerKeywords\)/);
    assert.match(coreSource, /eventItem\.memoryPayload\.triggerKeywords/);
    assert.match(settingsSource, /promptWithMemoryTriggers/);
    assert.match(settingsSource, /promptWithMemoryTags = prompt\.replace/);
    assert.match(settingsSource, /summaryPayload\.memoryTags/);
    assert.match(statusSource, /triggerKeywords = window\.imChat\?\.normalizeMemoryTriggerKeywords/);
    assert.match(cssSource, /\.memory-recall-narration-pill/);
    assert.match(indexSource, /4_chat_ai\.js\?v=20260716-status-prompt-v2/);
    assert.match(indexSource, /4_chat_bubbles\.js\?v=20260713-offline-summary-modal-v3/);
    assert.match(indexSource, /5_settings\.js\?v=20260716-status-prompt-v3/);
});

test('uses per-member group languages, content-sized private bubbles, and fresh edited-message context', async () => {
    const [aiSource, mainSource, coreSource, cssSource, indexSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_main.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);

    assert.match(aiSource, /const memberLanguageMap = groupMembers\.map/);
    assert.match(aiSource, /language:\s*member\.language \|\| 'zh'/);
    assert.match(aiSource, /【群成员独立语言｜最高优先级】/);
    assert.match(aiSource, /friendMessages 也必须跟随该段发起 speaker 的映射语言/);
    assert.match(aiSource, /严禁使用群聊对象的统一语言覆盖成员设置/);

    assert.match(cssSource, /\.group-private-chat-detail-bubble\s*\{[\s\S]*?display:\s*inline-flex/);
    assert.match(cssSource, /\.group-private-chat-detail-bubble\s*\{[\s\S]*?inline-size:\s*max-content/);
    assert.match(cssSource, /button\.group-private-chat-detail-bubble\s*\{[\s\S]*?max-inline-size:\s*min\(78%,\s*300px\)/);
    assert.match(cssSource, /\.group-private-chat-detail-row\.is-sender \.group-private-chat-detail-bubble\s*\{[\s\S]*?align-self:\s*flex-end/);

    assert.match(mainSource, /const rowMessageId = row\.getAttribute\('data-message-id'\)/);
    assert.match(mainSource, /window\.imApp\.findFriendMessageIndex\(liveFriend, messageDescriptor\)/);
    assert.match(mainSource, /id:\s*msg\.id \|\| rowMessageId \|\| null/);
    assert.match(coreSource, /const getApiContextFingerprint = \(message\) => JSON\.stringify/);
    assert.match(coreSource, /getApiContextFingerprint\(targetMessage\) !== previousContextFingerprint/);
    assert.match(coreSource, /window\.imApp\.clearFriendRuntimeMessageContext\(targetFriend\)/);
    assert.match(indexSource, /js\/imessage\/2_core\.js\?v=20260716-offline-token-v1/);
    assert.match(indexSource, /js\/imessage\/4_chat_ai\.js\?v=20260716-status-prompt-v2/);
    assert.match(indexSource, /js\/imessage\/4_chat_main\.js\?v=20260715-chat-context-menu-offline-retry-v1/);
});

test('uses stable long-press selection and purges deleted chat context without selecting narration', async () => {
    const [coreSource, aiSource, interfaceSource, mainSource, bubblesSource, cssSource, indexSource] = await Promise.all([
        fs.readFile(new URL('../js/imessage/2_core.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_ai.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_interface.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_main.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../js/imessage/4_chat_bubbles.js', import.meta.url), 'utf8'),
        fs.readFile(new URL('../css/imessage.css', import.meta.url), 'utf8'),
        fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);

    assert.match(coreSource, /batchSelectedMessages: new Map\(\)/);
    assert.match(interfaceSource, /key: id \? `id:\$\{id\}` : `timestamp:\$\{timestamp\}`/);
    assert.match(interfaceSource, /selection\.set\(descriptor\.key, descriptor\)/);
    assert.match(interfaceSource, /chat-batch-selection-count/);
    assert.match(interfaceSource, /selected \? '#111111' : '#c7c7cc'/);
    assert.doesNotMatch(interfaceSource, /batch-forward-btn|batch-star-btn/);
    assert.match(mainSource, /window\.imChat\.enterBatchSelectMode\(activeFriend, row, page\)/);
    assert.match(mainSource, /if \(window\.imData\.batchSelectMode\) return/);

    assert.match(coreSource, /window\.imChat\.invalidateFriendConversation\(safeFriendId\)/);
    assert.match(coreSource, /removedMessageIds\.has\(replyMessageId\)/);
    assert.match(coreSource, /targetFriend\.memory\.recallPresentation = null/);
    assert.match(coreSource, /purgeRegenerateRunSnapshots/);
    assert.match(coreSource, /targetFriend\.messages = previousMessages/);
    assert.match(aiSource, /function purgeRegenerateRunSnapshots/);
    assert.match(aiSource, /window\.imChat\.purgeRegenerateRunSnapshots = purgeRegenerateRunSnapshots/);

    const narrationRenderer = bubblesSource.slice(
        bubblesSource.indexOf('function renderSystemNoticeBubble'),
        bubblesSource.indexOf('function renderGroupRedPacketBubble')
    );
    assert.match(narrationRenderer, /row\.className = 'chat-system-row'/);
    assert.doesNotMatch(narrationRenderer, /chat-checkbox-wrapper/);
    assert.match(cssSource, /\.im-chat-cancel-batch-btn\s*\{[\s\S]*?color:\s*#111111/);
    assert.match(indexSource, /css\/imessage\.css\?v=20260716-status-prompt-v3/);
});
