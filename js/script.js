// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Responsive specific interactions
    const mainNav = document.querySelector('.main-nav');
    
    // Simulate active states on Nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Se for o botão C.T.A (lançar desafio), ignoramos o set active normal
            if(item.classList.contains('action-wrapper')) return;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Simulate interactions in Fake Feed Card
    const likeBtns = document.querySelectorAll('.action-btn');
    likeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(btn.innerHTML.includes('heart')) {
                btn.classList.toggle('active-like');
            }
        });
    });
});
