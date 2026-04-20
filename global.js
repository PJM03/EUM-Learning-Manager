const STORAGE_KEY = 'multimedia_quiz_sessions_v3';
const typeLabels = { "SEL": "객관식", "WRD": "단답형", "BLK": "빈칸 채우기", "SEN": "서술형" };

function loadSessionList() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try { 
            let list = JSON.parse(savedData); 
            list.forEach(s => { 
                if(!s.subject) s.subject = "미분류"; 
                if(!s.professor) s.professor = "";
            });
            return list;
        } catch (e) { return []; }
    }
    return [];
}

function saveSessionList(list) { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); 
}

function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

function normalizeQuestions(parsedData) {
    let questionsArray = Array.isArray(parsedData) ? parsedData : (parsedData.questions || []);
    return questionsArray.map((q, idx) => ({
        ...q,
        id: q.id ? String(q.id) : ('Q' + Math.random().toString(36).substr(2, 5)),
        text: q.question || q.text || `문제 ${idx+1}`,
        score: q.score !== undefined ? Number(q.score) : 1
    }));
}