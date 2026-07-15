(function (globalScope, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (globalScope) globalScope.imOfflineReasoning = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const COMPLETE_TAG_PATTERN = /<\s*(\/?)\s*(think(?:ing)?)\s*>/gi;
    const PARTIAL_TAG_CANDIDATES = [
        '<think>', '<thinking>', '</think>', '</thinking>'
    ];

    const normalizeText = (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n');

    const DEFAULT_MAX_RESPONSE_TOKENS = 30000;

    const normalizeMaxResponseTokens = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_RESPONSE_TOKENS;
        return Math.min(32768, Math.max(256, Math.round(numeric)));
    };

    const detectReasoningApiMode = (endpoint, model) => {
        const endpointText = String(endpoint || '').trim().toLowerCase();
        const modelText = String(model || '').trim().toLowerCase();
        if (/openrouter\.ai|openrouter/.test(endpointText)) return 'openrouter';
        if (/api\.openai\.com|openai\.com/.test(endpointText)) return 'native';
        if (/api\.deepseek\.com|deepseek\.com/.test(endpointText)) return 'native';
        if (/z\.ai|bigmodel|zhipu|moonshot|kimi/.test(endpointText)) return 'thinking';
        if (/\b(glm|kimi|moonshot)[-_/.]?/.test(modelText)) return 'thinking';
        return 'openrouter';
    };

    const isOpenAiReasoningModel = (endpoint, model) => {
        const endpointText = String(endpoint || '').trim().toLowerCase();
        const modelText = String(model || '').trim().toLowerCase();
        if (!/api\.openai\.com|openai\.com/.test(endpointText)) return false;
        return /^(o1|o3|o4)(?:[-_.]|$)|^gpt-5(?:[-_.]|$)/.test(modelText);
    };

    const buildReasoningRequestConfig = (options = {}) => {
        const endpoint = String(options.endpoint || '').trim();
        const model = String(options.model || '').trim();
        const enabled = options.enabled !== false;
        const maxTokens = normalizeMaxResponseTokens(options.maxTokens);
        const mode = detectReasoningApiMode(endpoint, model);
        const parameters = {};

        if (isOpenAiReasoningModel(endpoint, model)) parameters.max_completion_tokens = maxTokens;
        else parameters.max_tokens = maxTokens;

        if (mode === 'openrouter') {
            parameters.reasoning = { enabled, exclude: false };
        } else if (mode === 'thinking') {
            parameters.thinking = { type: enabled ? 'enabled' : 'disabled' };
        }

        return {
            mode,
            enabled,
            maxTokens,
            hasReasoningParameter: mode === 'openrouter' || mode === 'thinking',
            parameters
        };
    };

    const readReasoningValue = (value) => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        if (Array.isArray(value)) {
            return value.map(readReasoningValue).filter(Boolean).join('\n');
        }
        if (typeof value === 'object') {
            for (const key of ['text', 'content', 'reasoning_content', 'reasoning', 'summary']) {
                const text = readReasoningValue(value[key]);
                if (text) return text;
            }
        }
        return '';
    };

    const readFirstReasoningValue = (...values) => {
        for (const value of values) {
            const text = readReasoningValue(value);
            if (text) return text;
        }
        return '';
    };

    const readContentValue = (value) => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        if (Array.isArray(value)) return value.map(readContentValue).filter(Boolean).join('');
        if (typeof value === 'object') {
            for (const key of ['text', 'output_text', 'content', 'value']) {
                const text = readContentValue(value[key]);
                if (text) return text;
            }
        }
        return '';
    };

    const readFirstContentValue = (...values) => {
        for (const value of values) {
            const text = readContentValue(value);
            if (text) return text;
        }
        return '';
    };

    const findPartialTagSuffix = (text) => {
        const lower = text.toLowerCase();
        let best = '';
        for (const candidate of PARTIAL_TAG_CANDIDATES) {
            for (let length = 1; length < candidate.length; length += 1) {
                const prefix = candidate.slice(0, length);
                if (lower.endsWith(prefix) && prefix.length > best.length) best = text.slice(-prefix.length);
            }
        }
        return best;
    };

    const parseTaggedReasoning = (value, options = {}) => {
        const source = normalizeText(value);
        const contentParts = [];
        const reasoningParts = [];
        let cursor = 0;
        let reasoningStart = -1;
        let foundTag = false;
        let match = null;
        COMPLETE_TAG_PATTERN.lastIndex = 0;

        while ((match = COMPLETE_TAG_PATTERN.exec(source)) !== null) {
            foundTag = true;
            const isClosing = match[1] === '/';
            if (!isClosing) {
                if (reasoningStart < 0) {
                    contentParts.push(source.slice(cursor, match.index));
                    reasoningStart = COMPLETE_TAG_PATTERN.lastIndex;
                }
                continue;
            }

            if (reasoningStart >= 0) {
                reasoningParts.push(source.slice(reasoningStart, match.index));
                reasoningStart = -1;
                cursor = COMPLETE_TAG_PATTERN.lastIndex;
            } else {
                reasoningParts.push(source.slice(cursor, match.index));
                cursor = COMPLETE_TAG_PATTERN.lastIndex;
            }
        }

        let incomplete = false;
        let pendingTag = '';
        if (reasoningStart >= 0) {
            reasoningParts.push(source.slice(reasoningStart));
            incomplete = true;
        } else {
            contentParts.push(source.slice(cursor));
            if (!foundTag && options.streaming) {
                pendingTag = findPartialTagSuffix(contentParts[contentParts.length - 1] || '');
                if (pendingTag) {
                    const lastIndex = contentParts.length - 1;
                    contentParts[lastIndex] = contentParts[lastIndex].slice(0, -pendingTag.length);
                }
            }
        }

        return {
            content: contentParts.join('').trim(),
            reasoning: reasoningParts.map(part => part.trim()).filter(Boolean).join('\n\n'),
            foundTag,
            incomplete,
            pendingTag
        };
    };

    const normalizeResponse = (content, nativeReasoning, options = {}) => {
        const tagged = parseTaggedReasoning(content, options);
        const nativeText = readReasoningValue(nativeReasoning).trim();
        const taggedText = tagged.reasoning.trim();
        return {
            content: tagged.content,
            reasoning: taggedText || nativeText,
            reasoningSource: taggedText ? 'tagged' : (nativeText ? 'native' : ''),
            foundTag: tagged.foundTag,
            incomplete: tagged.incomplete,
            pendingTag: tagged.pendingTag
        };
    };

    return {
        normalizeMaxResponseTokens,
        detectReasoningApiMode,
        buildReasoningRequestConfig,
        readContentValue,
        readFirstContentValue,
        readReasoningValue,
        readFirstReasoningValue,
        parseTaggedReasoning,
        normalizeResponse
    };
});
