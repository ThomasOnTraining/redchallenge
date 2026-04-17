// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Responsive interaction setup (if any)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
             // Future implementation of mobile side drawer
             console.log("Mobile menu clicked");
        });
    }

    // In a real application, you would pull data and clone the #post-template
    // to populate the #feed-container here. For now, it stays with the Empty State.
});
