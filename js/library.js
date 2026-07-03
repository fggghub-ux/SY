(function () {
    'use strict';

    const NETEASE_REDIRECT_API = 'https://music.znnu.com/api/redirect';
    const NETEASE_METING_API = 'https://api.injahow.cn/meting/';
    const TABS = ['books', 'music', 'overview'];
    const DEFAULT_PREFERENCES = {
        activeTab: 'books',
        readerFontSize: 18,
        readerLineHeight: 1.85,
        readerTheme: 'light',
        rankingRange: 'week'
    };
    const BOOK_PALETTES = [
        ['#c9d4c8', '#415147'],
        ['#d7d0c5', '#514940'],
        ['#c8d1dc', '#3f4c5c'],
        ['#d6c9c6', '#5b4542'],
        ['#d6d4bd', '#50513f'],
        ['#c9d4d2', '#3f5350']
    ];

    const state = {
        ready: false,
        books: [],
        playlists: [],
        tracks: [],
        stats: [],
        preferences: { ...DEFAULT_PREFERENCES },
        activeTab: 'books',
        currentBook: null,
        currentPlaylist: null,
        currentTrack: null,
        queue: [],
        queueIndex: -1,
        chapters: [],
        lyrics: [],
        lyricIndex: -1,
        readerLastActivityAt: 0,
        pendingReadingSeconds: 0,
        pendingListeningSeconds: 0,
        lastMediaTime: 0,
        isSeeking: false,
        navDragging: false,
        navMouseDragging: false,
        navPointerId: null
    };

    const dom = {};
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.playsInline = true;

    function $(id) {
        return document.getElementById(id);
    }

    function cacheDom() {
        [
            'library-view', 'library-back-btn', 'library-header-action', 'library-main',
            'library-books-page', 'library-music-page', 'library-overview-page',
            'library-book-upload-btn', 'library-book-file-input', 'library-book-count',
            'library-book-grid', 'library-books-empty', 'library-import-netease-btn',
            'library-add-track-btn', 'library-music-add-btn', 'library-playlist-count',
            'library-playlist-list', 'library-music-empty', 'library-floating-nav',
            'library-mini-player', 'library-mini-open', 'library-mini-art', 'library-mini-title',
            'library-mini-artist', 'library-mini-play', 'library-mini-next', 'library-mini-progress',
            'library-reader-view', 'library-reader-back', 'library-reader-title',
            'library-reader-progress-label', 'library-reader-settings', 'library-reader-toc-button',
            'library-reader-toc', 'library-reader-toc-close', 'library-reader-toc-list', 'library-reader-scroll',
            'library-reader-content', 'library-reader-panel', 'library-playlist-view',
            'library-playlist-back', 'library-playlist-delete', 'library-playlist-cover',
            'library-playlist-title', 'library-playlist-meta', 'library-play-all',
            'library-track-list', 'library-player-view', 'library-player-close',
            'library-player-wash', 'library-player-art', 'library-player-title',
            'library-player-artist', 'library-player-progress', 'library-player-current',
            'library-player-duration', 'library-player-prev', 'library-player-play',
            'library-player-next', 'library-lyrics', 'library-import-modal',
            'library-import-form', 'library-netease-input', 'library-track-modal',
            'library-track-form', 'library-track-name', 'library-track-artist',
            'library-track-url', 'library-track-cover-url', 'library-track-lyric-url',
            'library-today-reading', 'library-today-listening', 'library-week-total',
            'library-week-chart', 'library-ranking-list'
        ].forEach((id) => {
            dom[id.replace(/^library-/, '').replace(/-/g, '_')] = $(id);
        });
    }

    function storage() {
        if (!window.appStorage) throw new Error('App storage is unavailable.');
        return window.appStorage;
    }

    function toast(message) {
        if (window.showToast) window.showToast(message);
        else console.info('[Library]', message);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeHttpUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function uid(prefix) {
        if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function hashString(value) {
        let hash = 0;
        for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        return Math.abs(hash);
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function lastSevenDays() {
        const result = [];
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        for (let offset = 6; offset >= 0; offset -= 1) {
            const date = new Date(now);
            date.setDate(now.getDate() - offset);
            result.push({
                key: localDateKey(date),
                label: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
            });
        }
        return result;
    }

    function formatDuration(seconds, compact = false) {
        const safe = Math.max(0, Math.round(Number(seconds) || 0));
        if (safe < 60) return compact ? `${safe}秒` : '0分钟';
        const minutes = Math.floor(safe / 60);
        if (minutes < 60) return `${minutes}分钟`;
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest ? `${hours}小时${rest}分` : `${hours}小时`;
    }

    function formatClock(seconds) {
        const safe = Math.max(0, Number.isFinite(Number(seconds)) ? Number(seconds) : 0);
        const minutes = Math.floor(safe / 60);
        const rest = Math.floor(safe % 60);
        return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function setArtwork(element, url, fallbackIcon = 'fa-music') {
        if (!element) return;
        const safeUrl = safeHttpUrl(url);
        element.innerHTML = safeUrl
            ? `<img src="${escapeHtml(safeUrl)}" alt="" referrerpolicy="no-referrer">`
            : `<i class="fas ${fallbackIcon}"></i>`;
    }

    function getTrack(trackId) {
        return state.tracks.find((track) => track.id === trackId) || null;
    }

    function getPlaylist(playlistId) {
        return state.playlists.find((playlist) => playlist.id === playlistId) || null;
    }

    async function loadState() {
        const repo = storage();
        const [books, playlists, tracks, stats, preferences] = await Promise.all([
            repo.loadLibraryBooks(),
            repo.loadLibraryPlaylists(),
            repo.loadLibraryTracks(),
            repo.loadLibraryDailyStats(),
            repo.getSetting('libraryPreferences', DEFAULT_PREFERENCES)
        ]);
        state.books = Array.isArray(books) ? books : [];
        state.playlists = Array.isArray(playlists) ? playlists : [];
        state.tracks = Array.isArray(tracks) ? tracks : [];
        state.stats = Array.isArray(stats) ? stats : [];
        state.preferences = { ...DEFAULT_PREFERENCES, ...(preferences || {}) };
        state.activeTab = TABS.includes(state.preferences.activeTab) ? state.preferences.activeTab : 'books';
    }

    async function savePreferences() {
        state.preferences.activeTab = state.activeTab;
        await storage().setSetting('libraryPreferences', state.preferences);
    }

    function openApp(tab) {
        if (!state.ready) return;
        if (TABS.includes(tab)) switchTab(tab, false);
        dom.view.classList.add('active');
        dom.view.setAttribute('aria-hidden', 'false');
        if (state.activeTab === 'overview') renderOverview();
    }

    function closeApp() {
        if (dom.reader_view.classList.contains('active')) closeReader();
        dom.playlist_view.classList.remove('active');
        dom.player_view.classList.remove('active');
        closeAllModals();
        dom.view.classList.remove('active');
        dom.view.setAttribute('aria-hidden', 'true');
        savePreferences().catch(console.error);
    }

    function switchTab(tab, persist = true) {
        if (!TABS.includes(tab)) return;
        state.activeTab = tab;
        const index = TABS.indexOf(tab);
        dom.view.style.setProperty('--library-nav-index', String(index));
        dom.view.querySelectorAll('[data-library-page]').forEach((page) => {
            page.classList.toggle('active', page.dataset.libraryPage === tab);
        });
        dom.floating_nav.querySelectorAll('[data-library-tab]').forEach((button) => {
            button.classList.toggle('active', button.dataset.libraryTab === tab);
        });
        dom.header_action.style.visibility = tab === 'overview' ? 'hidden' : 'visible';
        if (tab === 'overview') renderOverview();
        if (persist) savePreferences().catch(console.error);
    }

    function renderBooks() {
        const sorted = [...state.books].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        dom.book_count.textContent = `${sorted.length} ${sorted.length === 1 ? 'BOOK' : 'BOOKS'}`;
        dom.books_empty.hidden = sorted.length > 0;
        dom.book_grid.hidden = sorted.length === 0;
        dom.book_grid.innerHTML = sorted.map((book) => {
            const palette = BOOK_PALETTES[hashString(book.id) % BOOK_PALETTES.length];
            const progress = Math.round(Math.max(0, Math.min(1, Number(book.progress) || 0)) * 100);
            return `
                <article class="library-book-card" data-book-id="${escapeHtml(book.id)}">
                    <button class="library-book-open" type="button" data-book-action="open">
                        <span class="library-book-cover" style="background:${palette[0]};color:${palette[1]}">
                            <small>${escapeHtml(String(book.sourceType || 'TEXT').toUpperCase())}</small>
                            <strong>${escapeHtml(book.title || '未命名')}</strong>
                        </span>
                        <span class="library-book-info"><strong>${escapeHtml(book.title || '未命名')}</strong><span>${progress ? `已读 ${progress}%` : '尚未开始'}</span></span>
                    </button>
                    <div class="library-book-menu">
                        <button type="button" data-book-action="rename">重命名</button>
                        <button type="button" data-book-action="delete">删除</button>
                    </div>
                </article>`;
        }).join('');
    }

    function fileBaseName(name) {
        return String(name || '未命名书籍').replace(/\.[^/.]+$/, '') || '未命名书籍';
    }

    function decodeTextFile(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            return new TextDecoder('utf-8').decode(bytes.subarray(3));
        }
        if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
        if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (error) {
            try {
                return new TextDecoder('gb18030').decode(bytes);
            } catch (fallbackError) {
                return new TextDecoder('utf-8').decode(bytes);
            }
        }
    }

    async function readBookFile(file) {
        const lower = String(file.name || '').toLowerCase();
        if (lower.endsWith('.docx')) {
            if (!window.mammoth?.extractRawText) throw new Error('DOCX 解析组件未加载，请检查网络后重试');
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return String(result?.value || '').replace(/\r\n/g, '\n');
        }
        return decodeTextFile(await file.arrayBuffer()).replace(/\r\n/g, '\n').replace(/\u0000/g, '');
    }

    async function importBook(file) {
        if (!file) return;
        const lower = String(file.name || '').toLowerCase();
        if (!lower.endsWith('.txt') && !lower.endsWith('.text') && !lower.endsWith('.docx')) {
            toast('仅支持 TXT 和 DOCX 文件');
            return;
        }
        toast('正在整理书籍…');
        try {
            const text = await readBookFile(file);
            if (!text.trim()) throw new Error('文件内容为空');
            const now = Date.now();
            const book = {
                id: uid('book'),
                title: fileBaseName(file.name),
                sourceType: lower.endsWith('.docx') ? 'DOCX' : 'TXT',
                text,
                progress: 0,
                createdAt: now,
                updatedAt: now,
                lastOpenedAt: 0
            };
            await storage().saveLibraryBook(book);
            state.books.push(book);
            renderBooks();
            toast('书籍已放入书架');
        } catch (error) {
            console.error('[Library] Book import failed:', error);
            toast(error?.message || '书籍导入失败');
        } finally {
            dom.book_file_input.value = '';
        }
    }

    function requestRenameBook(book) {
        if (!book) return;
        if (window.showCustomModal) {
            window.showCustomModal({
                type: 'prompt',
                title: '重命名书籍',
                message: '输入新的书名',
                placeholder: '书名',
                defaultValue: book.title || '',
                confirmText: '保存',
                onConfirm: async (value) => {
                    const title = String(value || '').trim();
                    if (!title) return toast('书名不能为空');
                    book.title = title.slice(0, 100);
                    book.updatedAt = Date.now();
                    await storage().saveLibraryBook(book);
                    renderBooks();
                }
            });
            return;
        }
        const title = window.prompt('输入新的书名', book.title || '');
        if (title?.trim()) {
            book.title = title.trim().slice(0, 100);
            book.updatedAt = Date.now();
            storage().saveLibraryBook(book).then(renderBooks);
        }
    }

    function requestDeleteBook(book) {
        if (!book) return;
        const remove = async () => {
            if (state.currentBook?.id === book.id) closeReader();
            await storage().deleteLibraryBook(book.id);
            state.books = state.books.filter((item) => item.id !== book.id);
            renderBooks();
            toast('书籍已删除');
        };
        if (window.showCustomModal) {
            window.showCustomModal({ title: '删除书籍', message: `确定删除《${book.title}》吗？`, confirmText: '删除', isDestructive: true, onConfirm: remove });
        } else if (window.confirm(`确定删除《${book.title}》吗？`)) remove();
    }

    function applyReaderPreferences() {
        const size = Math.max(14, Math.min(28, Number(state.preferences.readerFontSize) || 18));
        const line = Math.max(1.4, Math.min(2.4, Number(state.preferences.readerLineHeight) || 1.85));
        const theme = ['light', 'paper', 'dark'].includes(state.preferences.readerTheme) ? state.preferences.readerTheme : 'light';
        state.preferences.readerFontSize = size;
        state.preferences.readerLineHeight = line;
        state.preferences.readerTheme = theme;
        dom.reader_view.style.setProperty('--reader-font', `${size}px`);
        dom.reader_view.style.setProperty('--reader-line', String(line));
        dom.reader_view.classList.toggle('theme-paper', theme === 'paper');
        dom.reader_view.classList.toggle('theme-dark', theme === 'dark');
        dom.reader_panel.querySelectorAll('[data-reader-theme]').forEach((button) => {
            button.classList.toggle('active', button.dataset.readerTheme === theme);
        });
    }

    function updateReaderProgress(save = false) {
        const book = state.currentBook;
        if (!book) return;
        const scroll = dom.reader_scroll;
        const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        book.progress = max > 0 ? Math.max(0, Math.min(1, scroll.scrollTop / max)) : 1;
        book.updatedAt = Date.now();
        dom.reader_progress_label.textContent = `${Math.round(book.progress * 100)}%`;
        if (save) storage().saveLibraryBook(book).catch(console.error);
    }

    function markReaderActivity() {
        state.readerLastActivityAt = Date.now();
    }

    function isChapterHeading(line) {
        const value = String(line || '').trim();
        if (!value || value.length > 80) return false;
        return /^(?:第[0-9零一二三四五六七八九十百千万两〇○]+[章节卷部篇回]|chapter\s+[0-9ivxlcdm]+\b|#{1,3}\s+|\d{1,3}[、.．]\s*\S+)/i.test(value);
    }

    function renderReaderDocument(text) {
        const lines = String(text || '').split('\n');
        const chapters = [{ title: '开始阅读', anchorId: 'library-reader-start' }];
        let chapterIndex = 0;
        const html = lines.map((line, lineIndex) => {
            if (!isChapterHeading(line)) return escapeHtml(line);
            chapterIndex += 1;
            const anchorId = `library-reader-chapter-${chapterIndex}`;
            chapters.push({ title: line.trim().replace(/^#{1,3}\s*/, ''), anchorId, lineIndex });
            return `<span class="library-reader-chapter" id="${anchorId}">${escapeHtml(line)}</span>`;
        }).join('\n');
        dom.reader_content.innerHTML = `<span id="library-reader-start"></span>${html}`;
        state.chapters = chapters;
        dom.reader_toc_list.innerHTML = chapters.map((chapter, index) => `
            <button type="button" data-chapter-anchor="${escapeHtml(chapter.anchorId)}">
                <span>${String(index + 1).padStart(2, '0')}</span>
                <span>${escapeHtml(chapter.title)}</span>
            </button>`).join('') + (chapters.length === 1
            ? '<p class="library-reader-toc-empty">未识别到明确章节标题。支持“第×章”、Chapter、Markdown 标题和数字标题。</p>'
            : '');
    }

    function openReader(book) {
        if (!book) return;
        state.currentBook = book;
        book.lastOpenedAt = Date.now();
        dom.reader_title.textContent = book.title || '未命名';
        renderReaderDocument(book.text || '');
        applyReaderPreferences();
        dom.reader_view.classList.add('active');
        dom.reader_view.setAttribute('aria-hidden', 'false');
        markReaderActivity();
        requestAnimationFrame(() => {
            const max = Math.max(0, dom.reader_scroll.scrollHeight - dom.reader_scroll.clientHeight);
            dom.reader_scroll.scrollTop = max * Math.max(0, Math.min(1, Number(book.progress) || 0));
            updateReaderProgress(false);
        });
    }

    async function flushReadingStats() {
        const seconds = state.pendingReadingSeconds;
        const book = state.currentBook;
        if (!book || seconds <= 0) return;
        state.pendingReadingSeconds = 0;
        await storage().incrementLibraryDailyStat({ date: localDateKey(), kind: 'reading', itemId: book.id, seconds });
    }

    function closeReader() {
        if (!state.currentBook) {
            dom.reader_view.classList.remove('active');
            return;
        }
        updateReaderProgress(true);
        flushReadingStats().catch(console.error);
        dom.reader_panel.hidden = true;
        dom.reader_toc.hidden = true;
        dom.reader_view.classList.remove('active');
        dom.reader_view.setAttribute('aria-hidden', 'true');
        state.currentBook = null;
        renderBooks();
    }

    function renderPlaylists() {
        const sorted = [...state.playlists].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        dom.playlist_count.textContent = `${sorted.length} ${sorted.length === 1 ? 'PLAYLIST' : 'PLAYLISTS'}`;
        dom.music_empty.hidden = sorted.length > 0;
        dom.playlist_list.hidden = sorted.length === 0;
        dom.playlist_list.innerHTML = sorted.map((playlist) => {
            const count = Array.isArray(playlist.trackIds) ? playlist.trackIds.length : 0;
            const cover = safeHttpUrl(playlist.coverUrl);
            return `
                <button class="library-playlist-card" type="button" data-playlist-id="${escapeHtml(playlist.id)}">
                    <span class="library-playlist-cover">${cover ? `<img src="${escapeHtml(cover)}" alt="" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                    <span><strong>${escapeHtml(playlist.name || '未命名歌单')}</strong><small>${count} 首歌曲 · ${escapeHtml(playlist.source === 'netease' ? '网易云音乐' : 'Library')}</small></span>
                    <i class="fas fa-chevron-right"></i>
                </button>`;
        }).join('');
    }

    function playlistTracks(playlist) {
        return (playlist?.trackIds || []).map(getTrack).filter(Boolean);
    }

    function openPlaylist(playlist) {
        if (!playlist) return;
        state.currentPlaylist = playlist;
        const tracks = playlistTracks(playlist);
        dom.playlist_title.textContent = playlist.name || '未命名歌单';
        dom.playlist_meta.textContent = `${tracks.length} 首歌曲${playlist.source === 'netease' ? ' · 网易云音乐' : ''}`;
        setArtwork(dom.playlist_cover, playlist.coverUrl);
        dom.track_list.innerHTML = tracks.map((track, index) => `
            <button class="library-track-row${track.available === false ? ' unavailable' : ''}" type="button" data-track-id="${escapeHtml(track.id)}">
                <span class="library-track-art">${safeHttpUrl(track.coverUrl) ? `<img src="${escapeHtml(safeHttpUrl(track.coverUrl))}" alt="" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <span><strong>${escapeHtml(track.name || '未知歌曲')}</strong><small>${escapeHtml(track.artist || '未知歌手')}</small></span>
                <span>${track.available === false ? '不可播放' : String(index + 1).padStart(2, '0')}</span>
            </button>`).join('');
        dom.playlist_view.classList.add('active');
        dom.playlist_view.setAttribute('aria-hidden', 'false');
    }

    function closePlaylist() {
        dom.playlist_view.classList.remove('active');
        dom.playlist_view.setAttribute('aria-hidden', 'true');
        state.currentPlaylist = null;
    }

    async function ensureManualPlaylist() {
        let playlist = state.playlists.find((item) => item.id === 'library_manual_playlist');
        if (playlist) return playlist;
        playlist = {
            id: 'library_manual_playlist',
            name: '我的歌单',
            source: 'manual',
            coverUrl: '',
            trackIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await storage().saveLibraryPlaylistBundle(playlist, []);
        state.playlists.push(playlist);
        return playlist;
    }

    function openModal(modal) {
        closeAllModals();
        modal.hidden = false;
        requestAnimationFrame(() => modal.querySelector('input, textarea')?.focus());
    }

    function closeAllModals() {
        [dom.import_modal, dom.track_modal].forEach((modal) => { if (modal) modal.hidden = true; });
    }

    async function addDirectTrack(event) {
        event.preventDefault();
        const name = dom.track_name.value.trim();
        const artist = dom.track_artist.value.trim() || '未知歌手';
        const mediaUrl = safeHttpUrl(dom.track_url.value);
        const coverUrl = dom.track_cover_url.value.trim() ? safeHttpUrl(dom.track_cover_url.value) : '';
        const lyricUrl = dom.track_lyric_url.value.trim() ? safeHttpUrl(dom.track_lyric_url.value) : '';
        if (!name || !mediaUrl) return toast('请填写歌曲名称和有效的音频 URL');
        if (dom.track_cover_url.value.trim() && !coverUrl) return toast('封面 URL 无效');
        if (dom.track_lyric_url.value.trim() && !lyricUrl) return toast('歌词 URL 无效');

        try {
            const playlist = await ensureManualPlaylist();
            const now = Date.now();
            const track = {
                id: uid('track'),
                playlistId: playlist.id,
                source: 'url',
                name,
                artist,
                mediaUrl,
                coverUrl,
                lyricUrl,
                available: true,
                createdAt: now,
                updatedAt: now
            };
            playlist.trackIds = [...(playlist.trackIds || []), track.id];
            playlist.coverUrl = playlist.coverUrl || coverUrl;
            playlist.updatedAt = now;
            await storage().saveLibraryPlaylistBundle(playlist, [track]);
            state.tracks.push(track);
            renderPlaylists();
            dom.track_form.reset();
            closeAllModals();
            toast('歌曲已添加到我的歌单');
        } catch (error) {
            console.error('[Library] Track save failed:', error);
            toast('歌曲保存失败');
        }
    }

    function extractSharedPlaylistName(input, playlistId) {
        const text = String(input || '');
        const quoted = text.match(/(?:歌单|分享)\s*[《「“"]([^》」”"\n]{1,80})[》」”"]/);
        if (quoted) return quoted[1].trim();
        const byLine = text.match(/分享歌单[:：]\s*([^\n]{1,80})/);
        if (byLine) return byLine[1].replace(/https?:\/\/.*$/, '').trim();
        return `网易云歌单 ${String(playlistId).slice(-6)}`;
    }

    async function fetchJson(url, timeoutMs = 25000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
            if (!response.ok) throw new Error(`请求失败 (${response.status})`);
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function resolveNetEasePlaylistId(input) {
        const raw = String(input || '').trim();
        if (!raw) throw new Error('请粘贴网易云歌单链接');
        if (/^\d{5,}$/.test(raw)) return raw;
        const urlMatch = raw.match(/https?:\/\/(?:y\.)?music\.163\.com\/[^\s)）]+|https?:\/\/163cn\.tv\/[a-zA-Z0-9]+/i);
        let target = urlMatch ? urlMatch[0] : raw;
        if (/163cn\.tv\//i.test(target)) {
            const result = await fetchJson(`${NETEASE_REDIRECT_API}?url=${encodeURIComponent(target)}`);
            if (result?.code !== 200 || !result.redirectUrl) throw new Error('网易云短链接解析失败，请尝试粘贴完整歌单链接');
            target = result.redirectUrl;
        }
        const idMatch = target.match(/[?&]id=(\d+)/i) || target.match(/\/playlist\/(\d+)/i);
        if (!idMatch) throw new Error('没有找到歌单 ID，请确认粘贴的是歌单链接');
        return idMatch[1];
    }

    async function importNetEasePlaylist(input) {
        const playlistId = await resolveNetEasePlaylistId(input);
        const endpoint = `${NETEASE_METING_API}?server=netease&type=playlist&id=${encodeURIComponent(playlistId)}`;
        const rows = await fetchJson(endpoint, 35000);
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('歌单为空、未公开或暂时无法解析');

        const now = Date.now();
        const playlistKey = `netease_playlist_${playlistId}`;
        const tracks = rows.map((row, index) => {
            const sourceUrl = safeHttpUrl(row?.url);
            const songId = sourceUrl ? new URL(sourceUrl).searchParams.get('id') : '';
            const trackId = songId ? `netease_track_${playlistId}_${songId}` : `netease_track_${playlistId}_${index}`;
            return {
                id: trackId,
                playlistId: playlistKey,
                source: 'netease',
                neteaseId: songId || '',
                name: String(row?.name || `歌曲 ${index + 1}`).slice(0, 120),
                artist: String(row?.artist || '未知歌手').slice(0, 120),
                mediaUrl: sourceUrl,
                coverUrl: safeHttpUrl(row?.pic),
                lyricUrl: safeHttpUrl(row?.lrc),
                available: !!sourceUrl,
                createdAt: now,
                updatedAt: now
            };
        });
        if (!tracks.some((track) => track.available)) throw new Error('歌单中没有可播放的歌曲');

        const previous = getPlaylist(playlistKey);
        const playlist = {
            id: playlistKey,
            source: 'netease',
            sourceId: playlistId,
            sourceUrl: `https://music.163.com/playlist?id=${playlistId}`,
            name: previous?.name || extractSharedPlaylistName(input, playlistId),
            coverUrl: tracks.find((track) => track.coverUrl)?.coverUrl || '',
            trackIds: tracks.map((track) => track.id),
            createdAt: previous?.createdAt || now,
            updatedAt: now
        };

        await storage().saveLibraryPlaylistBundle(playlist, tracks, { replaceTracks: true });
        state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
        state.playlists.push(playlist);
        state.tracks = state.tracks.filter((track) => track.playlistId !== playlist.id).concat(tracks);
        renderPlaylists();
        return playlist;
    }

    async function handleNetEaseImport(event) {
        event?.preventDefault();
        const input = dom.netease_input.value.trim();
        const submit = dom.import_form.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.textContent = '正在读取歌单…';
        try {
            const playlist = await importNetEasePlaylist(input);
            dom.import_form.reset();
            closeAllModals();
            toast(`已导入《${playlist.name}》`);
            openPlaylist(playlist);
        } catch (error) {
            console.error('[Library] NetEase import failed:', error);
            toast(error?.name === 'AbortError' ? '网易云服务响应超时，请稍后重试' : (error?.message || '网易云歌单导入失败'));
        } finally {
            submit.disabled = false;
            submit.textContent = '开始导入';
        }
    }

    function requestDeletePlaylist(playlist) {
        if (!playlist) return;
        const remove = async () => {
            const removingCurrent = state.currentTrack?.playlistId === playlist.id;
            if (removingCurrent) {
                audio.pause();
                audio.removeAttribute('src');
                state.currentTrack = null;
                state.queue = [];
                updatePlayerUi();
            }
            await storage().deleteLibraryPlaylist(playlist.id);
            state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
            state.tracks = state.tracks.filter((track) => track.playlistId !== playlist.id);
            closePlaylist();
            renderPlaylists();
            toast('歌单已删除');
        };
        if (window.showCustomModal) {
            window.showCustomModal({ title: '删除歌单', message: `确定删除《${playlist.name}》及其中歌曲吗？`, confirmText: '删除', isDestructive: true, onConfirm: remove });
        } else if (window.confirm(`确定删除《${playlist.name}》吗？`)) remove();
    }

    function parseLrc(text) {
        const lines = [];
        String(text || '').split(/\r?\n/).forEach((line) => {
            const tags = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
            const content = line.replace(/\[[^\]]+\]/g, '').trim();
            if (!content) return;
            tags.forEach((tag) => {
                const fractionRaw = tag[3] || '0';
                const fraction = Number(fractionRaw) / (fractionRaw.length === 3 ? 1000 : 100);
                lines.push({ time: Number(tag[1]) * 60 + Number(tag[2]) + fraction, text: content });
            });
        });
        return lines.sort((a, b) => a.time - b.time);
    }

    async function loadLyrics(track) {
        state.lyrics = [];
        state.lyricIndex = -1;
        dom.lyrics.innerHTML = '<p class="active">正在读取歌词…</p>';
        if (!track?.lyricUrl) {
            dom.lyrics.innerHTML = '<p class="active">这首歌暂时没有歌词</p>';
            return;
        }
        try {
            const response = await fetch(track.lyricUrl, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) throw new Error('Lyric request failed');
            state.lyrics = parseLrc(await response.text());
            dom.lyrics.innerHTML = state.lyrics.length
                ? state.lyrics.map((line, index) => `<p data-lyric-index="${index}">${escapeHtml(line.text)}</p>`).join('')
                : '<p class="active">这首歌暂时没有歌词</p>';
        } catch (error) {
            console.warn('[Library] Lyrics unavailable:', error);
            dom.lyrics.innerHTML = '<p class="active">歌词加载失败</p>';
        }
    }

    function updateLyrics(currentTime) {
        if (!state.lyrics.length) return;
        let nextIndex = -1;
        for (let index = 0; index < state.lyrics.length; index += 1) {
            if (state.lyrics[index].time <= currentTime + 0.05) nextIndex = index;
            else break;
        }
        if (nextIndex === state.lyricIndex) return;
        state.lyricIndex = nextIndex;
        dom.lyrics.querySelectorAll('p').forEach((line, index) => line.classList.toggle('active', index === nextIndex));
        if (nextIndex >= 0) {
            const active = dom.lyrics.querySelector(`[data-lyric-index="${nextIndex}"]`);
            if (active) dom.lyrics.scrollTo({ top: Math.max(0, active.offsetTop - dom.lyrics.clientHeight / 2), behavior: 'smooth' });
        }
    }

    async function playTrack(track, queue) {
        if (!track || track.available === false || !safeHttpUrl(track.mediaUrl)) {
            toast('这首歌暂时无法播放');
            return;
        }
        flushListeningStats().catch(console.error);
        if (Array.isArray(queue) && queue.length) state.queue = queue.filter((id) => !!getTrack(id));
        if (!state.queue.includes(track.id)) state.queue = [track.id];
        state.queueIndex = state.queue.indexOf(track.id);
        state.currentTrack = track;
        state.lastMediaTime = 0;
        audio.src = track.mediaUrl;
        audio.load();
        updatePlayerUi();
        loadLyrics(track);
        try {
            await audio.play();
        } catch (error) {
            console.warn('[Library] Playback failed:', error);
            toast('当前歌曲暂时无法播放');
            updatePlayerUi();
        }
    }

    function playQueueDirection(direction) {
        if (!state.queue.length) return;
        const total = state.queue.length;
        for (let step = 1; step <= total; step += 1) {
            const index = (state.queueIndex + direction * step + total) % total;
            const track = getTrack(state.queue[index]);
            if (track?.available !== false && safeHttpUrl(track?.mediaUrl)) {
                state.queueIndex = index;
                playTrack(track, state.queue);
                return;
            }
        }
        toast('歌单中没有可播放的歌曲');
    }

    function togglePlayback() {
        if (!state.currentTrack) {
            const first = state.tracks.find((track) => track.available !== false && safeHttpUrl(track.mediaUrl));
            if (first) playTrack(first, [first.id]);
            else toast('还没有可播放的歌曲');
            return;
        }
        if (audio.paused) audio.play().catch(() => toast('当前歌曲暂时无法播放'));
        else audio.pause();
    }

    function openPlayer() {
        if (!state.currentTrack) return;
        dom.player_view.classList.add('active');
        dom.player_view.setAttribute('aria-hidden', 'false');
    }

    function closePlayer() {
        dom.player_view.classList.remove('active');
        dom.player_view.setAttribute('aria-hidden', 'true');
    }

    function updatePlayerUi() {
        const track = state.currentTrack;
        const hasTrack = !!track;
        dom.mini_player.hidden = !hasTrack;
        dom.view.classList.toggle('has-mini-player', hasTrack);
        if (!hasTrack) return;
        dom.mini_title.textContent = track.name || '未知歌曲';
        dom.mini_artist.textContent = track.artist || '未知歌手';
        dom.player_title.textContent = track.name || '未知歌曲';
        dom.player_artist.textContent = track.artist || '未知歌手';
        setArtwork(dom.mini_art, track.coverUrl);
        setArtwork(dom.player_art, track.coverUrl);
        const cover = safeHttpUrl(track.coverUrl);
        dom.player_wash.style.backgroundImage = cover
            ? `linear-gradient(rgba(229,234,230,.45),rgba(245,243,237,.82)),url("${cover.replace(/"/g, '%22')}")`
            : '';
        dom.player_wash.style.backgroundSize = 'cover';
        dom.player_wash.style.backgroundPosition = 'center';
        const icon = audio.paused ? 'fa-play' : 'fa-pause';
        dom.mini_play.innerHTML = `<i class="fas ${icon}"></i>`;
        dom.player_play.innerHTML = `<i class="fas ${icon}"></i>`;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const ratio = duration > 0 ? current / duration : 0;
        dom.player_progress.value = String(Math.round(ratio * 1000));
        dom.player_current.textContent = formatClock(current);
        dom.player_duration.textContent = formatClock(duration);
        dom.mini_progress.style.setProperty('--mini-progress', `${Math.max(0, Math.min(100, ratio * 100))}%`);
    }

    async function flushListeningStats() {
        const seconds = state.pendingListeningSeconds;
        const track = state.currentTrack;
        if (!track || seconds <= 0) return;
        state.pendingListeningSeconds = 0;
        await storage().incrementLibraryDailyStat({ date: localDateKey(), kind: 'listening', itemId: track.id, seconds });
    }

    async function renderOverview() {
        try {
            state.stats = await storage().loadLibraryDailyStats();
        } catch (error) {
            console.error('[Library] Stats load failed:', error);
        }
        const days = lastSevenDays();
        const today = localDateKey();
        const sum = (kind, date) => state.stats
            .filter((row) => row.kind === kind && (!date || row.date === date))
            .reduce((total, row) => total + (Number(row.seconds) || 0), 0);
        const todayReading = sum('reading', today);
        const todayListening = sum('listening', today);
        dom.today_reading.textContent = formatDuration(todayReading);
        dom.today_listening.textContent = formatDuration(todayListening);

        const values = days.map((day) => ({
            ...day,
            reading: sum('reading', day.key),
            listening: sum('listening', day.key)
        }));
        const max = Math.max(60, ...values.flatMap((item) => [item.reading, item.listening]));
        const weekTotal = values.reduce((total, item) => total + item.reading + item.listening, 0);
        dom.week_total.textContent = formatDuration(weekTotal);
        dom.week_chart.innerHTML = values.map((item) => `
            <div class="library-chart-day">
                <div class="library-chart-bars">
                    <i class="library-chart-bar" style="height:${Math.max(3, item.reading / max * 100)}%" title="阅读 ${escapeHtml(formatDuration(item.reading, true))}"></i>
                    <i class="library-chart-bar listening" style="height:${Math.max(3, item.listening / max * 100)}%" title="听歌 ${escapeHtml(formatDuration(item.listening, true))}"></i>
                </div>
                <small>${item.key === today ? '今' : item.label}</small>
            </div>`).join('');
        renderRanking();
    }

    function renderRanking() {
        const range = state.preferences.rankingRange === 'all' ? 'all' : 'week';
        const weekKeys = new Set(lastSevenDays().map((day) => day.key));
        const totals = new Map();
        state.stats.forEach((row) => {
            if (row.kind !== 'listening' || (range === 'week' && !weekKeys.has(row.date))) return;
            totals.set(row.itemId, (totals.get(row.itemId) || 0) + (Number(row.seconds) || 0));
        });
        const ranked = [...totals.entries()]
            .map(([trackId, seconds]) => ({ track: getTrack(trackId), seconds }))
            .filter((item) => item.track && item.seconds > 0)
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 8);
        dom.ranking_list.innerHTML = ranked.length ? ranked.map((item, index) => `
            <div class="library-ranking-row">
                <b>${String(index + 1).padStart(2, '0')}</b>
                <span class="library-track-art">${safeHttpUrl(item.track.coverUrl) ? `<img src="${escapeHtml(safeHttpUrl(item.track.coverUrl))}" alt="" referrerpolicy="no-referrer">` : '<i class="fas fa-music"></i>'}</span>
                <div><strong>${escapeHtml(item.track.name)}</strong><small>${escapeHtml(item.track.artist)}</small></div>
                <span>${formatDuration(item.seconds, true)}</span>
            </div>`).join('') : '<div class="library-ranking-empty">听完一首歌后，这里会出现你的排行。</div>';
        dom.view.querySelectorAll('[data-range]').forEach((button) => {
            button.classList.toggle('active', button.dataset.range === range);
        });
    }

    function bindNavigation() {
        const selectAtClientX = (clientX) => {
            const rect = dom.floating_nav.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(.999, (clientX - rect.left) / rect.width));
            switchTab(TABS[Math.floor(ratio * 3)], false);
        };
        dom.floating_nav.addEventListener('click', (event) => {
            const button = event.target.closest('[data-library-tab]');
            if (button) switchTab(button.dataset.libraryTab);
        });
        dom.floating_nav.addEventListener('pointerdown', (event) => {
            state.navDragging = true;
            state.navPointerId = event.pointerId;
            dom.floating_nav.setPointerCapture?.(event.pointerId);
        });
        dom.floating_nav.addEventListener('pointermove', (event) => {
            if (!state.navDragging || state.navPointerId !== event.pointerId) return;
            selectAtClientX(event.clientX);
        });
        const endDrag = (event) => {
            if (state.navPointerId !== null && event.pointerId !== state.navPointerId) return;
            state.navDragging = false;
            state.navPointerId = null;
            savePreferences().catch(console.error);
        };
        dom.floating_nav.addEventListener('pointerup', endDrag);
        dom.floating_nav.addEventListener('pointercancel', endDrag);
        dom.floating_nav.addEventListener('mousedown', () => { state.navMouseDragging = true; });
        dom.floating_nav.addEventListener('mousemove', (event) => {
            if (!state.navMouseDragging || event.buttons !== 1) return;
            selectAtClientX(event.clientX);
        });
        document.addEventListener('mouseup', () => {
            if (!state.navMouseDragging) return;
            state.navMouseDragging = false;
            savePreferences().catch(console.error);
        });
    }

    function bindEvents() {
        $('app-phone-btn')?.addEventListener('click', () => openApp());
        dom.back_btn.addEventListener('click', closeApp);
        dom.header_action.addEventListener('click', () => {
            if (state.activeTab === 'books') dom.book_file_input.click();
            else if (state.activeTab === 'music') openModal(dom.track_modal);
        });
        dom.book_upload_btn.addEventListener('click', () => dom.book_file_input.click());
        dom.books_empty.addEventListener('click', (event) => {
            if (event.target.closest('[data-library-action="upload-book"]')) dom.book_file_input.click();
        });
        dom.book_file_input.addEventListener('change', () => importBook(dom.book_file_input.files?.[0]));
        dom.book_grid.addEventListener('click', (event) => {
            const card = event.target.closest('[data-book-id]');
            const action = event.target.closest('[data-book-action]')?.dataset.bookAction;
            if (!card || !action) return;
            const book = state.books.find((item) => item.id === card.dataset.bookId);
            if (action === 'open') openReader(book);
            if (action === 'rename') requestRenameBook(book);
            if (action === 'delete') requestDeleteBook(book);
        });
        dom.reader_back.addEventListener('click', closeReader);
        dom.reader_settings.addEventListener('click', () => {
            dom.reader_toc.hidden = true;
            dom.reader_panel.hidden = !dom.reader_panel.hidden;
        });
        dom.reader_toc_button.addEventListener('click', () => {
            dom.reader_panel.hidden = true;
            dom.reader_toc.hidden = !dom.reader_toc.hidden;
        });
        dom.reader_toc_close.addEventListener('click', () => { dom.reader_toc.hidden = true; });
        dom.reader_toc_list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-chapter-anchor]');
            if (!button) return;
            const anchor = document.getElementById(button.dataset.chapterAnchor);
            if (!anchor) return;
            dom.reader_toc.hidden = true;
            dom.reader_scroll.scrollTo({ top: Math.max(0, anchor.offsetTop - 24), behavior: 'smooth' });
            markReaderActivity();
        });
        dom.reader_panel.addEventListener('click', (event) => {
            const font = event.target.closest('[data-reader-font]');
            const line = event.target.closest('[data-reader-line]');
            const theme = event.target.closest('[data-reader-theme]');
            if (font) state.preferences.readerFontSize = (Number(state.preferences.readerFontSize) || 18) + Number(font.dataset.readerFont);
            if (line) state.preferences.readerLineHeight = (Number(state.preferences.readerLineHeight) || 1.85) + Number(line.dataset.readerLine) * .15;
            if (theme) state.preferences.readerTheme = theme.dataset.readerTheme;
            applyReaderPreferences();
            updateReaderProgress(false);
            savePreferences().catch(console.error);
        });
        let readerScrollTimer = null;
        dom.reader_scroll.addEventListener('scroll', () => {
            markReaderActivity();
            updateReaderProgress(false);
            clearTimeout(readerScrollTimer);
            readerScrollTimer = setTimeout(() => updateReaderProgress(true), 400);
        }, { passive: true });
        ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => dom.reader_view.addEventListener(eventName, markReaderActivity, { passive: true }));

        dom.import_netease_btn.addEventListener('click', () => openModal(dom.import_modal));
        dom.music_add_btn.addEventListener('click', () => openModal(dom.track_modal));
        dom.add_track_btn.addEventListener('click', () => openModal(dom.track_modal));
        dom.import_form.addEventListener('submit', handleNetEaseImport);
        dom.track_form.addEventListener('submit', addDirectTrack);
        dom.view.querySelectorAll('[data-close-library-modal]').forEach((button) => button.addEventListener('click', closeAllModals));
        [dom.import_modal, dom.track_modal].forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeAllModals(); }));
        dom.playlist_list.addEventListener('click', (event) => {
            const card = event.target.closest('[data-playlist-id]');
            if (card) openPlaylist(getPlaylist(card.dataset.playlistId));
        });
        dom.playlist_back.addEventListener('click', closePlaylist);
        dom.playlist_delete.addEventListener('click', () => requestDeletePlaylist(state.currentPlaylist));
        dom.play_all.addEventListener('click', () => {
            const tracks = playlistTracks(state.currentPlaylist).filter((track) => track.available !== false);
            if (tracks.length) playTrack(tracks[0], tracks.map((track) => track.id));
            else toast('歌单中没有可播放的歌曲');
        });
        dom.track_list.addEventListener('click', (event) => {
            const row = event.target.closest('[data-track-id]');
            if (!row) return;
            const tracks = playlistTracks(state.currentPlaylist);
            playTrack(getTrack(row.dataset.trackId), tracks.map((track) => track.id));
        });

        dom.mini_open.addEventListener('click', openPlayer);
        dom.mini_play.addEventListener('click', togglePlayback);
        dom.mini_next.addEventListener('click', () => playQueueDirection(1));
        dom.player_close.addEventListener('click', closePlayer);
        dom.player_play.addEventListener('click', togglePlayback);
        dom.player_prev.addEventListener('click', () => playQueueDirection(-1));
        dom.player_next.addEventListener('click', () => playQueueDirection(1));
        dom.player_progress.addEventListener('pointerdown', () => { state.isSeeking = true; });
        dom.player_progress.addEventListener('input', () => {
            if (!Number.isFinite(audio.duration)) return;
            const next = Number(dom.player_progress.value) / 1000 * audio.duration;
            dom.player_current.textContent = formatClock(next);
        });
        dom.player_progress.addEventListener('change', () => {
            if (Number.isFinite(audio.duration)) audio.currentTime = Number(dom.player_progress.value) / 1000 * audio.duration;
            state.lastMediaTime = audio.currentTime;
            state.isSeeking = false;
        });
        dom.view.querySelectorAll('[data-range]').forEach((button) => button.addEventListener('click', () => {
            state.preferences.rankingRange = button.dataset.range;
            savePreferences().catch(console.error);
            renderRanking();
        }));
        bindNavigation();

        audio.addEventListener('play', updatePlayerUi);
        audio.addEventListener('pause', () => { updatePlayerUi(); flushListeningStats().catch(console.error); });
        audio.addEventListener('loadedmetadata', () => { state.lastMediaTime = audio.currentTime || 0; updatePlayerUi(); });
        audio.addEventListener('seeking', () => { state.isSeeking = true; });
        audio.addEventListener('seeked', () => { state.lastMediaTime = audio.currentTime || 0; state.isSeeking = false; });
        audio.addEventListener('timeupdate', () => {
            const current = Number(audio.currentTime) || 0;
            const delta = current - state.lastMediaTime;
            if (!state.isSeeking && !audio.paused && delta > 0 && delta <= 5) {
                state.pendingListeningSeconds += delta;
                if (state.pendingListeningSeconds >= 15) flushListeningStats().catch(console.error);
            }
            state.lastMediaTime = current;
            updatePlayerUi();
            updateLyrics(current);
        });
        audio.addEventListener('ended', () => { flushListeningStats().catch(console.error); playQueueDirection(1); });
        audio.addEventListener('error', () => {
            if (!state.currentTrack || !audio.src) return;
            toast('当前歌曲暂时无法播放');
            updatePlayerUi();
        });

        window.addEventListener('pagehide', () => {
            if (state.currentBook) updateReaderProgress(true);
            flushReadingStats().catch(console.error);
            flushListeningStats().catch(console.error);
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                flushReadingStats().catch(console.error);
                flushListeningStats().catch(console.error);
            }
        });
    }

    function startTimers() {
        setInterval(() => {
            const readingActive = !!state.currentBook
                && dom.reader_view.classList.contains('active')
                && !document.hidden
                && Date.now() - state.readerLastActivityAt <= 60000;
            if (readingActive) {
                state.pendingReadingSeconds += 5;
                if (state.pendingReadingSeconds >= 15) flushReadingStats().catch(console.error);
            }
        }, 5000);
    }

    async function init() {
        cacheDom();
        if (!dom.view) return;
        try {
            await loadState();
            renderBooks();
            renderPlaylists();
            switchTab(state.activeTab, false);
            bindEvents();
            startTimers();
            updatePlayerUi();
            state.ready = true;
        } catch (error) {
            console.error('[Library] Initialization failed:', error);
            toast('Library 初始化失败');
        }
    }

    window.libraryApp = {
        open: (tab) => openApp(tab),
        close: closeApp,
        importNetEasePlaylist
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
