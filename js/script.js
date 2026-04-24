document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const API_URL = '/api';

    // Auth State
    let currentUser = null;
    try {
        const stored = localStorage.getItem('user');
        if (stored) currentUser = JSON.parse(stored);
    } catch(e) {}

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.mobile-nav-item, .sidebar-link, .top-tab');
    const feedContainer = document.getElementById('feed-container');
    const challengesContainer = document.getElementById('challenges-container');
    const popularContainer = document.getElementById('popular-container');
    const communitiesContainer = document.getElementById('communities-container');
    const postTemplate = document.getElementById('post-template');
    const sideNavigation = document.getElementById('side-navigation');
    const drawerOverlay = document.getElementById('drawer-overlay');

    // Auth DOM
    const authModal = document.getElementById('auth-modal');
    const authCloseBtn = document.getElementById('auth-close-btn');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authTitle = document.getElementById('auth-title');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const authSection = document.getElementById('auth-section');

    let isLoginMode = true;
    let currentView = 'view-home';
    let allCommunities = [];
    let currentCommunityId = null;

    // Utility: XSS Escaping
    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g,
            tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[tag]));
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}d`;
    };

// ============================
    // AUTH LOGIC
    // ============================
    function openAuthModal() {
        hideAuthError();
        authModal.classList.add('visible');
        lucide.createIcons();
    }
    function closeAuthModal() { authModal.classList.remove('visible'); }

    function showAuthError(msg) {
        const errBox = document.getElementById('auth-error');
        const errMsg = document.getElementById('auth-error-msg');
        errMsg.textContent = msg;
        errBox.style.display = 'flex';
        lucide.createIcons();
    }
    function hideAuthError() {
        const errBox = document.getElementById('auth-error');
        if (errBox) errBox.style.display = 'none';
    }

    function updateAuthUI() {
        const navSettings = document.getElementById('nav-settings');
        if (currentUser) {
            if (navSettings) navSettings.style.display = 'flex';
            authSection.innerHTML = `
                <div style="position: relative;" id="user-dropdown-container">
                    <div class="avatar-sm" style="cursor: pointer;" id="profile-dropdown-trigger" title="${escapeHTML(currentUser.username)}">
                        <img src="${escapeHTML(currentUser.avatar_url)}" alt="${escapeHTML(currentUser.username)}">
                    </div>
                    <div id="profile-dropdown-menu" style="display: none; position: absolute; top: 100%; right: 0; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem; width: 160px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.5); flex-direction: column; gap: 0.25rem; margin-top: 0.5rem;">
                        <button id="dropdown-settings-btn" style="background: transparent; border: none; color: var(--text-primary); text-align: left; padding: 0.5rem; cursor: pointer; border-radius: 4px; width: 100%; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;"><i data-lucide="settings" style="width: 16px; height: 16px;"></i> Configurações</button>
                        <button id="dropdown-logout-btn" style="background: transparent; border: none; color: #ef4444; text-align: left; padding: 0.5rem; cursor: pointer; border-radius: 4px; width: 100%; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;"><i data-lucide="log-out" style="width: 16px; height: 16px;"></i> Sair da conta</button>
                    </div>
                </div>
            `;
            
            const trigger = document.getElementById('profile-dropdown-trigger');
            const menu = document.getElementById('profile-dropdown-menu');
            if (trigger && menu) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
                });
                document.addEventListener('click', () => {
                    menu.style.display = 'none';
                });
                menu.addEventListener('click', (e) => e.stopPropagation());

                document.getElementById('dropdown-settings-btn').addEventListener('click', () => {
                    menu.style.display = 'none';
                    const ns = document.getElementById('nav-settings');
                    if (ns) ns.click();
                });
                document.getElementById('dropdown-logout-btn').addEventListener('click', () => {
                    logout();
                });
                lucide.createIcons();
            }
            
            fetchNotifications();

        } else {
            if (navSettings) navSettings.style.display = 'none';
            authSection.innerHTML = `
                <button class="nav-action-btn" id="login-trigger-btn" style="background:var(--btn-secondary);color:var(--text-primary);">
                    <i data-lucide="log-in" style="width:16px;height:16px;"></i>
                    <span>Entrar</span>
                </button>
            `;
            document.getElementById('login-trigger-btn').addEventListener('click', openAuthModal);
            lucide.createIcons();
        }
    }

    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
        updateAuthUI();
    };

    updateAuthUI();

    // Password eye toggle
    const eyeBtn = document.querySelector('.auth-eye-btn');
    if (eyeBtn) {
        eyeBtn.addEventListener('click', () => {
            const isPassword = authPasswordInput.type === 'password';
            authPasswordInput.type = isPassword ? 'text' : 'password';
            eyeBtn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
            lucide.createIcons();
        });
    }

    if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    const submitText = document.querySelector('.auth-submit-text');
    const submitSpinner = document.querySelector('.auth-spinner');

    function setSubmitLoading(loading) {
        submitText.style.display = loading ? 'none' : 'inline';
        submitSpinner.style.display = loading ? 'block' : 'none';
        authSubmitBtn.disabled = loading;
    }

    if (authToggleBtn) {
        authToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideAuthError();
            isLoginMode = !isLoginMode;
            const sub = document.querySelector('.auth-subtitle');
            if (isLoginMode) {
                authTitle.textContent = 'Entrar no Questly';
                if (sub) sub.textContent = 'Participe dos desafios e conquiste a comunidade';
                submitText.textContent = 'Entrar';
                authToggleText.textContent = 'Não tem uma conta?';
                authToggleBtn.textContent = 'Cadastre-se';
            } else {
                authTitle.textContent = 'Criar Conta';
                if (sub) sub.textContent = 'Junte-se à comunidade Questly';
                submitText.textContent = 'Cadastrar';
                authToggleText.textContent = 'Já tem uma conta?';
                authToggleBtn.textContent = 'Entrar';
            }
        });
    }

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const username = authUsernameInput.value.trim();
            const password = authPasswordInput.value.trim();
            hideAuthError();
            if (!username || !password) return showAuthError('Preencha todos os campos.');
            if (!isLoginMode && password.length < 6) return showAuthError('Senha precisa ter pelo menos 6 caracteres.');
            setSubmitLoading(true);
            try {
                const res = await fetch(`${API_URL}/${isLoginMode ? 'login' : 'register'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok) {
                    if (!isLoginMode) {
                        hideAuthError();
                        isLoginMode = true;
                        authTitle.textContent = 'Conta criada! Faça login';
                        submitText.textContent = 'Entrar';
                        authToggleText.textContent = 'Não tem uma conta?';
                        authToggleBtn.textContent = 'Cadastre-se';
                        authPasswordInput.value = '';
                    } else {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        currentUser = data.user;
                        closeAuthModal();
                        updateAuthUI();
                        loadCurrentView();
                    }
                } else {
                    showAuthError(data.error || 'Erro na autenticação');
                }
            } catch (e) {
                showAuthError('Falha na comunicação com o servidor.');
            } finally {
                setSubmitLoading(false);
            }
        });
    }

    [authUsernameInput, authPasswordInput].forEach(input => {
        if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') authSubmitBtn.click(); });
    });

    // ============================
    // FETCH HELPERS
    // ============================
    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    }

    async function authFetch(url, options = {}) {
        const res = await fetch(url, options);
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            currentUser = null;
            updateAuthUI();
            openAuthModal();
            throw new Error('Unauthorized');
        }
        if (res.status === 403) {
            // Could be expired JWT or rate limit
            const data = await res.clone().json().catch(() => ({}));
            if (data.error === 'Forbidden') {
                // JWT expired/invalid — force re-login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                currentUser = null;
                updateAuthUI();
                openAuthModal();
                throw new Error('Unauthorized');
            }
            // Rate limit or other — just throw without clearing session
            throw new Error(data.error || 'Forbidden');
        }
        return res;
    }

    // ============================
    // SKELETON LOADING
    // ============================
    function renderSkeleton(container, count = 3) {
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const sk = document.createElement('div');
            sk.className = 'reddit-card skeleton';
            sk.style.padding = '1rem';
            sk.style.minHeight = '100px';
            sk.innerHTML = `
                <div style="display:flex;gap:10px;margin-bottom:12px">
                    <div class="skeleton-avatar skeleton"></div>
                    <div class="skeleton-text skeleton" style="width:100px"></div>
                </div>
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text skeleton" style="width:75%"></div>
            `;
            container.appendChild(sk);
        }
    }

    // ============================
    // RENDER POSTS
    // ============================
    function renderFeed(posts, container) {
        container.innerHTML = '';
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox" class="empty-icon"></i>
                    <h2>Nenhum conteúdo ainda</h2>
                    <p>Seja o primeiro a contribuir!</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        posts.forEach(post => {
            const clone = postTemplate.content.cloneNode(true);
            const article = clone.querySelector('.reddit-card');
            article.setAttribute('data-id', post.id);

            clone.querySelector('.vote-count').textContent = post.upvotes || 0;
            clone.querySelector('[data-value="author"]').textContent = post.username;
            clone.querySelector('[data-value="time"]').textContent = timeAgo(post.created_at);
            clone.querySelector('[data-value="title"]').textContent = post.title;
            clone.querySelector('[data-value="body"]').textContent = post.content || '';
            clone.querySelector('[data-value="comments"]').textContent = post.comment_count || 0;

            if (post.image_url) {
                const img = document.createElement('img');
                img.src = escapeHTML(post.image_url);
                img.className = 'post-image';
                clone.querySelector('.post-body').after(img);
            }

            // Challenge badge
            if (post.type === 'challenge') {
                article.classList.add('challenge-card');
                const badge = clone.querySelector('.badge-tag');
                badge.textContent = post.challenge_type === 'duel_tictactoe' ? 'DUELO' : (post.challenge_type || 'DESAFIO').toUpperCase();
                badge.style.display = 'inline-block';

                const postBody = clone.querySelector('.post-body');
                const goal = post.goal || 100;

                if (post.challenge_type === 'collab') {
                    const progress = post.progress || 0;
                    const pct = Math.min((progress / goal) * 100, 100).toFixed(1);
                    postBody.insertAdjacentHTML('beforeend', `
                        <div class="collab-progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${pct}%"></div>
                            </div>
                            <div class="progress-text" style="display:flex; justify-content:space-between; font-size:0.8rem; margin: 4px 0 12px 0;">
                                <span>Progresso Global</span>
                                <span>${progress} / ${goal}</span>
                            </div>
                            <button class="collab-action" style="width:100%;"><i data-lucide="zap"></i> Contribuir para a Meta</button>
                        </div>
                    `);
                    clone.querySelector('.collab-action').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            const res = await authFetch(`${API_URL}/posts/${post.id}/collab`, { method: 'POST', headers: getAuthHeaders() });
                            if (res.ok) {
                                const btn = article.querySelector('.collab-action');
                                btn.textContent = 'Contribuição Enviada!';
                                btn.disabled = true;
                                btn.style.opacity = '0.6';
                                loadCurrentView();
                            } else { alert((await res.json()).error); }
                        } catch(err) { if (err.message !== 'Unauthorized') console.error(err); }
                    });
                } 
                else if (post.challenge_type === 'personal') {
                    const isParticipating = post.is_participating;
                    const progress = post.user_progress || 0;
                    const pct = Math.min((progress / goal) * 100, 100).toFixed(1);
                    
                    postBody.insertAdjacentHTML('beforeend', `
                        <div class="collab-progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${isParticipating ? pct : 0}%"></div>
                            </div>
                            <div class="progress-text" style="display:flex; justify-content:space-between; font-size:0.8rem; margin: 4px 0 12px 0;">
                                <span>Seu Progresso</span>
                                <span>${isParticipating ? progress : 0} / ${goal}</span>
                            </div>
                            <button class="collab-action" style="width:100%;">
                                ${!isParticipating ? '<i data-lucide="plus"></i> Participar' : '<i data-lucide="check-circle"></i> Fazer Check-in (+10 XP)'}
                            </button>
                        </div>
                    `);
                    
                    clone.querySelector('.collab-action').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const endpoint = isParticipating ? 'checkin' : 'join';
                        try {
                            const res = await authFetch(`${API_URL}/posts/${post.id}/${endpoint}`, { method: 'POST', headers: getAuthHeaders() });
                            if (res.ok) {
                                loadCurrentView();
                                fetchStats();
                            } else { alert((await res.json()).error); }
                        } catch(err) { if (err.message !== 'Unauthorized') console.error(err); }
                    });
                }
                else if (post.challenge_type === 'duel_tictactoe') {
                    const duel = post.duel;
                    if (duel) {
                        const board = JSON.parse(duel.game_state || '["","","","","","","","",""]');
                        const isP1 = currentUser && duel.player1_id === currentUser.id;
                        const isP2 = currentUser && duel.player2_id === currentUser.id;
                        const isTurn = currentUser && duel.current_turn === currentUser.id;
                        
                        let statusText = 'Aguardando oponente...';
                        if (duel.status === 'active') statusText = isTurn ? 'Sua vez!' : 'Vez do oponente...';
                        if (duel.status === 'p1_won') statusText = isP1 ? 'Você venceu! (+50 XP)' : 'Desafiante venceu!';
                        if (duel.status === 'p2_won') statusText = isP2 ? 'Você venceu! (+50 XP)' : 'Oponente venceu!';
                        if (duel.status === 'draw') statusText = 'Empate!';
                        
                        let html = `<div class="duel-status">${statusText}</div>`;
                        
                        if (duel.status === 'waiting' && !isP1) {
                            html += `<button class="collab-action accept-duel-btn" style="width:100%; margin-bottom:1rem;">Aceitar Duelo</button>`;
                        }
                        
                        html += `<div class="tictactoe-board">`;
                        board.forEach((cell, idx) => {
                            const cls = cell ? (cell === 'X' ? 'x occupied' : 'o occupied') : '';
                            html += `<div class="tictactoe-cell ${cls}" data-idx="${idx}">${cell}</div>`;
                        });
                        html += `</div>`;
                        
                        postBody.insertAdjacentHTML('beforeend', html);
                        
                        if (duel.status === 'waiting' && !isP1) {
                            const acceptBtn = clone.querySelector('.accept-duel-btn');
                            if (acceptBtn) {
                                acceptBtn.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    try {
                                        const res = await authFetch(`${API_URL}/duels/${post.id}/accept`, { method: 'POST', headers: getAuthHeaders() });
                                        if (res.ok) loadCurrentView();
                                        else alert((await res.json()).error);
                                    } catch(err) { if (err.message !== 'Unauthorized') console.error(err); }
                                });
                            }
                        }
                        
                        if (duel.status === 'active' && isTurn) {
                            const cells = clone.querySelectorAll('.tictactoe-cell:not(.occupied)');
                            cells.forEach(cell => {
                                cell.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const idx = cell.dataset.idx;
                                    try {
                                        const res = await authFetch(`${API_URL}/duels/${post.id}/move`, { 
                                            method: 'POST', headers: getAuthHeaders(),
                                            body: JSON.stringify({ position: parseInt(idx) })
                                        });
                                        if (res.ok) {
                                            loadCurrentView();
                                            fetchStats();
                                        }
                                        else alert((await res.json()).error);
                                    } catch(err) { if (err.message !== 'Unauthorized') console.error(err); }
                                });
                            });
                        }
                    }
                }
            }

            // Voting
            const upvoteBtn = clone.querySelector('.upvote');
            const downvoteBtn = clone.querySelector('.downvote');
            const countSpan = clone.querySelector('.vote-count');

            const handleVote = async (value, btn, opp) => {
                try {
                    const res = await authFetch(`${API_URL}/posts/${post.id}/vote`, {
                        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ value })
                    });
                    if (res.ok) {
                        const d = await res.json();
                        countSpan.textContent = d.total_upvotes;
                        btn.style.color = d.new_value === value ? (value === 1 ? 'var(--upvote-color)' : 'var(--downvote-color)') : '';
                        opp.style.color = '';
                    }
                } catch(e) { if (e.message !== 'Unauthorized') console.error(e); }
            };
            upvoteBtn.addEventListener('click', (e) => { e.stopPropagation(); handleVote(1, upvoteBtn, downvoteBtn); });
            downvoteBtn.addEventListener('click', (e) => { e.stopPropagation(); handleVote(-1, downvoteBtn, upvoteBtn); });

            // Comments toggle
            const commentBtn = clone.querySelector('.comment-toggle-btn');
            const commentsSection = clone.querySelector('.comments-section');
            const commentsList = clone.querySelector('.comments-list');
            const commentInput = clone.querySelector('.comment-input');
            const commentSendBtn = clone.querySelector('.comment-send-btn');

            commentBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const isOpen = commentsSection.style.display !== 'none';
                if (isOpen) {
                    commentsSection.style.display = 'none';
                    commentBtn.classList.remove('active');
                    return;
                }
                commentsSection.style.display = 'block';
                commentBtn.classList.add('active');
                commentsList.innerHTML = '<p class="comments-empty">Carregando...</p>';
                lucide.createIcons();

                try {
                    const res = await fetch(`${API_URL}/posts/${post.id}/comments`);
                    const comments = await res.json();
                    renderComments(commentsList, comments);
                } catch(err) {
                    commentsList.innerHTML = '<p class="comments-empty">Erro ao carregar comentários</p>';
                }
            });

            const sendComment = async () => {
                const text = commentInput.value.trim();
                if (!text) return;
                try {
                    const res = await authFetch(`${API_URL}/posts/${post.id}/comments`, {
                        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ content: text })
                    });
                    if (res.ok) {
                        const comment = await res.json();
                        commentInput.value = '';
                        appendComment(commentsList, comment);
                        // Update count
                        const cSpan = article.querySelector('[data-value="comments"]');
                        cSpan.textContent = parseInt(cSpan.textContent || 0) + 1;
                    }
                } catch(e) { if (e.message !== 'Unauthorized') console.error(e); }
            };

            commentSendBtn.addEventListener('click', (e) => { e.stopPropagation(); sendComment(); });
            commentInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.stopPropagation(); sendComment(); } });

            container.appendChild(clone);
        });

        lucide.createIcons();
    }

    function renderComments(container, comments) {
        container.innerHTML = '';
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="comments-empty">Nenhum comentário ainda. Seja o primeiro!</p>';
            return;
        }
        comments.forEach(c => appendComment(container, c));
    }

    function appendComment(container, c) {
        // Remove empty state if present
        const empty = container.querySelector('.comments-empty');
        if (empty) empty.remove();

        const div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML = `
            <div class="avatar-xs">
                <img src="${escapeHTML(c.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon')}" alt="${escapeHTML(c.username)}" style="width:24px;height:24px;border-radius:50%;">
            </div>
            <div class="comment-body">
                <div class="comment-meta">
                    <span class="comment-author">${escapeHTML(c.username)}</span>
                    <span class="comment-time">${timeAgo(c.created_at)}</span>
                </div>
                <div class="comment-text">${escapeHTML(c.content)}</div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ============================
    // DATA FETCHING
    // ============================
    async function fetchPosts() {
        renderSkeleton(feedContainer);
        renderSkeleton(challengesContainer);
        try {
            const response = await fetch(`${API_URL}/posts`);
            const posts = await response.json();
            renderFeed(posts.filter(p => p.type !== 'challenge'), feedContainer);
            renderFeed(posts.filter(p => p.type === 'challenge'), challengesContainer);
        } catch (err) {
            feedContainer.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Erro ao carregar o feed.</p>';
            challengesContainer.innerHTML = feedContainer.innerHTML;
        }
    }

    async function fetchPopular() {
        renderSkeleton(popularContainer);
        try {
            const res = await fetch(`${API_URL}/posts/popular`);
            const posts = await res.json();
            renderFeed(posts, popularContainer);
        } catch(err) {
            popularContainer.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Erro ao carregar populares.</p>';
        }
    }

    async function fetchCommunities() {
        communitiesContainer.innerHTML = '';
        try {
            const res = await fetch(`${API_URL}/communities`);
            const communities = await res.json();
            allCommunities = communities || [];
            renderCommunities(allCommunities);
            renderSidebarCommunities(allCommunities);
        } catch(err) {
            communitiesContainer.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Erro ao carregar comunidades.</p>';
        }
    }

    
    async function fetchRankings() {
        const list = document.getElementById('rankings-list');
        if (!list) return;
        try {
            const res = await fetch(`${API_URL}/rankings`);
            const users = await res.json();
            list.innerHTML = '';
            if (users.length === 0) {
                list.innerHTML = '<li class="rank-item" style="color: var(--text-muted);">Nenhum ranking ainda</li>';
                return;
            }
            users.forEach((u, i) => {
                const li = document.createElement('li');
                li.className = 'rank-item';
                li.innerHTML = `
                    <span class="rank-pos">${i + 1}</span>
                    <span class="rank-name">${escapeHTML(u.username)}</span>
                    <span class="rank-xp">${u.points} XP</span>
                `;
                list.appendChild(li);
            });
        } catch(err) { /* silent */ }
    }

    async function fetchStats() {
        try {
            const res = await fetch(`${API_URL}/stats`);
            const stats = await res.json();
            document.getElementById('stat-challenges').textContent = stats.challenges || 0;
            document.getElementById('stat-members').textContent = stats.members || 0;
            renderTrending(stats.top_posts || []);
            fetchRankings();
        } catch(err) { /* silent */ }
    }

    function renderCommunities(communities) {
        communitiesContainer.innerHTML = '';
        if (communities.length === 0) {
            communitiesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">Nenhuma comunidade encontrada.</p>';
            return;
        }
        communities.forEach(c => {
            const card = document.createElement('div');
            card.className = 'community-card';
            card.innerHTML = `
                <div class="community-card-header">
                    <div class="community-icon" style="background:${escapeHTML(c.color)};">
                        <i data-lucide="${escapeHTML(c.icon)}"></i>
                    </div>
                    <div class="community-info">
                        <h3>${escapeHTML(c.name)}</h3>
                        <p>${escapeHTML(c.description || '')}</p>
                    </div>
                </div>
                <div class="community-stats">
                    <span><i data-lucide="file-text"></i> ${c.post_count || 0} posts</span>
                    <span><i data-lucide="users"></i> ${c.member_count || 0} membros</span>
                </div>
                <button class="community-join-btn">Visitar Comunidade</button>
            `;
            card.querySelector('.community-join-btn').addEventListener('click', () => openSingleCommunity(c));
            card.querySelector('.community-card-header').addEventListener('click', () => openSingleCommunity(c));
            card.querySelector('.community-card-header').style.cursor = 'pointer';
            communitiesContainer.appendChild(card);
        });
        lucide.createIcons();
    }

    function renderSidebarCommunities(communities) {
        const el = document.getElementById('sidebar-communities');
        if (!el) return;
        el.innerHTML = '';
        communities.slice(0, 5).forEach(c => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'sidebar-link';
            a.innerHTML = `
                <span class="sidebar-community-dot" style="background:${escapeHTML(c.color)};width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                <span>${escapeHTML(c.name)}</span>
            `;
            el.appendChild(a);
        });
    }

    function renderTrending(topPosts) {
        const list = document.getElementById('trending-list');
        if (!list) return;
        list.innerHTML = '';
        if (topPosts.length === 0) {
            list.innerHTML = '<li class="trending-empty">Nenhum destaque ainda</li>';
            return;
        }
        topPosts.forEach((p, i) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span style="font-weight:700;color:var(--accent-brand);font-size:0.9rem;min-width:18px;">${i + 1}</span>
                <div class="trending-info">
                    <span>${escapeHTML(p.title).substring(0, 40)}${p.title.length > 40 ? '...' : ''}</span>
                    <small>${p.upvotes || 0} votos • ${escapeHTML(p.username)}</small>
                </div>
            `;
            list.appendChild(li);
        });
    }

    // ============================
    // POST CREATION
    // ============================
    const postInput = document.querySelector('.post-input');
    const challengeInput = document.querySelector('.challenge-input');
    const challengeSubmitBtn = document.querySelector('.challenge-submit-btn');
    const challengeTypeSelect = document.querySelector('.challenge-type-select');

    async function createPost(title, type = 'post', inputEl, challengeType = null, goal = null) {
        const parent = inputEl ? inputEl.closest('.create-post-card') : null;
        if (parent) parent.classList.add('is-loading');
        try {
            const bodyData = {
                title, content: type === 'challenge' ? 'Novo desafio proposto!' : '',
                type, challenge_type: challengeType, goal
            };
            if (currentView === 'view-single-community' && currentCommunityId) {
                bodyData.community_id = currentCommunityId;
            }

            const res = await authFetch(`${API_URL}/posts`, {
                method: 'POST', headers: getAuthHeaders(),
                body: JSON.stringify(bodyData)
            });
            if (res.ok) {
                if (inputEl) inputEl.value = '';
                if (currentView === 'view-single-community') {
                    fetchCommunityPosts(currentCommunityId);
                } else {
                    loadCurrentView();
                }
                fetchStats();
            } else {
                const d = await res.json();
                alert(d.error || 'Erro ao criar');
            }
        } catch(e) { if (e.message !== 'Unauthorized') console.error(e); }
        finally { if (parent) parent.classList.remove('is-loading'); }
    }

    if (postInput) {
        postInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && postInput.value.trim()) createPost(postInput.value.trim(), 'post', postInput);
        });
    }

    if (challengeInput) {
        challengeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && challengeInput.value.trim()) {
                createPost(challengeInput.value.trim(), 'challenge', challengeInput, challengeTypeSelect?.value || 'personal', null);
            }
        });
    }
    if (challengeSubmitBtn) {
        challengeSubmitBtn.addEventListener('click', () => {
            if (!currentUser) return openAuthModal();
            if (challengeInput.value.trim()) {
                createPost(challengeInput.value.trim(), 'challenge', challengeInput, challengeTypeSelect?.value || 'personal', null);
            }
        });
    }

    // Topbar create button
    const topbarCreateBtn = document.getElementById('topbar-create-btn');
    if (topbarCreateBtn) {
        topbarCreateBtn.addEventListener('click', () => {
            if (postInput && postInput.value.trim()) {
                createPost(postInput.value.trim(), 'post', postInput);
            } else {
                // Focus the input
                if (postInput) postInput.focus();
            }
        });
    }

    // ============================
    // NAVIGATION
    // ============================
    const dailyQuestsDB = [
        { title: "Beba 2L de Água", goal: 10 },
        { title: "Caminhada de 5km", goal: 5 },
        { title: "Leia 20 páginas", goal: 20 },
        { title: "Fique 1h offline", goal: 1 },
        { title: "Medite por 10 min", goal: 10 },
        { title: "Estude por 1 hora", goal: 60 }
    ];

    function renderDailyQuests() {
        const container = document.getElementById('daily-quests-container');
        if (!container) return;
        
        const today = Math.floor(Date.now() / 86400000);
        
        container.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const questIndex = (today + i) % dailyQuestsDB.length;
            const quest = dailyQuestsDB[questIndex];
            
            const card = document.createElement('div');
            card.className = 'quest-card';
            card.innerHTML = `
                <div class="quest-title">${escapeHTML(quest.title)}</div>
                <div class="quest-meta">Meta: ${quest.goal} check-ins</div>
                <button class="quest-accept-btn accept-daily-btn" data-title="${escapeHTML(quest.title)}" data-goal="${quest.goal}">Aceitar Missão</button>
            `;
            container.appendChild(card);
        }

        container.querySelectorAll('.accept-daily-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser) return openAuthModal();
                
                const title = e.target.closest('button').dataset.title;
                const goal = e.target.closest('button').dataset.goal;
                
                e.target.closest('button').textContent = "Aceitando...";
                e.target.closest('button').disabled = true;
                
                try {
                    const bodyData = {
                        title, content: 'Missão diária aceita!',
                        type: 'challenge', challenge_type: 'personal', goal: parseInt(goal)
                    };
                    const res = await authFetch(`${API_URL}/posts`, {
                        method: 'POST', headers: getAuthHeaders(),
                        body: JSON.stringify(bodyData)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        await authFetch(`${API_URL}/posts/${data.id}/join`, { method: 'POST', headers: getAuthHeaders() });
                        loadCurrentView();
                        fetchStats();
                    } else {
                        alert("Erro ao aceitar missão.");
                        e.target.closest('button').textContent = "Aceitar Missão";
                        e.target.closest('button').disabled = false;
                    }
                } catch(err) {
                    e.target.closest('button').textContent = "Aceitar Missão";
                    e.target.closest('button').disabled = false;
                }
            });
        });
    }

    function loadCurrentView() {
        if (currentView === 'view-home') {
            fetchPosts('post');
        } else if (currentView === 'view-challenges') {
            fetchPosts('challenge');
            renderDailyQuests();
        } else if (currentView === 'view-popular') {
            fetchPopular();
        } else if (currentView === 'view-communities') {
            fetchCommunities();
        }
    }

    function handleNavigation(targetId) {
        views.forEach(view => {
            view.classList.toggle('hidden', view.id !== targetId);
            view.classList.toggle('active', view.id === targetId);
        });
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.target === targetId);
        });
        currentView = targetId;

        // Expand layout for challenges view
        const feedCol = document.querySelector('.feed-column');
        const sideCol = document.querySelector('.sidebar-column');
        if (targetId === 'view-challenges') {
            if (feedCol) feedCol.style.maxWidth = '100%';
            if (sideCol) sideCol.style.display = 'none';
        } else {
            if (feedCol) feedCol.style.maxWidth = '';
            if (sideCol) sideCol.style.display = '';
        }

        loadCurrentView();
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (item.dataset.target) handleNavigation(item.dataset.target);
        });
    });

    // ============================
    // DRAWER
    // ============================
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    function toggleDrawer(open) { sideNavigation.classList.toggle('open', open); }
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => toggleDrawer(true));
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => toggleDrawer(false));
    navItems.forEach(item => {
        item.addEventListener('click', () => { if (window.innerWidth < 1200) toggleDrawer(false); });
    });
    document.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') { 
            toggleDrawer(false); 
            closeAuthModal(); 
            const cm = document.getElementById('create-community-modal');
            if (cm) {
                cm.style.opacity = '0';
                setTimeout(() => { cm.style.display = 'none'; }, 300);
            }
        } 
    });

    // ============================
    // COMMUNITIES LOGIC
    // ============================
    const communitySearchInput = document.getElementById('community-search-input');
    if (communitySearchInput) {
        communitySearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allCommunities.filter(c => c.name.toLowerCase().includes(term) || (c.description && c.description.toLowerCase().includes(term)));
            renderCommunities(filtered);
        });
    }

    const createCommModal = document.getElementById('create-community-modal');
    const openCreateCommBtn = document.getElementById('btn-open-create-community');
    const closeCreateCommBtn = document.getElementById('close-create-community-btn');
    const submitCreateCommBtn = document.getElementById('submit-create-community-btn');
    const createCommError = document.getElementById('create-community-error');
    const createCommErrorMsg = document.getElementById('create-community-error-msg');

    if (openCreateCommBtn) {
        openCreateCommBtn.addEventListener('click', () => {
            if (!currentUser) { openAuthModal(); return; }
            createCommError.style.display = 'none';
            createCommModal.style.display = 'flex';
            requestAnimationFrame(() => {
                createCommModal.style.opacity = '1';
                createCommModal.style.pointerEvents = 'auto';
            });
        });
    }

    if (closeCreateCommBtn) {
        closeCreateCommBtn.addEventListener('click', () => {
            createCommModal.style.opacity = '0';
            createCommModal.style.pointerEvents = 'none';
            setTimeout(() => { createCommModal.style.display = 'none'; }, 300);
        });
    }

    if (submitCreateCommBtn) {
        submitCreateCommBtn.addEventListener('click', async () => {
            const name = document.getElementById('community-name').value.trim();
            const description = document.getElementById('community-desc').value.trim();
            const color = document.getElementById('community-color').value;
            const icon = document.getElementById('community-icon').value.trim() || 'users';

            if (!name) {
                createCommErrorMsg.textContent = 'O nome da comunidade é obrigatório.';
                createCommError.style.display = 'flex';
                return;
            }

            const btnText = document.getElementById('create-community-btn-text');
            const spinner = document.getElementById('create-community-spinner');
            btnText.style.display = 'none';
            spinner.style.display = 'block';
            submitCreateCommBtn.disabled = true;

            try {
                const res = await authFetch(`${API_URL}/communities`, {
                    method: 'POST', headers: getAuthHeaders(),
                    body: JSON.stringify({ name, description, color, icon })
                });
                if (res.ok) {
                    closeCreateCommBtn.click();
                    fetchCommunities();
                } else {
                    const data = await res.json();
                    createCommErrorMsg.textContent = data.error || 'Erro ao criar comunidade';
                    createCommError.style.display = 'flex';
                }
            } catch (err) {
                createCommErrorMsg.textContent = 'Erro de rede';
                createCommError.style.display = 'flex';
            } finally {
                btnText.style.display = 'inline';
                spinner.style.display = 'none';
                submitCreateCommBtn.disabled = false;
            }
        });
    }

    window.openSingleCommunity = function(community) {
        currentCommunityId = community.id;
        
        views.forEach(view => {
            view.classList.toggle('hidden', view.id !== 'view-single-community');
            view.classList.toggle('active', view.id === 'view-single-community');
        });
        navItems.forEach(item => item.classList.remove('active'));
        currentView = 'view-single-community';

        document.getElementById('single-community-banner').style.background = escapeHTML(community.color || '#3b82f6');
        const iconContainer = document.getElementById('single-community-icon');
        iconContainer.innerHTML = `<i data-lucide="${escapeHTML(community.icon || 'users')}" style="color: ${escapeHTML(community.color || '#3b82f6')}; width: 30px; height: 30px;"></i>`;
        document.getElementById('single-community-name').textContent = escapeHTML(community.name);
        document.getElementById('single-community-desc').textContent = escapeHTML(community.description || '');

        lucide.createIcons();
        fetchCommunityPosts(community.id);
    };

    const backBtn = document.getElementById('btn-back-to-communities');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            currentCommunityId = null;
            handleNavigation('view-communities');
        });
    }

    async function fetchCommunityPosts(id) {
        const container = document.getElementById('single-community-feed-container');
        renderSkeleton(container);
        try {
            const res = await fetch(`${API_URL}/communities/${id}/posts`);
            const posts = await res.json();
            renderFeed(posts, container);
        } catch(err) {
            container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Erro ao carregar os posts desta comunidade.</p>';
        }
    }

    const commPostInput = document.getElementById('community-post-input');
    if (commPostInput) {
        commPostInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && commPostInput.value.trim()) {
                createPost(commPostInput.value.trim(), 'post', commPostInput);
            }
        });
    }

    // ============================
    // SETTINGS LOGIC
    // ============================
    const navSettings = document.getElementById('nav-settings');
    if (navSettings) {
        navSettings.addEventListener('click', () => {
            if (currentUser) {
                document.getElementById('settings-avatar').value = currentUser.avatar_url || '';
                document.getElementById('settings-username').value = currentUser.username || '';
                document.getElementById('settings-old-password').value = '';
                document.getElementById('settings-new-password').value = '';
                document.getElementById('settings-error').style.display = 'none';
                document.getElementById('settings-success').style.display = 'none';
            }
        });
    }

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const avatar_url = document.getElementById('settings-avatar').value.trim();
            const username = document.getElementById('settings-username').value.trim();
            const old_password = document.getElementById('settings-old-password').value;
            const new_password = document.getElementById('settings-new-password').value;

            const errorBox = document.getElementById('settings-error');
            const errorMsg = document.getElementById('settings-error-msg');
            const successBox = document.getElementById('settings-success');
            const successMsg = document.getElementById('settings-success-msg');
            
            errorBox.style.display = 'none';
            successBox.style.display = 'none';

            if (!username) {
                errorMsg.textContent = 'Nome de usuário não pode estar vazio.';
                errorBox.style.display = 'flex';
                return;
            }

            const btnText = document.getElementById('btn-save-settings-text');
            const spinner = document.getElementById('settings-spinner');
            btnText.style.display = 'none';
            spinner.style.display = 'block';
            btnSaveSettings.disabled = true;

            try {
                const res = await authFetch(`${API_URL}/users/profile`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ avatar_url, username, old_password, new_password })
                });
                const data = await res.json();
                
                if (res.ok) {
                    if (data.token) localStorage.setItem('token', data.token);
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        currentUser = data.user;
                        updateAuthUI();
                    }
                    successMsg.textContent = data.message;
                    successBox.style.display = 'flex';
                    document.getElementById('settings-old-password').value = '';
                    document.getElementById('settings-new-password').value = '';
                } else {
                    errorMsg.textContent = data.error || 'Erro ao atualizar perfil.';
                    errorBox.style.display = 'flex';
                }
            } catch(e) {
                errorMsg.textContent = 'Erro de rede.';
                errorBox.style.display = 'flex';
            } finally {
                btnText.style.display = 'inline';
                spinner.style.display = 'none';
                btnSaveSettings.disabled = false;
            }
        });
    }

    const btnDeleteAccount = document.getElementById('btn-delete-account');
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', async () => {
            if (confirm('Tem certeza absoluta que deseja deletar sua conta? Isso não pode ser desfeito e apagará todos os seus posts e comentários.')) {
                try {
                    const res = await authFetch(`${API_URL}/users/profile`, { method: 'DELETE', headers: getAuthHeaders() });
                    if (res.ok) {
                        alert('Sua conta foi deletada com sucesso.');
                        logout();
                        window.location.reload();
                    } else {
                        const data = await res.json();
                        alert(data.error || 'Erro ao deletar conta');
                    }
                } catch(e) {
                    alert('Erro de rede.');
                }
            }
        });
    }

    // ============================
    // NOTIFICATIONS LOGIC
    // ============================
    const notifTrigger = document.getElementById('notifications-trigger');
    const notifDropdown = document.getElementById('notifications-dropdown');
    const notifBadge = document.getElementById('notifications-badge');
    const notifList = document.getElementById('notifications-list');

    if (notifTrigger && notifDropdown) {
        notifTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentUser) return openAuthModal();
            notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'flex' : 'none';
        });

        document.addEventListener('click', () => {
            notifDropdown.style.display = 'none';
        });

        notifDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    async function fetchNotifications() {
        if (!currentUser) {
            if (notifBadge) notifBadge.style.display = 'none';
            return;
        }

        try {
            const res = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
            if (res.ok) {
                const notifications = await res.json();
                renderNotifications(notifications);
            }
            // Silently ignore auth errors for notifications
        } catch(e) {
            console.error('Error fetching notifications:', e);
        }
    }

    function renderNotifications(notifications) {
        if (!notifList || !notifBadge) return;
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.style.display = 'flex';
        } else {
            notifBadge.style.display = 'none';
        }

        if (notifications.length === 0) {
            notifList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">Nenhuma notificação ainda.</div>`;
            return;
        }

        notifList.innerHTML = notifications.map(notif => `
            <div class="notification-item" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 0.75rem; align-items: flex-start; background: ${notif.is_read ? 'transparent' : 'rgba(239, 68, 68, 0.1)'}; cursor: pointer; transition: background 0.2s;" onclick="readNotification(${notif.id}, ${notif.post_id})">
                <div class="avatar-sm" style="width: 32px; height: 32px; flex-shrink: 0;">
                    <img src="${escapeHTML(notif.actor_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed='+notif.actor_name)}" alt="${escapeHTML(notif.actor_name)}">
                </div>
                <div style="flex: 1; font-size: 0.875rem;">
                    <div><span style="font-weight: bold; color: var(--text-primary);">${escapeHTML(notif.actor_name)}</span> ${escapeHTML(notif.message)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${timeAgo(notif.created_at)}</div>
                </div>
                ${!notif.is_read ? '<div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-top: 0.25rem;"></div>' : ''}
            </div>
        `).join('');
    }

    window.readNotification = async function(notifId, postId) {
        try {
            await authFetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT' });
            if (notifDropdown) notifDropdown.style.display = 'none';
            fetchNotifications();
            // Optional: navigate to the post by filtering or opening a modal
            // In a full SPA this would do `loadPost(postId)`
        } catch(e) {
            console.error('Error reading notification', e);
        }
    };

    // ============================
    // INIT
    // ============================
    updateAuthUI();
    fetchPosts();
    fetchStats();
    fetchCommunities(); // for sidebar
});
