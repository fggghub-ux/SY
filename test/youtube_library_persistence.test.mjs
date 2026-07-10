import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [youtubeCoreSource, youtubeCommunitySource, librarySource, indexSource, libraryCssSource] = await Promise.all([
    fs.readFile(new URL('../js/youtube/2_core.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/youtube/6_community.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../js/library.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../css/library.css', import.meta.url), 'utf8')
]);

test('YouTube state is rehydrated after IndexedDB-backed global data becomes ready', () => {
    assert.match(youtubeCoreSource, /window\.globalDataReadyPromise\.then\(\(\) => \{/);
    assert.match(youtubeCoreSource, /loadYoutubeData\(\);\s*refreshYoutubeUiAfterHydration\(\);/);
    assert.match(youtubeCoreSource, /window\.youtubeDataReadyPromise\s*=/);
    assert.match(indexSource, /js\/youtube\/2_core\.js\?v=20260710-storage-ready-v1/);
});

test('YouTube message API generation is persisted before UI replay', () => {
    assert.match(youtubeCommunitySource, /const YT_CHAT_GENERATION_STALE_MS = 2 \* 60 \* 1000/);
    assert.match(youtubeCommunitySource, /function createYtGenerationPlaceholder\(generationId\)/);
    assert.match(youtubeCommunitySource, /source: YT_CHAT_GENERATION_SOURCE/);
    assert.match(youtubeCommunitySource, /cleanupStaleYtGeneratingMessages\(targetHistory\)/);
    assert.match(youtubeCommunitySource, /getLatestYtNonSystemMessage\(targetHistory\)/);
    assert.match(youtubeCommunitySource, /replaceYtChatGenerationWithReplies\(threadRef, generationId, replyMessages\)/);
    assert.match(youtubeCommunitySource, /markYtChatGenerationFailed\(threadRef, generationId\)/);
});

test('Library book import supports EPUB through JSZip and OPF spine parsing', () => {
    assert.match(indexSource, /jszip@3\.10\.1\/dist\/jszip\.min\.js/);
    assert.match(indexSource, /id="library-book-file-input"[^>]*\.epub/);
    assert.match(indexSource, /application\/epub\+zip/);
    assert.match(librarySource, /async function readEpubBookFile\(file\)/);
    assert.match(librarySource, /META-INF\/container\.xml/);
    assert.match(librarySource, /getXmlElementsByLocalName\(opfXml, 'itemref'\)/);
    assert.match(librarySource, /sourceType: 'EPUB'/);
});

test('Library reader uses horizontal paged navigation', () => {
    assert.match(librarySource, /function updateReaderPageGeometry\(\)/);
    assert.match(librarySource, /function getReaderPageMetrics\(options = \{\}\)/);
    assert.match(librarySource, /reader_content\?\.scrollWidth/);
    assert.match(librarySource, /const pageStep = columnWidth \+ pageGap/);
    assert.match(librarySource, /--reader-page-step/);
    assert.match(librarySource, /--reader-content-width/);
    assert.match(librarySource, /readerMetrics:\s*null/);
    assert.match(librarySource, /function invalidateReaderMetrics\(\)/);
    assert.match(librarySource, /if \(!options\.force && state\.readerMetrics\) return state\.readerMetrics/);
    assert.match(librarySource, /state\.readerProgressSaveTimer = setTimeout/);
    assert.match(librarySource, /const contentWidth = Math\.max\(geometry\.columnWidth, \(pageCount - 1\) \* geometry\.pageStep \+ geometry\.columnWidth\)/);
    assert.match(librarySource, /state\.readerMetrics = \{ \.\.\.geometry, contentWidth, maxOffset, pageCount \}/);
    assert.match(librarySource, /updateReaderProgress\(true, null, \{ immediate: true \}\)/);
    assert.match(librarySource, /const savedProgress = clampReaderProgress\(Number\(book\.progress\) \|\| 0\)/);
    assert.match(librarySource, /setReaderPage\(0, \{ animate: false, save: false, updateProgress: false \}\)/);
    assert.match(librarySource, /restoreReaderProgress\(savedProgress\)/);
    assert.match(librarySource, /nextPage \* metrics\.pageStep/);
    assert.match(librarySource, /state\.readerPage \* metrics\.pageStep/);
    assert.match(librarySource, /reader_scroll\.scrollTo\(\{ left, top: 0, behavior: options\.animate \? 'smooth' : 'auto' \}\)/);
    assert.match(librarySource, /reader_scroll\.scrollLeft = left/);
    assert.match(librarySource, /options\.updateProgress !== false/);
    assert.match(librarySource, /const currentOffset = Math\.max\(0, Math\.round\(Number\(dom\.reader_scroll\.scrollLeft\) \|\| state\.readerPage \* metrics\.pageStep\)\)/);
    assert.doesNotMatch(librarySource, /reader_content\.style\.transform/);
    assert.doesNotMatch(librarySource, /nextPage \* metrics\.pageWidth/);
    assert.doesNotMatch(librarySource, /scrollWidth - scroll\.clientWidth/);
    assert.doesNotMatch(librarySource, /reader_scroll\.addEventListener\('scroll'/);
    assert.match(librarySource, /function handleReaderPointerUp\(event\)/);
    assert.match(librarySource, /setReaderPage\(start\.page \+ \(dx < 0 \? 1 : -1\)/);
    assert.match(librarySource, /event\.key === 'ArrowRight'/);
    assert.match(librarySource, /event\.key === 'ArrowLeft'/);
    assert.match(librarySource, /getVisibleReaderText[\s\S]*getClientRects\(\)/);
    assert.match(librarySource, /String\.fromCharCode\(183\)/);
    assert.match(libraryCssSource, /\.library-reader-scroll\s*\{[\s\S]*overflow:\s*hidden/);
    assert.match(libraryCssSource, /\.library-reader-scroll\s*\{[\s\S]*padding:\s*38px 24px 32px/);
    assert.doesNotMatch(libraryCssSource, /scroll-snap-type:\s*x mandatory/);
    assert.match(libraryCssSource, /width:\s*var\(--reader-content-width, var\(--reader-column-width/);
    assert.match(libraryCssSource, /min-width:\s*var\(--reader-column-width/);
    assert.match(libraryCssSource, /scroll-behavior:\s*auto/);
    assert.match(libraryCssSource, /overscroll-behavior:\s*none/);
    assert.match(libraryCssSource, /contain:\s*layout style/);
    assert.doesNotMatch(libraryCssSource, /contain:\s*layout style paint/);
    assert.match(libraryCssSource, /column-width:\s*var\(--reader-column-width/);
    assert.match(libraryCssSource, /column-gap:\s*var\(--reader-page-gap/);
    assert.match(libraryCssSource, /transform:\s*none/);
    assert.match(libraryCssSource, /transition:\s*none/);
    assert.doesNotMatch(libraryCssSource, /will-change:\s*transform/);
    assert.match(libraryCssSource, /\.library-reader-scroll article\s*\{[\s\S]*padding:\s*0/);
    assert.doesNotMatch(libraryCssSource, /width:\s*max-content/);
    assert.doesNotMatch(libraryCssSource, /padding:\s*38px 24px 120px/);
});
