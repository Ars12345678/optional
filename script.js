document.addEventListener('DOMContentLoaded', () => {
    // Анимация при скролле
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.animate-in');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.3;
            
            if (elementPosition < screenPosition) {
                element.style.animation = 'fadeUp 0.8s forwards';
            }
        });
    };

    // Параллакс для изображения продукта
    const parallaxImage = () => {
        const promoImage = document.querySelector('.promo-image img');
        if (!promoImage) return;
        
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY;
            promoImage.style.transform = `scale(${1 + scrollPosition * 0.0005})`;
        });
    };

    // Изменение навигации при скролле
    const handleNavbar = () => {
        const navbar = document.querySelector('.navbar');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    };

    // Плавное появление элементов при загрузке
    const initAnimations = () => {
        animateOnScroll();
        window.addEventListener('scroll', animateOnScroll);
    };

    // Инициализация всех функций
    const init = () => {
        initAnimations();
        parallaxImage();
        handleNavbar();
    };

    init();
});