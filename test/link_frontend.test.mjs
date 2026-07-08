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
    assert.match(interfaceSource, /safeBubbleHeight/);
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

    assert.doesNotMatch(summarySource, /first-person summary/);
    assert.doesNotMatch(summarySource, /Char 的第一视角/);
    assert.match(summarySource, /third-person summary/);
    assert.match(summarySource, /Char's perspective/);
    assert.match(summarySource, /saw, heard, said, did, noticed/);
    assert.match(summarySource, /只描述 Char 看到、听到、说出、做出、注意到或能合理推断/);

    assert.match(interfaceSource, /setAttribute\('data-current-friend-id'/);
    assert.match(interfaceSource, /msg-context-row-clone/);
    assert.match(applyFriendCssSource, /data-current-friend-id="\$\{escapeCssAttributeValue\(friend\.id\)\}"/);
    assert.match(applyFriendCssSource, /scopeThemeCss\(friend\.customCss, prefix\)[\s\S]*scopeThemeCss\(friend\.customCss, contextPrefix\)/);
    assert.match(applyFriendCssSource, /scopeThemeCss\(friend\.statusCss, prefix\)/);
    assert.doesNotMatch(applyFriendCssSource, /scopeThemeCss\(friend\.statusCss, contextPrefix\)/);
    assert.match(cssSource, /#msg-context-bubble-clone \.msg-context-row-clone\s*\{/);
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
    assert.match(settingsSource, /function refreshThemePresetUi\(\)/);
    assert.ok((settingsSource.match(/refreshThemePresetUi\(\)/g) || []).length >= 4);
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
    assert.match(aiSource, /thought 字段必须使用自然中文/);
    assert.match(aiSource, /【中文强制】thought、location、action、mood、expression、events 以及 memoryPayload/);
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

    assert.match(interfaceSource, /window\.imApp\.getFriendById\(friend\.id\)/);
    assert.match(interfaceSource, /hasHistoricalThought/);
    assert.match(interfaceSource, /groupProfile\.thought \|\| '暂无心声'/);
    assert.match(interfaceSource, /formatStatusLabel/);
    assert.match(interfaceSource, /normalizeStatusForStorage/);
    assert.match(statusSource, /formatProfileStatusLabel/);

    assert.match(coreSource, /targetFriend\.messages\s*=\s*\[\]/);
    assert.match(coreSource, /normalized\.relationship\s*=/);
    assert.match(coreSource, /normalized\.allowRoleRecall\s*=\s*normalized\.allowRoleRecall\s*!==\s*false/);
    assert.match(coreSource, /targetFriend\.memberProfiles\s*=\s*\{\}/);
    assert.match(coreSource, /notes:\s*''/);
    assert.match(coreSource, /cleared\.lastSummaryMessageCount\s*=\s*0/);
    assert.match(coreSource, /cleared\.mountSettings\s*=/);
    assert.match(coreSource, /clearFriendRuntimeMessageContext\(targetFriend\)/);

    assert.match(settingsSource, /chatRoleRecallToggle\.checked\s*=\s*friend\.allowRoleRecall\s*!==\s*false/);
    assert.match(settingsSource, /targetFriend\.allowRoleRecall\s*=\s*nextValue/);
    assert.match(indexSource, /id="friend-relationship-input"/);
    assert.match(indexSource, /id="char-relationship-input"/);
    assert.match(indexSource, /Char 认为你们的关系/);
    assert.match(contactsSource, /friendRelationship/);
    assert.match(contactsSource, /relationship:\s*document\.getElementById\('friend-relationship-input'\)/);
    assert.match(settingsSource, /char-relationship-input/);
    assert.match(settingsSource, /relationshipInput\.value\s*=\s*friend\.relationship \|\| ''/);
    assert.match(settingsSource, /targetFriend\.relationship\s*=\s*relationshipInput \? relationshipInput\.value : ''/);
});
