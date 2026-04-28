const API_URL = 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'; 
let currentDay = 1; // You can make this dynamic later based on admin settings

// ==========================================
// INDEX.HTML LOGIC
// ==========================================
async function loginUser() {
    const name = document.getElementById('userName').value;
    const phone = document.getElementById('userPhone').value;

    if (!name || !phone) return alert("Please enter both Name and Phone.");

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
    });
    const data = await res.json();
    
    if(data.success) {
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userName', name);
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'grid';
        document.getElementById('display-name').innerText = name;
        loadLeaderboard();
    } else {
        alert("Login failed.");
    }
}

async function loadLeaderboard() {
    const res = await fetch(`${API_URL}/leaderboard`);
    const data = await res.json();
    const list = document.getElementById('leaderboard-list');
    if (!list) return; // Prevent error if not on index.html
    
    list.innerHTML = '';

    data.leaderboard.forEach(user => {
        const imgSrc = user.profile_pic ? user.profile_pic : DEFAULT_AVATAR;
        list.innerHTML += `
            <li class="leaderboard-item">
                <img src="${imgSrc}" class="user-avatar" alt="Avatar">
                <span>${user.name} - Score: ${user.final_score}</span>
            </li>
        `;
    });
}

// ==========================================
// ASSESSMENT.HTML LOGIC
// ==========================================
async function loadQuestions() {
    const res = await fetch(`${API_URL}/questions/${currentDay}`);
    const data = await res.json();
    
    const form = document.getElementById('assessment-form');
    document.getElementById('assessment-title').innerText = `Day ${currentDay} Assessment`;
    form.innerHTML = '';
    
    data.questions.forEach((q, index) => {
        let questionHTML = `<div class="question-block" style="margin-bottom: 20px;">
                                <p><strong>Q${index + 1}: ${q.question_text}</strong></p>`;
        
        if (q.question_type === 'mcq') {
            const options = JSON.parse(q.options);
            for (const [key, value] of Object.entries(options)) {
                questionHTML += `<label><input type="radio" name="q_${q.id}" value="${key}"> ${value}</label><br>`;
            }
        } else if (q.question_type === 'fill_blank') {
            questionHTML += `<input type="text" name="q_${q.id}" placeholder="Type your answer here..." required>`;
        } else {
            questionHTML += `<textarea name="q_${q.id}" rows="4" style="width: 100%;" placeholder="Write your response here..." required></textarea>`;
        }
        
        questionHTML += `</div>`;
        form.innerHTML += questionHTML;
    });
}

async function submitAssessment() {
    const form = document.getElementById('assessment-form');
    const formData = new FormData(form);
    const answers = [];

    for (let [name, value] of formData.entries()) {
        answers.push({ questionId: name.split('_')[1], answerText: value });
    }

    const res = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: localStorage.getItem('userId'), dayNumber: currentDay, answers })
    });

    const data = await res.json();
    if (data.success) {
        alert(`Assessment submitted! You scored ${data.scoreEarned} marks.`);
        window.location.href = 'index.html';
    }
}

// ==========================================
// ADMIN.HTML LOGIC
// ==========================================
function toggleAdminOptions() {
    const qType = document.getElementById('qType').value;
    document.getElementById('mcq-options').style.display = qType === 'mcq' ? 'block' : 'none';
}

async function addQuestion() {
    const data = {
        day_number: document.getElementById('dayNumber').value,
        question_type: document.getElementById('qType').value,
        question_text: document.getElementById('qText').value,
        options: document.getElementById('qType').value === 'mcq' ? document.getElementById('qOptions').value : null,
        correct_answer: document.getElementById('qCorrectAnswer').value
    };

    const res = await fetch(`${API_URL}/admin/add-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if(result.success) {
        alert('Question added successfully!');
        document.getElementById('qText').value = ''; 
        document.getElementById('qOptions').value = ''; 
        document.getElementById('qCorrectAnswer').value = ''; 
    }
}