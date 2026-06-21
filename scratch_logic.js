function checkDailyStatus() {
    const today = new Date().toDateString();
    if (appData.punishmentState.lastCheckedDate === today) return;
    
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
        }
    } else {
        const practicedCount = appData.grammars.filter(g => g.practiceCount > 0).length;
        if (practicedCount >= 5) {
             document.getElementById('weekly-task-banner').classList.remove('hidden');
        }
    }
    
    appData.punishmentState.lastCheckedDate = today;
    saveData();
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
        image: currentSpeakingImageBase64
    });
    saveData();
    
    renderSpeakingView();
});

function renderSpeakingView() {
    const today = new Date().toDateString();
    const todaysLog = appData.speakingLogs.find(l => new Date(l.date).toDateString() === today);
    
    if (todaysLog) {
        document.getElementById('speaking-form').parentElement.style.display = 'none';
        document.getElementById('speaking-practice-area').style.display = 'block';
        document.getElementById('practice-mindmap-img').src = todaysLog.image;
        document.getElementById('speaking-result-text').textContent = todaysLog.text;
    } else {
        document.getElementById('speaking-form').parentElement.style.display = 'block';
        document.getElementById('speaking-practice-area').style.display = 'none';
    }
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
