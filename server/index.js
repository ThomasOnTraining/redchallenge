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
    max: 1000, // Limit each IP to 1000 requests per window
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


// Optional Auth Middleware
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return next();
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) req.user = user;
        next();
    });
}

// --- API ROUTES ---

// Get Rankings
app.get('/api/rankings', (req, res) => {
    db.all(`SELECT id, username, avatar_url, points FROM users ORDER BY points DESC LIMIT 10`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


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
app.get('/api/posts', optionalAuth, (req, res) => {
    const typeFilter = req.query.type;
    let query = `
        SELECT posts.*, users.username, users.avatar_url,
        (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count
        FROM posts
        JOIN users ON posts.user_id = users.id
        WHERE posts.community_id IS NULL
    `;
    const params = [];
    if (typeFilter) {
        query += ' AND posts.type = ? ';
        params.push(typeFilter);
    }
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(`SELECT * FROM duels`, [], (err, duels) => {
            const userId = req.user ? req.user.id : null;
            if (!userId) {
                posts.forEach(p => {
                    if (p.type === 'challenge' && p.challenge_type === 'duel_tictactoe') {
                        p.duel = duels.find(d => d.post_id === p.id);
                    }
                });
                return res.json(posts);
            }
            
            db.all(`SELECT * FROM challenge_participants WHERE user_id = ?`, [userId], (err, parts) => {
                posts.forEach(p => {
                    if (p.type === 'challenge') {
                        if (p.challenge_type === 'duel_tictactoe') {
                            p.duel = duels.find(d => d.post_id === p.id);
                        } else if (p.challenge_type === 'personal') {
                            const part = parts.find(pt => pt.post_id === p.id);
                            p.user_progress = part ? part.progress : 0;
                            p.is_participating = !!part;
                            p.last_checkin = part ? part.last_checkin : null;
                        }
                    }
                });
                res.json(posts);
            });
        });
    });
});

// Create a new post/challenge
app.post('/api/posts', authenticateToken, (req, res) => {
    const { title, content, image_url, type, challenge_type, community_id, goal } = req.body;
    const user_id = req.user.id;
    
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required and must be a string' });
    if (type && !['post', 'challenge'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (type === 'challenge' && challenge_type && !['personal', 'collab', 'duel_tictactoe'].includes(challenge_type)) {
        return res.status(400).json({ error: 'Invalid challenge type' });
    }
    
    const safeTitle = title.trim().substring(0, 300);
    const safeContent = (content || '').trim().substring(0, 5000);
    const safeImage = image_url ? image_url.trim().substring(0, 2048) : null;
    const cid = community_id ? parseInt(community_id, 10) : null;
    const parsedGoal = goal ? parseInt(goal, 10) : 100;

    const query = `INSERT INTO posts (user_id, title, content, image_url, type, challenge_type, community_id, goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [user_id, safeTitle, safeContent, safeImage, type || 'post', challenge_type || null, cid, parsedGoal];

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        const postId = this.lastID;
        
        if (type === 'challenge' && challenge_type === 'duel_tictactoe') {
            db.run(`INSERT INTO duels (post_id, player1_id, current_turn) VALUES (?, ?, ?)`, [postId, user_id, user_id]);
        }
        res.status(201).json({ id: postId });
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
                        
                        db.run("COMMIT", (err) => {
                            if (!err && newValue === 1) {
                                db.get(`SELECT user_id FROM posts WHERE id = ?`, [postId], (err, post) => {
                                    if (!err && post && post.user_id !== user_id) {
                                        db.run(`INSERT INTO notifications (user_id, actor_id, post_id, type, message) VALUES (?, ?, ?, ?, ?)`,
                                            [post.user_id, user_id, postId, 'upvote', 'deu upvote no seu post']);
                                    }
                                });
                            }
                        });
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
        
        const commentId = this.lastID;
        
        db.get(`SELECT user_id FROM posts WHERE id = ?`, [postId], (err, post) => {
            if (!err && post && post.user_id !== userId) {
                db.run(`INSERT INTO notifications (user_id, actor_id, post_id, type, message) VALUES (?, ?, ?, ?, ?)`,
                    [post.user_id, userId, postId, 'comment', 'comentou no seu post']);
            }
        });

        res.status(201).json({
            id: commentId,
            content: safeContent,
            username: req.user.username,
            avatar_url: req.user.avatar_url,
            created_at: new Date().toISOString()
        });
    });
});

// ============================
// NOTIFICATIONS
// ============================

// Get notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all(`SELECT n.*, u.username as actor_name, u.avatar_url as actor_avatar 
            FROM notifications n
            JOIN users u ON n.actor_id = u.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 30`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json(rows || []);
    });
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const notifId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    if (isNaN(notifId) || notifId <= 0) return res.status(400).json({ error: 'Invalid ID' });
    
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [notifId, userId], function(err) {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ success: true });
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

// Create a new community
app.post('/api/communities', authenticateToken, (req, res) => {
    const { name, description, color, icon } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Community name is required' });
    }
    
    const safeName = xss(name.trim()).substring(0, 50);
    const safeDesc = xss((description || '').trim()).substring(0, 200);
    const safeColor = color ? xss(color.trim()) : '#ff4500';
    const safeIcon = icon ? xss(icon.trim()) : 'users';

    db.run(`INSERT INTO communities (name, description, color, icon) VALUES (?, ?, ?, ?)`,
        [safeName, safeDesc, safeColor, safeIcon], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Community name already exists' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ id: this.lastID, name: safeName, description: safeDesc, color: safeColor, icon: safeIcon });
    });
});

// Get posts for a specific community
app.get('/api/communities/:id/posts', (req, res) => {
    const communityId = parseInt(req.params.id, 10);
    if (isNaN(communityId) || communityId <= 0) return res.status(400).json({ error: 'Invalid community ID' });

    const query = `
        SELECT posts.*, users.username, users.avatar_url,
        (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comment_count
        FROM posts
        JOIN users ON posts.user_id = users.id
        WHERE posts.community_id = ?
        ORDER BY created_at DESC
    `;
    
    db.all(query, [communityId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
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

// Update user profile
app.put('/api/users/profile', authenticateToken, (req, res) => {
    const { username, avatar_url, old_password, new_password } = req.body;
    const userId = req.user.id;

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], async (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User not found' });

        let updates = [];
        let params = [];

        if (avatar_url && avatar_url !== user.avatar_url) {
            updates.push("avatar_url = ?");
            params.push(avatar_url);
        }

        if (username && username !== user.username) {
            if (user.last_username_change) {
                const lastChange = new Date(user.last_username_change).getTime();
                const now = Date.now();
                const daysSince = (now - lastChange) / (1000 * 60 * 60 * 24);
                if (daysSince < 30) {
                    return res.status(400).json({ error: 'Você só pode alterar o nome de usuário a cada 30 dias.' });
                }
            }
            updates.push("username = ?");
            params.push(username);
            updates.push("last_username_change = CURRENT_TIMESTAMP");
        }

        if (new_password) {
            if (!old_password) return res.status(400).json({ error: 'A senha atual é necessária para definir uma nova.' });
            const match = await bcrypt.compare(old_password, user.password_hash);
            if (!match) return res.status(401).json({ error: 'Senha atual incorreta.' });
            
            const hashed = await bcrypt.hash(new_password, 10);
            updates.push("password_hash = ?");
            params.push(hashed);
        }

        if (updates.length === 0) return res.json({ message: 'Nenhuma alteração realizada.' });

        params.push(userId);
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err2) {
            if (err2) {
                if (err2.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
                }
                return res.status(500).json({ error: err2.message });
            }
            // Return updated token
            db.get(`SELECT id, username, points, avatar_url, created_at FROM users WHERE id = ?`, [userId], (err3, updatedUser) => {
                const token = jwt.sign(updatedUser, process.env.JWT_SECRET || 'secret_key', { expiresIn: '24h' });
                res.json({ message: 'Perfil atualizado com sucesso.', token, user: updatedUser });
            });
        });
    });
});

// Delete user account
app.delete('/api/users/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.serialize(() => {
        db.run(`DELETE FROM votes WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM comments WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM posts WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao deletar conta.' });
            res.json({ message: 'Conta deletada com sucesso.' });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});


// Join personal challenge
app.post('/api/posts/:id/join', authenticateToken, (req, res) => {
    const postId = req.params.id;
    db.get(`SELECT * FROM posts WHERE id = ? AND challenge_type = 'personal'`, [postId], (err, post) => {
        if (!post) return res.status(404).json({ error: 'Personal challenge not found' });
        db.run(`INSERT INTO challenge_participants (post_id, user_id) VALUES (?, ?)`, [postId, req.user.id], (err) => {
            if (err) return res.status(400).json({ error: 'Already joined' });
            res.json({ success: true });
        });
    });
});

// Checkin personal challenge
app.post('/api/posts/:id/checkin', authenticateToken, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    db.get(`SELECT * FROM challenge_participants WHERE post_id = ? AND user_id = ?`, [postId, userId], (err, row) => {
        if (!row) return res.status(400).json({ error: 'Not participating' });
        
        // Anti-spam could be added here by checking row.last_checkin
        db.run(`UPDATE challenge_participants SET progress = progress + 1, last_checkin = CURRENT_TIMESTAMP WHERE post_id = ? AND user_id = ?`, [postId, userId], (err) => {
            db.run(`UPDATE users SET points = points + 10 WHERE id = ?`, [userId]);
            res.json({ success: true });
        });
    });
});

// Collab contribute
app.post('/api/posts/:id/collab', authenticateToken, (req, res) => {
    const postId = req.params.id;
    db.get(`SELECT * FROM posts WHERE id = ? AND challenge_type = 'collab'`, [postId], (err, post) => {
        if (!post) return res.status(404).json({ error: 'Collab challenge not found' });
        db.run(`UPDATE posts SET progress = progress + 1 WHERE id = ?`, [postId], () => {
            res.json({ success: true });
        });
    });
});

// Duel: Accept
app.post('/api/duels/:id/accept', authenticateToken, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    db.get(`SELECT * FROM duels WHERE post_id = ?`, [postId], (err, duel) => {
        if (!duel) return res.status(404).json({ error: 'Duel not found' });
        if (duel.status !== 'waiting') return res.status(400).json({ error: 'Duel not waiting' });
        if (duel.player1_id === userId) return res.status(400).json({ error: 'Cannot accept own duel' });
        
        db.run(`UPDATE duels SET player2_id = ?, status = 'active' WHERE post_id = ?`, [userId, postId], () => {
            res.json({ success: true });
        });
    });
});

// Duel: Move
app.post('/api/duels/:id/move', authenticateToken, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const { position } = req.body; // 0-8 for Tic-Tac-Toe
    
    db.get(`SELECT * FROM duels WHERE post_id = ?`, [postId], (err, duel) => {
        if (!duel) return res.status(404).json({ error: 'Duel not found' });
        if (duel.status !== 'active') return res.status(400).json({ error: 'Duel not active' });
        if (duel.current_turn !== userId) return res.status(400).json({ error: 'Not your turn' });
        
        let state = JSON.parse(duel.game_state);
        if (state[position] !== "") return res.status(400).json({ error: 'Invalid move' });
        
        const mark = duel.player1_id === userId ? 'X' : 'O';
        state[position] = mark;
        
        // Check win
        const winPatterns = [
            [0,1,2], [3,4,5], [6,7,8], // rows
            [0,3,6], [1,4,7], [2,5,8], // cols
            [0,4,8], [2,4,6]           // diags
        ];
        
        let won = false;
        for (let p of winPatterns) {
            if (state[p[0]] && state[p[0]] === state[p[1]] && state[p[0]] === state[p[2]]) {
                won = true; break;
            }
        }
        
        const isDraw = !won && state.every(c => c !== "");
        let newStatus = duel.status;
        if (won) newStatus = duel.player1_id === userId ? 'p1_won' : 'p2_won';
        else if (isDraw) newStatus = 'draw';
        
        const nextTurn = duel.player1_id === userId ? duel.player2_id : duel.player1_id;
        
        db.run(`UPDATE duels SET game_state = ?, current_turn = ?, status = ? WHERE post_id = ?`,
            [JSON.stringify(state), nextTurn, newStatus, postId], () => {
                
            // If won, give points!
            if (won) db.run(`UPDATE users SET points = points + 50 WHERE id = ?`, [userId]);
            
            res.json({ success: true, state, status: newStatus });
        });
    });
});
