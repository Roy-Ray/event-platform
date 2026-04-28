const mysql = require('mysql2/promise');

// Hardcoded configuration for local deployment
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Change this if your local MySQL username is different
    password: 'NewStrong@123', // Replace with your actual local MySQL password
    database: 'event_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;