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
        if (currentUser) {
            authSection.innerHTML = `
                <div class="avatar-sm" title="${escapeHTML(currentUser.username)} — Clique para sair" onclick="logout()">
                    <img src="${escapeHTML(currentUser.avatar_url)}" alt="${escapeHTML(currentUser.username)}">
                </div>
            `;
        } else {
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
                authTitle.textContent = 'Entrar no DesafioHub';
                if (sub) sub.textContent = 'Participe dos desafios e conquiste a comunidade';
                submitText.textContent = 'Entrar';
                authToggleText.textContent = 'Não tem uma conta?';
                authToggleBtn.textContent = 'Cadastre-se';
            } else {
                authTitle.textContent = 'Criar Conta';
                if (sub) sub.textContent = 'Junte-se à comunidade DesafioHub';
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
        if (res.status === 401) { openAuthModal(); throw new Error('Unauthorized'); }
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
                badge.textContent = post.challenge_type ? post.challenge_type.toUpperCase() : 'DESAFIO';
                badge.style.display = 'inline-block';

                const postBody = clone.querySelector('.post-body');
                if (post.challenge_type === 'collab') {
                    const pct = Math.min(post.progress || 0, 100);
                    postBody.insertAdjacentHTML('beforeend', `
                        <div class="collab-progress-container">
                            <div class="collab-progress-track">
                                <div class="collab-progress-fill" style="width:${pct}%"></div>
                            </div>
                            <div class="progress-text">
                                <span>Progresso da Comunidade</span>
                                <span class="progress-percent">${pct} / 100</span>
                            </div>
                            <button class="collab-action">Contribuir para a Meta</button>
                        </div>
                    `);
                    clone.querySelector('.collab-action').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            const res = await authFetch(`${API_URL}/posts/${post.id}/collab`, {
                                method: 'POST', headers: getAuthHeaders()
                            });
                            const data = await res.json();
                            if (res.ok) {
                                article.querySelector('.collab-progress-fill').style.width = `${Math.min(data.new_progress,100)}%`;
                                article.querySelector('.progress-percent').textContent = `${data.new_progress} / 100`;
                                const btn = article.querySelector('.collab-action');
                                btn.textContent = 'Contribuição Enviada!';
                                btn.disabled = true;
                                btn.style.opacity = '0.6';
                            } else { alert(data.error); }
                        } catch(err) { if (err.message !== 'Unauthorized') console.error(err); }
                    });
                } else if (post.challenge_type === 'duel') {
                    const safe = escapeHTML(post.username);
                    const ava = escapeHTML(post.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${safe}`);
                    postBody.insertAdjacentHTML('beforeend', `
                        <div class="duel-stage">
                            <div class="duel-avatar challenger"><img src="${ava}" alt="${safe}"><span>${safe}</span></div>
                            <div class="duel-vs">V/S</div>
                            <div class="duel-avatar opponent">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Open" style="border-style:dashed;border-color:var(--text-muted);">
                                <span style="color:var(--text-muted);">Aberto</span>
                            </div>
                        </div>
                        <button class="duel-action">Aceitar Duelo</button>
                    `);
                    clone.querySelector('.duel-action').addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!currentUser) { openAuthModal(); return; }
                        const btn = article.querySelector('.duel-action');
                        btn.textContent = 'Duelo Aceito!';
                        btn.disabled = true;
                        btn.style.opacity = '0.6';
                        const oppImg = article.querySelector('.duel-avatar.opponent img');
                        const oppSpan = article.querySelector('.duel-avatar.opponent span');
                        oppImg.src = escapeHTML(currentUser.avatar_url);
                        oppImg.style.borderStyle = 'solid';
                        oppImg.style.borderColor = 'var(--downvote-color)';
                        oppSpan.textContent = escapeHTML(currentUser.username);
                        oppSpan.style.color = 'var(--text-primary)';
                    });
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
            renderCommunities(communities);
            renderSidebarCommunities(communities);
        } catch(err) {
            communitiesContainer.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Erro ao carregar comunidades.</p>';
        }
    }

    async function fetchStats() {
        try {
            const res = await fetch(`${API_URL}/stats`);
            const stats = await res.json();
            document.getElementById('stat-challenges').textContent = stats.challenges || 0;
            document.getElementById('stat-members').textContent = stats.members || 0;
            renderTrending(stats.top_posts || []);
        } catch(err) { /* silent */ }
    }

    function renderCommunities(communities) {
        communitiesContainer.innerHTML = '';
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
                <button class="community-join-btn">Entrar</button>
            `;
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

    async function createPost(title, type = 'post', inputEl, challengeType = null) {
        const parent = inputEl ? inputEl.closest('.create-post-card') : null;
        if (parent) parent.classList.add('is-loading');
        try {
            const res = await authFetch(`${API_URL}/posts`, {
                method: 'POST', headers: getAuthHeaders(),
                body: JSON.stringify({
                    title, content: type === 'challenge' ? 'Novo desafio proposto!' : '',
                    type, challenge_type: challengeType
                })
            });
            if (res.ok) {
                if (inputEl) inputEl.value = '';
                loadCurrentView();
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
                createPost(challengeInput.value.trim(), 'challenge', challengeInput, challengeTypeSelect?.value || 'quiz');
            }
        });
    }
    if (challengeSubmitBtn) {
        challengeSubmitBtn.addEventListener('click', () => {
            if (challengeInput.value.trim()) {
                createPost(challengeInput.value.trim(), 'challenge', challengeInput, challengeTypeSelect?.value || 'quiz');
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
    function loadCurrentView() {
        if (currentView === 'view-home' || currentView === 'view-challenges') {
            fetchPosts();
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleDrawer(false); closeAuthModal(); } });

    // ============================
    // INIT
    // ============================
    fetchPosts();
    fetchStats();
    fetchCommunities(); // for sidebar
});
