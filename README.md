# 🏆 Pradiper Bandana Event 2026: Live Assessment & Winners Portal

> **A premium, full-stack freelance project architected and developed by the Ray & Roy Engineering Team.**

## 📌 Project Overview
This application was commissioned as a custom freelance project to handle the live deployment, secure student assessment, and celebratory showcase for the **Pradiper Bandana Event 2026**. The client required a high-performance, responsive, and visually engaging web application to manage live exams, automate grading, and announce their final champions in real-time.

🚀 **Live Demo:** [https://pradiper-bandana-event.onrender.com/](https://pradiper-bandana-event.onrender.com/)

---

## ✨ Key Deliverables & Features

### 👨‍🎓 Student Assessment Portal
*   **Live Dashboard:** View eligible participants and live viewer counts before logging in.
*   **Secure Access:** Join the event using Name, District, and a secret Event Code.
*   **Focus-Mode Assessment:** Distraction-free exam UI with auto-grading for MCQs and short answers.
*   **Strict Timers & Anti-Cheat:** Per-question countdown timers that pulse red when time is low. Right-clicking and copy-pasting are strictly disabled.
*   **Real-time Leaderboard:** Automatically calculates and displays the Top Performers based on their best scores.

### ⚖️ Judge / Admin Control Panel
*   **Secure Judge Login:** Restricted access using unique Judge Codes.
*   **Submission Grading:** View student answers side-by-side with the question and assign marks out of the maximum allowed. Averages scores between multiple judges automatically.
*   **Question Management (CRUD):** Easily Add, Edit, or Delete questions. Supports Paragraphs, Short Answers, and Multiple Choice Questions (MCQ).
*   **Auto-Grading Setup:** Define correct answers and max marks for instant automatic grading on objective questions.

### 🎉 Grand Finale Winners Portal
*   **Real-time Data Fetching:** Seamless connection to the Aiven MySQL database to dynamically pull winner data without requiring page reloads.
*   **Tiered UI System:** Custom sorting algorithm to visually separate "Grade A" (Gold) and "Grade B" (Silver) winners automatically based on database inputs.
*   **High-End Visuals:** Implemented interactive UI elements, including canvas-based celebration confetti and frosted-glass CSS effects.

---

## 💻 Tech Stack
*   **Frontend:** HTML5, CSS3 (Custom Grid/Flexbox, Dark Neon Theme), Vanilla JavaScript (Canvas API)
*   **Backend:** Node.js, Express.js
*   **Database:** MySQL (using `mysql2` promise wrapper)
*   **Cloud Hosting:** Render (Web Service) & Aiven Cloud (Database)

  

---
## Looking for high-performance, cloud-deployed web applications?
Contact us : roysourav1812@zohomail.in

## 🗄️ Full Database Schema (MySQL)
To set up this project on a new cloud database or local environment, run the following SQL commands to create the complete database schema:
```sql
CREATE DATABASE IF NOT EXISTS event_platform;
USE event_platform;

-- 1. Users Table (Stores student participants)
CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    general_code VARCHAR(50),
    profile_pic VARCHAR(255) DEFAULT '[https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg](https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg)'
);

-- 2. Judges Table (Stores admin/judge credentials)
CREATE TABLE IF NOT EXISTS Judges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    judge_code VARCHAR(50) UNIQUE NOT NULL
);

-- Insert Default Judges
INSERT IGNORE INTO Judges (name, judge_code) VALUES 
('Head Judge', 'JUDGE-001'),
('Panel Judge', 'JUDGE-002');

-- 3. Questions Table (Stores all assessment questions)
CREATE TABLE IF NOT EXISTS Questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_number INT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'paragraph', 'fill_blank', or 'mcq'
    question_text TEXT NOT NULL,
    options JSON NULL,                  -- Used for MCQ options
    correct_answer VARCHAR(255) NULL,   -- Used for Auto-Grading
    time_limit INT DEFAULT 300,         -- Time in seconds
    max_marks INT DEFAULT 10            -- Total possible marks
);

-- 4. Submissions Table (Stores student answers and judge evaluations)
CREATE TABLE IF NOT EXISTS Submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT NOT NULL,
    marks_awarded INT DEFAULT 0,        -- Marks given by auto-grader
    is_graded BOOLEAN DEFAULT FALSE,
    judge1_marks INT NULL,              -- Marks given by Judge 1
    judge2_marks INT NULL,              -- Marks given by Judge 2
    avg_marks FLOAT NULL,               -- Final calculated average
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE
);

-- 5. DailyScores Table (Aggregates daily points for the Leaderboard)
CREATE TABLE IF NOT EXISTS DailyScores (
    user_id INT NOT NULL,
    day_number INT NOT NULL,
    total_score INT DEFAULT 0,
    PRIMARY KEY (user_id, day_number),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- 6. FinalWinners Table (Tiered winners for the celebration page)
CREATE TABLE IF NOT EXISTS FinalWinners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    profile_pic VARCHAR(255) DEFAULT '[https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg](https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg)',
    grade VARCHAR(10) DEFAULT 'A'
);
