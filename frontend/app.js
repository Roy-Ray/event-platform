// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const API_URL = ''; 
const DEFAULT_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

// Use sessionStorage so they must log in every time they open a new tab
const userId = sessionStorage.getItem('userId');
const userName = sessionStorage.getItem('userName');
const hasCompleted = sessionStorage.getItem('hasCompleted') === 'true';
let currentQuestions = [];
let questionIndex = 0;
let timerInterval;

document.addEventListener('DOMContentLoaded', () => {
    // Record the page view immediately on load!
    recordPageView(); 
    
    // --- NEW: Activate the Image Zoom feature ---
    setupImageZoom(); 

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
    if (userId) {
        document.getElementById('pre-login-view').style.display = 'none';
        document.getElementById('post-login-view').style.display = 'grid'; 
        document.getElementById('display-name').innerText = userName;
        
        // Disable button if already completed
        if (hasCompleted) {
            const startBtn = document.getElementById('start-assessment-btn');
            if(startBtn) {
                startBtn.innerText = "TEST COMPLETED ✅";
                startBtn.disabled = true;
                startBtn.style.background = "rgba(255, 255, 255, 0.05)";
                startBtn.style.color = "var(--neon-cyan)";
                startBtn.style.border = "1px solid var(--neon-cyan)";
                startBtn.style.boxShadow = "none";
                startBtn.style.cursor = "not-allowed";
                startBtn.onclick = null;
            }
        }
        
        loadLeaderboard(); 
    } else {
        loadEligibleParticipants();
    }

    loadLiveResults(); 

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            // Trim spaces and allow district to be blank
            const name = document.getElementById('userName').value.trim();
            const district = document.getElementById('userDistrict').value.trim();
            const code = document.getElementById('generalCode').value.trim();

            if (!name || !code) return alert("Name and Event Code are required.");

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, district, general_code: code })
                });
                const data = await res.json();
                
                if (data.success) {
                    // Show popup if they already took the test
                    if (data.hasCompleted) {
                        alert("⚠️ Welcome back! You have already submitted your assessment. You cannot take the test again.");
                    }

                    sessionStorage.setItem('userId', data.userId);
                    sessionStorage.setItem('userName', name);
                    sessionStorage.setItem('hasCompleted', data.hasCompleted);
                    
                    document.getElementById('pre-login-view').style.display = 'none';
                    document.getElementById('post-login-view').style.display = 'grid';
                    document.getElementById('display-name').innerText = name;
                    
                    // Disable button immediately upon login
                    if (data.hasCompleted) {
                        const startBtn = document.getElementById('start-assessment-btn');
                        if(startBtn) {
                            startBtn.innerText = "TEST COMPLETED ✅";
                            startBtn.disabled = true;
                            startBtn.style.background = "rgba(255, 255, 255, 0.05)";
                            startBtn.style.color = "var(--neon-cyan)";
                            startBtn.style.border = "1px solid var(--neon-cyan)";
                            startBtn.style.boxShadow = "none";
                            startBtn.style.cursor = "not-allowed";
                            startBtn.onclick = null;
                        }
                    }

                    loadLeaderboard(); 
                } else {
                    alert(data.message || "Login failed.");
                }
            } catch (err) {
                alert("Could not connect to the server.");
            }
        });
    }
}

async function loadEligibleParticipants() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        
        const list = document.getElementById('eligible-list');
        if (!list) return;

        if (data.success && data.leaderboard.length > 0) {
            list.innerHTML = ''; 
            
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
            
            // Start the dynamic visual effect once list is loaded
            startDynamicShuffle();

        } else {
            list.innerHTML = '<p style="text-align:center; color:gray;">No participants registered yet.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        if (data.success && data.leaderboard.length > 0) {
            list.innerHTML = ''; 
            data.leaderboard.forEach((user, index) => {
                const imgSrc = user.profile_pic || DEFAULT_AVATAR;
                list.innerHTML += `
                    <li class="lb-item">
                        <div class="lb-rank">#${index + 1}</div>
                        <img src="${imgSrc}" class="lb-avatar" alt="${user.name}">
                        <div class="lb-info">
                            <h4 class="lb-name">${user.name}</h4>
                            <p class="lb-district">${user.district || 'Participant'}</p>
                        </div>
                        <div class="lb-score">⭐ ${user.final_score}</div>
                    </li>
                `;
            });

            // Trigger dynamic scroll effect
            startAutoScroll();

        } else {
            list.innerHTML = '<p style="text-align:center; color:gray;">No scores yet.</p>';
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadLiveResults() {
    try {
        const res = await fetch(`${API_URL}/results`);
        const data = await res.json();
        
        const list = document.getElementById('live-results-list');
        const view = document.getElementById('live-results-view');
        if (!list || !view) return;

        if (data.success && data.results.length > 0) {
            view.style.display = 'block'; 
            list.innerHTML = ''; 
            
            data.results.forEach((user, index) => {
                const imgSrc = user.profile_pic || DEFAULT_AVATAR;
                
                let rankColor = "var(--text-muted)";
                let medal = "";
                if(index === 0) { rankColor = "#ffd700"; medal = "🥇"; }      // 1st Place
                else if(index === 1) { rankColor = "#c0c0c0"; medal = "🥈"; } // 2nd Place
                else if(index === 2) { rankColor = "#cd7f32"; medal = "🥉"; } // 3rd Place

                list.innerHTML += `
                    <li class="lb-item" style="border-left: 4px solid ${rankColor}; display: flex; align-items: center; padding: 15px;">
                        <div class="lb-rank" style="color: ${rankColor}; width: 60px; font-size: 18px;">${medal} #${index + 1}</div>
                        <img src="${imgSrc}" class="lb-avatar" alt="${user.name}" style="border-color: ${rankColor}">
                        <div class="lb-info">
                            <h4 class="lb-name" style="margin: 0; font-size: 16px;">${user.name}</h4>
                            <p class="lb-district" style="margin: 0; font-size: 12px; color: var(--text-muted);">${user.district || 'Participant'}</p>
                        </div>
                        <div class="lb-score" style="border-color: ${rankColor}; color: ${rankColor}; background: rgba(0,0,0,0.3); padding: 5px 15px; border-radius: 20px;">
                            ⭐ ${Number(user.final_score).toFixed(2)}
                        </div>
                    </li>
                `;
            });
        } else {
            view.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
    }
}

// Allow multiple students to use the same device
function studentLogout() {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('hasCompleted');
    window.location.reload();
}

// ==========================================
// 2. ASSESSMENT PAGE LOGIC
// ==========================================
async function initAssessmentPage() {
    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    // Kick them out if they already took the test!
    if (sessionStorage.getItem('hasCompleted') === 'true') {
        alert("⚠️ Access Denied: You have already completed the assessment!");
        window.location.href = 'index.html';
        return;
    }

    document.addEventListener('paste', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());

    try {
        const res = await fetch(`${API_URL}/questions/1`);
        const data = await res.json();
        currentQuestions = data.questions || [];
        
        if (currentQuestions.length > 0) {
            document.getElementById('total-q').innerText = currentQuestions.length;
            document.getElementById('next-btn').style.display = 'inline-block';
            loadNextQuestion();
        } else {
            document.getElementById('question-container').innerHTML = "<p style='text-align:center;'>No questions available today.</p>";
        }

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', submitCurrentAnswer);
        }
    } catch (err) {
        console.error(err);
    }
}

function loadNextQuestion() {
    if (questionIndex >= currentQuestions.length) {
        alert("Assessment Complete! Returning to Dashboard.");
        sessionStorage.setItem('hasCompleted', 'true'); // Flag as completed locally
        window.location.href = 'index.html';
        return;
    }

    const q = currentQuestions[questionIndex];
    document.getElementById('q-number').innerText = questionIndex + 1;
    
    let html = `<div class="question-text">${q.question_text}</div>`;
    
    if (q.question_type === 'paragraph') {
        html += `<textarea id="answer-input" class="assessment-input" placeholder="Type your detailed answer here... (Minimum 200 words recommended)"></textarea>`;
    } else if (q.question_type === 'mcq') {
        html += `<select id="answer-input" class="assessment-input" style="cursor: pointer;">
                    <option value="">-- Select an option --</option>`;
        if (q.options) {
            try {
                const opts = JSON.parse(q.options);
                for (const [key, val] of Object.entries(opts)) {
                    html += `<option value="${key}">${key.toUpperCase()}: ${val}</option>`;
                }
            } catch(e) { console.error("Invalid MCQ JSON"); }
        }
        html += `</select>`;
    } else {
        html += `<input type="text" id="answer-input" class="assessment-input" placeholder="Type your short answer here...">`;
    }
    
    document.getElementById('question-container').innerHTML = html;
    startTimer(q.time_limit);
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    let timeLeft = seconds;
    const timerDisplay = document.getElementById('timer');
    
    timerDisplay.innerText = `${timeLeft}s`;
    timerDisplay.classList.remove('danger');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}s`;
        if (timeLeft <= 10) timerDisplay.classList.add('danger');
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitCurrentAnswer(); 
        }
    }, 1000);
}

async function submitCurrentAnswer() {
    clearInterval(timerInterval);
    const nextBtn = document.getElementById('next-btn');
    nextBtn.innerText = "Saving... ⏳";
    nextBtn.disabled = true;

    const q = currentQuestions[questionIndex];
    const inputEl = document.getElementById('answer-input');
    const answer = inputEl ? inputEl.value : "";

    try {
        const res = await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, dayNumber: 1, answers: [{ questionId: q.id, answerText: answer }] })
        });
        
        if (!res.ok) {
            throw new Error("Server rejected the submission");
        }
        
        questionIndex++;
        nextBtn.innerText = "Submit & Next ▶";
        nextBtn.disabled = false;
        loadNextQuestion();
    } catch (err) {
        console.error(err);
        alert("Error saving answer. Please try again.");
        nextBtn.innerText = "Submit & Next ▶";
        nextBtn.disabled = false;
    }
}

// ==========================================
// 3. ADMIN / JUDGE PAGE LOGIC
// ==========================================
function initAdminPage() {
    const judgeId = localStorage.getItem('judgeId'); // Judges still use local storage for convenience
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
                    window.location.reload(); 
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

async function loadAdminSubmissions() {
    try {
        const res = await fetch(`${API_URL}/admin/submissions`);
        const data = await res.json();
        const list = document.getElementById('submissions-list');
        if (!list) return;

        list.innerHTML = '';
        if (data.success && data.submissions.length > 0) {
            const judgeId = parseInt(localStorage.getItem('judgeId'));

            data.submissions.forEach(sub => {
                const img = sub.profile_pic || DEFAULT_AVATAR;
                const currentAvg = sub.avg_marks !== null ? sub.avg_marks : 'Pending';
                const maxMarks = sub.max_marks || 10;
                
                const myPrevMarks = judgeId === 1 ? sub.judge1_marks : sub.judge2_marks;
                const markVal = (myPrevMarks !== null && myPrevMarks !== undefined) ? myPrevMarks : '';
                
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
                            <label style="font-weight:bold;">Give Marks (0 - ${maxMarks}):</label>
                            <input type="number" id="marks-${sub.submission_id}" value="${markVal}" max="${maxMarks}" min="0" style="width: 100px; margin: 0;">
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
            loadAdminSubmissions(); 
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
                const typeLabel = q.question_type === 'mcq' ? 'MCQ' : (q.question_type === 'fill_blank' ? 'Short Answer' : 'Paragraph');
                
                const qOptionsStr = q.options ? encodeURIComponent(q.options) : '';
                const qCorrectStr = q.correct_answer ? encodeURIComponent(q.correct_answer) : '';
                const qTextStr = encodeURIComponent(q.question_text);

                list.innerHTML += `
                    <li class="lb-item" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #ffd700;">Day ${q.day_number}</strong> | 
                            <span style="color: var(--neon-pink); font-size: 12px; border: 1px solid var(--neon-pink); padding: 2px 6px; border-radius: 10px;">${typeLabel}</span>
                            <span style="color: var(--neon-cyan); margin-left: 10px;">⏱️ ${q.time_limit}s</span>
                            <span style="color: #ffd700; margin-left: 10px;">⭐ ${q.max_marks || 10} Marks</span>
                            <p style="margin: 5px 0;">${q.question_text}</p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn" style="background: #ffaa00; width: auto; padding: 8px 15px; font-size: 14px;" 
                                onclick="startEditQuestion(${q.id}, '${qTextStr}', '${q.question_type}', ${q.time_limit}, '${qOptionsStr}', '${qCorrectStr}', ${q.max_marks || 10})">Edit</button>
                            <button class="btn" style="background: #ff3333; width: auto; padding: 8px 15px; font-size: 14px;" 
                                onclick="deleteQuestion(${q.id})">Delete</button>
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
        time_limit: document.getElementById('qTime').value,
        options: document.getElementById('qOptions').value,
        correct_answer: document.getElementById('qCorrect').value,
        max_marks: document.getElementById('qMarks').value
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

function startEditQuestion(id, textEncoded, type, time, optionsEncoded, correctEncoded, marks) {
    document.getElementById('form-title').innerText = "✏️ Edit Question";
    document.getElementById('edit-q-id').value = id;
    document.getElementById('qText').value = decodeURIComponent(textEncoded);
    document.getElementById('qType').value = type;
    document.getElementById('qTime').value = time;
    document.getElementById('qOptions').value = optionsEncoded ? decodeURIComponent(optionsEncoded) : '';
    document.getElementById('qCorrect').value = correctEncoded ? decodeURIComponent(correctEncoded) : '';
    document.getElementById('qMarks').value = marks;
    
    document.getElementById('save-q-btn').innerText = "Update Question";
    document.getElementById('cancel-edit-btn').style.display = "inline-block";
    
    if (typeof toggleMCQFields === 'function') toggleMCQFields();
    document.querySelector('.crud-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('form-title').innerText = "➕ Add New Question";
    document.getElementById('edit-q-id').value = "";
    document.getElementById('qText').value = "";
    document.getElementById('qTime').value = "300";
    document.getElementById('qOptions').value = "";
    document.getElementById('qCorrect').value = "";
    document.getElementById('qMarks').value = "10";
    
    document.getElementById('save-q-btn').innerText = "Save Question";
    document.getElementById('cancel-edit-btn').style.display = "none";
    if (typeof toggleMCQFields === 'function') toggleMCQFields();
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

// ==========================================
// DYNAMIC UI EFFECTS (PAGE VIEWS TRACKER)
// ==========================================

async function recordPageView() {
    const counter = document.getElementById('active-count');
    if (!counter) return;

    try {
        // Calls the backend route to +1 the view count and retrieve the new total
        const res = await fetch(`${API_URL}/pageview`);
        const data = await res.json();
        
        if (data.success) {
            counter.innerText = data.views;
        }
    } catch (err) {
        console.error("Error fetching page views");
    }
}

// ==========================================
// IMAGE ZOOM FEATURE (1.5 SECONDS)
// ==========================================
function setupImageZoom() {
    // 1. Create the overlay element behind the scenes
    const overlay = document.createElement('div');
    overlay.className = 'img-zoom-overlay';
    const popupImg = document.createElement('img');
    overlay.appendChild(popupImg);
    document.body.appendChild(overlay);

    let zoomTimeout;

    // 2. Listen for clicks anywhere on the page
    document.body.addEventListener('click', (e) => {
        // Check if the thing they clicked was an Image (IMG)
        if (e.target.tagName === 'IMG') {
            e.preventDefault();

            // Copy the source of the clicked image into our popup image
            popupImg.src = e.target.src;
            
            // Show the popup!
            overlay.classList.add('active');

            // Reset the timer in case they click multiple images quickly
            clearTimeout(zoomTimeout);

            // Hide the popup exactly 1.5 seconds (1500 milliseconds) later
            zoomTimeout = setTimeout(() => {
                overlay.classList.remove('active');
            }, 1500);
        }
    });

    // 3. Optional: Let them click the background to close it early
    overlay.addEventListener('click', () => {
        overlay.classList.remove('active');
        clearTimeout(zoomTimeout);
    });
}

function startAutoScroll() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    let isHovered = false;

    list.addEventListener('mouseenter', () => isHovered = true);
    list.addEventListener('mouseleave', () => isHovered = false);

    setInterval(() => {
        if (!isHovered && list.scrollHeight > list.clientHeight) {
            list.scrollTop += 1; 
            
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - 1) {
                setTimeout(() => list.scrollTop = 0, 1000);
            }
        }
    }, 40);
}

// ==========================================
// DYNAMIC RANDOM SHUFFLER FOR ELIGIBLE LIST
// ==========================================
function startDynamicShuffle() {
    const list = document.getElementById('eligible-list');
    if (!list) return;

    // Clear any existing intervals so it doesn't speed up accidentally
    if (window.shuffleInterval) clearInterval(window.shuffleInterval);

    window.shuffleInterval = setInterval(() => {
        const items = list.querySelectorAll('.lb-item');
        // Only shuffle if there are at least 4 people in the list
        if (items.length < 4) return; 

        // Pick a random person to move
        const oldIndex = Math.floor(Math.random() * items.length);
        const itemToMove = items[oldIndex];

        // Step 1: Smoothly fade them out and shrink slightly
        itemToMove.style.opacity = '0';
        itemToMove.style.transform = 'scale(0.9) translateY(-10px)';

        // Step 2: Wait for the fade-out to finish (600ms), then move them
        setTimeout(() => {
            // Pick a brand new random position
            const newIndex = Math.floor(Math.random() * items.length);

            // Move them in the HTML DOM
            if (newIndex >= items.length - 1) {
                list.appendChild(itemToMove); // Send to the very bottom
            } else {
                list.insertBefore(itemToMove, items[newIndex]); // Send to the middle/top
            }

            // Step 3: Smoothly fade them back in at their new location!
            setTimeout(() => {
                itemToMove.style.opacity = '1';
                itemToMove.style.transform = 'scale(1) translateY(0)';
            }, 50); 
            
        }, 600); // 600ms matches our CSS transition time
        
    }, 3000); // Trigger a new random shuffle every 3 seconds
}