let sessionList = loadSessionList();
let activeSessionId = sessionStorage.getItem('activeSessionId');
let session = sessionList.find(s => s.id === activeSessionId);

if (!session || !session.completed) { window.location.href = 'index.html'; }

let questions = session.data.questions;
let userAnswers = session.data.userAnswers;

window.onload = () => {
    document.getElementById('sidebar-title').innerText = session.subject || "학습 목록";
    document.getElementById('sidebar-subtitle').innerText = session.title;
    renderResultsView();
};

function renderResultsView() {
    const resView = document.getElementById('result-view');
    let earnedPoints = 0; let totalPoints = 0;
    let html = `<div class="container" style="max-width: 800px;">`;
    
    questions.forEach((q, i) => {
        const uAns = userAnswers[q.id] || "";
        let isCorrect = false;
        let qScore = q.score !== undefined ? Number(q.score) : 1;

        if(q.type !== 'SEN') {
            totalPoints += qScore;
            if(q.type === 'SEL') isCorrect = (uAns === q.answer);
            else {
                const cAns = Array.isArray(q.answer) ? q.answer : [q.answer];
                isCorrect = cAns.some(a => a.toLowerCase().replace(/\s/g, '') === uAns.toLowerCase().replace(/\s/g, ''));
            }
            if(isCorrect) earnedPoints += qScore;
        }
        
        // 서술형(SEN)의 경우 색상을 주황색(--warning)으로 표시
        const color = q.type === 'SEN' ? 'var(--warning)' : (isCorrect ? 'var(--success)' : 'var(--error)');
        const icon = q.type === 'SEN' ? '📝 서술형' : (isCorrect ? '✅ 정답' : '❌ 오답');
        const scoreDisplay = q.type === 'SEN' ? '(서술형 평가대기)' : (isCorrect ? `+${qScore}점` : `0 / ${qScore}점`);

        html += `
        <div class="card" id="res-q-${i}" style="border-left: 6px solid ${color}; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                <div style="font-weight:700; color:${color};">${icon}</div>
                <div style="font-size: 0.9rem; font-weight: 600; color: ${color}; background: ${color}15; padding: 4px 10px; border-radius: 12px;">${scoreDisplay}</div>
            </div>
            <div class="q-text" style="font-size: 1.15rem; margin-bottom: 16px;">${i+1}. ${q.text}</div>
            <div style="background: var(--bg-color); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <div style="margin-bottom: 8px; color: var(--secondary);"><b>나의 답안:</b> ${uAns || '<span style="color:#aaa;">(미입력)</span>'}</div>
                <div style="color:var(--primary); margin-bottom: 12px;"><b>모범 정답:</b> ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                <div style="padding-top: 12px; border-top: 1px solid var(--border); color: var(--secondary); font-size: 0.95rem; line-height: 1.5;"><b>해설:</b> ${q.explanation}</div>
            </div>
        </div>`;
    });
    
    const headerHtml = `
    <div style="text-align:center; padding:32px; background:var(--surface); border:1px solid var(--border); border-radius:24px; margin-bottom:32px;">
        <div style="font-size:1.1rem; color:var(--secondary)">객관식/단답형 총점</div>
        <div style="font-size:3.5rem; font-weight:800; color:var(--primary)">${earnedPoints} <span style="font-size: 1.5rem; color:var(--secondary)">/ ${totalPoints} 점</span></div>
    </div>`;
    
    resView.innerHTML = headerHtml + html + `</div>`;
    
    renderSidebar();
    filterResults('ALL');
}

function renderSidebar() {
    const list = document.getElementById('question-list');
    list.innerHTML = '';
    questions.forEach((q, i) => {
        const uAns = userAnswers[q.id] || "";
        let isCorrect = false;
        if(q.type !== 'SEN') {
            if(q.type === 'SEL') isCorrect = (uAns === q.answer);
            else {
                const cAns = Array.isArray(q.answer) ? q.answer : [q.answer];
                isCorrect = cAns.some(a => a.toLowerCase().replace(/\s/g, '') === uAns.toLowerCase().replace(/\s/g, ''));
            }
        }
        const color = q.type === 'SEN' ? 'var(--warning)' : (isCorrect ? 'var(--success)' : 'var(--error)');
        const icon = q.type === 'SEN' ? '📝' : (isCorrect ? '✅' : '❌');

        const div = document.createElement('div');
        div.className = 'sidebar-item'; div.id = `side-item-${i}`;
        div.onclick = () => { document.getElementById(`res-q-${i}`).scrollIntoView({behavior:'smooth'}); toggleSidebar(false); };
        
        // 사이드바 문제명 및 내 답안 수직 배치
        div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 8px;">
            <div style="line-height: 1.3; font-weight: 500; color: #24292f;">${i+1}. ${q.type==='SEN'?'[서술형] ':''}${q.text.substring(0, 20)}...</div>
            <div style="font-size:0.85rem; color:${color}; font-weight: 600; background: var(--bg-color); padding: 6px 10px; border-radius: 8px;">
                ${icon} ${uAns.length > 15 ? uAns.substring(0,15)+'...' : (uAns || '(미입력)')}
            </div>
        </div>`;
        
        list.appendChild(div);
    });
}

window.filterResults = function(filterType) {
    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    questions.forEach((q, i) => {
        const item = document.getElementById(`side-item-${i}`);
        const card = document.getElementById(`res-q-${i}`);
        if(!item || !card) return;
        
        let show = true;
        const uAns = userAnswers[q.id] || "";
        let isCorrect = false;

        if (q.type !== 'SEN') {
            if (q.type === 'SEL') isCorrect = (uAns === q.answer);
            else {
                const cAns = Array.isArray(q.answer) ? q.answer : [q.answer];
                isCorrect = cAns.some(a => a.toLowerCase().replace(/\s/g, '') === uAns.toLowerCase().replace(/\s/g, ''));
            }
        }

        if(filterType === 'CORRECT' && (q.type === 'SEN' || !isCorrect)) show = false;
        if(filterType === 'INCORRECT' && (q.type === 'SEN' || isCorrect)) show = false;
        if(filterType === 'SEN' && q.type !== 'SEN') show = false;

        if(show) { item.classList.remove('hide'); card.classList.remove('hide'); }
        else { item.classList.add('hide'); card.classList.add('hide'); }
    });
};

window.toggleSidebar = function(force) {
    const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay');
    if (force !== undefined) { if(force) { sb.classList.add('mobile-open'); ov.classList.add('active'); } else { sb.classList.remove('mobile-open'); ov.classList.remove('active'); } return; }
    sb.classList.toggle('mobile-open'); ov.classList.toggle('active');
};

window.goHome = function() { window.location.href = 'index.html'; };