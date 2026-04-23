const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xss = require('xss');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter);

// Serve Static Files from the root
app.use(express.static(path.join(__dirname, '..')));

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Username and password must be valid strings' });
    }
    // Username: 3-30 chars, alphanumeric + underscores only
    const trimmedUser = username.trim();
    if (trimmedUser.length < 3 || trimmedUser.length > 30) {
        return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' });
    }
    if (password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const safeUsername = xss(trimmedUser);
        const safeAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(safeUsername)}`;
        
        db.run(`INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?)`, 
        [safeUsername, hashedPassword, safeAvatar], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.status(201).json({ id: this.lastID, message: 'User created successfully' });
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Username and password must be valid strings' });
    }
    
    // Sanitize before querying
    const safeUsername = xss(username.trim());

    db.get(`SELECT * FROM users WHERE username = ?`, [safeUsername], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
        
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id, username: user.username, avatar_url: user.avatar_url }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, avatar_url: user.avatar_url } });
    });
});

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
app.post('/api/posts', authenticateToken, (req, res) => {
    const { title, content, image_url, type, challenge_type } = req.body;
    const user_id = req.user.id;
    
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required and must be a string' });
    if (content && typeof content !== 'string') return res.status(400).json({ error: 'Content must be a string' });
    if (image_url && typeof image_url !== 'string') return res.status(400).json({ error: 'Image URL must be a string' });
    if (type && !['post', 'challenge'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (type === 'challenge' && challenge_type && !['quiz', 'pilula', 'duel', 'collab'].includes(challenge_type)) {
        return res.status(400).json({ error: 'Invalid challenge type' });
    }
    
    const safeTitle = xss(title.trim()).substring(0, 300);
    const safeContent = xss((content || '').trim()).substring(0, 5000);
    const safeImage = image_url ? xss(image_url.trim()).substring(0, 2048) : null;

    if (safeTitle.length === 0) return res.status(400).json({ error: 'Title cannot be empty after sanitization' });

    const query = `INSERT INTO posts (user_id, title, content, image_url, type, challenge_type) VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [user_id, safeTitle, safeContent, safeImage, type || 'post', challenge_type];

    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Vote on a post
app.post('/api/posts/:id/vote', authenticateToken, (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID' });
    const user_id = req.user.id;
    const { value } = req.body;

    if (![1, -1].includes(value)) {
        return res.status(400).json({ error: 'Invalid vote value' });
    }

    db.serialize(() => {
        db.run("BEGIN EXCLUSIVE TRANSACTION");
        db.get("SELECT value FROM votes WHERE user_id = ? AND post_id = ?", [user_id, postId], (err, row) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            
            let newValue = value;
            let query = "";
            let params = [];
            
            if (row && row.value === value) {
                // Toggle off
                query = "DELETE FROM votes WHERE user_id = ? AND post_id = ?";
                params = [user_id, postId];
                newValue = 0;
            } else {
                // Upsert (SQLite 3.24.0+)
                query = `INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)
                         ON CONFLICT(user_id, post_id) DO UPDATE SET value = excluded.value`;
                params = [user_id, postId, value];
            }
            
            db.run(query, params, function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                
                // Update upvotes count in posts table atomically
                const updateQuery = `
                    UPDATE posts 
                    SET upvotes = IFNULL((SELECT SUM(value) FROM votes WHERE post_id = ?), 0)
                    WHERE id = ?
                `;
                db.run(updateQuery, [postId, postId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    
                    db.get(`SELECT upvotes FROM posts WHERE id = ?`, [postId], (err, postRow) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: err.message });
                        }
                        
                        db.run("COMMIT");
                        res.json({ success: true, new_value: newValue, total_upvotes: postRow.upvotes });
                    });
                });
            });
        });
    });
});

// Collab contribution
app.post('/api/posts/:id/collab', authenticateToken, (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID' });
    const userId = req.user.id;
    
    db.serialize(() => {
        db.run("BEGIN EXCLUSIVE TRANSACTION");
        db.get("SELECT challenge_type, progress FROM posts WHERE id = ?", [postId], (err, post) => {
            if (err || !post || post.challenge_type !== 'collab') {
                db.run("ROLLBACK");
                return res.status(400).json({ error: 'Invalid post or not a collab' });
            }
            
            db.run("INSERT INTO collab_contributions (user_id, post_id) VALUES (?, ?)", [userId, postId], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    if (err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Already contributed' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                
                db.run("UPDATE posts SET progress = progress + 1 WHERE id = ?", [postId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    res.json({ success: true, new_progress: post.progress + 1 });
                });
            });
        });
    });
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID' });

    db.all(`SELECT comments.*, users.username, users.avatar_url
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.post_id = ?
            ORDER BY comments.created_at ASC`, [postId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json(rows || []);
    });
});

// Create a comment
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID' });
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
    }
    const safeContent = xss(content.trim()).substring(0, 2000);
    const userId = req.user.id;

    db.run(`INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
        [postId, userId, safeContent], function(err) {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.status(201).json({
            id: this.lastID,
            content: safeContent,
            username: req.user.username,
            avatar_url: req.user.avatar_url,
            created_at: new Date().toISOString()
        });
    });
});

// Get popular posts (sorted by upvotes)
app.get('/api/posts/popular', (req, res) => {
    db.all(`SELECT posts.*, users.username, users.avatar_url,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count
            FROM posts
            JOIN users ON posts.user_id = users.id
            ORDER BY posts.upvotes DESC, posts.created_at DESC
            LIMIT 20`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json(rows || []);
    });
});

// Get all communities
app.get('/api/communities', (req, res) => {
    db.all(`SELECT communities.*,
            (SELECT COUNT(*) FROM posts WHERE posts.community_id = communities.id) as post_count
            FROM communities
            ORDER BY post_count DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json(rows || []);
    });
});

// Get stats for sidebar
app.get('/api/stats', (req, res) => {
    const stats = {};
    db.get(`SELECT COUNT(*) as total FROM posts WHERE type = 'challenge'`, (err, row) => {
        stats.challenges = row ? row.total : 0;
        db.get(`SELECT COUNT(*) as total FROM users`, (err2, row2) => {
            stats.members = row2 ? row2.total : 0;
            db.all(`SELECT posts.id, posts.title, posts.upvotes, users.username
                    FROM posts JOIN users ON posts.user_id = users.id
                    ORDER BY posts.upvotes DESC LIMIT 5`, (err3, rows) => {
                stats.top_posts = rows || [];
                res.json(stats);
            });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
