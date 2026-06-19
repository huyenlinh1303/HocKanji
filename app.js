// === STATE MANAGEMENT ===
let appData = {
    components: [], // { id, name }
    words: [],      // { id, componentId, kanji, meaning }
    practiceState: {
        lastDate: null,
        dailyComponentIds: [], // IDs of components to practice today
        completed: false
    }
};

// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem("appData");
    if (saved) {
        appData = JSON.parse(saved);
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
const pages = ['dashboard', 'add-word', 'practice', 'dictionary'];
const pageTitles = {
    'dashboard': 'Tổng quan',
    'add-word': 'Thêm từ mới',
    'practice': 'Luyện tập',
    'dictionary': 'Từ điển'
};

function navigateTo(pageId) {
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === pageId) {
            link.classList.add('active');
        }
    });

    // Update active section
    pages.forEach(p => {
        document.getElementById(p).classList.add('hidden');
        document.getElementById(p).classList.remove('active');
    });
    const activeSection = document.getElementById(pageId);
    activeSection.classList.remove('hidden');
    
    // Trigger animation
    requestAnimationFrame(() => {
        activeSection.classList.add('active');
    });

    // Update title
    document.getElementById('page-title').textContent = pageTitles[pageId];

    // Page specific initialization
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'dictionary') renderDictionary();
    if (pageId === 'practice') initPracticeView();
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

// === ADD WORD ===
const componentInput = document.getElementById('component-input');
const suggestionsList = document.getElementById('component-suggestions');
const addWordForm = document.getElementById('add-word-form');
const addSuccessMsg = document.getElementById('add-success-msg');

// Suggestion logic
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
            div.textContent = c.name;
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

// Hide suggestions on outside click
document.addEventListener('click', (e) => {
    if (e.target !== componentInput) {
        suggestionsList.classList.add('hidden');
    }
});

// Handle form submit
addWordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const compName = document.getElementById('component-input').value.trim();
    const kanji = document.getElementById('kanji-input').value.trim();
    const meaning = document.getElementById('meaning-input').value.trim();

    if (!compName || !kanji || !meaning) return;

    // Find or create component
    let comp = appData.components.find(c => c.name === compName);
    if (!comp) {
        comp = { id: generateId(), name: compName };
        appData.components.push(comp);
    }

    // Add word
    appData.words.push({
        id: generateId(),
        componentId: comp.id,
        kanji: kanji,
        meaning: meaning
    });

    saveData();
    renderDashboard();

    // Reset form & show success
    addWordForm.reset();
    addSuccessMsg.classList.remove('hidden');
    setTimeout(() => {
        addSuccessMsg.classList.add('hidden');
    }, 3000);
});

// === DICTIONARY ===
function renderDictionary() {
    const container = document.getElementById('dictionary-list');
    container.innerHTML = '';

    if (appData.components.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-books"></i><p>Bạn chưa thêm từ vựng nào.</p></div>';
        return;
    }

    const searchTerm = document.getElementById('search-dict').value.toLowerCase();

    appData.components.forEach(comp => {
        const compWords = appData.words.filter(w => w.componentId === comp.id);
        
        // Filter by search term
        const filteredWords = compWords.filter(w => 
            w.kanji.toLowerCase().includes(searchTerm) || 
            w.meaning.toLowerCase().includes(searchTerm) ||
            comp.name.toLowerCase().includes(searchTerm)
        );

        if (filteredWords.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'dict-group';
        
        groupDiv.innerHTML = `
            <div class="dict-group-title">
                ${comp.name} <span class="badge">${compWords.length} từ</span>
            </div>
            <div class="dict-words">
                ${filteredWords.map(w => `
                    <div class="dict-word-card">
                        <div class="dict-kanji">${w.kanji}</div>
                        <div class="dict-meaning">${w.meaning}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(groupDiv);
    });
}

document.getElementById('search-dict').addEventListener('input', renderDictionary);

// === PRACTICE LOGIC ===
let currentPracticeIndex = 0;
let currentPracticeComponent = null;

function initPracticeView() {
    const today = new Date().toDateString();
    
    // Check if we need to generate new practice session
    if (appData.practiceState.lastDate !== today) {
        // Need to pick up to 5 components that have words
        const validComponents = appData.components.filter(c => appData.words.some(w => w.componentId === c.id));
        
        // Shuffle and pick 5
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
    navigateTo('practice');
    if (!appData.practiceState.completed && appData.practiceState.dailyComponentIds.length > 0) {
        document.getElementById('btn-start-practice').click();
    }
});

function renderPracticeStep() {
    if (currentPracticeIndex >= appData.practiceState.dailyComponentIds.length) {
        appData.practiceState.completed = true;
        saveData();
        showPracticeSummary();
        return;
    }

    const compId = appData.practiceState.dailyComponentIds[currentPracticeIndex];
    currentPracticeComponent = appData.components.find(c => c.id === compId);
    const compWords = appData.words.filter(w => w.componentId === compId);

    // Update UI
    document.getElementById('practice-component-display').textContent = currentPracticeComponent.name;
    document.getElementById('current-group-index').textContent = currentPracticeIndex + 1;
    document.getElementById('total-groups-index').textContent = appData.practiceState.dailyComponentIds.length;
    
    const progressPercent = ((currentPracticeIndex) / appData.practiceState.dailyComponentIds.length) * 100;
    document.getElementById('practice-progress').style.width = `${progressPercent}%`;

    // Render inputs
    const container = document.getElementById('practice-inputs-container');
    container.innerHTML = '';
    
    for (let i = 0; i < compWords.length; i++) {
        container.innerHTML += `
            <div class="practice-row">
                <input type="text" class="practice-kanji-input" placeholder="Từ Kanji ${i+1}" required autocomplete="off">
                <input type="text" class="practice-meaning-input" placeholder="Nghĩa ${i+1}" required autocomplete="off">
            </div>
        `;
    }

    // Reset feedback
    document.getElementById('practice-feedback').classList.add('hidden');
    document.getElementById('btn-next-group').classList.add('hidden');
    
    // Show buttons
    document.querySelector('.practice-actions').style.display = 'flex';
    document.getElementById('practice-form').reset();
    
    // Focus first input
    setTimeout(() => {
        const firstInput = container.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 100);
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
    const meaningInputs = document.querySelectorAll('.practice-meaning-input');
    
    const userAnswers = [];
    for (let i = 0; i < kanjiInputs.length; i++) {
        userAnswers.push({
            kanji: kanjiInputs[i].value.trim().toLowerCase(),
            meaning: meaningInputs[i].value.trim().toLowerCase()
        });
    }

    const feedbackArea = document.getElementById('practice-feedback');
    feedbackArea.innerHTML = '<h3>Kết quả:</h3>';
    feedbackArea.classList.remove('hidden');

    let correctCount = 0;
    
    // To check without order mattering, we track matched actual words
    const matchedIndices = new Set();

    compWords.forEach(actualWord => {
        let isCorrect = false;
        
        if (!skipped) {
            // Find a matching user answer that hasn't been used yet
            for (let i = 0; i < userAnswers.length; i++) {
                if (matchedIndices.has(i)) continue;
                
                const ua = userAnswers[i];
                // basic matching
                if (ua.kanji === actualWord.kanji.toLowerCase()) {
                    isCorrect = true;
                    matchedIndices.add(i);
                    break;
                }
            }
        }

        if (isCorrect) {
            correctCount++;
            feedbackArea.innerHTML += `
                <div class="feedback-item status-correct">
                    <i class="ph-fill ph-check-circle status-icon"></i>
                    <div class="feedback-content">
                        <h4>${actualWord.kanji}</h4>
                        <p>${actualWord.meaning}</p>
                    </div>
                </div>
            `;
        } else {
            feedbackArea.innerHTML += `
                <div class="feedback-item ${skipped ? 'status-missed' : 'status-incorrect'}">
                    <i class="ph-fill ${skipped ? 'ph-warning-circle' : 'ph-x-circle'} status-icon"></i>
                    <div class="feedback-content">
                        <h4>${actualWord.kanji} (Bỏ lỡ / Sai)</h4>
                        <p>Nghĩa: ${actualWord.meaning}</p>
                    </div>
                </div>
            `;
        }
    });

    // Hide submit/skip buttons, show next button
    document.querySelector('.practice-actions').style.display = 'none';
    document.getElementById('btn-next-group').classList.remove('hidden');
    document.getElementById('btn-next-group').focus();
    
    // Disable inputs
    kanjiInputs.forEach(input => input.disabled = true);
    meaningInputs.forEach(input => input.disabled = true);
}

document.getElementById('btn-next-group').addEventListener('click', () => {
    currentPracticeIndex++;
    renderPracticeStep();
});

function showPracticeSummary() {
    document.getElementById('practice-setup').classList.add('hidden');
    document.getElementById('practice-active').classList.add('hidden');
    document.getElementById('practice-summary').classList.remove('hidden');
    renderDashboard(); // Update dashboard stats (completed status)
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
