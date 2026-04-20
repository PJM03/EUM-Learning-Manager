let sessionList = loadSessionList();
let activeExportSessionId = null;
let isListExpanded = false; 
let accuracyChartInstance = null; 
let subjectChartInstance = null;
let isPromptFolded = false;
let promptTemplate = "프롬프트를 로드할 수 없습니다.";
let currentStatMode = 'ALL'; 

window.onload = async () => {
    renderStartScreen();
    await loadPromptTemplate();
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#export-menu') && !e.target.closest('.export-btn-trigger')) {
            document.getElementById('export-menu').classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    });
};

async function loadPromptTemplate() {
    try {
        const res = await fetch('./gemini_qset_gen_prompt.md');
        if (res.ok) promptTemplate = await res.text();
        else promptTemplate = "프롬프트 파일을 찾을 수 없습니다. (gemini_qset_gen_prompt.md)";
    } catch (e) { promptTemplate = "여기에 프롬프트를 넣어주세요"; }
    
    document.getElementById('prompt-raw-view').value = promptTemplate;
    if (typeof marked !== 'undefined') document.getElementById('prompt-markdown-view').innerHTML = marked.parse(promptTemplate);
    else document.getElementById('prompt-markdown-view').innerText = promptTemplate;
}

function togglePromptSection() {
    isPromptFolded = !isPromptFolded;
    const wrapper = document.getElementById('prompt-content-wrapper');
    const icon = document.getElementById('prompt-fold-icon');
    if (isPromptFolded) { wrapper.classList.add('folded'); icon.innerText = 'expand_more'; } 
    else { wrapper.classList.remove('folded'); icon.innerText = 'expand_less'; }
}

function togglePromptView() {
    const isMarkdown = document.getElementById('prompt-toggle').checked;
    if (isMarkdown) {
        document.getElementById('prompt-markdown-view').classList.remove('hide');
        document.getElementById('prompt-raw-view').classList.add('hide');
    } else {
        document.getElementById('prompt-markdown-view').classList.add('hide');
        document.getElementById('prompt-raw-view').classList.remove('hide');
    }
}

function goToGemini() {
    copyAiPrompt(false); 
    window.open('https://gemini.google.com', '_blank');
}

function copyAiPrompt(showAlert = true) {
    navigator.clipboard.writeText(promptTemplate).then(() => {
        if(showAlert) alert("프롬프트가 클립보드에 복사되었습니다.");
    }).catch(err => { alert("복사에 실패했습니다. 수동으로 텍스트를 복사해주세요."); });
}

let pressTimer = null;
window.startLongPress = function(e, id) {
    if(window.innerWidth > 768) return; 
    pressTimer = setTimeout(() => { showMobileActionMenu(id); }, 500); 
};
window.cancelLongPress = function() { if (pressTimer) clearTimeout(pressTimer); };
window.preventContextMenu = function(e) { if(window.innerWidth <= 768) e.preventDefault(); };

function renderStartScreen() {
    const container = document.getElementById('session-list-ui');
    container.innerHTML = '';
    const expandBtn = document.getElementById('show-more-btn');
    
    if (sessionList.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--secondary); padding: 40px 0;">저장된 학습 기록이 없습니다.<br>새 파일을 열어주세요.</div>`;
        expandBtn.classList.add('hide');
        updateDashboardStats();
        return;
    }

    const sortedList = [...sessionList].sort((a, b) => b.timestamp - a.timestamp);
    const displayList = isListExpanded ? sortedList : sortedList.slice(0, 5); 
    
    if (sortedList.length > 5) {
        expandBtn.classList.remove('hide');
        document.getElementById('expand-text').innerText = isListExpanded ? '접기' : `모든 기록 보기 (${sortedList.length})`;
        document.getElementById('expand-icon').innerText = isListExpanded ? 'expand_less' : 'expand_more';
    } else expandBtn.classList.add('hide');

    const grouped = {};
    displayList.forEach(session => {
        const sub = session.subject;
        if(!grouped[sub]) grouped[sub] = { professor: session.professor, sessions: [] };
        grouped[sub].sessions.push(session);
    });

    for (const [subject, groupData] of Object.entries(grouped)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'tree-group';
        const subjectHeader = document.createElement('div');
        subjectHeader.className = 'tree-subject';
        
        let profStr = groupData.professor ? `<span style="font-size: 0.9rem; font-weight: 500; color: #041e49; margin-left: 6px;">(${groupData.professor} 교수님)</span>` : "";
        subjectHeader.innerHTML = `
            <span class="material-symbols-rounded">folder_open</span> ${subject} ${profStr}
            <button class="icon-btn" style="width:24px; height:24px; border:none; background:transparent; margin-left: 6px;" onclick="renameSubject('${subject}')" title="과목명 수정"><span class="material-symbols-rounded" style="font-size:16px;">edit</span></button>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; font-weight: 500; background: white; color: var(--primary); padding: 2px 8px; border-radius: 12px;">${groupData.sessions.length}개</span>
                <button class="icon-btn" style="width:28px; height:28px; border-color: var(--primary); color: var(--primary); background: white;" onclick="viewSubjectStats('${subject}')" title="이 과목 통계 분석"><span class="material-symbols-rounded" style="font-size: 16px;">analytics</span></button>
            </div>`;
        groupDiv.appendChild(subjectHeader);

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree-children';

        groupData.sessions.forEach(session => {
            const dateStr = new Date(session.timestamp).toLocaleDateString('ko-KR');
            const totalQ = session.data.questions.length;
            const ansQ = Object.keys(session.data.userAnswers).filter(k => session.data.userAnswers[k] && session.data.userAnswers[k].trim() !== "").length;
            const badgeClass = session.completed ? 'badge-done' : 'badge-ing';
            const badgeText = session.completed ? '완료' : '진행중';
            const actionIcon = session.completed ? 'menu_book' : 'play_arrow';
            
            const item = document.createElement('div');
            item.className = 'session-item';
            item.setAttribute('ontouchstart', `startLongPress(event, '${session.id}')`);
            item.setAttribute('ontouchend', `cancelLongPress()`);
            item.setAttribute('ontouchmove', `cancelLongPress()`);
            item.setAttribute('oncontextmenu', `preventContextMenu(event)`);
            item.innerHTML = `
                <div class="session-info">
                    <div class="session-title"><span class="badge-status ${badgeClass}">${badgeText}</span> ${session.title}
                        <button class="icon-btn" style="width:24px; height:24px; border:none; background:transparent; margin-left: 4px;" onclick="triggerRename('${session.id}')"><span class="material-symbols-rounded" style="font-size:16px;">edit</span></button>
                    </div>
                    <div class="session-meta">${dateStr} | ${ansQ}/${totalQ} 해결</div>
                </div>
                <div class="session-actions">
                    <button class="icon-btn" style="color: var(--primary); border-color: var(--primary);" onclick="openSession('${session.id}')"><span class="material-symbols-rounded">${actionIcon}</span></button>
                    <button class="icon-btn export-btn-trigger desktop-only" onclick="showExportMenu(event, '${session.id}')"><span class="material-symbols-rounded">download</span></button>
                    <button class="icon-btn danger desktop-only" onclick="deleteSession('${session.id}')"><span class="material-symbols-rounded">delete</span></button>
                </div>`;
            childrenDiv.appendChild(item);
        });
        groupDiv.appendChild(childrenDiv);
        container.appendChild(groupDiv);
    }
    updateDashboardStats();
}

function toggleExpandSessions() { isListExpanded = !isListExpanded; renderStartScreen(); }

window.renameSubject = function(oldSubject) {
    showPromptModal("과목명 변경", `"${oldSubject}" 과목의 새로운 이름을 입력하세요.`, oldSubject, false).then(newSub => {
        if(newSub && newSub.trim() !== "") {
            sessionList.forEach(s => { if (s.subject === oldSubject) s.subject = newSub.trim(); });
            saveSessionList(sessionList); renderStartScreen();
        }
    });
};

window.viewSubjectStats = function(subject) { currentStatMode = subject; document.getElementById('chart-section').scrollIntoView({ behavior: 'smooth' }); updateDashboardStats(); };
window.viewAllStats = function() { currentStatMode = 'ALL'; updateDashboardStats(); };

function updateDashboardStats() {
    let completedSessions = 0, totalSolvedQ = 0, globalEarnedPoints = 0, globalTotalPoints = 0, targetEarnedPoints = 0, targetTotalPoints = 0, barStats = {}; 

    document.getElementById('chart-section-title').innerText = currentStatMode === 'ALL' ? '학습 성취도 분석 (전체)' : `학습 성취도 분석 (${currentStatMode})`;
    document.getElementById('chart-doughnut-title').innerText = currentStatMode === 'ALL' ? '전체 정답률' : `'${currentStatMode}' 정답률`;
    document.getElementById('chart-bar-title').innerText = currentStatMode === 'ALL' ? '과목별 정답/오답률 비교' : `'${currentStatMode}' 완료한 문제 세트 비교`;

    sessionList.forEach(s => {
        const sub = s.subject;
        const isTarget = (currentStatMode === 'ALL' || sub === currentStatMode);
        let labelKey = currentStatMode === 'ALL' ? sub : s.title;
        
        // 제출(완료)된 세션의 데이터만 통계에 편입
        if (s.completed) {
            completedSessions++;
            if (isTarget && !barStats[labelKey]) barStats[labelKey] = { earned: 0, total: 0 };
        }
        
        s.data.questions.forEach(q => {
            const uAns = s.data.userAnswers[q.id] || "";
            if (uAns.trim() !== "") totalSolvedQ++;
            let qScore = q.score !== undefined ? Number(q.score) : 1;

            if (s.completed && q.type !== 'SEN') {
                globalTotalPoints += qScore;
                if(isTarget) { targetTotalPoints += qScore; barStats[labelKey].total += qScore; }
                
                let isCorrect = false;
                if (q.type === 'SEL') { if(uAns === q.answer) isCorrect = true; } 
                else {
                    const cAns = Array.isArray(q.answer) ? q.answer : [q.answer];
                    const cleanUser = uAns.toLowerCase().replace(/\s/g, '');
                    if(cAns.some(a => a.toLowerCase().replace(/\s/g, '') === cleanUser)) isCorrect = true;
                }
                if(isCorrect) {
                    globalEarnedPoints += qScore;
                    if(isTarget) { targetEarnedPoints += qScore; barStats[labelKey].earned += qScore; }
                }
            }
        });
    });

    document.getElementById('stat-total-sessions').innerText = completedSessions;
    document.getElementById('stat-total-q').innerText = totalSolvedQ;
    drawAccuracyChart(currentStatMode === 'ALL' ? globalEarnedPoints : targetEarnedPoints, currentStatMode === 'ALL' ? globalTotalPoints : targetTotalPoints);
    drawBarChart(barStats);
}

function drawAccuracyChart(earned, total) {
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    if (accuracyChartInstance) accuracyChartInstance.destroy();
    if (total === 0) {
        accuracyChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['표시할 데이터가 없습니다'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'], borderWidth: 0 }] }, options: { cutout: '75%', responsive: true, maintainAspectRatio: false, plugins: { tooltip: {enabled: false}, legend: {display: false} } } });
        return;
    }
    const missed = total - earned;
    const accuracy = Math.round((earned / total) * 100);
    accuracyChartInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: ['정답 점수', '오답 점수'], datasets: [{ data: [earned, missed], backgroundColor: ['#1a7f37', '#cf222e'], borderWidth: 0 }] },
        options: { cutout: '75%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } },
        plugins: [{
            id: 'textCenter',
            beforeDraw: function(chart) {
                var width = chart.width, height = chart.height, ctx = chart.ctx;
                ctx.restore(); ctx.font = "bold " + (height / 110).toFixed(2) + "em Pretendard"; ctx.textBaseline = "middle"; ctx.fillStyle = "#24292f";
                var text = accuracy + "%", textX = Math.round((width - ctx.measureText(text).width) / 2), textY = height / 2 - 10;
                ctx.fillText(text, textX, textY); ctx.save();
            }
        }]
    });
}

function drawBarChart(stats) {
    const ctx = document.getElementById('subjectChart').getContext('2d');
    if (subjectChartInstance) subjectChartInstance.destroy();
    const labels = Object.keys(stats);
    if(labels.length === 0) {
        subjectChartInstance = new Chart(ctx, { type: 'bar', data: { labels: ['표시할 데이터가 없습니다'], datasets: [{ data: [0], backgroundColor: '#e0e0e0' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: {enabled: false}, legend: {display: false} }, scales: { y: { display: false } } } });
        return;
    }
    const correctRates = labels.map(l => Math.round((stats[l].earned / (stats[l].total || 1)) * 100) || 0);
    const incorrectRates = correctRates.map(r => 100 - r);
    subjectChartInstance = new Chart(ctx, {
        type: 'bar', data: { labels: labels, datasets: [ { label: '정답률 (%)', data: correctRates, backgroundColor: '#1a7f37', borderRadius: 4 }, { label: '오답률 (%)', data: incorrectRates, backgroundColor: '#cf222e', borderRadius: 4 } ] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 25 } } }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
    });
}

function triggerRename(id) {
    const session = sessionList.find(s => s.id === id);
    if(!session) return;
    showPromptModal("세션 이름 변경", "새로운 이름을 입력하세요.", session.title, false).then(newTitle => {
        if(newTitle) { session.title = newTitle; saveSessionList(sessionList); renderStartScreen(); }
    });
}

function openSession(id) {
    sessionStorage.setItem('activeSessionId', id);
    const session = sessionList.find(s => s.id === id);
    if (session.completed) window.location.href = 'result.html';
    else window.location.href = 'question.html';
}

function showPromptModal(title, desc, defVal, isPassword = false) {
    return new Promise((resolve) => {
        document.getElementById('prompt-modal-title').innerText = title; document.getElementById('prompt-modal-desc').innerText = desc;
        const inp = document.getElementById('prompt-input'); inp.type = isPassword ? 'password' : 'text'; inp.value = defVal;
        document.getElementById('prompt-modal').classList.add('active'); setTimeout(() => inp.focus(), 50);
        inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('prompt-confirm-btn').click(); } };
        document.getElementById('prompt-confirm-btn').onclick = () => {
            const val = inp.value.trim(); if(!val && !isPassword) return alert("값을 입력해주세요.");
            closeModal('prompt-modal'); resolve(val);
        };
    });
}

function showLoadingModal(title, desc) {
    document.getElementById('loading-modal-title').innerText = title; document.getElementById('loading-modal-desc').innerText = desc;
    document.getElementById('loading-spinner').classList.remove('hide'); document.getElementById('loading-close-btn').classList.add('hide');
    document.getElementById('loading-modal').classList.add('active');
}

function finishLoadingModal(title, desc, isError = false) {
    document.getElementById('loading-modal-title').innerText = title; document.getElementById('loading-modal-desc').innerText = desc;
    const spinner = document.getElementById('loading-spinner'); spinner.classList.add('hide');
    if (isError) { spinner.innerHTML = `<span class="material-symbols-rounded" style="font-size:48px; color:var(--error);">error</span>`; spinner.classList.remove('hide'); }
    else { spinner.innerHTML = `<span class="material-symbols-rounded" style="font-size:48px; color:var(--success);">check_circle</span>`; spinner.classList.remove('hide'); }
    document.getElementById('loading-close-btn').classList.remove('hide');
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

window.handleFileUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text(); const filename = file.name;
    if (filename.endsWith('.elmb')) {
        showPromptModal("전체 복원 (.elmb)", "백업 파일의 암호를 입력해주세요.", "", true).then(pwd => {
            if(!pwd) return;
            try {
                const bytes = CryptoJS.AES.decrypt(text, pwd); const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                if (!decrypted) throw new Error();
                const importedSessions = JSON.parse(decrypted);
                if (sessionList.length > 0 && !confirm("현재 모든 기록이 삭제되고 백업 데이터로 덮어씌워집니다. 진행할까요?")) return;
                sessionList = importedSessions; saveSessionList(sessionList); renderStartScreen(); alert("성공적으로 복원되었습니다.");
            } catch (e) { alert("비밀번호가 틀렸거나 파일이 손상되었습니다."); }
        });
    } else if (filename.endsWith('.ebd')) {
        showPromptModal("EBD 잠금 해제", "파일의 암호를 입력해주세요.", "", true).then(pwd => {
            if(!pwd) return;
            try {
                const bytes = CryptoJS.AES.decrypt(text, pwd); const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                if (!decrypted) throw new Error();
                const parsed = JSON.parse(decrypted);
                
                const completed = parsed.completed || false;
                const userAnswers = parsed.userAnswers || {};
                const normQs = normalizeQuestions(parsed);
                const questions = completed ? normQs : shuffleArray(normQs);
                
                processImportedData(questions, filename, Array.isArray(parsed) ? "미분류" : (parsed.lecture || parsed.subject || "미분류"), Array.isArray(parsed) ? "" : (parsed.professor || ""), completed, userAnswers);
            } catch (e) { alert("비밀번호가 틀렸거나 파일이 손상되었습니다."); }
        });
    } else {
        try { 
            const parsed = JSON.parse(text);
            const completed = parsed.completed || false;
            const userAnswers = parsed.userAnswers || {};
            const normQs = normalizeQuestions(parsed);
            const questions = completed ? normQs : shuffleArray(normQs);
            
            processImportedData(questions, filename, Array.isArray(parsed) ? "미분류" : (parsed.lecture || parsed.subject || "미분류"), Array.isArray(parsed) ? "" : (parsed.professor || ""), completed, userAnswers);
        } catch (e) { alert("올바르지 않은 JSON 파일입니다."); }
    }
    event.target.value = '';
};

function processImportedData(data, filename, subject, professor, completed = false, userAnswers = {}) {
    sessionList.push({ id: 'S' + Date.now(), title: filename.replace('.json', '').replace('.ebd', ''), subject: subject, professor: professor, timestamp: Date.now(), completed: completed, data: { questions: data, userAnswers: userAnswers } });
    saveSessionList(sessionList); renderStartScreen();
}

window.exportFullBackup = function() {
    if(sessionList.length === 0) return alert("백업할 데이터가 없습니다.");
    showPromptModal("전체 데이터 백업 (.elmb)", "백업 파일을 보호할 암호를 설정하세요.", "", true).then(pwd => {
        if(!pwd) return;
        showLoadingModal("전체 백업 생성 중", "학습 데이터를 암호화하고 있습니다...");
        setTimeout(() => {
            try {
                const encrypted = CryptoJS.AES.encrypt(JSON.stringify(sessionList), pwd).toString();
                downloadFile(encrypted, `EUM_Backup_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.elmb`, 'text/plain');
                finishLoadingModal("생성 완료", "전체 백업 파일(.elmb)이 다운로드되었습니다.");
            } catch (err) { finishLoadingModal("오류 발생", "백업 파일 생성 중 오류가 발생했습니다.", true); }
        }, 50);
    });
};

window.showExportMenu = function(e, id) { e.stopPropagation(); activeExportSessionId = id; const menu = document.getElementById('export-menu'); menu.style.top = `${e.currentTarget.getBoundingClientRect().bottom + window.scrollY + 8}px`; menu.style.left = `${e.currentTarget.getBoundingClientRect().right + window.scrollX - 200}px`; menu.classList.add('active'); };
window.showMobileActionMenu = function(id) { activeExportSessionId = id; document.getElementById('mobile-action-modal').classList.add('active'); };
window.execMobileAction = function(type) { closeModal('mobile-action-modal'); if (type === 'DELETE') deleteSession(activeExportSessionId); else execExport(type); };
window.deleteSession = function(id) { if(confirm("이 기록을 정말 삭제하시겠습니까?")) { sessionList = sessionList.filter(s => s.id !== id); saveSessionList(sessionList); renderStartScreen(); } };

window.execExport = async function(type) {
    document.getElementById('export-menu').classList.remove('active');
    const session = sessionList.find(s => s.id === activeExportSessionId);
    if (!session) return;
    const safeTitle = session.title.replace(/[^a-z0-9가-힣]/gi, '_');
    const exportData = { 
        lecture: session.subject, 
        professor: session.professor, 
        questions: session.data.questions,
        completed: session.completed,
        userAnswers: session.data.userAnswers
    };

    if (type === 'JSON') downloadFile(JSON.stringify(exportData, null, 2), `${safeTitle}.json`, 'application/json');
    else if (type === 'EBD') {
        showPromptModal("EBD 파일 암호화", "파일을 보호할 비밀번호를 입력하세요.", "", true).then(pwd => {
            if(!pwd) return; downloadFile(CryptoJS.AES.encrypt(JSON.stringify(exportData), pwd).toString(), `${safeTitle}.ebd`, 'text/plain');
        });
    } else if (type === 'PDF') {
        showLoadingModal("PDF 생성 중", "결과 보고서를 생성하고 있습니다...");
        setTimeout(() => {
            const element = document.createElement('div'); element.style.padding = '40px'; element.style.fontFamily = 'Pretendard, sans-serif';
            let profTitle = session.professor ? `<div style="text-align:center; color:#57606a; margin-top: 4px;">지도교수: ${session.professor}</div>` : "";
            element.innerHTML = `<h1 style="color:#0b57d0; text-align:center; margin-bottom: 8px;">${session.title} 학습 보고서</h1><div style="text-align:center; font-weight:600; color:#24292f; margin-bottom:4px;">과목: ${session.subject || '미분류'}</div>${profTitle}<hr style="margin-top:20px; margin-bottom:20px;">`;
            
            let earnedPoints = 0; let totalPoints = 0;
            session.data.questions.forEach((q, i) => {
                const uAns = session.data.userAnswers[q.id] || ""; let isCorrect = false; let qScore = q.score !== undefined ? Number(q.score) : 1;
                if(q.type !== 'SEN') { totalPoints += qScore; if(q.type === 'SEL') isCorrect = (uAns === q.answer); else isCorrect = (Array.isArray(q.answer) ? q.answer : [q.answer]).some(a => a.toLowerCase().replace(/\s/g, '') === uAns.toLowerCase().replace(/\s/g, '')); if(isCorrect) earnedPoints += qScore; }
                const color = q.type === 'SEN' ? '#0b57d0' : (isCorrect ? '#1a7f37' : '#cf222e');
                element.innerHTML += `<div style="margin-bottom:24px; border-bottom:1px solid #d0d7de; padding-bottom:16px;"><h3 style="color:${color}; margin:0 0 10px 0;">${i+1}. ${q.text} <span style="font-size:0.9rem; font-weight:normal; margin-left:8px;">[${qScore}점]</span></h3><p><b>나의 답안:</b> ${uAns}</p><p><b>모범 정답:</b> ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</p><p style="color:#57606a;"><b>해설:</b> ${q.explanation}</p></div>`;
            });
            element.innerHTML = `<h2 style="text-align:center; margin-bottom: 30px;">총점: ${earnedPoints} / ${totalPoints} 점</h2>` + element.innerHTML;
            html2pdf().from(element).set({ margin: 10, filename: `${safeTitle}_Report.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save().then(() => finishLoadingModal("생성 완료", "PDF 파일이 성공적으로 다운로드되었습니다.")).catch(e => finishLoadingModal("오류 발생", "PDF 생성 중 오류가 발생했습니다.", true));
        }, 100);
    }
};

function downloadFile(content, fileName, contentType) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: contentType })); a.download = fileName; a.click(); }