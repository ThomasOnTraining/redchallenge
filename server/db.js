const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || 'database/reddit_desafios.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            points INTEGER DEFAULT 0,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`ALTER TABLE users ADD COLUMN password_hash TEXT`, (err) => { /* ignore */ });

        // Posts & Challenges table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            content TEXT,
            image_url TEXT,
            type TEXT CHECK(type IN ('post', 'challenge')) DEFAULT 'post',
            challenge_type TEXT, -- 'quiz', 'duel', 'collab'
            upvotes INTEGER DEFAULT 0,
            progress INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        db.run(`ALTER TABLE posts ADD COLUMN progress INTEGER DEFAULT 0`, (err) => { /* ignore */ });

        // Votes table
        db.run(`CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            value INTEGER CHECK(value IN (1, -1)),
            UNIQUE(user_id, post_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )`);

        // Comments table
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Collab Contributions table
        db.run(`CREATE TABLE IF NOT EXISTS collab_contributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )`);

        // Communities table
        db.run(`CREATE TABLE IF NOT EXISTS communities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#ff4500',
            icon TEXT DEFAULT 'users',
            member_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Add community_id to posts
        db.run(`ALTER TABLE posts ADD COLUMN community_id INTEGER REFERENCES communities(id)`, (err) => { /* ignore */ });

        // Seed initial admin user if not exists
        db.get("SELECT id FROM users WHERE username = 'Admin'", (err, row) => {
            if (!row) {
                db.run("INSERT INTO users (username, points, avatar_url) VALUES ('Admin', 100, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin')");
            }
        });

        // Seed communities
        const communities = [
            ['Tech', 'Tecnologia, programação e inovação', '#3b82f6', 'cpu'],
            ['Saúde', 'Bem-estar, fitness e saúde mental', '#4ade80', 'heart-pulse'],
            ['Ciência', 'Descobertas científicas e curiosidades', '#a78bfa', 'atom'],
            ['Games', 'Jogos, e-sports e cultura gamer', '#f472b6', 'gamepad-2'],
            ['Finanças', 'Investimentos, economia e educação financeira', '#fbbf24', 'trending-up'],
        ];
        communities.forEach(([name, desc, color, icon]) => {
            db.run(`INSERT OR IGNORE INTO communities (name, description, color, icon) VALUES (?, ?, ?, ?)`,
                [name, desc, color, icon]);
        });
    });
}

module.exports = db;
