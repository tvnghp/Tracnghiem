// Admin credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

function checkAuth() {
  return localStorage.getItem('admin_authenticated') === 'true';
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    localStorage.setItem('admin_authenticated', 'true');
    showAdminPanel();
  } else {
    alert('Tên đăng nhập hoặc mật khẩu không đúng!');
  }
}

function handleLogout() {
  localStorage.removeItem('admin_authenticated');
  showLoginForm();
}

function showAdminPanel() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('admin-container').style.display = 'block';
  renderTopics();
}

function showLoginForm() {
  document.getElementById('login-container').style.display = 'block';
  document.getElementById('admin-container').style.display = 'none';
  document.getElementById('login-form').reset();
}

function getTopics() {
  return JSON.parse(localStorage.getItem('quiz_topics') || '[]');
}

function saveTopics(topics) {
  localStorage.setItem('quiz_topics', JSON.stringify(topics));
}

function uuid() {
  return 'topic-' + Math.random().toString(36).substr(2, 9) + Date.now();
}

function parseExcelFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const workbook = XLSX.read(evt.target.result, {
        type: 'binary',
        cellText: false,
        cellDates: true,
        cellStyles: false,
        sheetStubs: false
      });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        blankrows: false,
        raw: false,
        dateNF: 'dd/mm/yyyy'
      });
      
      if (!rows || !rows.length) {
        callback({ error: 'File không có dữ liệu!' });
        return;
      }
      
      function getCol(row, name) {
        name = name.trim().toLowerCase();
        for (let k in row) {
          if (k.trim().toLowerCase() === name) return row[k];
        }
        return '';
      }
      
      const testRow = rows[0];
      function hasCol(name) {
        return Object.keys(testRow).some(k => k.trim().toLowerCase() === name.trim().toLowerCase());
      }
      
      if (!(hasCol('câu hỏi') && hasCol('đáp án a') && hasCol('đáp án b') && 
            hasCol('đáp án c') && hasCol('đáp án d') && hasCol('đáp án đúng') && hasCol('giải thích'))) {
        callback({ error: 'File thiếu cột hoặc không đúng định dạng mẫu!' });
        return;
      }
      
      const questions = rows.map((row, idx) => {
        let rawAnswer = getCol(row, 'đáp án đúng').toString().trim();
        let answer = ["1", "2", "3", "4"].includes(rawAnswer) 
          ? ["A", "B", "C", "D"][parseInt(rawAnswer)-1] 
          : rawAnswer.toUpperCase();
        
        let cols = [
          {label: "A", value: getCol(row, 'đáp án a')},
          {label: "B", value: getCol(row, 'đáp án b')},
          {label: "C", value: getCol(row, 'đáp án c')},
          {label: "D", value: getCol(row, 'đáp án d')}
        ];
        
        let options = [];
        let optionLabels = [];
        cols.forEach(col => {
          if (col.value && col.value.toString().trim() !== "") {
            options.push(col.value);
            optionLabels.push(col.label);
          }
        });
        
        if (!getCol(row, 'câu hỏi')) return null;
        if (!answer) return null;
        
        let validAnswer = false;
        if (["A", "B", "C", "D"].includes(answer)) {
          let idxLabel = ["A", "B", "C", "D"].indexOf(answer);
          validAnswer = cols[idxLabel].value && cols[idxLabel].value.toString().trim() !== "";
        }
        if (!validAnswer) return null;
        
        return {
          question: getCol(row, 'câu hỏi'),
          options: options,
          optionLabels: optionLabels,
          answer: answer,
          explain: getCol(row, 'giải thích')
        };
      }).filter(q => q);
      
      if (!questions.length) {
        callback({ error: 'Không có câu hỏi hợp lệ trong file!' });
        return;
      }
      
      callback({ questions });
    } catch (err) {
      console.error(err);
      callback({ error: 'Lỗi khi đọc file. Vui lòng thử lại.' });
    }
  };
  reader.onerror = () => callback({ error: 'Không đọc được file Excel!' });
  reader.readAsBinaryString(file);
}

function renderTopics() {
  const topics = getTopics();
  const container = document.getElementById('topic-list-container');
  
  if (topics.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="material-icons">folder_open</i>
        <p>Chưa có chuyên đề nào</p>
      </div>`;
    const eb = document.getElementById('exam-topic-percents');
    if (eb) eb.innerHTML = '<p>Chưa có chuyên đề để chọn.</p>';
    renderExams([]);
    return;
  }
  
  const normalTopics = topics.filter(t => !t.isExam);
  const exams = topics.filter(t => t.isExam === true);

  container.innerHTML = normalTopics.map(topic => `
    <div class="topic-item">
      <div class="topic-info">
        <h3>${topic.name}</h3>
        <div class="topic-meta">${topic.questions.length} câu hỏi</div>
      </div>
      <div>
        <button onclick="openEditTopic('${topic.id}')" class="btn btn-outline" style="margin-right:8px;">
          <i class="material-icons">edit</i> Sửa
        </button>
        <button onclick="delTopic('${topic.id}')" class="btn btn-delete">
          <i class="material-icons">delete</i> Xóa
        </button>
      </div>
    </div>
  `).join('');

  renderExamBuilderTopics(normalTopics);
  renderExams(exams);
}

function renderExams(exams) {
  const container = document.getElementById('exam-list-container');
  if (!container) return;
  if (!exams || exams.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="material-icons">assignment</i>
        <p>Chưa có bài thi nào</p>
      </div>`;
    return;
  }
  container.innerHTML = exams.map(exam => {
    const total = exam.examConfig?.total ?? (exam.questions ? exam.questions.length : 0);
    const duration = (typeof exam.durationMinutes === 'number' && exam.durationMinutes > 0)
      ? `${exam.durationMinutes} phút` : 'Không đặt thời gian';
    return `
    <div class="topic-item">
      <div class="topic-info">
        <h3>${exam.name}</h3>
        <div class="topic-meta">${total} câu • ${duration}${exam.allowPause ? ' • Cho phép tạm dừng' : ''}</div>
      </div>
      <div>
        <button onclick="openEditExam('${exam.id}')" class="btn btn-outline" style="margin-right:8px;">
          <i class="material-icons">edit</i> Sửa
        </button>
        <button onclick="delTopic('${exam.id}')" class="btn btn-delete">
          <i class="material-icons">delete</i> Xóa
        </button>
      </div>
    </div>`;
  }).join('');
}

// ===== Edit Topic Logic =====
window.openEditTopic = function(topicId) {
  const topics = getTopics();
  const topic = topics.find(t => t.id === topicId && !t.isExam);
  if (!topic) return;
  
  document.getElementById('edit-topic-id').value = topic.id;
  document.getElementById('edit-topic-name').value = topic.name || '';
  document.getElementById('edit-topic-file').value = '';
  document.getElementById('edit-topic-msg').textContent = '';
  document.getElementById('edit-topic-modal').classList.remove('hidden');
}

function saveEditTopic(e) {
  e.preventDefault();
  const msg = document.getElementById('edit-topic-msg');
  msg.textContent = '';
  
  const id = document.getElementById('edit-topic-id').value;
  const name = document.getElementById('edit-topic-name').value.trim();
  const fileInput = document.getElementById('edit-topic-file');
  
  if (!name) {
    msg.textContent = 'Vui lòng nhập tên chuyên đề!';
    return;
  }
  
  const topics = getTopics();
  const idx = topics.findIndex(t => t.id === id && !t.isExam);
  if (idx === -1) {
    msg.textContent = 'Không tìm thấy chuyên đề!';
    return;
  }
  
  const file = fileInput.files[0];
  if (!file) {
    // Chỉ đổi tên
    topics[idx].name = name;
    saveTopics(topics);
    renderTopics();
    document.getElementById('edit-topic-modal').classList.add('hidden');
    return;
  }
  
  // Đổi tên + thay câu hỏi
  parseExcelFile(file, (result) => {
    if (result.error) {
      msg.textContent = result.error;
      return;
    }
    topics[idx].name = name;
    topics[idx].questions = result.questions;
    saveTopics(topics);
    renderTopics();
    document.getElementById('edit-topic-modal').classList.add('hidden');
  });
}

// ===== Edit Exam Logic =====
window.openEditExam = function(examId) {
  const topics = getTopics();
  const exam = topics.find(t => t.id === examId && t.isExam);
  if (!exam) return;
  
  document.getElementById('edit-exam-id').value = exam.id;
  document.getElementById('edit-exam-name').value = exam.name || '';
  document.getElementById('edit-exam-total').value = exam.examConfig?.total || (exam.questions?.length || 0);
  document.getElementById('edit-exam-duration').value = exam.durationMinutes || '';
  document.getElementById('edit-exam-allow-pause').checked = !!exam.allowPause;
  renderEditExamTopics(topics.filter(t => !t.isExam), exam);
  document.getElementById('edit-exam-msg').textContent = '';
  document.getElementById('edit-exam-modal').classList.remove('hidden');
}

function renderEditExamTopics(allTopics, exam) {
  const holder = document.getElementById('edit-exam-topic-percents');
  if (!holder) return;
  if (!allTopics || allTopics.length === 0) {
    holder.innerHTML = '<p>Chưa có chuyên đề để chọn.</p>';
    return;
  }
  
  const distMap = {};
  (exam.examConfig?.distribution || []).forEach(d => distMap[d.id] = d.percent);
  
  holder.innerHTML = allTopics.map(t => `
    <div class="topic-item" style="align-items:center; gap:12px;">
      <label style="flex:1; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" class="edit-eb-topic-check" value="${t.id}" ${distMap[t.id] ? 'checked' : ''}>
        <span>${t.name}</span>
      </label>
      <div style="display:flex; align-items:center; gap:6px;">
        <input type="number" class="edit-eb-topic-percent" data-id="${t.id}" min="0" max="100" step="1" value="${distMap[t.id] || 0}" style="width:90px;">
        <span>%</span>
        <small style="color:#666">(${t.questions.length} câu)</small>
      </div>
    </div>
  `).join('');

  holder.querySelectorAll('.edit-eb-topic-percent').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const chk = holder.querySelector(`.edit-eb-topic-check[value="${id}"]`);
      if (chk && parseFloat(e.target.value || '0') > 0) chk.checked = true;
      normalizePercents(holder);
    });
    inp.addEventListener('blur', () => normalizePercents(holder));
  });
  
  holder.querySelectorAll('.edit-eb-topic-check').forEach(chk => {
    chk.addEventListener('change', () => normalizePercents(holder));
  });
}

function saveEditExam(e) {
  e.preventDefault();
  const msg = document.getElementById('edit-exam-msg');
  msg.textContent = '';
  
  const id = document.getElementById('edit-exam-id').value;
  const name = document.getElementById('edit-exam-name').value.trim();
  const total = parseInt(document.getElementById('edit-exam-total').value, 10);
  const durationMinutes = parseInt(document.getElementById('edit-exam-duration').value, 10);
  const allowPause = !!document.getElementById('edit-exam-allow-pause').checked;

  if (!name) { msg.textContent = 'Vui lòng nhập tên bài thi!'; return; }
  if (!Number.isFinite(total) || total <= 0) { msg.textContent = 'Tổng số câu phải > 0!'; return; }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) { msg.textContent = 'Thời gian phải > 0!'; return; }

  const holder = document.getElementById('edit-exam-topic-percents');
  const checks = Array.from(holder.querySelectorAll('.edit-eb-topic-check'));
  const selected = checks.filter(c => c.checked).map(c => c.value);
  if (selected.length === 0) { msg.textContent = 'Vui lòng chọn ít nhất 1 chuyên đề!'; return; }

  const percInputs = Array.from(holder.querySelectorAll('.edit-eb-topic-percent'));
  const dist = [];
  let sumPercent = 0;
  for (const inp of percInputs) {
    const tid = inp.getAttribute('data-id');
    const p = parseFloat(inp.value || '0');
    if (!selected.includes(tid)) continue;
    if (p < 0 || p > 100 || !Number.isFinite(p)) { msg.textContent = 'Tỷ lệ phải 0-100!'; return; }
    sumPercent += p;
    dist.push({ id: tid, percent: p });
  }
  if (Math.round(sumPercent) !== 100) { msg.textContent = 'Tổng tỷ lệ phải bằng 100%'; return; }

  const topics = getTopics();
  const idx = topics.findIndex(t => t.id === id && t.isExam);
  if (idx === -1) { msg.textContent = 'Không tìm thấy bài thi!'; return; }
  
  topics[idx].name = name;
  topics[idx].durationMinutes = durationMinutes;
  topics[idx].allowPause = allowPause;
  topics[idx].examConfig = { total, distribution: dist };
  saveTopics(topics);
  
  try { localStorage.removeItem(`quiz_exam_questions_${id}`); } catch(_) {}
  renderTopics();
  document.getElementById('edit-exam-modal').classList.add('hidden');
}

window.delTopic = function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa chuyên đề này?')) return;
  const all = getTopics();
  const removed = all.find(topic => topic.id === id);
  const topics = all.filter(topic => topic.id !== id);
  saveTopics(topics);
  if (removed && removed.isExam === true) {
    try { localStorage.removeItem(`quiz_exam_questions_${id}`); } catch(_) {}
  }
  renderTopics();
};

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderExamBuilderTopics(topics) {
  const holder = document.getElementById('exam-topic-percents');
  if (!holder) return;
  if (!topics || topics.length === 0) {
    holder.innerHTML = '<p>Chưa có chuyên đề để chọn.</p>';
    return;
  }

  holder.innerHTML = topics.map(t => `
    <div class="topic-item" style="align-items:center; gap:12px;">
      <label style="flex:1; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" class="eb-topic-check" value="${t.id}">
        <span>${t.name}</span>
      </label>
      <div style="display:flex; align-items:center; gap:6px;">
        <input type="number" class="eb-topic-percent" data-id="${t.id}" min="0" max="100" step="1" value="0" style="width:90px;">
        <span>%</span>
        <small style="color:#666">(${t.questions.length} câu)</small>
      </div>
    </div>
  `).join('');

  holder.querySelectorAll('.eb-topic-percent').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const chk = holder.querySelector(`.eb-topic-check[value="${id}"]`);
      if (chk && parseFloat(e.target.value || '0') > 0) chk.checked = true;
      normalizePercents(holder);
    });
    inp.addEventListener('blur', () => normalizePercents(holder));
  });

  holder.querySelectorAll('.eb-topic-check').forEach(chk => {
    chk.addEventListener('change', () => normalizePercents(holder));
  });
}

function normalizePercents(scopeEl) {
  const root = scopeEl || document;
  const checks = Array.from(root.querySelectorAll('.eb-topic-check')).filter(c => c.checked);
  const percInputs = (id) => root.querySelector(`.eb-topic-percent[data-id="${id}"]`);
  if (checks.length === 0) return;

  const lastId = checks[checks.length - 1].value;
  let sumOthers = 0;
  checks.forEach(c => {
    const id = c.value;
    const inp = percInputs(id);
    const val = parseFloat(inp && inp.value ? inp.value : '0');
    if (id !== lastId) sumOthers += (Number.isFinite(val) ? val : 0);
  });

  let remain = 100 - Math.round(sumOthers);
  remain = Math.max(0, Math.min(100, remain));
  const lastInp = percInputs(lastId);
  if (lastInp) lastInp.value = String(remain);
}

function buildCompositeExam(e) {
  e.preventDefault();
  const msg = document.getElementById('exam-builder-msg');
  msg.textContent = '';

  const name = document.getElementById('exam-name').value.trim();
  const total = parseInt(document.getElementById('exam-total').value, 10);
  const durationMinutes = parseInt(document.getElementById('exam-duration').value, 10);
  const allowPause = !!document.getElementById('exam-allow-pause').checked;
  const allTopics = getTopics();

  if (!name) { msg.textContent = 'Vui lòng nhập tên bộ đề!'; return; }
  if (!Number.isFinite(total) || total <= 0) { msg.textContent = 'Tổng số câu hỏi phải là số > 0!'; return; }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) { msg.textContent = 'Thời gian làm bài phải là số phút > 0!'; return; }

  const checks = Array.from(document.querySelectorAll('.eb-topic-check'));
  const selected = checks.filter(c => c.checked).map(c => c.value);
  if (selected.length === 0) { msg.textContent = 'Vui lòng chọn ít nhất 1 chuyên đề!'; return; }

  const percInputs = Array.from(document.querySelectorAll('.eb-topic-percent'));
  const dist = [];
  let sumPercent = 0;
  for (const inp of percInputs) {
    const id = inp.getAttribute('data-id');
    const p = parseFloat(inp.value || '0');
    if (!selected.includes(id)) continue;
    if (p < 0 || p > 100 || !Number.isFinite(p)) { msg.textContent = 'Tỷ lệ phải trong khoảng 0-100!'; return; }
    sumPercent += p;
    dist.push({ id, percent: p });
  }

  if (Math.round(sumPercent) !== 100) {
    msg.textContent = 'Tổng tỷ lệ phải bằng 100%';
    return;
  }

  const withCalc = dist.map(d => ({ id: d.id, percent: d.percent, exact: (total * d.percent) / 100 }));
  let allocated = withCalc.map(x => ({ id: x.id, count: Math.floor(x.exact), frac: x.exact - Math.floor(x.exact) }));
  let assigned = allocated.reduce((s, a) => s + a.count, 0);
  let remain = total - assigned;
  if (remain > 0) {
    allocated.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < allocated.length && remain > 0; i++) {
      allocated[i].count += 1;
      remain--;
    }
  }

  const pickPerTopic = {};
  for (const a of allocated) {
    const topic = allTopics.find(t => t.id === a.id);
    if (!topic) { msg.textContent = 'Không tìm thấy chuyên đề đã chọn!'; return; }
    if (a.count > topic.questions.length) {
      msg.textContent = `Chuyên đề "${topic.name}" không đủ câu hỏi (${a.count}/${topic.questions.length}). Giảm tỷ lệ hoặc tổng số câu.`;
      return;
    }
    const shuffled = shuffleArray(topic.questions.slice());
    pickPerTopic[a.id] = shuffled.slice(0, a.count);
  }

  let combined = [];
  for (const a of allocated) combined = combined.concat(pickPerTopic[a.id] || []);
  shuffleArray(combined);

  if (combined.length !== total) {
    msg.textContent = `Số câu gộp được (${combined.length}) khác tổng (${total}). Vui lòng điều chỉnh tỷ lệ.`;
    return;
  }

  const topics = allTopics.slice();
  const examConfig = { total: total, distribution: dist };
  topics.push({ 
    id: uuid(), 
    name: name, 
    isExam: true, 
    examConfig: examConfig, 
    questions: combined, 
    durationMinutes: durationMinutes, 
    allowPause: allowPause 
  });
  saveTopics(topics);
  renderTopics();
  document.getElementById('exam-builder-form').reset();
  msg.textContent = 'Tạo bộ đề thành công!';
  setTimeout(() => { msg.textContent = ''; }, 2000);
}

function exportTopicsJson() {
  const topics = getTopics();
  const blob = new Blob([JSON.stringify(topics, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'topics.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth()) {
    showAdminPanel();
  } else {
    showLoginForm();
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  
  // Topic form
  document.getElementById('topic-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('topic-name').value.trim();
    const fileInput = document.getElementById('file-quiz');
    const msg = document.getElementById('topic-msg');
    msg.textContent = '';
    
    if (!name) { msg.textContent = "Vui lòng nhập tên chuyên đề!"; return; }
    const file = fileInput.files[0];
    if (!file) { msg.textContent = "Vui lòng chọn file câu hỏi!"; return; }
    
    parseExcelFile(file, (result) => {
      if (result.error) {
        msg.textContent = result.error;
        return;
      }
      
      const topics = getTopics();
      topics.push({
        id: uuid(),
        name: name,
        questions: result.questions
      });
      saveTopics(topics);
      renderTopics();
      document.getElementById('topic-form').reset();
      msg.textContent = "Tạo chuyên đề thành công!";
      setTimeout(() => { msg.textContent = ''; }, 2000);
    });
  });
  
  // Edit Topic modal handlers
  document.getElementById('edit-topic-form').addEventListener('submit', saveEditTopic);
  document.getElementById('edit-topic-cancel').addEventListener('click', () => {
    document.getElementById('edit-topic-modal').classList.add('hidden');
  });
  
  // Edit Exam modal handlers
  document.getElementById('edit-exam-form').addEventListener('submit', saveEditExam);
  document.getElementById('edit-exam-cancel').addEventListener('click', () => {
    document.getElementById('edit-exam-modal').classList.add('hidden');
  });
  
  // Exam Builder
  document.getElementById('exam-builder-form').addEventListener('submit', buildCompositeExam);
  
  // Export
  const exportBtn = document.getElementById('export-json-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportTopicsJson);
});
