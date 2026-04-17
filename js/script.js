// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Configuration
    const API_URL = '/api'; // Same host
    const MOCK_USER_ID = 1; // Simulation of logged in Admin

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.mobile-nav-item, .sidebar-link, .top-tab');
    const feedContainer = document.getElementById('feed-container');
    const challengesContainer = document.getElementById('challenges-container');
    const postTemplate = document.getElementById('post-template');
    const sideNavigation = document.getElementById('side-navigation');
    const drawerOverlay = document.getElementById('drawer-overlay');

    // State
    let currentView = 'view-home';

    function renderSkeleton(container) {
        container.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'reddit-card skeleton';
            skeletonCard.style.padding = '1rem';
            skeletonCard.style.minHeight = '120px';
            skeletonCard.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <div class="skeleton-avatar skeleton"></div>
                    <div class="skeleton-text skeleton" style="width:100px;"></div>
                </div>
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text skeleton" style="width:80%;"></div>
            `;
            feedContainer.appendChild(skeletonCard);
        }
    }

    // Fetch and Render Posts
    async function fetchPosts() {
        renderSkeleton(feedContainer);
        renderSkeleton(challengesContainer);
        
        try {
            const response = await fetch(`${API_URL}/posts`);
            const posts = await response.json();
            
            if (posts.length > 0) {
                // Render Home Feed (All posts)
                renderFeed(posts, feedContainer);
                
                // Render Challenges Feed (Only challenges)
                const challenges = posts.filter(p => p.type === 'challenge');
                renderFeed(challenges, challengesContainer);
            } else {
                const emptyHtml = `
                <div class="empty-state">
                    <i data-lucide="inbox" class="empty-icon"></i>
                    <h2>O seu feed está vazio.</h2>
                    <p>Seja o primeiro a lançar um desafio para a comunidade ou explore novos tópicos.</p>
                </div>`;
                feedContainer.innerHTML = emptyHtml;
                challengesContainer.innerHTML = emptyHtml;
                lucide.createIcons();
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            const errorHtml = '<p style="text-align:center; padding: 2rem;">Erro ao recarregar o feed.</p>';
            feedContainer.innerHTML = errorHtml;
            challengesContainer.innerHTML = errorHtml;
        }
    }

    function renderFeed(posts, container) {
        // Clear empty state or existing posts
        container.innerHTML = '';

        posts.forEach(post => {
            const clone = postTemplate.content.cloneNode(true);
            
            // Map data
            const article = clone.querySelector('.reddit-card');
            article.setAttribute('data-id', post.id);

            clone.querySelector('.vote-count').textContent = post.upvotes || 0;
            clone.querySelector('[data-value="author"]').textContent = post.username;
            clone.querySelector('[data-value="time"]').textContent = new Date(post.created_at).toLocaleDateString();
            clone.querySelector('[data-value="title"]').textContent = post.title;
            clone.querySelector('[data-value="body"]').textContent = post.content || '';
            clone.querySelector('[data-value="comments"]').textContent = post.comment_count || 0;

            if (post.image_url) {
                const img = document.createElement('img');
                img.src = post.image_url;
                img.className = 'post-image'; // CSS needs to handle this
                clone.querySelector('.post-body').after(img);
            }

            // Challenge badge
            if (post.type === 'challenge') {
                const badge = clone.querySelector('.badge-tag');
                badge.textContent = post.challenge_type.toUpperCase();
                badge.style.display = 'inline-block';
            }

            // Voting Logic bindings
            const upvoteBtn = clone.querySelector('.upvote');
            const downvoteBtn = clone.querySelector('.downvote');
            const countSpan = clone.querySelector('.vote-count');

            const handleVote = async (value, btnObj, oppositeBtn) => {
                const currentCount = parseInt(countSpan.textContent);
                try {
                    const response = await fetch(`${API_URL}/posts/${post.id}/vote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: MOCK_USER_ID, value: value })
                    });
                    if (response.ok) {
                        // Simplistic optimistic UI update
                        countSpan.textContent = currentCount + value;
                        btnObj.style.color = value === 1 ? 'var(--upvote-color)' : 'var(--downvote-color)';
                        oppositeBtn.style.color = '';
                    }
                } catch (e) {
                    console.error('Vote failed', e);
                }
            };

            upvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleVote(1, upvoteBtn, downvoteBtn);
            });

            downvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleVote(-1, downvoteBtn, upvoteBtn);
            });

            container.appendChild(clone);
        });

        // Re-initialize icons for new elements
        lucide.createIcons();
    }

    // Post Creation Logic
    const postInput = document.querySelector('.post-input');
    const createBtn = document.querySelector('.nav-action-btn'); // Top "Criar" button or could use enter on input

    async function createPost(title, type = 'post', inputElement) {
        const parent = inputElement ? inputElement.parentElement : postInput.parentElement;
        if (!parent) return;
        parent.classList.add('is-loading');
        
        try {
            const response = await fetch(`${API_URL}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: MOCK_USER_ID,
                    title: title,
                    content: type === 'challenge' ? 'Novo desafio proposto!' : 'Conteúdo de exemplo gerado via interface.',
                    type: type,
                    challenge_type: type === 'challenge' ? 'quiz' : null
                })
            });

            if (response.ok) {
                if (inputElement) inputElement.value = '';
                fetchPosts(); // Refresh feeds
            }
        } catch (error) {
            console.error('Error creating post:', error);
        } finally {
            parent.classList.remove('is-loading');
        }
    }

    if (postInput) {
        postInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && postInput.value.trim() !== '') {
                createPost(postInput.value.trim(), 'post', postInput);
            }
        });
    }

    if (createBtn) {
        createBtn.addEventListener('click', () => {
             if (postInput.value.trim() !== '') {
                createPost(postInput.value.trim(), 'post', postInput);
             } else {
                createPost('Desafio de Teste #' + Math.floor(Math.random()*100), 'challenge', postInput);
             }
        });
    }

    // Challenge View Specific Logic
    const challengeInput = document.querySelector('.challenge-input');
    const challengeSubmitBtn = document.querySelector('.challenge-submit-btn');

    if (challengeInput) {
        challengeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && challengeInput.value.trim() !== '') {
                createPost(challengeInput.value.trim(), 'challenge', challengeInput);
            }
        });
    }

    if (challengeSubmitBtn) {
        challengeSubmitBtn.addEventListener('click', () => {
             if (challengeInput.value.trim() !== '') {
                createPost(challengeInput.value.trim(), 'challenge', challengeInput);
             }
        });
    }

    // Navigation Logic
    function handleNavigation(targetId) {
        // Toggle Views
        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.remove('hidden');
                view.classList.add('active');
            } else {
                view.classList.add('hidden');
                view.classList.remove('active');
            }
        });

        // Toggle Nav Items State
        navItems.forEach(item => {
            if (item.dataset.target === targetId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        currentView = targetId;
        
        // Refresh visible feed
        fetchPosts();
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.dataset.target;
            if (target) {
                handleNavigation(target);
            }
        });
    });

    // Initialize
    fetchPosts();

    // Responsive interaction setup
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    function toggleDrawer(open) {
        if (open) {
            sideNavigation.classList.add('open');
        } else {
            sideNavigation.classList.remove('open');
        }
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
             toggleDrawer(true);
        });
    }

    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }

    // Close drawer on link click (mobile)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 1200) {
                toggleDrawer(false);
            }
        });
    });

    // ESC to close drawer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleDrawer(false);
    });
});
