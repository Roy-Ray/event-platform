const express = require('express');
const cors = require('cors');
const pool = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());

// Login
app.post('/login', async (req, res) => {
    const { name, phone } = req.body;
    try {
        const [rows] = await pool.query('SELECT id FROM Users WHERE phone = ?', [phone]);
        if (rows.length > 0) {
            res.json({ success: true, userId: rows[0].id });
        } else {
            const [result] = await pool.query('INSERT INTO Users (name, phone) VALUES (?, ?)', [name, phone]);
            res.json({ success: true, userId: result.insertId });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Leaderboard (Best 3 out of 5)
app.get('/leaderboard', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.name, u.profile_pic, 
                   COALESCE(SUM(top_scores.total_score), 0) AS final_score
            FROM Users u
            LEFT JOIN (
                SELECT user_id, total_score,
                       ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY total_score DESC) as rn
                FROM DailyScores
            ) top_scores ON u.id = top_scores.user_id AND top_scores.rn <= 3
            GROUP BY u.id, u.name, u.profile_pic
            ORDER BY final_score DESC
        `;
        const [leaderboard] = await pool.query(query);
        res.json({ success: true, leaderboard });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Fetch Questions for a Day
app.get('/questions/:day', async (req, res) => {
    try {
        const [questions] = await pool.query('SELECT id, question_type, question_text, options FROM Questions WHERE day_number = ?', [req.params.day]);
        res.json({ success: true, questions });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Submit Assessment (WITH AUTO-GRADING)
app.post('/submit', async (req, res) => {
    const { userId, dayNumber, answers } = req.body;
    let dailyScore = 0;

    try {
        for (let ans of answers) {
            let marksAwarded = 0;
            let isGraded = false;

            // Fetch the correct answer from DB to prevent front-end cheating
            const [qRow] = await pool.query('SELECT question_type, correct_answer FROM Questions WHERE id = ?', [ans.questionId]);
            
            if (qRow.length > 0) {
                const question = qRow[0];
                
                // Auto-grade logic
                if (question.question_type === 'mcq' || question.question_type === 'fill_blank') {
                    isGraded = true;
                    // Compare answers (ignoring case and whitespace)
                    if (question.correct_answer && ans.answerText.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()) {
                        marksAwarded = 10; // 10 points per correct answer
                        dailyScore += marksAwarded;
                    }
                }
            }

            // Save the submission
            await pool.query(
                'INSERT INTO Submissions (user_id, question_id, answer_text, marks_awarded, is_graded) VALUES (?, ?, ?, ?, ?)',
                [userId, ans.questionId, ans.answerText, marksAwarded, isGraded]
            );
        }
        
        // Update the total score for that day
        await pool.query(
            'INSERT INTO DailyScores (user_id, day_number, total_score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_score = total_score + ?',
            [userId, dayNumber, dailyScore, dailyScore]
        );

        res.json({ success: true, scoreEarned: dailyScore });
    } catch (err) {
        console.error(err);
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
app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
});