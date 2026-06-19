// === STATE MANAGEMENT ===
let appData = {
    components: [], // { id, name, phonetic, meaning }
    words: [],      // { id, componentId, kanji, romaji, meaning }
    practiceState: {
        lastDate: null,
        dailyComponentIds: [], 
        completed: false
    }
};

let practiceMode = 'daily'; // 'daily' or 'single'

// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem("appData");
    if (saved) {
        appData = JSON.parse(saved);
        // Ensure backwards compatibility
        appData.components.forEach(c => {
            if (c.phonetic === undefined) c.phonetic = '';
            if (c.meaning === undefined) c.meaning = '';
        });
        appData.words.forEach(w => {
            if (w.romaji === undefined) w.romaji = '';
        });
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem("appData", JSON.stringify(appData));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// === NAVIGATION ===
const pages = ['dashboard', 'groups', 'add-word', 'practice', 'dictionary'];
const pageTitles = {
    'dashboard': 'Tổng quan',
    'groups': 'Quản lý Nhóm',
    'add-word': 'Thêm từ mới',
    'practice': 'Luyện tập',
    'dictionary': 'Từ điển'
};

function navigateTo(pageId) {
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

// === GROUPS MANAGEMENT ===
document.getElementById('add-group-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name-input').value.trim();
    const phonetic = document.getElementById('group-phonetic-input').value.trim();
    const meaning = document.getElementById('group-meaning-input').value.trim();

    if (!name) return;

    let comp = appData.components.find(c => c.name === name);
    if (comp) {
        // Update existing if created previously without info
        comp.phonetic = phonetic;
        comp.meaning = meaning;
    } else {
        appData.components.push({
            id: generateId(),
            name,
            phonetic,
            meaning
        });
    }

    saveData();
    renderGroups();
    
    e.target.reset();
    const msg = document.getElementById('add-group-success-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
});

function renderGroups() {
    const list = document.getElementById('groups-list');
    list.innerHTML = '';
    
    if (appData.components.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="ph ph-folder"></i><p>Chưa có nhóm nào được tạo.</p></div>';
        return;
    }

    appData.components.forEach(comp => {
        const wordCount = appData.words.filter(w => w.componentId === comp.id).length;
        
        list.innerHTML += `
            <div class="group-item-card">
                <div class="group-item-header">
                    <div class="group-item-kanji">${comp.name}</div>
                    <div class="group-item-info">
                        <div class="group-item-phonetic">Âm: ${comp.phonetic || '--'}</div>
                        <div class="group-item-meaning">Nghĩa: ${comp.meaning || '--'}</div>
                        <div class="text-muted" style="font-size: 13px; margin-top: 4px;">${wordCount} từ vựng</div>
                    </div>
                </div>
                <div class="group-item-actions">
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

document.addEventListener('click', (e) => {
    if (e.target !== componentInput) suggestionsList.classList.add('hidden');
});

addWordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const compName = document.getElementById('component-input').value.trim();
    const kanji = document.getElementById('kanji-input').value.trim();
    const romaji = document.getElementById('romaji-input').value.trim();
    const meaning = document.getElementById('meaning-input').value.trim();

    if (!compName || !kanji || !romaji || !meaning) return;

    let comp = appData.components.find(c => c.name === compName);
    if (!comp) {
        comp = { id: generateId(), name: compName, phonetic: '', meaning: '' };
        appData.components.push(comp);
    }

    appData.words.push({
        id: generateId(),
        componentId: comp.id,
        kanji,
        romaji,
        meaning
    });

    saveData();

    addWordForm.reset();
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
                        ${comp.phonetic ? `[${comp.phonetic}]` : ''} ${comp.meaning}
                    </span>
                    <span class="badge">${filteredWords.length} từ</span>
                </div>
                <div class="dict-words">
                    ${filteredWords.map(w => `
                        <div class="dict-word-card">
                            <div class="dict-kanji">${w.kanji}</div>
                            <div class="dict-romaji">${w.romaji}</div>
                            <div class="dict-meaning">${w.meaning}</div>
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

// === PRACTICE LOGIC ===
let currentPracticeIndex = 0;
let currentPracticeComponent = null;

function initPracticeView() {
    practiceMode = 'daily';
    const today = new Date().toDateString();
    
    if (appData.practiceState.lastDate !== today) {
        const validComponents = appData.components.filter(c => appData.words.some(w => w.componentId === c.id));
        const shuffled = validComponents.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5).map(c => c.id);
        
        appData.practiceState = {
            lastDate: today,
            dailyComponentIds: selected,
            completed: false
        };
        saveData();
    }

    if (appData.practiceState.dailyComponentIds.length === 0) {
        document.getElementById('practice-setup').innerHTML = '<div class="card text-center"><h2>Chưa có dữ liệu</h2><p>Hãy thêm từ vựng trước khi luyện tập nhé.</p></div>';
        return;
    }

    document.getElementById('btn-start-practice').textContent = 'Bắt đầu 5 Nhóm Ngẫu Nhiên';

    if (appData.practiceState.completed) {
        showPracticeSummary();
    } else {
        document.getElementById('practice-setup').classList.remove('hidden');
        document.getElementById('practice-active').classList.add('hidden');
        document.getElementById('practice-summary').classList.add('hidden');
    }
}

document.getElementById('btn-start-practice').addEventListener('click', () => {
    document.getElementById('practice-setup').classList.add('hidden');
    document.getElementById('practice-active').classList.remove('hidden');
    currentPracticeIndex = 0;
    renderPracticeStep();
});

document.getElementById('btn-start-practice-dash').addEventListener('click', () => {
    practiceMode = 'daily';
    navigateTo('practice');
    if (!appData.practiceState.completed && appData.practiceState.dailyComponentIds.length > 0) {
        document.getElementById('btn-start-practice').click();
    }
});

document.getElementById('btn-retry-practice').addEventListener('click', () => {
    // Retry daily practice
    if(practiceMode === 'daily') {
        appData.practiceState.completed = false;
        saveData();
        initPracticeView();
        document.getElementById('btn-start-practice').click();
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
        `Phiên âm: ${currentPracticeComponent.phonetic || '--'} | Nghĩa: ${currentPracticeComponent.meaning || '--'}`;
    
    if (practiceMode === 'single') {
        document.getElementById('practice-progress-container').classList.add('hidden');
    } else {
        document.getElementById('practice-progress-container').classList.remove('hidden');
        document.getElementById('current-group-index').textContent = currentPracticeIndex + 1;
        document.getElementById('total-groups-index').textContent = appData.practiceState.dailyComponentIds.length;
        const progressPercent = ((currentPracticeIndex) / appData.practiceState.dailyComponentIds.length) * 100;
        document.getElementById('practice-progress').style.width = `${progressPercent}%`;
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

// === INIT ===
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(e.currentTarget.dataset.target);
    });
});

// Start app
loadData();
navigateTo('dashboard');
