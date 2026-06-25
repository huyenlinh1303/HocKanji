// === STATE MANAGEMENT ===
let appData = {
    components: [], // { id, name, phonetic, romaji, meaning, explanation }
    words: [],      // { id, componentId, kanji, phonetic, romaji, meaning, image, explanation }
    practiceState: {
        lastDate: null,
        dailyComponentIds: [], 
        completed: false
    },
    speakingLogs: [],
    grammarGroups: [],
    grammars: [],
    punishmentState: { active: false, multiplier: 1 },
    weeklyGrammarTask: { lastCompletedDate: null }
};

let practiceMode = 'daily'; // 'daily' or 'single'

// Inject Modal CSS dynamically to prevent browser CSS caching issues
const modalCSS = `
/* Modal */
.modal {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s;
}
.modal-content {
    width: 100%;
    max-width: 500px;
    margin: 20px;
    padding: 32px;
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.btn-close-modal {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
}
.btn-close-modal:hover { color: var(--danger); }
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = modalCSS;
document.head.appendChild(styleSheet);

// Load data from localForage/localStorage
async function loadData() {
    try {
        let saved = await localforage.getItem("appData");
        
        // Migrate from localStorage if localForage is empty
        if (!saved) {
            const lsSaved = localStorage.getItem("appData");
            if (lsSaved) {
                saved = JSON.parse(lsSaved);
                // Save to localForage immediately
                await localforage.setItem("appData", saved);
                console.log("Migrated data from localStorage to localForage");
            }
        }
        
        if (saved) {
            appData = saved;
            if(!appData.speakingLogs) appData.speakingLogs = [];
            if(!appData.grammarGroups) appData.grammarGroups = [];
            if(!appData.grammars) appData.grammars = [];
            if(!appData.punishmentState) appData.punishmentState = { active: false, multiplier: 1 };
            if(!appData.weeklyGrammarTask) appData.weeklyGrammarTask = { lastCompletedDate: null };
            // Ensure backwards compatibility
            appData.components.forEach(c => {
                if (c.phonetic === undefined) c.phonetic = '';
                if (c.meaning === undefined) c.meaning = '';
                if (c.romaji === undefined) c.romaji = '';
                if (c.explanation === undefined) c.explanation = '';
            });
            appData.words.forEach(w => {
                if (w.romaji === undefined) w.romaji = '';
                if (w.phonetic === undefined) w.phonetic = '';
                if (w.explanation === undefined) w.explanation = '';
            });
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

// Save data to localForage
async function saveData() {
    try {
        await localforage.setItem("appData", appData);
    } catch (err) {
        console.error("Error saving data:", err);
    }
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// === NAVIGATION ===
const pages = ['dashboard', 'groups', 'add-word', 'practice', 'speaking', 'grammar', 'dictionary', 'notifications'];
const pageTitles = {
    'dashboard': 'Tổng quan',
    'groups': 'Quản lý Nhóm',
    'add-word': 'Thêm từ mới',
    'practice': 'Luyện tập',
    'speaking': 'Luyện nói',
    'grammar': 'Ngữ pháp',
    'dictionary': 'Từ điển',
    'notifications': 'Thông báo'
};

let navHistory = []; // Stores { pageId, scrollY }

window.goBack = function() {
    if (navHistory.length === 0) return;
    const prev = navHistory.pop();
    navigateTo(prev.pageId, { isBack: true, restoreScrollY: prev.scrollY });
};

function navigateTo(pageId, options = { isBack: false, fromSidebar: false }) {
    const activeSectionEl = document.querySelector('.page-section.active');
    const currentPageId = activeSectionEl ? activeSectionEl.id : null;

    if (options.fromSidebar) {
        navHistory = []; // Clear history if clicked from sidebar
    } else if (!options.isBack && currentPageId && currentPageId !== pageId) {
        // Save current page to history before navigating away
        navHistory.push({
            pageId: currentPageId,
            scrollY: window.scrollY || document.documentElement.scrollTop
        });
    }

    const backBtn = document.getElementById('btn-back-history');
    if (backBtn) {
        if (navHistory.length > 0) {
            backBtn.classList.remove('hidden');
        } else {
            backBtn.classList.add('hidden');
        }
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === pageId) link.classList.add('active');
    });

    pages.forEach(p => {
        document.getElementById(p).classList.add('hidden');
        document.getElementById(p).classList.remove('active');
    });
    
    const activeSection = document.getElementById(pageId);
    activeSection.classList.remove('hidden');
    requestAnimationFrame(() => activeSection.classList.add('active'));

    document.getElementById('page-title').textContent = pageTitles[pageId];

    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'groups') renderGroups();
    if (pageId === 'dictionary') renderDictionary();
    if (pageId === 'practice') {
        if (practiceMode === 'daily') initPracticeView();
        // If single, it's already initialized before navigation
    }

    if (options.isBack && options.restoreScrollY !== undefined) {
        setTimeout(() => window.scrollTo(0, options.restoreScrollY), 10);
    } else if (!options.isBack) {
        window.scrollTo(0, 0);
    }
}

// === DASHBOARD ===
function renderDashboard() {
    document.getElementById('total-words-count').textContent = appData.words.length;
    document.getElementById('total-groups-count').textContent = appData.components.length;
    
    const today = new Date().toDateString();
    const isPracticedToday = appData.practiceState.lastDate === today && appData.practiceState.completed;
    document.getElementById('practiced-today-status').textContent = isPracticedToday ? 'Đã hoàn thành' : 'Chưa luyện tập';
    document.getElementById('practiced-today-status').style.color = isPracticedToday ? 'var(--success)' : 'var(--text-main)';
}

document.getElementById('card-groups').addEventListener('click', () => {
    navigateTo('groups');
});

document.getElementById('card-total-words').addEventListener('click', () => {
    navigateTo('dictionary');
});

document.getElementById('card-practiced-today').addEventListener('click', () => {
    navigateTo('practice');
});

// === DATA MANAGEMENT ===
document.getElementById('btn-export-data').addEventListener('click', () => {
    const dataStr = JSON.stringify(appData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `kanji_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
});

document.getElementById('input-import-data').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData && importedData.components && importedData.words) {
                if (confirm('Bạn có chắc chắn muốn ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu từ file này không?')) {
                    appData = importedData;
                    await saveData();
                    alert('Đã khôi phục dữ liệu thành công! Trang sẽ được tải lại.');
                    location.reload();
                }
            } else {
                alert('File không đúng định dạng dữ liệu của ứng dụng.');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi khi đọc file. Vui lòng kiểm tra lại.');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

// === GROUPS MANAGEMENT ===
document.getElementById('add-group-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name-input').value.trim();
    const phonetic = document.getElementById('group-phonetic-input').value.trim();
    const romaji = document.getElementById('group-romaji-input').value.trim();
    const meaning = document.getElementById('group-meaning-input').value.trim();
    const explanation = document.getElementById('group-explanation-input')?.value.trim() || '';

    if (!name) return;

    let comp = appData.components.find(c => c.name === name);
    if (comp) {
        // Update existing if created previously without info
        comp.phonetic = phonetic;
        comp.romaji = romaji;
        comp.meaning = meaning;
        comp.explanation = explanation;
    } else {
        appData.components.push({
            id: generateId(),
            name,
            phonetic,
            romaji,
            meaning,
            explanation
        });
    }

    saveData();
    renderGroups();
    
    e.target.reset();
    const msg = document.getElementById('add-group-success-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
});

let isGroupDeleteMode = false;
let selectedGroupIds = new Set();

document.getElementById('btn-toggle-delete-groups').addEventListener('click', () => {
    isGroupDeleteMode = !isGroupDeleteMode;
    selectedGroupIds.clear();
    
    if (isGroupDeleteMode) {
        document.getElementById('btn-toggle-delete-groups').classList.add('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-groups').classList.remove('hidden');
    } else {
        document.getElementById('btn-toggle-delete-groups').classList.remove('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-groups').classList.add('hidden');
    }
    renderGroups();
});

document.getElementById('btn-delete-selected-groups').addEventListener('click', () => {
    if (selectedGroupIds.size === 0) return;
    if (confirm(`Bạn có chắc muốn xóa ${selectedGroupIds.size} nhóm đã chọn? Mọi từ vựng trong các nhóm này cũng sẽ bị xóa vĩnh viễn.`)) {
        appData.components = appData.components.filter(c => !selectedGroupIds.has(c.id));
        appData.words = appData.words.filter(w => !selectedGroupIds.has(w.componentId));
        saveData();
        
        isGroupDeleteMode = false;
        selectedGroupIds.clear();
        document.getElementById('btn-toggle-delete-groups').classList.remove('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-groups').classList.add('hidden');
        renderGroups();
    }
});

window.toggleGroupSelection = function(id) {
    if (selectedGroupIds.has(id)) {
        selectedGroupIds.delete(id);
    } else {
        selectedGroupIds.add(id);
    }
}

function renderGroups() {
    const list = document.getElementById('groups-list');
    list.innerHTML = '';
    
    if (appData.components.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="ph ph-folder"></i><p>Chưa có nhóm nào được tạo.</p></div>';
        return;
    }

    appData.components.forEach(comp => {
        const wordCount = appData.words.filter(w => w.componentId === comp.id).length;
        
        const checkboxHTML = isGroupDeleteMode ? `
            <div style="position: absolute; top: 12px; right: 12px; z-index: 2;">
                <input type="checkbox" style="width: 20px; height: 20px; cursor: pointer;" ${selectedGroupIds.has(comp.id) ? 'checked' : ''} onchange="toggleGroupSelection('${comp.id}')">
            </div>
        ` : '';

        list.innerHTML += `
            <div class="group-item-card" style="position: relative; ${isGroupDeleteMode ? 'border: 2px solid var(--danger);' : ''}">
                ${checkboxHTML}
                <div class="group-item-header" style="${isGroupDeleteMode ? 'opacity: 0.7; pointer-events: none;' : ''}">
                    <div class="group-item-kanji">${comp.name}</div>
                    <div class="group-item-info">
                        <div class="group-item-phonetic">Âm: ${comp.phonetic || '--'}</div>
                        <div class="group-item-phonetic">Romaji: ${comp.romaji || '--'}</div>
                        <div class="group-item-meaning">Nghĩa: ${comp.meaning || '--'}</div>
                        ${comp.explanation ? `<div class="group-item-meaning text-muted" style="margin-top: 4px; font-style: italic;">Lý giải: ${comp.explanation}</div>` : ''}
                        <div class="text-muted" style="font-size: 13px; margin-top: 4px;">${wordCount} từ vựng</div>
                    </div>
                </div>
                <div class="group-item-actions">
                    <button class="btn btn-secondary btn-small" onclick="openEditGroupModal('${comp.id}')">
                        <i class="ph ph-pencil"></i> Sửa thông tin nhóm
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="handleAddWordToGroup('${comp.name}')">
                        <i class="ph ph-plus"></i> Thêm từ vào nhóm này
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="handleViewWordsGroup('${comp.name}')">
                        <i class="ph ph-list"></i> Xem danh sách từ
                    </button>
                    <button class="btn btn-primary btn-small" onclick="handlePracticeSingleGroup('${comp.id}')">
                        <i class="ph ph-brain"></i> Luyện tập nhóm này
                    </button>
                </div>
            </div>
        `;
    });
}

// Edit Modal Logic
window.openEditGroupModal = function(id) {
    const comp = appData.components.find(c => c.id === id);
    if(!comp) return;
    
    // Fallback: Nếu HTML bị cache chưa có modal, tự động tạo modal
    if (!document.getElementById('edit-group-modal')) {
        const modalHTML = `
        <div id="edit-group-modal" class="modal hidden">
            <div class="modal-content card">
                <div class="modal-header">
                    <h2>Sửa thông tin nhóm</h2>
                    <button class="btn-close-modal" id="btn-close-edit-modal"><i class="ph ph-x"></i></button>
                </div>
                <form id="edit-group-form" class="mt-4">
                    <input type="hidden" id="edit-group-id">
                    <div class="form-group">
                        <label for="edit-group-name">Tên Nhóm / Phần nhận diện</label>
                        <input type="text" id="edit-group-name" readonly style="background: var(--bg-color); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label for="edit-group-phonetic">Phiên âm Hán Việt</label>
                        <input type="text" id="edit-group-phonetic" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="edit-group-romaji">Phiên âm Romaji</label>
                        <input type="text" id="edit-group-romaji" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="edit-group-meaning">Nghĩa tiếng Việt</label>
                        <input type="text" id="edit-group-meaning" autocomplete="off">
                    </div>
                    <div class="mt-4" style="text-align: right;">
                        <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Re-bind events for the newly injected modal
        document.getElementById('btn-close-edit-modal').addEventListener('click', () => {
            document.getElementById('edit-group-modal').classList.add('hidden');
        });

        document.getElementById('edit-group-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = document.getElementById('edit-group-id').value;
            const editComp = appData.components.find(c => c.id === editId);
            if(editComp) {
                editComp.phonetic = document.getElementById('edit-group-phonetic').value.trim();
                editComp.romaji = document.getElementById('edit-group-romaji').value.trim();
                editComp.meaning = document.getElementById('edit-group-meaning').value.trim();
                editComp.explanation = document.getElementById('edit-group-explanation').value.trim();
                saveData();
                renderGroups();
                document.getElementById('edit-group-modal').classList.add('hidden');
            }
        });
    }

    document.getElementById('edit-group-id').value = comp.id;
    document.getElementById('edit-group-name').value = comp.name;
    document.getElementById('edit-group-phonetic').value = comp.phonetic || '';
    document.getElementById('edit-group-romaji').value = comp.romaji || '';
    document.getElementById('edit-group-meaning').value = comp.meaning || '';
    document.getElementById('edit-group-explanation').value = comp.explanation || '';
    
    document.getElementById('edit-group-modal').classList.remove('hidden');
};

// Events are now dynamically bound inside openEditGroupModal if injected,
// but we keep them here in case HTML is properly loaded from the start.
const closeBtn = document.getElementById('btn-close-edit-modal');
if(closeBtn) {
    closeBtn.addEventListener('click', () => {
        document.getElementById('edit-group-modal').classList.add('hidden');
    });
}

const editForm = document.getElementById('edit-group-form');
if(editForm) {
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-group-id').value;
        const comp = appData.components.find(c => c.id === id);
        if(comp) {
            comp.phonetic = document.getElementById('edit-group-phonetic').value.trim();
            comp.romaji = document.getElementById('edit-group-romaji').value.trim();
            comp.meaning = document.getElementById('edit-group-meaning').value.trim();
            comp.explanation = document.getElementById('edit-group-explanation').value.trim();
            saveData();
            renderGroups();
            document.getElementById('edit-group-modal').classList.add('hidden');
        }
    });
}


window.handleAddWordToGroup = function(groupName) {
    navigateTo('add-word');
    document.getElementById('component-input').value = groupName;
    document.getElementById('kanji-input').focus();
};

window.handleViewWordsGroup = function(groupName) {
    navigateTo('dictionary');
    document.getElementById('search-dict').value = groupName;
    document.getElementById('btn-clear-dict-filter').classList.remove('hidden');
    renderDictionary();
};

window.handlePracticeSingleGroup = function(groupId) {
    practiceMode = 'single';
    
    const compWords = appData.words.filter(w => w.componentId === groupId);
    if (compWords.length === 0) {
        alert("Nhóm này chưa có từ vựng nào để luyện tập!");
        return;
    }

    appData.practiceState.dailyComponentIds = [groupId];
    appData.practiceState.completed = false; // Reset complete state for this run
    
    navigateTo('practice');
    
    document.getElementById('practice-setup').classList.add('hidden');
    document.getElementById('practice-active').classList.remove('hidden');
    document.getElementById('practice-summary').classList.add('hidden');
    
    currentPracticeIndex = 0;
    renderPracticeStep();
};


// === ADD WORD ===
const componentInput = document.getElementById('component-input');
const suggestionsList = document.getElementById('component-suggestions');
const addWordForm = document.getElementById('add-word-form');

componentInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    suggestionsList.innerHTML = '';
    
    if (val.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
    }

    const matches = appData.components.filter(c => c.name.toLowerCase().includes(val));
    if (matches.length > 0) {
        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = `${c.name} (${c.meaning || '?'})`;
            div.addEventListener('click', () => {
                componentInput.value = c.name;
                suggestionsList.classList.add('hidden');
            });
            suggestionsList.appendChild(div);
        });
        suggestionsList.classList.remove('hidden');
    } else {
        suggestionsList.classList.add('hidden');
    }
});

// Helper function to process image files into base64
function processImageFile(file, callback) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width = Math.round(width * (MAX_HEIGHT / height));
                    height = MAX_HEIGHT;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Global paste listener for images
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let imageFile = null;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            imageFile = item.getAsFile();
            break;
        }
    }
    
    if (imageFile) {
        // Check which section is active
        const addWordActive = document.getElementById('add-word').classList.contains('active');
        const editWordModalActive = !document.getElementById('edit-word-modal').classList.contains('hidden');
        
        if (editWordModalActive) {
            processImageFile(imageFile, (base64) => {
                currentEditWordImageBase64 = base64;
                document.getElementById('edit-word-image-preview').style.display = 'block';
                document.getElementById('edit-word-image-preview-img').src = currentEditWordImageBase64;
            });
        } else if (addWordActive) {
            processImageFile(imageFile, (base64) => {
                currentSelectedImageBase64 = base64;
                document.getElementById('image-preview').style.display = 'block';
                document.getElementById('image-preview-img').src = currentSelectedImageBase64;
            });
        }
    }
});

let currentSelectedImageBase64 = null;

// Add Word Image Handlers
document.getElementById('image-paste-area')?.addEventListener('click', () => {
    document.getElementById('image-input').click();
});

document.getElementById('image-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file, (base64) => {
            currentSelectedImageBase64 = base64;
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('image-preview-img').src = currentSelectedImageBase64;
        });
    }
});

document.getElementById('btn-remove-image')?.addEventListener('click', () => {
    currentSelectedImageBase64 = null;
    document.getElementById('image-input').value = '';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-preview-img').src = '';
});

document.getElementById('add-word-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const compName = document.getElementById('component-input').value.trim();
    const kanji = document.getElementById('kanji-input').value.trim();
    const phonetic = document.getElementById('phonetic-input').value.trim();
    const romaji = document.getElementById('romaji-input').value.trim();
    const meaning = document.getElementById('meaning-input').value.trim();
    const explanation = document.getElementById('explanation-input')?.value.trim() || '';

    if (!compName || !kanji || !romaji || !meaning) return;

    let comp = appData.components.find(c => c.name === compName);
    if (!comp) {
        comp = { id: generateId(), name: compName, phonetic: '', romaji: '', meaning: '', explanation: '' };
        appData.components.push(comp);
    }

    appData.words.push({
        id: generateId(),
        componentId: comp.id,
        kanji,
        phonetic,
        romaji,
        meaning,
        explanation,
        image: currentSelectedImageBase64
    });

    saveData();

    document.getElementById('add-word-form').reset();
    currentSelectedImageBase64 = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-preview-img').src = '';
    const msg = document.getElementById('add-success-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
});

// === DICTIONARY ===
document.getElementById('btn-clear-dict-filter').addEventListener('click', () => {
    document.getElementById('search-dict').value = '';
    document.getElementById('btn-clear-dict-filter').classList.add('hidden');
    renderDictionary();
});

let isWordDeleteMode = false;
let selectedWordIds = new Set();

document.getElementById('btn-toggle-delete-words').addEventListener('click', () => {
    isWordDeleteMode = !isWordDeleteMode;
    selectedWordIds.clear();
    
    if (isWordDeleteMode) {
        document.getElementById('btn-toggle-delete-words').classList.add('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-words').classList.remove('hidden');
    } else {
        document.getElementById('btn-toggle-delete-words').classList.remove('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-words').classList.add('hidden');
    }
    renderDictionary();
});

document.getElementById('btn-delete-selected-words').addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    if (confirm(`Bạn có chắc muốn xóa ${selectedWordIds.size} từ vựng đã chọn?`)) {
        appData.words = appData.words.filter(w => !selectedWordIds.has(w.id));
        saveData();
        
        isWordDeleteMode = false;
        selectedWordIds.clear();
        document.getElementById('btn-toggle-delete-words').classList.remove('bg-danger', 'text-white');
        document.getElementById('btn-delete-selected-words').classList.add('hidden');
        renderDictionary();
    }
});

window.toggleWordSelection = function(id, event) {
    if (event) event.stopPropagation();
    if (selectedWordIds.has(id)) {
        selectedWordIds.delete(id);
    } else {
        selectedWordIds.add(id);
    }
}

function renderDictionary() {
    const container = document.getElementById('dictionary-list');
    container.innerHTML = '';

    if (appData.components.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-books"></i><p>Bạn chưa thêm từ vựng nào.</p></div>';
        return;
    }

    const searchTerm = document.getElementById('search-dict').value.toLowerCase().trim();
    
    if(searchTerm === '') {
        document.getElementById('btn-clear-dict-filter').classList.add('hidden');
    }

    let hasResults = false;

    appData.components.forEach(comp => {
        const compWords = appData.words.filter(w => w.componentId === comp.id);
        
        let filteredWords = compWords;
        // Search filter
        if (searchTerm) {
            if (comp.name.toLowerCase().includes(searchTerm)) {
                // If group matches, show all words
            } else {
                filteredWords = compWords.filter(w => 
                    w.kanji.toLowerCase().includes(searchTerm) || 
                    w.romaji.toLowerCase().includes(searchTerm) || 
                    w.meaning.toLowerCase().includes(searchTerm)
                );
            }
        }

        if (filteredWords.length === 0) return;
        hasResults = true;

        container.innerHTML += `
            <div class="dict-group">
                <div class="dict-group-title">
                    ${comp.name} 
                    <span style="font-size: 14px; margin-left:8px; color: var(--text-muted); font-weight:normal;">
                        ${comp.phonetic ? `[${comp.phonetic}]` : ''} ${comp.romaji ? `(${comp.romaji})` : ''} ${comp.meaning}
                    </span>
                    <span class="badge">${filteredWords.length} từ</span>
                </div>
                <div class="dict-words">
                    ${filteredWords.map(w => `
                        <div class="dict-word-card" style="cursor: pointer; position: relative; ${isWordDeleteMode ? 'border: 2px solid var(--danger);' : ''}" onclick="${isWordDeleteMode ? `toggleWordSelection('${w.id}', event); renderDictionary();` : `openWordDetailModal('${w.id}')`}">
                            ${isWordDeleteMode ? `
                                <div style="position: absolute; top: 8px; left: 8px; z-index: 2;">
                                    <input type="checkbox" style="width: 20px; height: 20px; cursor: pointer;" ${selectedWordIds.has(w.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleWordSelection('${w.id}', event); renderDictionary();">
                                </div>
                            ` : `
                                <button class="btn-edit-word" onclick="event.stopPropagation(); openEditWordModal('${w.id}')" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; z-index: 2;">
                                    <i class="ph ph-pencil"></i>
                                </button>
                            `}
                            <div style="${isWordDeleteMode ? 'opacity: 0.7; pointer-events: none;' : ''}">
                                ${w.image ? `<img src="${w.image}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />` : ''}
                                <div class="dict-kanji">${w.kanji}</div>
                                ${w.phonetic ? `<div class="dict-phonetic" style="font-size: 0.9em; color: var(--text-muted); margin-top: 2px;">[${w.phonetic}]</div>` : ''}
                                <div class="dict-romaji">${w.romaji}</div>
                                <div class="dict-meaning">${w.meaning}</div>
                                ${w.explanation ? `<div class="dict-meaning text-muted" style="margin-top: 4px; font-style: italic; font-size: 0.85em;">Lý giải: ${w.explanation}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    if (!hasResults) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-magnifying-glass"></i><p>Không tìm thấy kết quả.</p></div>';
    }
}

document.getElementById('search-dict').addEventListener('input', () => {
    if(document.getElementById('search-dict').value.trim().length > 0) {
        document.getElementById('btn-clear-dict-filter').classList.remove('hidden');
    }
    renderDictionary();
});

window.openWordDetailModal = function(wordId) {
    const w = appData.words.find(x => x.id === wordId);
    if (!w) return;
    const c = appData.components.find(x => x.id === w.componentId);

    let html = `
        <h1 style="font-size: 3rem; margin-bottom: 10px; color: var(--primary);">${w.kanji}</h1>
        ${w.phonetic ? `<p style="font-size: 1.2rem; font-weight: bold; margin-bottom: 5px; color: var(--text-main);">Âm Hán: ${w.phonetic}</p>` : ''}
        <p style="font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">${w.romaji}</p>
        <p style="font-size: 1.1rem; margin-bottom: 20px;">${w.meaning}</p>
        ${w.explanation ? `<p style="font-size: 0.95rem; font-style: italic; color: var(--text-muted); margin-bottom: 15px; text-align: left; background: var(--bg-color); padding: 10px; border-radius: 4px;">Lý giải: ${w.explanation}</p>` : ''}
        ${w.image ? `<img src="${w.image}" style="max-width: 100%; max-height: 250px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />` : ''}
        <div style="background: var(--bg-color); padding: 15px; border-radius: 8px; text-align: left; margin-top: 10px;">
            <p style="margin-bottom: 5px;"><strong>Nhóm/Phần nhận diện:</strong> ${c ? c.name : '--'}</p>
            <p style="margin-bottom: 5px; font-size: 0.95em;" class="text-muted">Âm Hán: ${c ? (c.phonetic || '--') : '--'}</p>
            <p style="margin-bottom: 5px; font-size: 0.95em;" class="text-muted">Romaji nhóm: ${c ? (c.romaji || '--') : '--'}</p>
            <p style="font-size: 0.95em;" class="text-muted">Nghĩa nhóm: ${c ? (c.meaning || '--') : '--'}</p>
        </div>
    `;
    document.getElementById('word-detail-content').innerHTML = html;
    document.getElementById('word-detail-modal').classList.remove('hidden');
};

document.getElementById('btn-close-word-modal')?.addEventListener('click', () => {
    document.getElementById('word-detail-modal').classList.add('hidden');
});

let currentEditWordImageBase64 = null;
window.openEditWordModal = function(wordId) {
    const w = appData.words.find(x => x.id === wordId);
    if (!w) return;

    document.getElementById('edit-word-id').value = w.id;
    document.getElementById('edit-word-kanji').value = w.kanji;
    document.getElementById('edit-word-phonetic').value = w.phonetic || '';
    document.getElementById('edit-word-romaji').value = w.romaji;
    document.getElementById('edit-word-meaning').value = w.meaning;
    document.getElementById('edit-word-explanation').value = w.explanation || '';
    
    currentEditWordImageBase64 = w.image || null;
    const previewDiv = document.getElementById('edit-word-image-preview');
    const previewImg = document.getElementById('edit-word-image-preview-img');
    const fileInput = document.getElementById('edit-word-image-input');
    fileInput.value = ''; // Reset file input
    
    if (currentEditWordImageBase64) {
        previewDiv.style.display = 'block';
        previewImg.src = currentEditWordImageBase64;
    } else {
        previewDiv.style.display = 'none';
        previewImg.src = '';
    }

    document.getElementById('edit-word-modal').classList.remove('hidden');
};

document.getElementById('btn-close-edit-word-modal')?.addEventListener('click', () => {
    document.getElementById('edit-word-modal').classList.add('hidden');
});

// Edit Word Image Handlers
document.getElementById('edit-word-image-paste-area')?.addEventListener('click', () => {
    document.getElementById('edit-word-image-input').click();
});

document.getElementById('edit-word-image-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file, (base64) => {
            currentEditWordImageBase64 = base64;
            document.getElementById('edit-word-image-preview').style.display = 'block';
            document.getElementById('edit-word-image-preview-img').src = currentEditWordImageBase64;
        });
    }
});

document.getElementById('btn-remove-edit-image')?.addEventListener('click', () => {
    currentEditWordImageBase64 = null;
    document.getElementById('edit-word-image-input').value = '';
    document.getElementById('edit-word-image-preview').style.display = 'none';
    document.getElementById('edit-word-image-preview-img').src = '';
});

document.getElementById('edit-word-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-word-id').value;
    const w = appData.words.find(x => x.id === id);
    if (w) {
        w.kanji = document.getElementById('edit-word-kanji').value.trim();
        w.phonetic = document.getElementById('edit-word-phonetic').value.trim();
        w.romaji = document.getElementById('edit-word-romaji').value.trim();
        w.meaning = document.getElementById('edit-word-meaning').value.trim();
        w.explanation = document.getElementById('edit-word-explanation')?.value.trim() || '';
        w.image = currentEditWordImageBase64;
        saveData();
        renderDictionary();
        document.getElementById('edit-word-modal').classList.add('hidden');
    }
});

// === PRACTICE LOGIC ===
let currentPracticeIndex = 0;
let currentPracticeComponent = null;

function generateRandomGroups() {
    const validComponents = appData.components.filter(c => appData.words.some(w => w.componentId === c.id));
    if (appData.punishmentState && appData.punishmentState.active) {
        let result = [];
        for (let i = 0; i < appData.punishmentState.multiplier; i++) {
            const shuffled = [...validComponents].sort(() => 0.5 - Math.random());
            result = result.concat(shuffled.map(c => c.id));
        }
        return result;
    } else {
        const shuffled = validComponents.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 5).map(c => c.id);
    }
}

function initPracticeView() {
    practiceMode = 'daily';
    
    const validComponents = appData.components.filter(c => appData.words.some(w => w.componentId === c.id));
    
    if (validComponents.length === 0) {
        document.getElementById('practice-setup').innerHTML = '<div class="card text-center"><h2>Chưa có dữ liệu</h2><p>Hãy thêm từ vựng trước khi luyện tập nhé.</p></div>';
        return;
    }

    if (appData.punishmentState && appData.punishmentState.active) {
        const totalRounds = validComponents.length * appData.punishmentState.multiplier;
        document.getElementById('btn-start-practice').textContent = `Chấp nhận Hình Phạt (${totalRounds} Nhóm ngẫu nhiên)`;
        document.getElementById('btn-start-practice').style.backgroundColor = 'var(--danger)';
    } else {
        const count = Math.min(5, validComponents.length);
        document.getElementById('btn-start-practice').textContent = `Bắt đầu Luyện Tập (${count} Nhóm Ngẫu Nhiên)`;
        document.getElementById('btn-start-practice').style.backgroundColor = 'var(--primary)';
    }

    if (appData.practiceState.completed) {
        showPracticeSummary();
    } else {
        document.getElementById('practice-setup').classList.remove('hidden');
        document.getElementById('practice-active').classList.add('hidden');
        document.getElementById('practice-summary').classList.add('hidden');
    }
}

document.getElementById('btn-start-practice').addEventListener('click', () => {
    appData.practiceState.lastDate = new Date().toDateString();
    appData.practiceState.dailyComponentIds = generateRandomGroups();
    appData.practiceState.completed = false;
    saveData();

    document.getElementById('practice-setup').classList.add('hidden');
    document.getElementById('practice-active').classList.remove('hidden');
    currentPracticeIndex = 0;
    renderPracticeStep();
});

document.getElementById('btn-start-practice-dash').addEventListener('click', () => {
    practiceMode = 'daily';
    navigateTo('practice');
    if (!appData.practiceState.completed) {
        document.getElementById('btn-start-practice').click();
    }
});

document.getElementById('btn-retry-practice').addEventListener('click', () => {
    // Retry daily practice
    if(practiceMode === 'daily') {
        document.getElementById('practice-summary').classList.add('hidden');
        document.getElementById('btn-start-practice').click(); // Re-rolls random groups
    } else {
        // Retry single group
        document.getElementById('practice-summary').classList.add('hidden');
        document.getElementById('practice-active').classList.remove('hidden');
        currentPracticeIndex = 0;
        renderPracticeStep();
    }
});


function addPracticeRow() {
    const container = document.getElementById('practice-inputs-container');
    const rowId = `row-${Date.now()}`;
    
    const row = document.createElement('div');
    row.className = 'practice-row';
    row.id = rowId;
    
    row.innerHTML = `
        <input type="text" class="practice-kanji-input" placeholder="Kanji" autocomplete="off">
        <input type="text" class="practice-romaji-input" placeholder="Romaji" autocomplete="off">
        <input type="text" class="practice-meaning-input" placeholder="Nghĩa" autocomplete="off">
        <button type="button" class="btn-remove-row" tabindex="-1"><i class="ph ph-trash"></i></button>
    `;
    
    // Xử lý nút xóa
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        // Nếu xóa hết row thì tự động thêm 1 row trống
        if (container.children.length === 0) addPracticeRow();
    });

    container.appendChild(row);
    // Focus into the new row
    setTimeout(() => {
        row.querySelector('.practice-kanji-input').focus();
    }, 50);
}

document.getElementById('btn-add-practice-row').addEventListener('click', addPracticeRow);

function renderPracticeStep() {
    if (currentPracticeIndex >= appData.practiceState.dailyComponentIds.length) {
        if(practiceMode === 'daily') {
            appData.practiceState.completed = true;
            if (appData.punishmentState && appData.punishmentState.active) {
                appData.punishmentState.active = false;
                appData.punishmentState.multiplier = 1;
            }
            saveData();
        }
        showPracticeSummary();
        return;
    }

    const compId = appData.practiceState.dailyComponentIds[currentPracticeIndex];
    currentPracticeComponent = appData.components.find(c => c.id === compId);

    // Update UI
    document.getElementById('practice-component-display').textContent = currentPracticeComponent.name;
    document.getElementById('practice-component-details').textContent = 
        `Phiên âm: ${currentPracticeComponent.phonetic || '--'} | Romaji: ${currentPracticeComponent.romaji || '--'} | Nghĩa: ${currentPracticeComponent.meaning || '--'}`;
    
    if (practiceMode === 'single') {
        document.getElementById('practice-progress-container').classList.add('hidden');
    } else {
        document.getElementById('practice-progress-container').classList.remove('hidden');
        document.getElementById('current-group-index').textContent = currentPracticeIndex + 1;
        document.getElementById('total-groups-index').textContent = appData.practiceState.dailyComponentIds.length;
        const progressPercent = ((currentPracticeIndex) / appData.practiceState.dailyComponentIds.length) * 100;
        document.getElementById('practice-progress').style.width = `${progressPercent}%`;
    }

    const compWords = appData.words.filter(w => w.componentId === currentPracticeComponent.id);
    const hintsContainer = document.getElementById('practice-image-hints');
    if (hintsContainer) {
        const imagesHtml = compWords
            .filter(w => w.image)
            .map(w => `<img src="${w.image}" style="height: 80px; width: 80px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="Gợi ý" />`)
            .join('');
        hintsContainer.innerHTML = imagesHtml;
    }

    // Reset inputs: Add exactly 1 blank row
    const container = document.getElementById('practice-inputs-container');
    container.innerHTML = '';
    addPracticeRow();

    // Reset feedback
    document.getElementById('practice-feedback').classList.add('hidden');
    document.getElementById('btn-next-group').classList.add('hidden');
    document.getElementById('btn-add-practice-row').classList.remove('hidden');
    
    // Show buttons
    document.querySelector('.practice-actions').style.display = 'flex';
}

document.getElementById('practice-form').addEventListener('submit', (e) => {
    e.preventDefault();
    checkAnswers();
});

document.getElementById('btn-skip-group').addEventListener('click', () => {
    checkAnswers(true);
});

function checkAnswers(skipped = false) {
    const compWords = appData.words.filter(w => w.componentId === currentPracticeComponent.id);
    
    const kanjiInputs = document.querySelectorAll('.practice-kanji-input');
    const romajiInputs = document.querySelectorAll('.practice-romaji-input');
    const meaningInputs = document.querySelectorAll('.practice-meaning-input');
    
    const userAnswers = [];
    for (let i = 0; i < kanjiInputs.length; i++) {
        const k = kanjiInputs[i].value.trim().toLowerCase();
        const r = romajiInputs[i].value.trim().toLowerCase();
        const m = meaningInputs[i].value.trim().toLowerCase();
        // Bỏ qua các hàng trống hoàn toàn
        if (k || r || m) {
            userAnswers.push({ kanji: k, romaji: r, meaning: m });
        }
    }

    const feedbackArea = document.getElementById('practice-feedback');
    feedbackArea.innerHTML = '';
    feedbackArea.classList.remove('hidden');

    if (skipped) {
        feedbackArea.innerHTML += `
            <div class="feedback-section-title text-missing"><i class="ph ph-warning-circle"></i> Đã bỏ qua nhóm này. Các từ thuộc nhóm:</div>
        `;
        compWords.forEach(w => {
            feedbackArea.innerHTML += `
                <div class="feedback-item status-missing">
                    <div class="feedback-content">
                        <h4>${w.kanji} <span class="text-muted" style="font-size:13px; font-weight:normal">(${w.romaji})</span></h4>
                        <p>${w.meaning}</p>
                        ${w.image ? `<img src="${w.image}" style="max-height: 120px; border-radius: 6px; margin-top: 10px;" />` : ''}
                    </div>
                </div>
            `;
        });
        finishChecking();
        return;
    }

    let corrects = [];
    let incorrects = [];
    let extras = [];
    let matchedActualIds = new Set();

    // Analyze User Answers
    userAnswers.forEach(ua => {
        // Find if this kanji exists in the group
        const matchedActual = compWords.find(w => w.kanji.toLowerCase() === ua.kanji);
        
        if (matchedActual) {
            // Check if romaji and meaning match closely (simple lowercase check)
            const isRomajiCorrect = ua.romaji === matchedActual.romaji.toLowerCase();
            const isMeaningCorrect = ua.meaning === matchedActual.meaning.toLowerCase();

            if (isRomajiCorrect && isMeaningCorrect) {
                corrects.push({ user: ua, actual: matchedActual });
            } else {
                incorrects.push({ user: ua, actual: matchedActual });
            }
            matchedActualIds.add(matchedActual.id);
        } else {
            // Kanji does not belong to this group or doesn't exist
            extras.push({ user: ua });
        }
    });

    // Find Missing
    let missings = compWords.filter(w => !matchedActualIds.has(w.id));

    // Render Feedback
    if (corrects.length > 0) {
        feedbackArea.innerHTML += `<div class="feedback-section-title text-correct"><i class="ph ph-check-circle"></i> Đúng (${corrects.length})</div>`;
        corrects.forEach(c => {
            feedbackArea.innerHTML += `
                <div class="feedback-item status-correct">
                    <div class="feedback-content">
                        <h4>${c.actual.kanji}</h4>
                        <p>${c.actual.meaning}</p>
                        ${c.actual.image ? `<img src="${c.actual.image}" style="max-height: 120px; border-radius: 6px; margin-top: 10px;" />` : ''}
                    </div>
                </div>`;
        });
    }

    if (incorrects.length > 0) {
        feedbackArea.innerHTML += `<div class="feedback-section-title text-incorrect"><i class="ph ph-x-circle"></i> Sai Nghĩa / Romaji (${incorrects.length})</div>`;
        incorrects.forEach(c => {
            feedbackArea.innerHTML += `
                <div class="feedback-item status-incorrect">
                    <div class="feedback-content">
                        <h4>${c.actual.kanji} <span class="text-danger" style="font-size:12px;">(Bạn nhập: ${c.user.romaji} - ${c.user.meaning})</span></h4>
                        <p>Đáp án đúng: <strong>${c.actual.romaji}</strong> - <strong>${c.actual.meaning}</strong></p>
                        ${c.actual.image ? `<img src="${c.actual.image}" style="max-height: 120px; border-radius: 6px; margin-top: 10px;" />` : ''}
                    </div>
                </div>`;
        });
    }

    if (extras.length > 0) {
        feedbackArea.innerHTML += `<div class="feedback-section-title text-extra"><i class="ph ph-info"></i> Thừa / Không thuộc nhóm (${extras.length})</div>`;
        extras.forEach(c => {
            feedbackArea.innerHTML += `
                <div class="feedback-item status-extra">
                    <div class="feedback-content">
                        <h4>${c.user.kanji || '(Trống)'}</h4>
                        <p>Từ này không có trong nhóm hoặc bạn gõ sai Kanji.</p>
                    </div>
                </div>`;
        });
    }

    if (missings.length > 0) {
        feedbackArea.innerHTML += `<div class="feedback-section-title text-missing"><i class="ph ph-warning-circle"></i> Thiếu (${missings.length})</div>`;
        missings.forEach(c => {
            feedbackArea.innerHTML += `
                <div class="feedback-item status-missing">
                    <div class="feedback-content">
                        <h4>${c.kanji} <span class="text-muted" style="font-size:13px; font-weight:normal">(${c.romaji})</span></h4>
                        <p>${c.meaning}</p>
                        ${c.image ? `<img src="${c.image}" style="max-height: 120px; border-radius: 6px; margin-top: 10px;" />` : ''}
                    </div>
                </div>`;
        });
    }

    if (corrects.length === 0 && incorrects.length === 0 && extras.length === 0 && missings.length === 0) {
        // Edge case: Empty group? Should not happen based on filtering, but just in case
        feedbackArea.innerHTML = "<p>Không có dữ liệu để kiểm tra.</p>";
    }

    finishChecking();
}

function finishChecking() {
    // Hide actions, show next button
    document.querySelector('.practice-actions').style.display = 'none';
    document.getElementById('btn-add-practice-row').classList.add('hidden');
    document.getElementById('btn-next-group').classList.remove('hidden');
    document.getElementById('btn-next-group').focus();
    
    // Disable inputs
    document.querySelectorAll('.practice-kanji-input, .practice-romaji-input, .practice-meaning-input').forEach(input => input.disabled = true);
    document.querySelectorAll('.btn-remove-row').forEach(btn => btn.disabled = true);
}

document.getElementById('btn-next-group').addEventListener('click', () => {
    currentPracticeIndex++;
    renderPracticeStep();
});

function showPracticeSummary() {
    document.getElementById('practice-setup').classList.add('hidden');
    document.getElementById('practice-active').classList.add('hidden');
    document.getElementById('practice-summary').classList.remove('hidden');
    if(practiceMode === 'daily') renderDashboard(); // Update dashboard stats
}

document.getElementById('btn-back-home').addEventListener('click', () => {
    navigateTo('dashboard');
});

function checkDailyStatus() {
    const today = new Date().toDateString();
    if (!appData.notifications) appData.notifications = [];
    
    if (appData.punishmentState.lastCheckedDate === today) {
        renderNotifications();
        return;
    }
    
    appData.notifications = [];
    appData.notifications.push({ id: 'task-practice', text: 'Luyện tập Kanji 5 nhóm ngẫu nhiên hôm nay', completed: false });
    appData.notifications.push({ id: 'task-speaking', text: 'Nhập bài Luyện nói mới hôm nay', completed: false });
    
    if (appData.speakingLogs.length > 0) {
        const lastLogDate = new Date(appData.speakingLogs[appData.speakingLogs.length - 1].date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = lastLogDate.toDateString() === today;
        const isYesterday = lastLogDate.toDateString() === yesterday.toDateString();
        
        if (!isToday && !isYesterday) {
            if (appData.punishmentState.active) {
                appData.punishmentState.multiplier *= 2;
            } else {
                appData.punishmentState.active = true;
                appData.punishmentState.multiplier = 1;
            }
        }
    }
    
    if (appData.weeklyGrammarTask.lastCompletedDate) {
        const last = new Date(appData.weeklyGrammarTask.lastCompletedDate);
        const now = new Date();
        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) {
            document.getElementById('weekly-task-banner').classList.remove('hidden');
            appData.notifications.push({ id: 'task-weekly', text: 'Nhiệm vụ tuần: Ôn tập ngữ pháp', completed: false });
        }
    } else {
        const practicedCount = appData.grammars.filter(g => g.practiceCount > 0).length;
        if (practicedCount >= 5) {
             document.getElementById('weekly-task-banner').classList.remove('hidden');
             appData.notifications.push({ id: 'task-weekly', text: 'Nhiệm vụ tuần: Ôn tập ngữ pháp', completed: false });
        }
    }
    
    appData.punishmentState.lastCheckedDate = today;
    saveData();
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!appData.notifications || appData.notifications.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">Hôm nay không có nhiệm vụ nào!</p>';
    } else {
        appData.notifications.forEach(notif => {
            const opacity = notif.completed ? '0.5' : '1';
            const checked = notif.completed ? 'checked' : '';
            list.innerHTML += `
                <div class="stat-card" style="opacity: ${opacity}; display: flex; align-items: center; gap: 16px; padding: 16px; transition: opacity 0.3s;">
                    <input type="checkbox" style="width: 20px; height: 20px; cursor: pointer;" ${checked} onchange="toggleNotification('${notif.id}')">
                    <span style="font-size: 16px; font-weight: 500;">${notif.text}</span>
                </div>
            `;
        });
    }
    
    const badge = document.getElementById('nav-notif-badge');
    if(badge) {
        const uncompleted = (appData.notifications || []).filter(n => !n.completed).length;
        if (uncompleted > 0) {
            badge.textContent = uncompleted;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

window.toggleNotification = function(id) {
    const notif = appData.notifications.find(n => n.id === id);
    if(notif) {
        notif.completed = !notif.completed;
        saveData();
        renderNotifications();
    }
}

// === SPEAKING ===
let currentSpeakingImageBase64 = null;
let speakingTimerInterval = null;
let speakingTimeLeft = 120; // 2 minutes

document.getElementById('speaking-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentSpeakingImageBase64 = e.target.result;
            document.getElementById('speaking-image-preview').style.display = 'block';
            document.getElementById('speaking-image-preview-img').src = currentSpeakingImageBase64;
        };
        reader.readAsDataURL(file);
    } else {
        currentSpeakingImageBase64 = null;
        document.getElementById('speaking-image-preview').style.display = 'none';
        document.getElementById('speaking-image-preview-img').src = '';
    }
});

document.getElementById('speaking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('speaking-text').value.trim();
    if (!text || !currentSpeakingImageBase64) return;
    
    const today = new Date().toDateString();
    appData.speakingLogs.push({
        id: generateId(),
        date: today,
        text: text,
        image: currentSpeakingImageBase64,
        practiceCount: 0
    });
    saveData();
    
    alert('Lưu bài nói thành công!');
    e.target.reset();
    currentSpeakingImageBase64 = null;
    document.getElementById('speaking-image-preview').style.display = 'none';
    document.getElementById('speaking-image-preview-img').src = '';
    
    switchSpeakingTab('speaking-gallery');
});

let currentPracticeSpeakingId = null;
let currentSpeakingRetryCount = 0;

window.switchSpeakingTab = function(tabId) {
    document.querySelectorAll('.speaking-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    document.querySelectorAll('#speaking-tab-buttons button').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    });
    const eventBtn = event ? event.currentTarget : document.querySelector(`[onclick="switchSpeakingTab('${tabId}')"]`);
    if(eventBtn) {
        eventBtn.classList.remove('btn-secondary');
        eventBtn.classList.add('btn-primary');
    }
    
    if (tabId === 'speaking-gallery') renderSpeakingGallery();
}

function renderSpeakingGallery() {
    const grid = document.getElementById('speaking-logs-grid');
    grid.innerHTML = '';
    
    if (appData.speakingLogs.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center;">Chưa có bài nói nào được lưu.</p>';
        return;
    }
    
    appData.speakingLogs.forEach((log, index) => {
        grid.innerHTML += `
            <div class="stat-card clickable" style="position: relative; flex-direction: column; align-items: stretch; text-align: center; padding: 16px;" onclick="openSpeakingPractice('${log.id}')">
                <button class="btn btn-secondary btn-small" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.9); color: var(--danger); padding: 4px; border: none;" onclick="deleteSpeakingLog('${log.id}', event)" title="Xóa bài nói này">
                    <i class="ph ph-trash"></i>
                </button>
                <img src="${log.image}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; box-shadow: var(--shadow-sm);" />
                <h3 style="margin-bottom: 4px;">Ngày ${index + 1} (${log.date})</h3>
                <p class="text-muted" style="font-size: 0.9rem;">Đã luyện lại: ${log.practiceCount || 0} lần</p>
            </div>
        `;
    });
}

window.deleteSpeakingLog = function(logId, event) {
    event.stopPropagation();
    if (confirm("Bạn có chắc muốn xóa bài nói này không? Hành động này không thể hoàn tác.")) {
        appData.speakingLogs = appData.speakingLogs.filter(l => l.id !== logId);
        saveData();
        renderSpeakingGallery();
    }
}

window.openSpeakingPractice = function(logId) {
    const log = appData.speakingLogs.find(l => l.id === logId);
    if (!log) return;
    
    currentPracticeSpeakingId = logId;
    currentSpeakingRetryCount = 0;
    
    document.getElementById('speaking-gallery').classList.add('hidden');
    document.getElementById('speaking-add').classList.add('hidden');
    document.getElementById('speaking-tab-buttons').classList.add('hidden');
    document.getElementById('speaking-practice-area').classList.remove('hidden');
    
    document.getElementById('practice-mindmap-img').src = log.image;
    document.getElementById('speaking-result-text').textContent = log.text;
    document.getElementById('speaking-result-text').classList.add('hidden');
    
    // Reset buttons
    document.getElementById('btn-start-speaking').classList.remove('hidden');
    document.getElementById('btn-retry-speaking').classList.add('hidden');
    document.getElementById('btn-finish-speaking').classList.add('hidden');
    document.getElementById('btn-finish-speaking').disabled = false;
    document.getElementById('btn-finish-speaking').innerHTML = '<i class="ph ph-check-circle"></i> Đã mượt';
    
    speakingTimeLeft = 120;
    updateSpeakingTimerDisplay();
    clearInterval(speakingTimerInterval);
}

window.closeSpeakingPractice = function() {
    document.getElementById('speaking-practice-area').classList.add('hidden');
    document.getElementById('speaking-tab-buttons').classList.remove('hidden');
    clearInterval(speakingTimerInterval);
    switchSpeakingTab('speaking-gallery');
}

function updateSpeakingTimerDisplay() {
    const m = Math.floor(speakingTimeLeft / 60).toString().padStart(2, '0');
    const s = (speakingTimeLeft % 60).toString().padStart(2, '0');
    document.getElementById('speaking-timer').textContent = `${m}:${s}`;
}

document.getElementById('btn-start-speaking').addEventListener('click', () => {
    document.getElementById('btn-start-speaking').classList.add('hidden');
    document.getElementById('btn-retry-speaking').classList.remove('hidden');
    document.getElementById('btn-finish-speaking').classList.remove('hidden');
    
    speakingTimeLeft = 120;
    updateSpeakingTimerDisplay();
    clearInterval(speakingTimerInterval);
    speakingTimerInterval = setInterval(() => {
        speakingTimeLeft--;
        updateSpeakingTimerDisplay();
        if (speakingTimeLeft <= 0) {
            clearInterval(speakingTimerInterval);
        }
    }, 1000);
});

document.getElementById('btn-retry-speaking').addEventListener('click', () => {
    currentSpeakingRetryCount++;
    const log = appData.speakingLogs.find(l => l.id === currentPracticeSpeakingId);
    if(log) {
        log.practiceCount = (log.practiceCount || 0) + 1;
        saveData();
    }
    
    // Reset buttons and timer just like start
    document.getElementById('btn-start-speaking').classList.remove('hidden');
    document.getElementById('btn-retry-speaking').classList.add('hidden');
    document.getElementById('btn-finish-speaking').classList.add('hidden');
    document.getElementById('btn-finish-speaking').disabled = false;
    document.getElementById('btn-finish-speaking').innerHTML = '<i class="ph ph-check-circle"></i> Đã mượt';
    document.getElementById('speaking-result-text').classList.add('hidden');
    
    speakingTimeLeft = 120;
    updateSpeakingTimerDisplay();
    clearInterval(speakingTimerInterval);
    
    if (currentSpeakingRetryCount >= 3) {
        document.getElementById('speaking-result-text').classList.remove('hidden');
    }
});

document.getElementById('btn-finish-speaking').addEventListener('click', () => {
    clearInterval(speakingTimerInterval);
    document.getElementById('speaking-result-text').classList.remove('hidden');
    document.getElementById('btn-finish-speaking').disabled = true;
    document.getElementById('btn-finish-speaking').innerHTML = '<i class="ph ph-check"></i> Đã hoàn thành';
});

// === GRAMMAR ===
function switchGrammarTab(tabId) {
    document.querySelectorAll('.grammar-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    document.querySelectorAll('#grammar-tab-buttons button').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    });
    const eventBtn = event ? event.currentTarget : document.querySelector(`[onclick="switchGrammarTab('${tabId}')"]`);
    if(eventBtn) {
        eventBtn.classList.remove('btn-secondary');
        eventBtn.classList.add('btn-primary');
    }
    
    if (tabId === 'grammar-add') renderGrammarGroupSelect();
    if (tabId === 'grammar-list') renderGrammarList();
    if (tabId === 'grammar-random') loadRandomGrammarPractice();
}

function renderGrammarGroupSelect() {
    const select = document.getElementById('grammar-group-select');
    select.innerHTML = '';
    appData.grammarGroups.forEach(g => {
        select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
    if (appData.grammarGroups.length === 0) {
        select.innerHTML = '<option value="" disabled selected>Vui lòng tạo nhóm ngữ pháp trước</option>';
    }
}

document.getElementById('add-grammar-group-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('grammar-group-name').value.trim();
    const color = document.getElementById('grammar-group-color').value;
    if (!name) return;
    
    appData.grammarGroups.push({
        id: generateId(),
        name,
        color
    });
    saveData();
    e.target.reset();
    alert('Đã tạo nhóm ngữ pháp thành công!');
});

document.getElementById('add-grammar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const groupId = document.getElementById('grammar-group-select').value;
    const structure = document.getElementById('grammar-structure').value.trim();
    const example = document.getElementById('grammar-example').value.trim();
    const translation = document.getElementById('grammar-translation').value.trim();
    const explanation = document.getElementById('grammar-explanation').value.trim();
    
    if (!groupId || !structure || !example || !translation) return;
    
    appData.grammars.push({
        id: generateId(),
        groupId,
        structure,
        example,
        translation,
        explanation,
        practiceCount: 0
    });
    saveData();
    e.target.reset();
    alert('Đã thêm ngữ pháp thành công!');
});

function renderGrammarList() {
    const grid = document.getElementById('grammar-groups-grid');
    grid.innerHTML = '';
    
    if (appData.grammarGroups.length === 0) {
        grid.innerHTML = '<p>Chưa có nhóm ngữ pháp nào.</p>';
        return;
    }
    
    appData.grammarGroups.forEach(g => {
        const count = appData.grammars.filter(gr => gr.groupId === g.id).length;
        grid.innerHTML += `
            <div class="stat-card clickable" style="border-left: 4px solid ${g.color};" onclick="openGrammarTable('${g.id}')">
                <div class="stat-info">
                    <h3>${g.name}</h3>
                    <p>${count} mẫu câu</p>
                </div>
            </div>
        `;
    });
}

function openGrammarTable(groupId) {
    const group = appData.grammarGroups.find(g => g.id === groupId);
    if (!group) return;
    
    document.getElementById('grammar-groups-grid').classList.add('hidden');
    document.getElementById('grammar-items-table-container').classList.remove('hidden');
    document.getElementById('grammar-table-title').textContent = `Nhóm: ${group.name}`;
    
    const tbody = document.getElementById('grammar-items-tbody');
    tbody.innerHTML = '';
    
    const items = appData.grammars.filter(g => g.groupId === groupId);
    items.forEach((item, index) => {
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px; font-weight: bold; color: var(--primary);">${item.structure}</td>
                <td style="padding: 10px;">${item.example}</td>
                <td style="padding: 10px;">${item.translation}</td>
                <td style="padding: 10px;" class="text-muted">${item.explanation || '--'}</td>
                <td style="padding: 10px;">${item.practiceCount} lần</td>
                <td style="padding: 10px;">
                    <button class="btn btn-primary btn-small" onclick="startSingleGrammarPractice('${item.id}')">Luyện tập</button>
                </td>
            </tr>
        `;
    });
}

function closeGrammarTable() {
    document.getElementById('grammar-items-table-container').classList.add('hidden');
    document.getElementById('grammar-groups-grid').classList.remove('hidden');
}

// Single Grammar Practice
let currentSGPItem = null;
let currentSGPWords = [];

function startSingleGrammarPractice(grammarId) {
    const item = appData.grammars.find(g => g.id === grammarId);
    if (!item) return;
    currentSGPItem = item;
    
    document.getElementById('grammar-items-table-container').classList.add('hidden');
    document.getElementById('single-grammar-practice').classList.remove('hidden');
    document.getElementById('sgp-structure').textContent = item.structure;
    
    // Pick 5 random words
    const validWords = appData.words.filter(w => w.kanji && w.meaning);
    const shuffled = validWords.sort(() => 0.5 - Math.random());
    currentSGPWords = shuffled.slice(0, 5);
    
    const wordsContainer = document.getElementById('sgp-words-container');
    wordsContainer.innerHTML = '';
    const inputsContainer = document.getElementById('sgp-inputs-container');
    inputsContainer.innerHTML = '';
    
    currentSGPWords.forEach((w, index) => {
        wordsContainer.innerHTML += `
            <div class="stat-card" style="padding: 10px; text-align: center;">
                <h4 style="font-size: 1.2rem; color: var(--text-main); margin-bottom: 5px;">${w.kanji}</h4>
                <p style="font-size: 0.9rem; color: var(--text-muted);">${w.meaning}</p>
            </div>
        `;
        
        inputsContainer.innerHTML += `
            <div class="form-group">
                <label>Câu ${index + 1} (với từ ${w.kanji})</label>
                <input type="text" class="sgp-input" required autocomplete="off">
            </div>
        `;
    });
}

function closeSingleGrammarPractice() {
    document.getElementById('single-grammar-practice').classList.add('hidden');
    document.getElementById('grammar-items-table-container').classList.remove('hidden');
}

document.getElementById('sgp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentSGPItem) {
        currentSGPItem.practiceCount++;
        saveData();
        alert('Chúc mừng! Bạn đã hoàn thành luyện tập mẫu câu này.');
        closeSingleGrammarPractice();
        openGrammarTable(currentSGPItem.groupId);
    }
});

// Random Grammar Practice
let currentRandomGrammars = [];
let currentRandomWords = [];

window.loadRandomGrammarPractice = function() {
    const grammars = appData.grammars.filter(g => g.structure);
    const words = appData.words.filter(w => w.kanji && w.meaning);
    
    if (grammars.length === 0 || words.length === 0) {
        alert('Chưa đủ dữ liệu từ vựng hoặc ngữ pháp để luyện tập ngẫu nhiên.');
        return;
    }
    
    const shuffledG = [...grammars].sort(() => 0.5 - Math.random());
    currentRandomGrammars = shuffledG.slice(0, 5);
    
    const shuffledW = [...words].sort(() => 0.5 - Math.random());
    currentRandomWords = shuffledW.slice(0, 5);
    
    const gList = document.getElementById('random-grammars-list');
    gList.innerHTML = currentRandomGrammars.map(g => `<li><strong>${g.structure}</strong>: ${g.translation}</li>`).join('');
    
    const wGrid = document.getElementById('random-words-grid');
    wGrid.innerHTML = currentRandomWords.map(w => `
        <div class="stat-card" style="padding: 10px; text-align: center;">
            <div style="font-size: 1.2rem; color: var(--text-main);">${w.kanji}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${w.meaning}</div>
        </div>
    `).join('');
    
    document.getElementById('random-grammar-form').reset();
}

document.getElementById('random-grammar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    currentRandomGrammars.forEach(g => {
        g.practiceCount++;
    });
    saveData();
    alert('Nộp bài thành công! Các mẫu câu đã được cộng lượt luyện tập.');
    loadRandomGrammarPractice();
});

// Weekly Task Modal (Mockup logic)
window.openWeeklyTaskModal = function() {
    alert('Chức năng kiểm tra tuần: Chức năng này sẽ được triển khai chi tiết sau. Bạn vừa nhấn vào nhiệm vụ tuần!');
    // For now just hide it and set completed
    document.getElementById('weekly-task-banner').classList.add('hidden');
    appData.weeklyGrammarTask.lastCompletedDate = new Date().toDateString();
    saveData();
}

// === INIT ===
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(e.currentTarget.dataset.target, { fromSidebar: true });
    });
});

// Start app
async function initApp() {
    await loadData();
    checkDailyStatus();
    if(appData.speakingLogs.length > 0) {
        switchSpeakingTab('speaking-gallery');
    } else {
        switchSpeakingTab('speaking-add');
    }
    navigateTo('dashboard');
}

initApp();
