const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files from the root
// This allows index.html at root to find css/ and js/ folders
app.use(express.static(path.join(__dirname, '..')));

// --- API ROUTES ---

// Get all posts & challenges
app.get('/api/posts', (req, res) => {
    const query = `
        SELECT posts.*, users.username, users.avatar_url,
        (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count
        FROM posts
        JOIN users ON posts.user_id = users.id
        ORDER BY created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Create a new post/challenge
app.post('/api/posts', (req, res) => {
    const { user_id, title, content, image_url, type, challenge_type } = req.body;
    
    if (!title || !user_id) {
        return res.status(400).json({ error: 'Title and user_id are required' });
    }

    const query = `INSERT INTO posts (user_id, title, content, image_url, type, challenge_type) VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [user_id, title, content, image_url, type || 'post', challenge_type];

    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Vote on a post
app.post('/api/posts/:id/vote', (req, res) => {
    const postId = req.params.id;
    const { user_id, value } = req.body; // value should be 1 or -1

    if (![1, -1].includes(value)) {
        return res.status(400).json({ error: 'Invalid vote value' });
    }

    // Use a transaction or careful logic for "upsert-like" behavior in SQLite 3.x
    // Simplest for prototype: Remove existing vote and insert new one
    db.serialize(() => {
        db.run(`DELETE FROM votes WHERE user_id = ? AND post_id = ?`, [user_id, postId]);
        
        db.run(`INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)`, [user_id, postId, value], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Update upvotes count in posts table
            const updateQuery = `
                UPDATE posts 
                SET upvotes = (SELECT SUM(value) FROM votes WHERE post_id = ?)
                WHERE id = ?
            `;
            db.run(updateQuery, [postId, postId], (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, new_value: value });
            });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
