let sessionList = loadSessionList();
let activeSessionId = sessionStorage.getItem('activeSessionId');
let session = sessionList.find(s => s.id === activeSessionId);
let questions = session ? session.data.questions : [];
let userAnswers = session ? session.data.userAnswers : {};
let currentIndex = 0;
let slideDirection = ''; 

if (!session || session.completed) { window.location.href = 'index.html'; }

window.onload = () => {
    document.getElementById('sidebar-title').innerText = session.subject || "학습 목록";
    document.getElementById('sidebar-subtitle').innerText = session.title;
    renderSidebar(); renderProgressBar(); updateDisplay();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            
            // 다음 문제로 넘어가기 전, 현재 입력칸의 포커스를 해제하여 onchange 이벤트를 강제로 발생시킴
            if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                document.activeElement.blur();
            }
            
            if (currentIndex < questions.length - 1) moveQuestion(1);
            else document.getElementById('final-submit-btn').focus();
            return;
        }

        // 입력칸에 포커스가 있을 때는 숫자 단축키 무시 (단답/서술형 입력 중 오작동 방지)
        if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        // 객관식 숫자 키보드 선택 로직 (1~9)
        const q = questions[currentIndex];
        if (q && q.type === 'SEL') {
            const keyNum = parseInt(e.key, 10);
            if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
                const optIndex = keyNum - 1; // 1번 키는 배열의 0번째 요소
                // 존재하는 선택지 개수 내에서만 동작
                if (optIndex < q.options.length) {
                    e.preventDefault();
                    selectOption(q.options[optIndex], q.id);
                }
            }
        }
    });
};

function renderSidebar() {
    const list = document.getElementById('question-list');
    list.innerHTML = '';
    questions.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'sidebar-item'; div.id = `side-item-${i}`;
        let pts = q.score !== undefined ? `<span style="font-size:0.75rem; color:var(--primary); background:var(--primary-container); padding:2px 6px; border-radius:10px; margin-left:4px;">${q.score}점</span>` : "";
        div.onclick = () => { slideDirection = i > currentIndex ? 'slide-left' : 'slide-right'; currentIndex = i; updateDisplay(); toggleSidebar(false); };
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div>${i+1}. ${q.type==='SEN'?'[서술형] ':' '}${q.text.substring(0, 10)}...${pts}</div><span id="side-ans-${i}" style="font-size:0.8rem; color:var(--secondary);"></span></div>`;
        list.appendChild(div);
    });
    updateSidebarStatus();
}

function updateSidebarStatus() {
    questions.forEach((q, i) => {
        const item = document.getElementById(`side-item-${i}`);
        if(i === currentIndex) item.classList.add('active'); else item.classList.remove('active');
        const ansSpan = document.getElementById(`side-ans-${i}`);
        const uAns = userAnswers[q.id];
        if (uAns && uAns.trim() !== '') { ansSpan.innerHTML = '●'; ansSpan.style.color = 'var(--primary)'; } 
        else { ansSpan.innerHTML = '○'; ansSpan.style.color = 'var(--border)'; }
    });
}

window.toggleHint = function() { document.getElementById('q-hint-box').classList.toggle('hide'); };

function updateDisplay() {
    const q = questions[currentIndex];
    const wrapper = document.getElementById('quiz-wrapper');
    wrapper.innerHTML = '';
    const card = document.createElement('div'); card.className = `card ${slideDirection}`; slideDirection = ''; 

    let qScore = q.score !== undefined ? `<span style="font-size: 0.9rem; font-weight: 500; color: var(--primary); background: var(--primary-container); padding: 4px 10px; border-radius: 12px; vertical-align: middle; margin-left: 8px;">배점 ${q.score}점</span>` : "";
    let html = `<div class="q-text">${q.text} ${qScore}</div>`;
    
    if (q.hint) html += `<div style="margin-bottom: 20px;"><button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" onclick="toggleHint()">💡 힌트 보기</button><div id="q-hint-box" class="hide" style="margin-top: 12px; padding: 16px; background: #fff8c5; border: 1px solid #e1c841; border-radius: 8px; font-size: 0.95rem; color: #4d4411;">${q.hint}</div></div>`;

    if (q.type === 'SEL') {
        html += `<div class="options-grid">`;
        q.options.forEach((opt, i) => { 
            const isSel = userAnswers[q.id] === opt; 
            const safeOpt = opt.replace(/'/g, "\\'"); // 싱글쿼터 이스케이프 처리
            html += `<button class="option-btn ${isSel ? 'selected' : ''}" onclick="selectOption('${safeOpt}', '${q.id}')">${i+1}. ${opt}</button>`; 
        });
        html += `</div>`;
    } else {
        const val = userAnswers[q.id] || '';
        // 고유 문제 ID(q.id)를 직접 전달하여 인덱스 변화로 인한 오류를 방지
        if(q.type === 'SEN') html += `<textarea class="input-field" rows="5" placeholder="답안을 서술하세요..." onchange="saveTextAns(this.value, '${q.id}')">${val}</textarea>`;
        else html += `<input type="text" class="input-field" placeholder="정답을 입력하세요..." value="${val}" onchange="saveTextAns(this.value, '${q.id}')">`;
    }
    card.innerHTML = html; wrapper.appendChild(card);
    
    document.getElementById('q-counter').innerText = `문제 ${currentIndex + 1} / ${questions.length}`;
    document.getElementById('q-type-badge').innerText = typeLabels[q.type];
    
    document.getElementById('prev-btn').disabled = currentIndex === 0;
    if (currentIndex === questions.length - 1) { document.getElementById('next-btn').classList.add('hide'); document.getElementById('final-submit-btn').classList.remove('hide'); } 
    else { document.getElementById('next-btn').classList.remove('hide'); document.getElementById('final-submit-btn').classList.add('hide'); }
    
    updateSidebarStatus(); renderProgressBar();

    // 텍스트 입력칸이 있는 경우 화면 전환 후 자동으로 포커스 이동
    const inputEl = card.querySelector('.input-field');
    if (inputEl) {
        setTimeout(() => {
            inputEl.focus();
            // 기존 답안이 있을 경우 커서를 텍스트 맨 끝으로 이동
            if (inputEl.value) {
                inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
            }
        }, 100);
    }
}

// 명시적인 ID를 받아 해당 문제의 답안으로 저장
window.selectOption = function(val, qId) { 
    const targetId = qId || questions[currentIndex].id;
    userAnswers[targetId] = val; 
    updateDisplay(); 
};

// 명시적인 ID를 받아 해당 문제의 답안으로 저장
window.saveTextAns = function(val, qId) { 
    const targetId = qId || questions[currentIndex].id;
    userAnswers[targetId] = val; 
    updateSidebarStatus(); 
};

window.moveQuestion = function(dir) {
    const newIdx = currentIndex + dir;
    if (newIdx >= 0 && newIdx < questions.length) { slideDirection = dir > 0 ? 'slide-left' : 'slide-right'; currentIndex = newIdx; updateDisplay(); }
};

function renderProgressBar() {
    const pct = ((currentIndex + 1) / questions.length) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
}

window.toggleSidebar = function(force) {
    const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay');
    if (force !== undefined) { if(force) { sb.classList.add('mobile-open'); ov.classList.add('active'); } else { sb.classList.remove('mobile-open'); ov.classList.remove('active'); } return; }
    sb.classList.toggle('mobile-open'); ov.classList.toggle('active');
};

window.submitSession = function() {
    if(confirm("정말 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.")) {
        session.completed = true; session.data.userAnswers = userAnswers;
        saveSessionList(sessionList);
        window.location.href = 'result.html';
    }
};

window.goHome = function() {
    session.data.userAnswers = userAnswers; saveSessionList(sessionList);
    window.location.href = 'index.html';
};