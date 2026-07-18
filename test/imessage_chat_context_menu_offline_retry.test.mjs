import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readWorkspaceFile = (path) => readFile(new URL(path, root), 'utf8');

test('manual narration and dynamic action remain distinct inside the bounded chat context', async () => {
    const [coreSource, aiSource, sheetSource] = await Promise.all([
        readWorkspaceFile('js/imessage/2_core.js'),
        readWorkspaceFile('js/imessage/4_chat_ai.js'),
        readWorkspaceFile('js/imessage/4_chat_sheet.js')
    ]);

    assert.match(coreSource, /<SCENE_NARRATION source="\$\{narrationSource\}" attribution="none">/);
    assert.match(coreSource, /narrator_dynamic_action[\s\S]*scene_director/);
    assert.match(coreSource, /not a message, spoken line, inner thought, intention, or automatically performed action from User/);
    assert.match(coreSource, /Do not reply as though User said this text/);
    assert.match(coreSource, /unless the narration explicitly names that character as the actor/);
    assert.match(coreSource, /treat that action as an already established scene fact/);
    assert.match(coreSource, /return contextLimit > 0 \? allMessages\.slice\(-contextLimit\) : \[\]/);
    assert.match(coreSource, /return recentMessages[\s\S]*\.map\(\(message, index\) => window\.imApp\.formatMessageForApiContext/);
    assert.match(aiSource, /noticeKind: 'narration',[\s\S]{0,120}narrationSource: 'dynamic_action'/);
    assert.match(sheetSource, /noticeKind: 'narration',[\s\S]{0,120}narrationSource: 'manual'/);
});

test('dynamic narration continues the scene and rejects repetition of the prior beat', async () => {
    const aiSource = await readWorkspaceFile('js/imessage/4_chat_ai.js');

    assert.match(aiSource, /previousDynamicActionNarration/);
    assert.match(aiSource, /message\?\.narrationSource === 'dynamic_action'/);
    assert.match(aiSource, /上一条动描：\$\{previousDynamicActionText/);
    assert.match(aiSource, /严格使用第三人称叙述/);
    assert.match(aiSource, /写出因果相连的“下一拍”/);
    assert.match(aiSource, /不得重复相同的核心动作、环境意象、镜头焦点或句式/);
    assert.match(aiSource, /也不得仅用近义词改写/);
    assert.match(aiSource, /text 必须全程使用简体中文/);
    assert.match(aiSource, /高于角色默认语言、对话语言和上下文语言的硬性要求/);
});

test('offline prompts include creative guidance and the updated Green Apple writing style', async () => {
    const sheetSource = await readWorkspaceFile('js/imessage/4_chat_sheet.js');

    assert.match(sheetSource, /id: 'style_creative_guidance',[\s\S]{0,120}name: '文学指导',[\s\S]{0,120}enabled: true,[\s\S]{0,120}presetVersion: 4/);
    assert.match(sheetSource, /Literary Writing Guidance[\s\S]*Fundamental Logic[\s\S]*Literary Reference and Emulation[\s\S]*Draw extensively on and emulate relevant literary classics\.[\s\S]*Subtextual Dialogue/);
    const creativeGuidance = sheetSource.match(/id: 'style_creative_guidance'[\s\S]*?content: `([\s\S]*?)`[\s\S]*?id: 'style_baimiao'/)?.[1] || '';
    assert.ok(creativeGuidance);
    assert.match(creativeGuidance, /^<literary_guidance>[\s\S]*<\/literary_guidance>$/);
    assert.doesNotMatch(creativeGuidance, /<writing_style|文风-创作指导/);
    assert.match(creativeGuidance, /II\. Language and Prose Rules[\s\S]*5\. Emotion Through Scenery[\s\S]*6\. Literary Reference and Emulation[\s\S]*III\. Character, Dialogue, and Foreshadowing[\s\S]*3\. Open-Ended Conclusions/);
    assert.doesNotMatch(creativeGuidance, /IV\. Structure, Rhythm, and the Aesthetics of Restraint|Narrative Pacing/);
    assert.doesNotMatch(creativeGuidance, /#/);
    assert.doesNotMatch(creativeGuidance, /根据文体灵活调整/);
    assert.match(sheetSource, /id: 'style_green_apple',[\s\S]{0,100}name: '文风-青苹果',[\s\S]{0,100}enabled: false,[\s\S]{0,100}presetVersion: 3/);
    assert.match(sheetSource, /<writing_style name="文风-青苹果">/);
    assert.match(sheetSource, /温柔清透，留白感强/);
    assert.match(sheetSource, /一次互动只放大1个心动瞬间/);
    assert.match(sheetSource, /环境即情绪（新海诚式）/);
    assert.match(sheetSource, /拌嘴式反差萌（有川浩式）/);
    assert.match(sheetSource, /'style_creative_guidance',[\s\S]*'style_baimiao',[\s\S]*'style_green_apple',[\s\S]*'barrage_comments',[\s\S]*'format_rules',[\s\S]*'player_choices'/);
    assert.match(sheetSource, /defaultPrompt\.id === 'style_green_apple'[\s\S]*normalized\.splice\(styleIndex >= 0 \? styleIndex \+ 1 : normalized\.length, 0, missingPrompt\)/);
    assert.match(sheetSource, /refreshBuiltInContent = \(\['style_creative_guidance', 'style_green_apple'\]\.includes\(id\) \|\| fullCotIds\.includes\(id\)\)[\s\S]*sourcePresetVersion < targetPresetVersion/);
});

test('offline COT scans mounted writing styles without vectorizing them', async () => {
    const sheetSource = await readWorkspaceFile('js/imessage/4_chat_sheet.js');

    assert.match(sheetSource, /id: 'cot_literary_guidance',[\s\S]{0,100}name: 'cot-文学指导',[\s\S]{0,100}enabled: true,[\s\S]{0,100}presetVersion: 4/);
    assert.match(sheetSource, /是否遵循已启用的 <literary_guidance> 标签；是否仿写并参照至少三部与当前题材、风格相关的名著。/);
    assert.doesNotMatch(sheetSource.match(/id: 'cot_literary_guidance'[\s\S]*?content: `([\s\S]*?)`/)?.[1] || '', /文风创作指导标签/);
    assert.match(sheetSource, /id: 'cot_scene_planning'[\s\S]*?是否结合世界书、人设、记忆、线上与线下上下文及角色动机规划当前情景/);
    assert.match(sheetSource, /id: 'cot_language_check'[\s\S]*?是否按照角色默认语言书写台词/);
    assert.match(sheetSource, /id: 'cot_output_audit'[\s\S]*?是否遵循全部启用的格式规则与任务要求/);
    assert.match(sheetSource, /fullCotIds\.includes\(id\)[\s\S]*sourcePresetVersion < targetPresetVersion/);
    assert.doesNotMatch(sheetSource, /Think through the active world-book facts|Before drafting, scan the current system instruction|Before ending the reasoning, verify that/);
    assert.match(sheetSource, /for \(let p of offlinePrompts\)[\s\S]*if \(!isEnabled\) continue;[\s\S]*p\.content\.trim\(\)/);
    assert.doesNotMatch(sheetSource, /<writing_style[^>]*source="vectorized_char_memory"/);
});

test('offline reasoning keeps native fields separate and history prompts prose-only', async () => {
    const [sheetSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(indexSource, /offline_reasoning\.js\?v=20260718-offline-cot-v1[\s\S]*4_chat_sheet\.js\?v=20260718-offline-cot-v1/);
    assert.match(sheetSource, /extractResponseParts\(\[[\s\S]*responseMessage\.content[\s\S]*responseMessage\.reasoning[\s\S]*responseMessage\.reasoning_content[\s\S]*responseMessage\.reasoning_details/);
    assert.match(sheetSource, /extractResponseParts\(\[[\s\S]*delta\.content[\s\S]*delta\.reasoning[\s\S]*delta\.reasoning_content[\s\S]*delta\.reasoning_details/);
    assert.match(sheetSource, /appendReasoningChunk[\s\S]*appendContentChunk/);
    assert.match(sheetSource, /content: normalized\.content,[\s\S]*reasoning: normalized\.reasoning/);
    assert.match(sheetSource, /let currentNativeReasoning =[\s\S]*normalizeResponse\(currentContent, currentNativeReasoning/);
    assert.match(sheetSource, /finish: \(\) => \{[\s\S]*lastVisibleReasoning[\s\S]*reasoning: lastVisibleReasoning/);
    assert.match(sheetSource, /latestFriendAfterSave[\s\S]*renderOfflineCurrentMessages\(latestFriendAfterSave\)/);
    assert.match(sheetSource, /cloneOfflineMeetingMessages\(offlineMessages\)[\s\S]*content: message\.content[\s\S]*isOffline: true/);
    assert.doesNotMatch(sheetSource, /cloneOfflineMeetingMessages\(offlineMessages\)[\s\S]{0,500}reasoning: message\.reasoning/);
});

test('offline reasoning is always requested internally and provider errors remain explicit', async () => {
    const sheetSource = await readWorkspaceFile('js/imessage/4_chat_sheet.js');

    assert.match(sheetSource, /const OFFLINE_COT_PROMPT_IDS = new Set\(\[[\s\S]*'cot_before'[\s\S]*'cot_output_audit'[\s\S]*'cot_after'/);
    assert.match(sheetSource, /const requestReasoning = true;[\s\S]*buildCotInstructionBlock\(enabledCotPrompts\)[\s\S]*if \(OFFLINE_COT_PROMPT_IDS\.has\(p\.id\)\)[\s\S]*apiMessages\.push\(\{ role: 'system', content: cotCompilation\.content \}\)/);
    assert.match(sheetSource, /requestOfflineAssistantReplyWithCotValidation[\s\S]*validateCotResponse\(firstRawContent, expectedTitles\)[\s\S]*streamingBubble\?\.reset\?\.\(\)[\s\S]*validateCotResponse\(secondRawContent, expectedTitles\)/);
    assert.match(sheetSource, /模型未完全按 COT 预设输出/);
    assert.match(sheetSource, /const options = \{ includeBuiltin: false \};[\s\S]*getter\('system_depth', worldBookFriend, contextText, options\)/);
    assert.match(sheetSource, /p\.id === OFFLINE_CHAT_HISTORY_PROMPT_ID[\s\S]*mountHistory\(\);[\s\S]*apiMessages\.push\(\{ role: 'system', content: promptContent \}\)/);
    assert.match(sheetSource, /const mountHistory = \(\) => \{[\s\S]*apiMessages\.push\(\.\.\.historyMessages\.map/);
    assert.match(sheetSource, /id: OFFLINE_CHAT_HISTORY_PROMPT_ID,[\s\S]*name: '上下文'[\s\S]*editable: false,[\s\S]*deletable: false,[\s\S]*alwaysEnabled: true,[\s\S]*presetVersion: 3/);
    assert.match(sheetSource, /const isHistoryAnchor = prompt\.id === OFFLINE_CHAT_HISTORY_PROMPT_ID[\s\S]*if \(!isHistoryAnchor\) \{[\s\S]*offline-settings-expand-btn/);
    assert.doesNotMatch(sheetSource, /System Instruction for Current Roleplay|System COT Instruction for This Reply/);
    assert.doesNotMatch(sheetSource, /const systemPrompt = isGroup/);
    assert.doesNotMatch(sheetSource, /assistant_prefill|assistantPrefill/);
    assert.doesNotMatch(sheetSource, /apiMessages\.push\(\{\s*role: 'assistant',\s*content: [`'"]<thinking>/);
    assert.match(sheetSource, /buildReasoningRequestConfig\(\{[\s\S]*enabled: options\.requestReasoning !== false[\s\S]*maxTokens: OFFLINE_MAX_RESPONSE_TOKENS/);
    assert.match(sheetSource, /reasoningRequest\.hasReasoningParameter[\s\S]*response\.status === 400 \|\| response\.status === 422/);
    assert.match(sheetSource, /error\.code = isUnsupportedReasoningConfig \? 'reasoning_config_unsupported'/);
    assert.match(sheetSource, /generationError: error\?\.code === 'reasoning_config_unsupported'[\s\S]*'reasoning_unsupported'/);
    assert.match(sheetSource, /当前接口不支持自动推理配置/);
    assert.match(sheetSource, /extractResponseParts\(\[[\s\S]*responseMessage\.content[\s\S]*responseMessage\.output_text/);
    assert.match(sheetSource, /returnedJsonInsteadOfStream[\s\S]*responseContentType\.includes\('application\/json'\)/);
    assert.match(sheetSource, /finishReason[\s\S]*reasoning_tokens_exhausted/);
    assert.match(sheetSource, /思考已用完固定的 30000 回复 Token，请重试或更换模型/);
});

test('context menu measures actual panels and refits after opening More actions', async () => {
    const [interfaceSource, mainSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_interface.js'),
        readWorkspaceFile('js/imessage/4_chat_main.js')
    ]);

    assert.match(interfaceSource, /function fitContextMenuToViewport\(\)/);
    assert.match(interfaceSource, /reactionBar\?\.getBoundingClientRect\(\)\.height/);
    assert.match(interfaceSource, /visibleActions\?\.getBoundingClientRect\(\)\.height/);
    assert.match(interfaceSource, /bubbleClone\.style\.maxHeight/);
    assert.match(interfaceSource, /bubbleClone\.style\.overflowY = 'auto'/);
    assert.match(interfaceSource, /measureContextMenuSafeInset\(screenEl, '--safe-bottom'\)/);
    assert.match(interfaceSource, /window\.imChat\.fitContextMenuToViewport = fitContextMenuToViewport/);
    assert.match(mainSource, /moreActions\.style\.display = 'flex';[\s\S]{0,180}fitContextMenuToViewport/);
});

test('offline empty or failed generations persist a blank rerollable floor', async () => {
    const [sheetSource, indexSource] = await Promise.all([
        readWorkspaceFile('js/imessage/4_chat_sheet.js'),
        readWorkspaceFile('index.html')
    ]);

    assert.match(sheetSource, /new Error\(exhaustedTokens[\s\S]*Offline assistant returned empty content/);
    assert.match(sheetSource, /generationState: message\?\.generationState === 'failed' \? 'failed' : undefined/);
    assert.match(sheetSource, /generationState: 'failed',[\s\S]{0,180}generationError:/);
    assert.match(sheetSource, /persistOfflineMessages\(activeFriend, latestMessages\.concat\(failedMessage\)\)/);
    assert.match(sheetSource, /\$\{!isUser \? '<button[^']+data-offline-action="reroll"/);
    assert.match(sheetSource, /generationState: undefined,[\s\S]{0,100}generationError: undefined/);
    assert.match(indexSource, /js\/imessage\/4_chat_ai\.js\?v=20260718-single-chat-prompt-v2/);
    assert.match(indexSource, /js\/imessage\/offline_reasoning\.js\?v=20260718-offline-cot-v1/);
    assert.match(indexSource, /js\/imessage\/4_chat_sheet\.js\?v=20260718-offline-cot-v1/);
    assert.match(indexSource, /js\/imessage\/4_chat_(?:interface|main)\.js\?v=20260715-chat-context-menu-offline-retry-v1/g);
});
