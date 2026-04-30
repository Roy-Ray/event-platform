// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const API_URL = 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

const userId = localStorage.getItem('userId');
const userName = localStorage.getItem('userName');
let currentQuestions = [];
let questionIndex = 0;
let timerInterval;

// ==========================================
// ROUTER (Detects which page is open)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        initIndexPage();
    } else if (path.includes('assessment.html')) {
        initAssessmentPage();
    } else if (path.includes('admin.html')) {
        initAdminPage();
    }
});

// ==========================================
// 1. INDEX PAGE LOGIC
// ==========================================
function initIndexPage() {
    // If already logged in, skip login screen and show dashboard
    if (userId) {
        document.getElementById('pre-login-view').style.display = 'none';
        document.getElementById('post-login-view').style.display = 'grid'; 
        document.getElementById('display-name').innerText = userName;
        loadLeaderboard(); 
    } else {
        // If NOT logged in, load the eligible participants list on the login screen
        loadEligibleParticipants();
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const name = document.getElementById('userName').value;
            const district = document.getElementById('userDistrict').value;
            const code = document.getElementById('generalCode').value;

            if (!name || !code) return alert("Name and Event Code are required.");

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, district, general_code: code })
                });
                const data = await res.json();
                
                if (data.success) {
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userName', name);
                    
                    // Switch views
                    document.getElementById('pre-login-view').style.display = 'none';
                    document.getElementById('post-login-view').style.display = 'grid';
                    document.getElementById('display-name').innerText = name;
                    
                    loadLeaderboard(); // Load the post-login leaderboard
                } else {
                    alert(data.message || "Login failed.");
                }
            } catch (err) {
                console.error(err);
                alert("Could not connect to the server.");
            }
        });
    }
}

// NEW FUNCTION: Fetch and render the Eligible Participants list (Pre-login)
async function loadEligibleParticipants() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        
        const list = document.getElementById('eligible-list');
        const activeCount = document.getElementById('active-count');
        if (!list) return;

        if (data.success && data.leaderboard.length > 0) {
            list.innerHTML = ''; 
            if(activeCount) activeCount.innerText = data.leaderboard.length; // Update the counter at the top
            
            data.leaderboard.forEach((user) => {
                const imgSrc = user.profile_pic || DEFAULT_AVATAR;
                
                list.innerHTML += `
                    <li class="lb-item">
                        <img src="${imgSrc}" class="lb-avatar" alt="${user.name}" style="border-color: #ff007f;">
                        <div class="lb-info">
                            <h4 class="lb-name">${user.name}</h4>
                            <p class="lb-district">${user.district || 'Registered Participant'}</p>
                        </div>
                        <div class="lb-score" style="border-color: #ff007f; color: #ff007f; background: rgba(255, 0, 127, 0.1);">
                            ✓ Ready
                        </div>
                    </li>
                `;
            });
        } else {
            list.innerHTML = '<p style="text-align:center; color:gray;">No participants registered yet.</p>';
            if(activeCount) activeCount.innerText = '0';
        }
    } catch (err) {
        console.error("Failed to load eligible participants", err);
    }
}

// Fetch and render the dark neon leaderboard (Post-login)
async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        if (data.success && data.leaderboard.length > 0) {
            list.innerHTML = ''; // Clear loading text
            
            data.leaderboard.forEach((user, index) => {
                const imgSrc = user.profile_pic || DEFAULT_AVATAR;
                const rank = index + 1; // Calculate rank based on array order
                
                list.innerHTML += `
                    <li class="lb-item">
                        <div class="lb-rank">#${rank}</div>
                        <img src="${imgSrc}" class="lb-avatar" alt="${user.name}">
                        <div class="lb-info">
                            <h4 class="lb-name">${user.name}</h4>
                            <p class="lb-district">${user.district || 'Participant'}</p>
                        </div>
                        <div class="lb-score">
                            ⭐ ${user.final_score}
                        </div>
                    </li>
                `;
            });
        } else {
            list.innerHTML = '<p style="text-align:center; color:gray;">No scores yet.</p>';
        }
    } catch (err) {
        console.error("Failed to load leaderboard", err);
    }
}

// ==========================================
// 2. ASSESSMENT PAGE LOGIC
// ==========================================
async function initAssessmentPage() {
    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    // Block Paste globally to prevent cheating
    document.addEventListener('paste', e => e.preventDefault());

    try {
        // Fetching Day 1 questions
        const res = await fetch(`${API_URL}/questions/1`);
        const data = await res.json();
        currentQuestions = data.questions || [];
        
        if (currentQuestions.length > 0) {
            loadNextQuestion();
        } else {
            document.getElementById('question-container').innerHTML = "<p>No questions available today.</p>";
            document.getElementById('next-btn').style.display = 'none';
        }

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', submitCurrentAnswer);
        }
    } catch (err) {
        console.error("Failed to load questions", err);
    }
}

function loadNextQuestion() {
    if (questionIndex >= currentQuestions.length) {
        alert("Assessment Complete! Thank you.");
        window.location.href = 'index.html';
        return;
    }

    const q = currentQuestions[questionIndex];
    document.getElementById('q-number').innerText = questionIndex + 1;
    
    let html = `<p><strong>${q.question_text}</strong></p>`;
    
    // Render textarea for paragraphs, normal input for others
    if (q.question_type === 'paragraph') {
        html += `<textarea id="answer-input" rows="8"></textarea>`;
    } else {
        html += `<input type="text" id="answer-input">`;
    }
    
    document.getElementById('question-container').innerHTML = html;
    
    // Start the strict timer
    startTimer(q.time_limit);
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    let timeLeft = seconds;
    const timerDisplay = document.getElementById('timer');
    
    timerDisplay.innerText = `${timeLeft}s`;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitCurrentAnswer(); // Auto-submit when time is up
        }
    }, 1000);
}

async function submitCurrentAnswer() {
    clearInterval(timerInterval);
    const q = currentQuestions[questionIndex];
    const inputEl = document.getElementById('answer-input');
    const answer = inputEl ? inputEl.value : "";

    try {
        await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId, 
                dayNumber: 1, 
                answers: [{ questionId: q.id, answerText: answer }] 
            })
        });
        
        questionIndex++;
        loadNextQuestion();
    } catch (err) {
        console.error("Failed to submit answer", err);
        alert("Error submitting answer. Please check your connection.");
    }
}




// ==========================================
// 3. ADMIN / JUDGE PAGE LOGIC (CRUD & EVALUATION)
// ==========================================
function initAdminPage() {
    const judgeId = localStorage.getItem('judgeId');
    const judgeName = localStorage.getItem('judgeName');

    if (judgeId) {
        document.getElementById('judge-login-section').style.display = 'none';
        document.getElementById('judge-dashboard').style.display = 'block';
        document.getElementById('judge-name-display').innerText = judgeName;
        loadAdminSubmissions();
        loadAdminQuestions();
    }

    const judgeLoginBtn = document.getElementById('judge-login-btn');
    if (judgeLoginBtn) {
        judgeLoginBtn.addEventListener('click', async () => {
            const code = document.getElementById('judgeCode').value;
            if (!code) return alert("Please enter a Judge Code.");

            try {
                const res = await fetch(`${API_URL}/judge/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ judge_code: code })
                });
                const data = await res.json();
                
                if (data.success) {
                    localStorage.setItem('judgeId', data.judgeId);
                    localStorage.setItem('judgeName', data.judgeName);
                    window.location.reload(); // Refresh to show dashboard
                } else {
                    alert("Invalid Judge Code!");
                }
            } catch (err) {
                alert("Server error connecting to judge portal.");
            }
        });
    }
}

function logoutJudge() {
    localStorage.removeItem('judgeId');
    localStorage.removeItem('judgeName');
    window.location.reload();
}

// ---- GRADING SUBMISSIONS ----
async function loadAdminSubmissions() {
    try {
        const res = await fetch(`${API_URL}/admin/submissions`);
        const data = await res.json();
        
        const list = document.getElementById('submissions-list');
        if (!list) return;

        list.innerHTML = '';
        if (data.success && data.submissions.length > 0) {
            data.submissions.forEach(sub => {
                const img = sub.profile_pic || DEFAULT_AVATAR;
                const currentAvg = sub.avg_marks !== null ? sub.avg_marks : 'Pending';
                
                list.innerHTML += `
                    <div class="lb-item" style="display: block;">
                        <div style="display: flex; align-items: center; margin-bottom: 15px;">
                            <img src="${img}" class="lb-avatar" alt="Student">
                            <div>
                                <h4 class="lb-name" style="color: var(--neon-cyan);">${sub.name}</h4>
                                <p class="lb-district">District: ${sub.district || 'N/A'}</p>
                            </div>
                        </div>
                        <p style="color: var(--neon-pink); font-weight: bold; margin: 5px 0;">Q: ${sub.question_text}</p>
                        <p style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">${sub.answer_text}</p>
                        
                        <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
                            <label style="font-weight:bold;">Give Marks (0-10):</label>
                            <input type="number" id="marks-${sub.submission_id}" max="10" min="0" style="width: 100px; margin: 0;">
                            <button class="btn" style="width: auto; padding: 10px 20px; font-size: 14px;" onclick="submitEvaluation(${sub.submission_id})">Save Score</button>
                            <span style="margin-left: auto; color: var(--text-muted);">Current Avg: <strong style="color: white;">${currentAvg}</strong></span>
                        </div>
                    </div>
                `;
            });
        } else {
            list.innerHTML = '<p style="color:gray;">No submissions to grade yet.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function submitEvaluation(subId) {
    // Determine which judge is grading based on ID (Judge 1 or Judge 2)
    const judgeId = parseInt(localStorage.getItem('judgeId'));
    const marks = document.getElementById(`marks-${subId}`).value;

    if (!marks) return alert("Please enter marks before saving.");

    try {
        const res = await fetch(`${API_URL}/admin/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission_id: subId, judge_number: judgeId, marks })
        });
        
        if (res.ok) {
            alert('Marks saved successfully!');
            loadAdminSubmissions(); // Refresh the list
        }
    } catch (err) {
        alert("Error saving marks.");
    }
}

// ---- MANAGING QUESTIONS (CRUD) ----
async function loadAdminQuestions() {
    try {
        const res = await fetch(`${API_URL}/admin/questions/all`);
        const data = await res.json();
        
        const list = document.getElementById('admin-questions-list');
        if (!list) return;

        list.innerHTML = '';
        if (data.success && data.questions.length > 0) {
            data.questions.forEach(q => {
                list.innerHTML += `
                    <li class="lb-item" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #ffd700;">Day ${q.day_number}</strong> | 
                            <span style="color: var(--neon-cyan);">${q.time_limit}s</span>
                            <p style="margin: 5px 0;">${q.question_text}</p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn" style="background: #ffaa00; width: auto; padding: 8px 15px; font-size: 14px;" onclick="startEditQuestion(${q.id}, '${q.question_text.replace(/'/g, "\\'")}', '${q.question_type}', ${q.time_limit})">Edit</button>
                            <button class="btn" style="background: #ff3333; width: auto; padding: 8px 15px; font-size: 14px;" onclick="deleteQuestion(${q.id})">Delete</button>
                        </div>
                    </li>
                `;
            });
        } else {
            list.innerHTML = '<p style="color:gray;">No questions found.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function saveQuestion() {
    const id = document.getElementById('edit-q-id').value;
    const payload = {
        day_number: document.getElementById('qDay').value,
        question_type: document.getElementById('qType').value,
        question_text: document.getElementById('qText').value,
        time_limit: document.getElementById('qTime').value
    };

    if (!payload.question_text) return alert("Question text cannot be empty.");

    const url = id ? `${API_URL}/admin/questions/${id}` : `${API_URL}/admin/add-question`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert(id ? 'Question Updated!' : 'Question Added!');
            cancelEdit();
            loadAdminQuestions();
        }
    } catch (err) {
        alert("Error saving question.");
    }
}

function startEditQuestion(id, text, type, time) {
    document.getElementById('form-title').innerText = "✏️ Edit Question";
    document.getElementById('edit-q-id').value = id;
    document.getElementById('qText').value = text;
    document.getElementById('qType').value = type;
    document.getElementById('qTime').value = time;
    
    document.getElementById('save-q-btn').innerText = "Update Question";
    document.getElementById('cancel-edit-btn').style.display = "inline-block";
    
    // Scroll to form
    document.querySelector('.crud-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('form-title').innerText = "➕ Add New Question";
    document.getElementById('edit-q-id').value = "";
    document.getElementById('qText').value = "";
    document.getElementById('qTime').value = "300";
    
    document.getElementById('save-q-btn').innerText = "Save Question";
    document.getElementById('cancel-edit-btn').style.display = "none";
}

async function deleteQuestion(id) {
    if (!confirm("Are you sure you want to delete this question? This will also delete all student submissions for it!")) return;

    try {
        const res = await fetch(`${API_URL}/admin/questions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Question Deleted.");
            loadAdminQuestions();
        }
    } catch (err) {
        alert("Error deleting question.");
    }
}

