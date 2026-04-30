const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// 1. USER LOGIN & REGISTRATION
// ==========================================
app.post('/login', async (req, res) => {
    // FIXED: Now expects district and general_code instead of phone
    const { name, district, general_code } = req.body;
    
    try {
        const [rows] = await pool.query('SELECT id FROM Users WHERE name = ?', [name]);
        if (rows.length > 0) {
            // User exists, log them in
            res.json({ success: true, userId: rows[0].id });
        } else {
            // New user, insert with district and code
            const [result] = await pool.query(
                'INSERT INTO Users (name, district, general_code) VALUES (?, ?, ?)', 
                [name, district, general_code]
            );
            res.json({ success: true, userId: result.insertId });
        }
    } catch (err) {
        console.error("LOGIN ERROR: ", err); // This will help debug if it fails again
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ==========================================
// 2. FETCH LEADERBOARD / ELIGIBLE PARTICIPANTS
// ==========================================
app.get('/leaderboard', async (req, res) => {
    try {
        // FIXED: Added 'district' to the SELECT and GROUP BY clauses for the new UI
        const query = `
            SELECT u.id, u.name, u.profile_pic, u.district,
                   COALESCE(SUM(top_scores.total_score), 0) AS final_score
            FROM Users u
            LEFT JOIN (
                SELECT user_id, total_score,
                       ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY total_score DESC) as rn
                FROM DailyScores
            ) top_scores ON u.id = top_scores.user_id AND top_scores.rn <= 3
            GROUP BY u.id, u.name, u.profile_pic, u.district
            ORDER BY final_score DESC
        `;
        const [leaderboard] = await pool.query(query);
        res.json({ success: true, leaderboard });
    } catch (err) {
        console.error("LEADERBOARD ERROR: ", err);
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 3. FETCH QUESTIONS FOR ASSESSMENT
// ==========================================
app.get('/questions/:day', async (req, res) => {
    try {
        // FIXED: Added time_limit to the query so the frontend timer knows how long to run
        const [questions] = await pool.query(
            'SELECT id, question_type, question_text, options, time_limit FROM Questions WHERE day_number = ?', 
            [req.params.day]
        );
        res.json({ success: true, questions });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 4. SUBMIT ASSESSMENT & AUTO-GRADING
// ==========================================
app.post('/submit', async (req, res) => {
    const { userId, dayNumber, answers } = req.body;
    let dailyScore = 0;

    try {
        for (let ans of answers) {
            let marksAwarded = 0;
            let isGraded = false;

            const [qRow] = await pool.query('SELECT question_type, correct_answer FROM Questions WHERE id = ?', [ans.questionId]);
            
            if (qRow.length > 0) {
                const question = qRow[0];
                
                // Auto-grade logic for MCQ and Fill in Blank
                if (question.question_type === 'mcq' || question.question_type === 'fill_blank') {
                    isGraded = true;
                    if (question.correct_answer && ans.answerText.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()) {
                        marksAwarded = 10;
                        dailyScore += marksAwarded;
                    }
                }
            }

            await pool.query(
                'INSERT INTO Submissions (user_id, question_id, answer_text, marks_awarded, is_graded) VALUES (?, ?, ?, ?, ?)',
                [userId, ans.questionId, ans.answerText, marksAwarded, isGraded]
            );
        }
        
        await pool.query(
            'INSERT INTO DailyScores (user_id, day_number, total_score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_score = total_score + ?',
            [userId, dayNumber, dailyScore, dailyScore]
        );

        res.json({ success: true, scoreEarned: dailyScore });
    } catch (err) {
        console.error("SUBMIT ERROR: ", err);
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 5. JUDGE PANEL ROUTES
// ==========================================

// Fetch all submissions for the judges
app.get('/admin/submissions', async (req, res) => {
    try {
        const query = `
            SELECT s.id as submission_id, u.name, u.profile_pic, u.district, 
                   q.question_text, s.answer_text, s.judge1_marks, s.judge2_marks, s.avg_marks
            FROM Submissions s
            JOIN Users u ON s.user_id = u.id
            JOIN Questions q ON s.question_id = q.id
        `;
        const [submissions] = await pool.query(query);
        res.json({ success: true, submissions });
    } catch (err) {
        console.error("ADMIN SUBMISSIONS ERROR: ", err);
        res.status(500).json({ success: false });
    }
});

// Save judge evaluations and calculate average
app.post('/admin/evaluate', async (req, res) => {
    const { submission_id, judge_number, marks } = req.body;
    try {
        const column = judge_number === 1 ? 'judge1_marks' : 'judge2_marks';
        await pool.query(`UPDATE Submissions SET ${column} = ? WHERE id = ?`, [marks, submission_id]);

        // Calculate average if both judges have graded
        await pool.query(`
            UPDATE Submissions 
            SET avg_marks = (judge1_marks + judge2_marks) / 2 
            WHERE id = ? AND judge1_marks IS NOT NULL AND judge2_marks IS NOT NULL
        `, [submission_id]);

        res.json({ success: true });
    } catch (err) {
        console.error("ADMIN EVALUATE ERROR: ", err);
        res.status(500).json({ success: false });
    }
});

// Admin Add Question
app.post('/admin/add-question', async (req, res) => {
    const { day_number, question_type, question_text, options, correct_answer } = req.body;
    try {
        await pool.query('INSERT IGNORE INTO EventDays (day_number, is_active) VALUES (?, true)', [day_number]);
        await pool.query(
            'INSERT INTO Questions (day_number, question_type, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)',
            [day_number, question_type, question_text, options, correct_answer]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

const PORT = 3000;
// ==========================================
// NEW JUDGE & CRUD ROUTES
// ==========================================

// Judge Login
app.post('/judge/login', async (req, res) => {
    const { judge_code } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM Judges WHERE judge_code = ?', [judge_code]);
        if (rows.length > 0) {
            res.json({ success: true, judgeId: rows[0].id, judgeName: rows[0].name });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Judge Code' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// Get all questions for the Admin Panel
app.get('/admin/questions/all', async (req, res) => {
    try {
        const [questions] = await pool.query('SELECT * FROM Questions ORDER BY day_number, id');
        res.json({ success: true, questions });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Update a question (Edit)
app.put('/admin/questions/:id', async (req, res) => {
    const { question_type, question_text, time_limit } = req.body;
    try {
        await pool.query(
            'UPDATE Questions SET question_type = ?, question_text = ?, time_limit = ? WHERE id = ?',
            [question_type, question_text, time_limit, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Delete a question
app.delete('/admin/questions/:id', async (req, res) => {
    try {
        // First, delete any submissions tied to this question to prevent foreign key errors
        await pool.query('DELETE FROM Submissions WHERE question_id = ?', [req.params.id]);
        // Then, delete the actual question
        await pool.query('DELETE FROM Questions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});
app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
});