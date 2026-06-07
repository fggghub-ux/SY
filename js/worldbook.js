// ==========================================
// World Book Logic
// ==========================================
let worldBooks = [];
let wbGroups = [];
let editingBookId = null;
let activeEntryId = null;
let tempEntries = [];
let activeWbGroupName = null;

function getWbElement(id) {
    return document.getElementById(id);
}

function openWbOverlay(id) {
    const el = getWbElement(id);
    if (el) openView(el);
}

function closeWbOverlay(id) {
    const el = getWbElement(id);
    if (el) closeView(el);
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
    return escapeHtml(value);
}

function normalizeGroupName(value) {
    const name = String(value || '').trim();
    return name || '未分组';
}

function normalizeGroups() {
    const seen = new Set();
    wbGroups = (Array.isArray(wbGroups) ? wbGroups : [])
        .map(name => String(name || '').trim())
        .filter(name => name && name !== '未分组')
        .filter(name => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
}

function getAllDisplayGroups() {
    normalizeGroups();
    return [...wbGroups, '未分组'];
}

// Load data on init
document.addEventListener('DOMContentLoaded', () => {
    if (window.StorageManager) {
        worldBooks = StorageManager.load('u2_worldBooks', []);
        wbGroups = StorageManager.load('u2_wbGroups', []);
        normalizeGroups();
    }
});

function saveWorldBooksData() {
    if (window.StorageManager) {
        StorageManager.save('u2_worldBooks', worldBooks);
        StorageManager.save('u2_wbGroups', wbGroups);
    }
}

// Map the old UI to the new UI property manually just in case
if (typeof UI !== 'undefined' && !UI.views.worldBook) {
    UI.views.worldBook = document.getElementById('world-book-view');
}
if (typeof UI !== 'undefined' && !UI.overlays.addGroup) {
    UI.overlays.addGroup = document.getElementById('add-group-overlay');
}
if (typeof UI !== 'undefined' && !UI.overlays.addBook) {
    UI.overlays.addBook = document.getElementById('add-book-overlay');
}
if (typeof UI !== 'undefined' && !UI.overlays.bookGroupPicker) {
    UI.overlays.bookGroupPicker = document.getElementById('book-group-picker-sheet');
}

const wbBackBtn = document.getElementById('world-book-back-btn');
if (wbBackBtn) {
    wbBackBtn.addEventListener('click', () => {
        closeWbOverlay('world-book-view');
    });
}

// Tabs logic
const wbSegmentBtns = document.querySelectorAll('.wb-segment-btn');
const wbTabContents = document.querySelectorAll('.wb-tab-content');

wbSegmentBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active from all
        wbSegmentBtns.forEach(b => b.classList.remove('active'));
        wbTabContents.forEach(c => c.style.display = 'none');
        
        // Add active to clicked
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        const targetContent = document.getElementById(`wb-tab-${targetTab}`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }
    });
});

// Add Menu Logic
const wbAddBtn = document.getElementById('world-book-add-btn');
const wbAddMenu = document.getElementById('wb-add-menu');

if (wbAddBtn && wbAddMenu) {
    wbAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wbAddMenu.style.display = wbAddMenu.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (wbAddMenu.style.display === 'block' && !wbAddMenu.contains(e.target) && e.target !== wbAddBtn) {
            wbAddMenu.style.display = 'none';
        }
    });
}

// Add Group
const btnAddGroup = document.getElementById('wb-add-group-btn');
if (btnAddGroup) {
    btnAddGroup.addEventListener('click', () => {
        if (wbAddMenu) wbAddMenu.style.display = 'none';
        const input = getWbElement('add-group-name-input');
        if (input) input.value = '';
        openWbOverlay('add-group-overlay');
    });
}

const confirmAddGroupBtn = document.getElementById('confirm-add-group-btn');
if (confirmAddGroupBtn) {
    confirmAddGroupBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('add-group-name-input');
        const name = nameInput ? nameInput.value.trim() : '';
        normalizeGroups();

        if (!name) {
            showToast('请输入分组名称');
            return;
        }

        if (wbGroups.includes(name) || name === '未分组') {
            showToast('分组已存在');
            return;
        }

        wbGroups.push(name);
        saveWorldBooksData();
        renderWorldBooks();
        if (nameInput) nameInput.value = '';
        closeWbOverlay('add-group-overlay');
        showToast('分组已添加');
    });
}

const cancelAddGroupBtn = document.getElementById('cancel-add-group-btn');
if (cancelAddGroupBtn) {
    cancelAddGroupBtn.addEventListener('click', () => {
        closeWbOverlay('add-group-overlay');
    });
}

// Add / Edit Book Logic
const btnAddBook = document.getElementById('wb-add-book-btn');
const addEntryBtn = document.getElementById('add-book-entry-btn');

// New Buttons
const wbEditActions = document.getElementById('wb-edit-actions');
const deleteWorldBookBtn = document.getElementById('delete-world-book-btn');

// 导入导出按钮已被移除，不再获取其DOM节点

const wbImportFileInput = document.getElementById('wb-import-file');
const wbImportMainBtn = document.getElementById('world-book-import-btn');
const wbImportMenuBtn = document.getElementById('wb-import-menu-btn');
const wbGroupBackBtn = document.getElementById('wb-group-back-btn');
const wbGroupAddBookBtn = document.getElementById('wb-group-add-book-btn');
const wbGroupDeleteCurrentBtn = document.getElementById('wb-group-delete-current-btn');

if (btnAddBook) {
    btnAddBook.addEventListener('click', () => {
        if (wbAddMenu) wbAddMenu.style.display = 'none';
        openBookModal(); // Open in create mode
    });
}

function triggerWorldBookImport() {
    if (wbAddMenu) wbAddMenu.style.display = 'none';
    if (wbImportFileInput) wbImportFileInput.click();
}

if (wbImportMainBtn) wbImportMainBtn.addEventListener('click', triggerWorldBookImport);
if (wbImportMenuBtn) wbImportMenuBtn.addEventListener('click', triggerWorldBookImport);

if (wbGroupBackBtn) {
    wbGroupBackBtn.addEventListener('click', () => {
        showWbMainPage();
    });
}

if (wbGroupAddBookBtn) {
    wbGroupAddBookBtn.addEventListener('click', () => {
        openBookModal(null, activeWbGroupName);
    });
}

if (wbGroupDeleteCurrentBtn) {
    wbGroupDeleteCurrentBtn.addEventListener('click', () => {
        if (!activeWbGroupName || activeWbGroupName === '未分组') return;
        deleteGroupByName(activeWbGroupName, true);
    });
}

if (btnAddBook) {
    btnAddBook.addEventListener('click', () => {
        if (wbAddMenu) wbAddMenu.style.display = 'none';
        openBookModal(); // Open in create mode
    });
}

function showCenteredConfirm({
    title = '确认操作',
    message = '确定继续吗？',
    confirmText = '确认',
    cancelText = '取消',
    isDestructive = false,
    onConfirm
} = {}) {
    if (window.showCustomModal) {
        window.showCustomModal({
            title,
            message,
            isDestructive,
            confirmText,
            cancelText,
            onConfirm
        });
        return;
    }

    const existingModal = document.getElementById('wb-inline-confirm-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'wb-inline-confirm-overlay';
    overlay.className = 'bottom-sheet-overlay wb-centered-modal-overlay active';
    overlay.innerHTML = `
        <div class="wb-centered-modal-card wb-group-modal-card wb-inline-confirm-card">
            <div class="wb-centered-modal-header">
                <div class="wb-centered-modal-title">${title}</div>
            </div>
            <div class="wb-centered-modal-body wb-inline-confirm-body">
                <div class="wb-inline-confirm-message">${message}</div>
                <div class="wb-inline-confirm-actions">
                    <button type="button" class="wb-inline-confirm-btn wb-inline-confirm-cancel">${cancelText}</button>
                    <button type="button" class="wb-inline-confirm-btn ${isDestructive ? 'wb-inline-confirm-danger' : 'wb-inline-confirm-confirm'}">${confirmText}</button>
                </div>
            </div>
        </div>
    `;

    const cleanup = () => overlay.remove();
    const cancelBtn = overlay.querySelector('.wb-inline-confirm-cancel');
    const confirmBtn = overlay.querySelector(isDestructive ? '.wb-inline-confirm-danger' : '.wb-inline-confirm-confirm');

    cancelBtn.addEventListener('click', cleanup);
    confirmBtn.addEventListener('click', () => {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });

    document.body.appendChild(overlay);
}

function normalizeEntryForEditor(entry = {}, idx = 0) {
    const baseEntry = (window.normalizeWorldBookEntry ? window.normalizeWorldBookEntry(entry) : {
        id: entry.id || `wb-entry-${Date.now()}-${idx}`,
        title: entry.title || entry.name || entry.keyword || `词条${idx + 1}`,
        keyword: entry.title ? (entry.keyword || '') : '',
        content: entry.content || '',
        triggerMode: entry.triggerMode === 'keyword' ? 'keyword' : 'permanent',
        injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(entry.injectionPosition)
            ? entry.injectionPosition
            : 'before_role',
        systemDepth: Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4,
        order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 100,
        recursive: false,
        enabled: entry.enabled !== false
    });

    return {
        ...baseEntry,
        id: Date.now() + idx,
        title: baseEntry.title || entry.keyword || `词条${idx + 1}`,
        keyword: entry.title ? (baseEntry.keyword || '') : (entry.triggerMode === 'keyword' ? (baseEntry.keyword || '') : ''),
        content: baseEntry.content || '',
        triggerMode: baseEntry.triggerMode || 'permanent',
        injectionPosition: baseEntry.injectionPosition || 'before_role',
        systemDepth: Number.isFinite(Number(baseEntry.systemDepth)) ? Number(baseEntry.systemDepth) : 4,
        order: Number.isFinite(Number(baseEntry.order)) ? Number(baseEntry.order) : 100,
        recursive: false,
        enabled: baseEntry.enabled !== false
    };
}

function createDefaultEntry(index = 0) {
    return normalizeEntryForEditor({
        title: `词条${index + 1}`,
        keyword: '',
        content: '',
        triggerMode: 'permanent',
        injectionPosition: 'before_role',
        systemDepth: 4,
        order: 100,
        recursive: false,
        enabled: true
    }, index);
}

function renderAddBookGroupSelect() {
    const groupSelect = document.getElementById('add-book-group-input');
    if (!groupSelect) return;
    
    normalizeGroups();
    const allGroups = ['未分组', ...wbGroups];
    
    groupSelect.innerHTML = allGroups.map(g => 
        `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`
    ).join('');
}

function openBookModal(book = null, preferredGroup = null) {
    const modalTitle = document.querySelector('#add-book-overlay .wb-centered-modal-title, #add-book-overlay .sheet-title');
    const nameInput = document.getElementById('add-book-name-input');
    const groupInput = document.getElementById('add-book-group-input');
    
    renderAddBookGroupSelect();
    
    // Reset state
    if (book) {
        editingBookId = book.id;
        if (modalTitle) modalTitle.textContent = '编辑世界书';
        if (nameInput) nameInput.value = book.name || '';
        if (groupInput) groupInput.value = normalizeGroupName(book.group);
        
        // Show Edit Actions
        if(wbEditActions) wbEditActions.style.display = 'flex';
        if(deleteWorldBookBtn) deleteWorldBookBtn.style.display = 'flex';

        // Clone entries deeply to avoid reference issues
        tempEntries = (Array.isArray(book.entries) ? book.entries : []).map((e, idx) => normalizeEntryForEditor(e, idx));
        
        if (tempEntries.length > 0) {
            activeEntryId = tempEntries[0].id;
            renderEntries();
        } else {
            addEntry();
        }
    } else {
        editingBookId = null;
        if (modalTitle) modalTitle.textContent = '添加世界书';
        if (nameInput) nameInput.value = '';
        if (groupInput) groupInput.value = '未分组';
        
        // Hide Edit Actions
        if(wbEditActions) wbEditActions.style.display = 'none';
        if(deleteWorldBookBtn) deleteWorldBookBtn.style.display = 'none';

        tempEntries = [];
        // Add initial empty entry
        addEntry();
    }
    
    openWbOverlay('add-book-overlay');
}

// Delete Logic
if (deleteWorldBookBtn) {
    deleteWorldBookBtn.addEventListener('click', () => {
        if (!editingBookId) return;
        showCenteredConfirm({
            title: '删除世界书',
            message: '确定要删除这本世界书吗？此操作不可恢复。',
            isDestructive: true,
            confirmText: '删除',
            onConfirm: () => {
                worldBooks = worldBooks.filter(b => b.id !== editingBookId);
                saveWorldBooksData();
                renderWorldBooks();
                closeWbOverlay('add-book-overlay');
                showToast('世界书已删除');
            }
        });
    });
}

function addEntry() {
    const newEntry = createDefaultEntry(tempEntries.length);
    tempEntries.push(newEntry);
    activeEntryId = newEntry.id;
    renderEntries();
}

function deleteEntry(id, e) {
    e.stopPropagation();
    showCenteredConfirm({
        title: '删除词条',
        message: '确定要删除这个词条吗？此操作不可恢复。',
        isDestructive: true,
        confirmText: '删除',
        onConfirm: () => {
            tempEntries = tempEntries.filter(ent => ent.id !== id);
            if (activeEntryId === id) {
                activeEntryId = null;
            }
            renderEntries();
        }
    });
}

function renderEntries() {
    const listContainer = document.getElementById('wb-entries-list-container');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    tempEntries.forEach(entry => {
        const isExpanded = entry.id === activeEntryId;
        const item = document.createElement('div');
        item.className = `wb-entry-item ${isExpanded ? 'expanded' : ''}`;
        
        const showSystemDepthFields = entry.injectionPosition === 'system_depth';
        const showTriggerKeywordField = entry.triggerMode === 'keyword';
        const triggerLabel = entry.triggerMode === 'keyword' ? '关键词' : '永久';
        const positionLabel = entry.injectionPosition === 'after_role'
            ? '角色后'
            : entry.injectionPosition === 'system_depth'
                ? '系统'
                : '角色前';
        
        item.innerHTML = `
            <div class="wb-entry-header">
                <div class="wb-entry-title-wrap">
                    <span class="wb-entry-title">${escapeHtml(entry.title || '未命名词条')}</span>
                    <span class="wb-entry-subtitle">${triggerLabel} · ${positionLabel}</span>
                </div>
                <div class="wb-entry-actions">
                    <i class="fas fa-xmark wb-entry-delete-btn"></i>
                    <i class="fas fa-chevron-down wb-entry-toggle-icon"></i>
                </div>
            </div>
            <div class="wb-entry-body">
                <label class="wb-entry-field">
                    <span class="wb-entry-field-label">条目名字</span>
                    <input type="text" class="wb-entry-title-input wb-entry-bubble-input" placeholder="输入条目名字" value="${escapeAttr(entry.title || '')}">
                </label>
                <div class="wb-entry-meta-grid" style="grid-template-columns: 1fr 1fr;">
                    <label class="wb-entry-field">
                        <span class="wb-entry-field-label">触发模式</span>
                        <select class="wb-entry-trigger-mode wb-entry-select">
                            <option value="permanent" ${entry.triggerMode === 'permanent' ? 'selected' : ''}>永久</option>
                            <option value="keyword" ${entry.triggerMode === 'keyword' ? 'selected' : ''}>关键词</option>
                        </select>
                    </label>
                    <label class="wb-entry-field">
                        <span class="wb-entry-field-label">注入位置</span>
                        <select class="wb-entry-injection-position wb-entry-select">
                            <option value="before_role" ${entry.injectionPosition === 'before_role' ? 'selected' : ''}>角色前</option>
                            <option value="after_role" ${entry.injectionPosition === 'after_role' ? 'selected' : ''}>角色后</option>
                            <option value="system_depth" ${entry.injectionPosition === 'system_depth' ? 'selected' : ''}>系统</option>
                        </select>
                    </label>
                </div>
                <div class="wb-entry-system-depth-fields" style="display: ${showSystemDepthFields ? 'block' : 'none'};">
                    <label class="wb-entry-field">
                        <span class="wb-entry-field-label">深度</span>
                        <input type="number" class="wb-entry-system-depth-input wb-entry-number-input" min="0" value="${Number.isFinite(Number(entry.systemDepth)) ? Number(entry.systemDepth) : 4}">
                    </label>
                </div>
                <div class="wb-entry-trigger-keyword-field" style="display: ${showTriggerKeywordField ? 'block' : 'none'};">
                    <label class="wb-entry-field">
                        <span class="wb-entry-field-label">关键词 (多个用逗号分隔)</span>
                        <input type="text" class="wb-entry-keyword-input wb-entry-bubble-input" placeholder="输入关键词..." value="${escapeAttr(entry.keyword || '')}">
                    </label>
                </div>
                <label class="wb-entry-field">
                    <span class="wb-entry-field-label">条目内容</span>
                    <textarea class="wb-entry-body-textarea" placeholder="输入条目内容...">${escapeHtml(entry.content || '')}</textarea>
                </label>
            </div>
        `;
        
        const header = item.querySelector('.wb-entry-header');
        const deleteBtn = item.querySelector('.wb-entry-delete-btn');
        const titleInput = item.querySelector('.wb-entry-title-input');
        const triggerModeInput = item.querySelector('.wb-entry-trigger-mode');
        const injectionPositionInput = item.querySelector('.wb-entry-injection-position');
        const systemDepthInput = item.querySelector('.wb-entry-system-depth-input');
        const keywordInput = item.querySelector('.wb-entry-keyword-input');
        const contentInput = item.querySelector('.wb-entry-body-textarea');
        
        header.addEventListener('click', (e) => {
            if(e.target === deleteBtn || deleteBtn.contains(e.target)) return;
            if (activeEntryId === entry.id) {
                activeEntryId = null;
            } else {
                activeEntryId = entry.id;
            }
            renderEntries();
        });
        
        deleteBtn.addEventListener('click', (e) => {
            deleteEntry(entry.id, e);
        });
        
        titleInput.addEventListener('input', (e) => {
            entry.title = e.target.value;
            item.querySelector('.wb-entry-title').textContent = entry.title || '未命名词条';
        });
        
        triggerModeInput.addEventListener('change', (e) => {
            entry.triggerMode = e.target.value === 'keyword' ? 'keyword' : 'permanent';
            renderEntries();
        });
        
        injectionPositionInput.addEventListener('change', (e) => {
            entry.injectionPosition = e.target.value;
            renderEntries();
        });
        
        if (systemDepthInput) {
            systemDepthInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                entry.systemDepth = Number.isFinite(value) ? value : 4;
            });
        }
        
        if (keywordInput) {
            keywordInput.addEventListener('input', (e) => {
                entry.keyword = e.target.value;
            });
        }
        
        contentInput.addEventListener('input', (e) => {
            entry.content = e.target.value;
        });
        
        listContainer.appendChild(item);
    });
}

if (addEntryBtn) {
    addEntryBtn.addEventListener('click', addEntry);
}

// Group Picker for Add Book - Removed as we now use native select

// Confirm Add/Edit Book
const confirmAddBookBtn = document.getElementById('confirm-add-book-btn');
if (confirmAddBookBtn) {
    confirmAddBookBtn.addEventListener('click', () => {
        const name = document.getElementById('add-book-name-input')?.value.trim() || '';
        const group = normalizeGroupName(document.getElementById('add-book-group-input')?.value);

        if (!name) {
            showToast('请输入世界书名字');
            return;
        }

        if (!tempEntries.length) {
            showToast('请至少添加一个条目');
            addEntry();
            return;
        }

        for (let i = 0; i < tempEntries.length; i += 1) {
            const entry = tempEntries[i];
            const label = entry.title ? `“${entry.title}”` : `第 ${i + 1} 个条目`;

            if (entry.triggerMode === 'keyword' && !(entry.keyword || '').trim()) {
                activeEntryId = entry.id;
                renderEntries();
                showToast(`${label}需要填写关键词`);
                return;
            }

            if (!(entry.content || '').trim()) {
                activeEntryId = entry.id;
                renderEntries();
                showToast(`${label}需要填写条目内容`);
                return;
            }
        }
        
        // Clean up entries (remove id used for UI)
        const finalEntries = tempEntries.map((e, idx) => ({
            ...normalizeEntryForEditor(e, idx),
            id: undefined,
            title: (e.title || '').trim() || `词条${idx + 1}`,
            keyword: e.triggerMode === 'keyword' ? (e.keyword || '').trim() : '',
            content: (e.content || '').trim(),
            triggerMode: e.triggerMode === 'keyword' ? 'keyword' : 'permanent',
            injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(e.injectionPosition)
                ? e.injectionPosition
                : 'before_role',
            systemDepth: Number.isFinite(Number(e.systemDepth)) ? Number(e.systemDepth) : 4,
            order: 100, // 后台统一保存为100，不再依赖界面输入框
            recursive: false,
            enabled: e.enabled !== false
        })).map(({ id, ...rest }) => rest);

        if (editingBookId) {
            // Update existing
            const book = worldBooks.find(b => String(b.id) === String(editingBookId));
            if (book) {
                book.name = name;
                book.group = group;
                book.entries = finalEntries;
                showToast('世界书已更新');
            }
        } else {
            // Create new
            worldBooks.push({
                id: Date.now(),
                name,
                group: group === '未分组' ? '未分组' : group,
                entries: finalEntries,
                isGlobal: false,
                attachedRoles: []
            });
            showToast('世界书已添加');
        }

        saveWorldBooksData();
        renderWorldBooks();
        closeWbOverlay('add-book-overlay');
    });
}


function sanitizeImportedWorldBook(rawBook, fallbackName = '导入的世界书') {
    const source = rawBook && typeof rawBook === 'object' ? rawBook : {};
    const rawEntries = Array.isArray(source.entries)
        ? source.entries
        : (source.content ? [{ title: source.name || fallbackName, content: source.content }] : []);

    const entries = rawEntries.map((entry, idx) => {
        const normalized = normalizeEntryForEditor(entry || {}, idx);
        return {
            title: normalized.title || `词条${idx + 1}`,
            keyword: normalized.triggerMode === 'keyword' ? (normalized.keyword || '') : '',
            content: normalized.content || '',
            triggerMode: normalized.triggerMode === 'keyword' ? 'keyword' : 'permanent',
            injectionPosition: ['before_role', 'after_role', 'system_depth'].includes(normalized.injectionPosition)
                ? normalized.injectionPosition
                : 'before_role',
            systemDepth: Number.isFinite(Number(normalized.systemDepth)) ? Number(normalized.systemDepth) : 4,
            order: Number.isFinite(Number(normalized.order)) ? Number(normalized.order) : 100,
            recursive: false,
            enabled: normalized.enabled !== false
        };
    }).filter(entry => (entry.content || '').trim());

    return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        name: String(source.name || source.title || fallbackName || '导入的世界书').trim() || '导入的世界书',
        group: normalizeGroupName(source.group || activeWbGroupName || '未分组'),
        entries: entries.length ? entries : [{
            title: '正文',
            keyword: '',
            content: String(source.content || fallbackName || '').trim() || '空白内容',
            triggerMode: 'permanent',
            injectionPosition: 'before_role',
            systemDepth: 4,
            order: 100,
            recursive: false,
            enabled: true
        }],
        isGlobal: !!source.isGlobal,
        attachedRoles: Array.isArray(source.attachedRoles) ? source.attachedRoles : []
    };
}

function getFileBaseName(fileName = '') {
    return String(fileName || '导入的世界书').replace(/\.[^/.]+$/, '') || '导入的世界书';
}

async function readWorldBookImportText(file) {
    const fileName = file?.name || '';
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.docx')) {
        if (!window.mammoth || typeof window.mammoth.extractRawText !== 'function') {
            showToast('docx 解析库加载失败，请检查网络或先另存为 txt 后导入');
            return null;
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        const text = result?.value || '';
        if (!text.trim()) {
            throw new Error('docx 文件内容为空');
        }
        return text;
    }

    return await file.text();
}

function parseImportedWorldBooks(text, file) {
    const fileName = file?.name || '';
    const fallbackName = getFileBaseName(fileName);
    const lowerName = fileName.toLowerCase();
    const trimmed = String(text || '').trim();

    if (!trimmed) {
        throw new Error('文件内容为空');
    }

    if (lowerName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.worldBooks) ? parsed.worldBooks : [parsed]);
        return list.map((book, idx) => sanitizeImportedWorldBook(book, idx === 0 ? fallbackName : `${fallbackName}-${idx + 1}`));
    }

    return [sanitizeImportedWorldBook({
        name: fallbackName,
        group: activeWbGroupName || '未分组',
        entries: [{
            title: fallbackName,
            content: trimmed,
            triggerMode: 'permanent',
            injectionPosition: 'before_role',
            systemDepth: 4,
            order: 100,
            recursive: false,
            enabled: true
        }]
    }, fallbackName)];
}

async function importWorldBookFile(file) {
    if (!file) return;

    try {
        const text = await readWorldBookImportText(file);
        if (text === null) return;

        const importedBooks = parseImportedWorldBooks(text, file);
        if (!importedBooks.length) {
            showToast('没有可导入的世界书');
            return;
        }

        worldBooks.push(...importedBooks);
        importedBooks.forEach(book => {
            const group = normalizeGroupName(book.group);
            if (group !== '未分组' && !wbGroups.includes(group)) wbGroups.push(group);
        });

        saveWorldBooksData();
        renderWorldBooks();
        if (activeWbGroupName) renderGroupBookList(activeWbGroupName);
        showToast(`已导入 ${importedBooks.length} 本世界书`);
    } catch (error) {
        console.error('Failed to import world book:', error);
        showToast('导入失败：请检查文件格式');
    }
}

if (wbImportFileInput) {
    wbImportFileInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        await importWorldBookFile(file);
        event.target.value = '';
    });
}

// Render World Books Helper
function calculateTokens(entries) {
    // Very rough mock token calculation
    let text = (Array.isArray(entries) ? entries : []).map(e => (e.title || '') + (e.keyword || '') + (e.content || '')).join('');
    return Math.ceil(text.length * 1.5) || 0;
}
window.calculateTokens = calculateTokens; // Export for imessage.js

function createBookHtml(book, type) {
    let rightElementHtml = '';
    const tokens = calculateTokens(book.entries);
    const bookId = escapeAttr(book.id);
    const bookName = escapeHtml(book.name || '未命名世界书');

    if (type === 'all' || type === 'global') {
        rightElementHtml = `
            <div class="wb-book-meta">
                <span class="wb-token-count">+${tokens} Tokens</span>
                <label class="toggle-switch">
                    <input type="checkbox" class="wb-global-toggle" data-id="${bookId}" ${book.isGlobal ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
        `;
    } else if (type === 'local') {
        const avatarSrc = Array.isArray(book.attachedRoles) ? (book.attachedRoles[0]?.avatarUrl || '') : '';
        const avatarInner = avatarSrc ? `<img src="${escapeAttr(avatarSrc)}">` : `<i class="fas fa-user"></i>`;
        rightElementHtml = `
            <div class="wb-book-meta">
                <span class="wb-token-count">+${tokens} Tokens</span>
                <div class="wb-char-avatar">${avatarInner}</div>
            </div>
        `;
    }

    return `
        <div class="wb-book-item" data-id="${bookId}">
            <div class="wb-book-info">
                <div class="wb-book-icon"><i class="fas fa-book"></i></div>
                <div class="wb-book-name">${bookName}</div>
            </div>
            ${rightElementHtml}
        </div>
    `;
}

function getBooksInGroup(groupName) {
    return worldBooks.filter(b => normalizeGroupName(b.group) === normalizeGroupName(groupName));
}

function createBookListItemElement(book, type = 'all') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createBookHtml(book, type).trim();
    const item = wrapper.firstElementChild;
    if (!item) return document.createElement('div');

    item.addEventListener('click', (event) => {
        if (event.target.closest('.toggle-switch') || event.target.closest('.wb-global-toggle')) return;
        openBookModal(book);
    });

    return item;
}

function deleteGroupByName(groupName, returnToMain = false) {
    const normalized = normalizeGroupName(groupName);
    if (normalized === '未分组') return;

    showCenteredConfirm({
        title: '删除分组',
        message: `确定要删除分组 "${normalized}" 吗？该分组下的世界书将被移动到"未分组"。`,
        isDestructive: true,
        confirmText: '删除',
        onConfirm: () => {
            wbGroups = wbGroups.filter(g => g !== normalized);
            worldBooks.forEach(b => {
                if (normalizeGroupName(b.group) === normalized) {
                    b.group = '未分组';
                }
            });
            if (returnToMain) activeWbGroupName = null;
            saveWorldBooksData();
            renderWorldBooks();
            if (returnToMain) showWbMainPage();
            showToast('分组已删除');
        }
    });
}

function renderGroupBookList(groupName) {
    const groupTitle = document.getElementById('wb-group-page-title');
    const largeTitle = document.getElementById('wb-group-large-title');
    const list = document.getElementById('wb-group-book-list');
    const deleteBtn = document.getElementById('wb-group-delete-current-btn');
    if (!list) return;

    const normalized = normalizeGroupName(groupName);
    const booksInGroup = getBooksInGroup(normalized);
    if (groupTitle) groupTitle.textContent = normalized;
    if (largeTitle) largeTitle.textContent = normalized;
    if (deleteBtn) deleteBtn.style.display = normalized === '未分组' ? 'none' : 'inline-flex';

    list.innerHTML = '';
    if (!booksInGroup.length) {
        list.innerHTML = '<div class="wb-files-empty-state"><i class="fas fa-folder-open"></i><span>这个分组还没有世界书</span></div>';
        return;
    }

    booksInGroup.forEach(book => {
        list.appendChild(createBookListItemElement(book, 'all'));
    });
}

function showWbMainPage() {
    activeWbGroupName = null;
    const mainPage = document.getElementById('wb-files-main-page');
    const groupPage = document.getElementById('wb-files-group-page');
    if (mainPage) mainPage.classList.add('active');
    if (groupPage) groupPage.classList.remove('active');
}

function openWbGroupPage(groupName) {
    activeWbGroupName = normalizeGroupName(groupName);
    const mainPage = document.getElementById('wb-files-main-page');
    const groupPage = document.getElementById('wb-files-group-page');
    if (mainPage) mainPage.classList.remove('active');
    if (groupPage) groupPage.classList.add('active');
    renderGroupBookList(activeWbGroupName);
}

function createGroupFolderElement(groupName) {
    const normalized = normalizeGroupName(groupName);
    const booksInGroup = getBooksInGroup(normalized);
    const groupDiv = document.createElement('div');
    groupDiv.className = 'wb-group-container';
    groupDiv.setAttribute('role', 'button');
    groupDiv.setAttribute('tabindex', '0');

    const deleteBtnHtml = normalized !== '未分组'
        ? '<button type="button" class="wb-group-delete-btn" aria-label="删除分组"><i class="fas fa-xmark"></i></button>'
        : '';

    groupDiv.innerHTML = `
        <div class="wb-group-header">
            ${deleteBtnHtml}
            <div class="wb-folder-visual" aria-hidden="true">
                <span class="wb-folder-tab"></span>
                <span class="wb-folder-body"><i class="fas fa-folder wb-group-folder-icon"></i></span>
            </div>
            <div class="wb-group-title">${escapeHtml(normalized)}</div>
            <div class="wb-group-count">${booksInGroup.length} 项</div>
        </div>
    `;

    const deleteBtn = groupDiv.querySelector('.wb-group-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroupByName(normalized);
        });
    }

    const openGroup = () => openWbGroupPage(normalized);
    groupDiv.addEventListener('click', (e) => {
        if (!deleteBtn || !deleteBtn.contains(e.target)) openGroup();
    });
    groupDiv.addEventListener('keydown', (event) => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openGroup();
        }
    });

    return groupDiv;
}

function renderWorldBooks() {
    normalizeGroups();
    const allList = document.getElementById('wb-all-list');
    if (!allList) return;
    allList.innerHTML = '';

    getAllDisplayGroups().forEach(groupName => {
        allList.appendChild(createGroupFolderElement(groupName));
    });

    if (activeWbGroupName) {
        renderGroupBookList(activeWbGroupName);
    }

    // Render Global Tab
    const globalList = document.getElementById('wb-global-list');
    if (globalList) {
        const globalBooks = worldBooks.filter(b => b.isGlobal);
        globalList.innerHTML = '';
        if (globalBooks.length) {
            const wrapper = document.createElement('div');
            wrapper.className = 'wb-flat-book-list';
            globalBooks.forEach(book => wrapper.appendChild(createBookListItemElement(book, 'global')));
            globalList.appendChild(wrapper);
        } else {
            globalList.innerHTML = `<div class="wb-empty-state">暂无全局世界书</div>`;
        }
    }

    // Render Local Tab
    const localList = document.getElementById('wb-local-list');
    if (localList) {
        localList.innerHTML = '';

        const friends = window.getImFriends ? window.getImFriends() : [];
        const wrapper = document.createElement('div');
        wrapper.className = 'wb-flat-book-list';

        worldBooks.forEach(book => {
            const boundFriends = friends.filter(f => Array.isArray(f.boundBooks) && f.boundBooks.map(String).includes(String(book.id)));

            boundFriends.forEach(friend => {
                const item = createBookListItemElement(book, 'local');
                const avatarSrc = friend.avatarUrl || '';
                const avatar = item.querySelector('.wb-char-avatar');
                if (avatar) {
                    avatar.innerHTML = avatarSrc ? `<img src="${escapeAttr(avatarSrc)}">` : `<i class="fas fa-user"></i>`;
                }
                wrapper.appendChild(item);
            });
        });

        if (wrapper.children.length === 0) {
            localList.innerHTML = `<div class="wb-empty-state">暂无绑定</div>`;
        } else {
            localList.appendChild(wrapper);
        }
    }
}

window.renderWorldBooks = renderWorldBooks; // Export for update
window.getWorldBooks = function() {
    return Array.isArray(worldBooks) ? worldBooks : [];
};

window.renderWorldBookSelector = function(selectedIds = [], onConfirm) {
    let selectedBookIds = [];
    let selectorSheet = document.getElementById('wb-selector-sheet');

    if (!selectorSheet) {
        selectorSheet = document.createElement('div');
        selectorSheet.id = 'wb-selector-sheet';
        selectorSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
        selectorSheet.style.zIndex = '650';
        selectorSheet.innerHTML = `
            <div class="bottom-sheet wb-selector-panel">
                <div class="sheet-handle"></div>
                <div class="sheet-title">选择世界书</div>
                <div class="wb-selector-body">
                    <div class="wb-selector-field">
                        <label for="wb-selector-group-select">选择分组</label>
                        <select id="wb-selector-group-select" class="wb-native-select"></select>
                    </div>
                    <div class="wb-selector-field">
                        <label for="wb-selector-book-select">选择世界书</label>
                        <select id="wb-selector-book-select" class="wb-native-select"></select>
                        <div id="wb-selector-empty" class="wb-selector-empty"></div>
                    </div>
                    <div class="wb-selector-preview-head">
                        <span>已挂载</span>
                        <span id="wb-selector-mounted-count">0 项</span>
                    </div>
                    <div id="wb-selector-mounted-list" class="wb-selector-mounted-list"></div>
                </div>
                <div class="wb-selector-actions">
                    <button type="button" class="sheet-action wb-selector-action-btn" id="wb-selector-cancel-btn">取消</button>
                    <button type="button" class="sheet-action confirm-action wb-selector-action-btn" id="wb-selector-confirm-btn">保存</button>
                </div>
            </div>
        `;
        const appRoot = document.getElementById('app') || document.body;
        appRoot.appendChild(selectorSheet);

        selectorSheet.addEventListener('click', (event) => {
            if (event.target === selectorSheet) closeView(selectorSheet);
        });
    }

    const groupSelect = selectorSheet.querySelector('#wb-selector-group-select');
    const bookSelect = selectorSheet.querySelector('#wb-selector-book-select');
    const emptyEl = selectorSheet.querySelector('#wb-selector-empty');
    const mountedList = selectorSheet.querySelector('#wb-selector-mounted-list');
    const mountedCount = selectorSheet.querySelector('#wb-selector-mounted-count');
    const confirmBtn = selectorSheet.querySelector('#wb-selector-confirm-btn');
    const cancelBtn = selectorSheet.querySelector('#wb-selector-cancel-btn');

    const getBookById = (id) => (Array.isArray(worldBooks) ? worldBooks : [])
        .find(book => String(book.id) === String(id));

    const addGroup = (groups, groupName) => {
        const normalized = normalizeGroupName(groupName);
        if (!groups.includes(normalized)) groups.push(normalized);
    };

    const getSelectorGroups = () => {
        const groups = [];
        getAllDisplayGroups().forEach(groupName => addGroup(groups, groupName));
        (Array.isArray(worldBooks) ? worldBooks : []).forEach(book => addGroup(groups, book.group));
        return groups;
    };

    const renderBookSelect = () => {
        if (!bookSelect || !groupSelect) return;

        const currentGroup = normalizeGroupName(groupSelect.value);
        const selectedSet = new Set(selectedBookIds.map(String));
        const booksInGroup = (Array.isArray(worldBooks) ? worldBooks : [])
            .filter(book => normalizeGroupName(book.group) === currentGroup)
            .filter(book => !selectedSet.has(String(book.id)));

        if (booksInGroup.length === 0) {
            bookSelect.innerHTML = '<option value="">暂无可挂载世界书</option>';
            bookSelect.disabled = true;
            if (emptyEl) {
                const hasBooksInGroup = (Array.isArray(worldBooks) ? worldBooks : [])
                    .some(book => normalizeGroupName(book.group) === currentGroup);
                emptyEl.textContent = hasBooksInGroup ? '该分组下的世界书已全部挂载' : '该分组下暂无世界书';
            }
            return;
        }

        bookSelect.disabled = false;
        bookSelect.innerHTML = [
            '<option value="">选择要挂载的世界书</option>',
            ...booksInGroup.map(book => {
                const tokens = calculateTokens(book.entries);
                const name = book.name || '未命名世界书';
                return `<option value="${escapeAttr(book.id)}">${escapeHtml(name)} · +${tokens} Tokens</option>`;
            })
        ].join('');
        if (emptyEl) emptyEl.textContent = '';
    };

    const renderMountedList = () => {
        if (!mountedList) return;

        if (mountedCount) mountedCount.textContent = `${selectedBookIds.length} 项`;

        if (selectedBookIds.length === 0) {
            mountedList.innerHTML = '<div class="wb-selector-mounted-empty">还没有挂载世界书</div>';
            return;
        }

        mountedList.innerHTML = selectedBookIds.map(id => {
            const book = getBookById(id);
            if (!book) return '';
            const group = normalizeGroupName(book.group);
            const tokens = calculateTokens(book.entries);

            return `
                <div class="wb-selector-mounted-card" data-id="${escapeAttr(id)}">
                    <div class="wb-selector-mounted-icon"><i class="fas fa-book"></i></div>
                    <div class="wb-selector-mounted-info">
                        <div class="wb-selector-mounted-name">${escapeHtml(book.name || '未命名世界书')}</div>
                        <div class="wb-selector-mounted-meta">${escapeHtml(group)} · +${tokens} Tokens</div>
                    </div>
                    <button type="button" class="wb-selector-remove-btn" data-id="${escapeAttr(id)}" aria-label="移除 ${escapeAttr(book.name || '世界书')}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        mountedList.querySelectorAll('.wb-selector-remove-btn').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                selectedBookIds = selectedBookIds.filter(bookId => String(bookId) !== String(id));
                renderMountedList();
                renderBookSelect();
            });
        });
    };

    const renderGroupSelect = () => {
        if (!groupSelect) return;
        const groups = getSelectorGroups();
        const currentValue = normalizeGroupName(groupSelect.value);
        groupSelect.innerHTML = groups.map(groupName => (
            `<option value="${escapeAttr(groupName)}">${escapeHtml(groupName)}</option>`
        )).join('');
        groupSelect.value = groups.includes(currentValue) ? currentValue : groups[0];
    };

    selectedBookIds = (Array.isArray(selectedIds) ? selectedIds : [])
        .map(id => String(id))
        .filter((id, index, ids) => ids.indexOf(id) === index)
        .filter(id => !!getBookById(id));

    renderGroupSelect();
    renderMountedList();
    renderBookSelect();

    if (groupSelect) {
        groupSelect.onchange = () => {
            renderBookSelect();
        };
    }

    if (bookSelect) {
        bookSelect.onchange = () => {
            const id = bookSelect.value;
            if (!id || selectedBookIds.includes(String(id))) return;
            selectedBookIds.push(String(id));
            bookSelect.value = '';
            renderMountedList();
            renderBookSelect();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => closeView(selectorSheet);
    }

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            closeView(selectorSheet);
            if (typeof onConfirm === 'function') onConfirm([...selectedBookIds]);
        };
    }

    openView(selectorSheet);
};

function renderLegacyWorldBookSelector(selectedIds = [], onConfirm) {
    const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(String));
    let selectorSheet = document.getElementById('wb-selector-sheet');

    if (!selectorSheet) {
        selectorSheet = document.createElement('div');
        selectorSheet.id = 'wb-selector-sheet';
        selectorSheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
        selectorSheet.style.zIndex = '650';
        selectorSheet.innerHTML = `
            <div class="bottom-sheet" style="height: 72%; display: flex; flex-direction: column;">
                <div class="sheet-handle"></div>
                <div class="sheet-title">选择世界书</div>
                <div id="wb-selector-list" class="account-list" style="flex: 1; overflow-y: auto; margin: 16px;"></div>
                <div style="display: flex; gap: 10px; padding: 0 16px 20px;">
                    <div class="sheet-action" id="wb-selector-cancel-btn" style="flex: 1; margin: 0;">取消</div>
                    <div class="sheet-action confirm-action" id="wb-selector-confirm-btn" style="flex: 1; margin: 0; background-color: #1c1c1e; color: #fff;">保存</div>
                </div>
            </div>
        `;
        const appRoot = document.getElementById('app') || document.body;
        appRoot.appendChild(selectorSheet);

        selectorSheet.addEventListener('click', (event) => {
            if (event.target === selectorSheet) closeView(selectorSheet);
        });
    }

    const listEl = selectorSheet.querySelector('#wb-selector-list');
    const confirmBtn = selectorSheet.querySelector('#wb-selector-confirm-btn');
    const cancelBtn = selectorSheet.querySelector('#wb-selector-cancel-btn');

    if (listEl) {
        if (!Array.isArray(worldBooks) || worldBooks.length === 0) {
            listEl.innerHTML = '<div style="padding: 40px 16px; text-align: center; color: #8e8e93; font-size: 15px;">暂无世界书</div>';
        } else {
            listEl.innerHTML = worldBooks.map((book) => {
                const id = String(book.id);
                const checked = selected.has(id) ? 'checked' : '';
                const name = escapeHtml(book.name || '未命名世界书');
                return `
                    <label class="settings-item" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                            <i class="fas fa-book" style="color: #111;"></i>
                            <span style="font-size: 15px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
                        </div>
                        <input type="checkbox" class="wb-selector-checkbox" value="${escapeAttr(id)}" ${checked} style="width: 20px; height: 20px;">
                    </label>
                `;
            }).join('');
        }
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => closeView(selectorSheet);
    }

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const nextIds = Array.from(selectorSheet.querySelectorAll('.wb-selector-checkbox:checked'))
                .map((input) => input.value);
            closeView(selectorSheet);
            if (typeof onConfirm === 'function') onConfirm(nextIds);
        };
    }

    openView(selectorSheet);
}

// Auto-save summary to World Book globally
window.autoSaveSummaryToWorldBook = function(title, summaryText) {
    const newBook = {
        id: Date.now(),
        name: title || '自动总结',
        group: '未分组',
        entries: [{
            title: '总结内容',
            keyword: '',
            content: summaryText,
            triggerMode: 'permanent',
            injectionPosition: 'before_role',
            systemDepth: 4,
            order: 100,
            recursive: false,
            enabled: true
        }],
        isGlobal: true,
        attachedRoles: []
    };
    
    worldBooks.push(newBook);
    saveWorldBooksData();
    renderWorldBooks();
    showToast('已自动生成全局世界书');
};

// Global Click Listener for Edit Book (Event Delegation)
document.addEventListener('click', (e) => {
    // Handle Edit Book Click
    const bookItem = e.target.closest('.wb-book-item');
    if (bookItem) {
        // Ensure we didn't click the toggle switch
        if (!e.target.closest('.toggle-switch')) {
            const bookId = bookItem.getAttribute('data-id');
            const book = worldBooks.find(b => String(b.id) === String(bookId));
            if (book) {
                if (wbAddMenu) wbAddMenu.style.display = 'none'; // Close menu if open
                openBookModal(book);
            }
        }
    }
});

// Global Change Listener for Toggles
document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('wb-global-toggle')) {
        const bookId = e.target.getAttribute('data-id');
        const book = worldBooks.find(b => String(b.id) === String(bookId));
        if (book) {
            book.isGlobal = e.target.checked;
            saveWorldBooksData();
            
            // Sync UI: update all switches for this book
            document.querySelectorAll('.wb-global-toggle').forEach(s => {
                if (String(s.getAttribute('data-id')) === String(bookId)) {
                    s.checked = book.isGlobal;
                }
            });

            // If in Global tab and unchecking, remove item with animation
            if (!book.isGlobal) {
                const globalList = document.getElementById('wb-global-list');
                // Check if the event came from inside global list
                if (globalList && globalList.contains(e.target)) {
                    const row = e.target.closest('.wb-book-item');
                    if (row) {
                        row.classList.add('removing');
                        setTimeout(() => {
                            row.remove();
                        }, 300);
                    }
                } else {
                    // Unchecked from All tab, just refresh global list silently
                    if (globalList) {
                        const globalBooks = worldBooks.filter(b => b.isGlobal);
                        globalList.innerHTML = globalBooks.length
                            ? `<div class="wb-flat-book-list">${globalBooks.map(b => createBookHtml(b, 'global')).join('')}</div>`
                            : `<div class="wb-empty-state">暂无全局世界书</div>`;
                    }
                }
            } else {
                // Checked from All tab, add to global list
                const globalList = document.getElementById('wb-global-list');
                if (globalList) {
                    const globalBooks = worldBooks.filter(b => b.isGlobal);
                    globalList.innerHTML = globalBooks.length
                        ? `<div class="wb-flat-book-list">${globalBooks.map(b => createBookHtml(b, 'global')).join('')}</div>`
                        : `<div class="wb-empty-state">暂无全局世界书</div>`;
                }
            }
        }
    }
});
