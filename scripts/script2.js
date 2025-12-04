document.addEventListener('DOMContentLoaded', function() {
    // ===================================
    // 1. Funcionalidade do Menu Responsivo
    // ===================================
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const navLinks = document.querySelectorAll('.nav ul li a');

    menuToggle.addEventListener('click', () => {
        // Alterna as classes para abrir/fechar o menu e animar o ícone
        nav.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });

    // Fechar o menu ao clicar em um link (útil em mobile)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (nav.classList.contains('active')) {
                nav.classList.remove('active');
                menuToggle.classList.remove('active');
            }
            // Chama a função de scroll suave (que o browser faz por padrão com o smooth scroll)
            updateActiveLink(link.getAttribute('href'));
        });
    });

    // ===================================
    // 2. Funcionalidade do Slider Hero
    // ===================================
    let slideIndex = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const prevButton = document.querySelector('.prev');
    const nextButton = document.querySelector('.next');
    let slideInterval;

    function showSlides(n) {
        if (n >= slides.length) { slideIndex = 0; }
        if (n < 0) { slideIndex = slides.length - 1; }

        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        slides[slideIndex].classList.add('active');
        dots[slideIndex].classList.add('active');
    }

    function plusSlides(n) {
        showSlides(slideIndex += n);
        resetInterval();
    }

    function currentSlide(n) {
        showSlides(slideIndex = n);
        resetInterval();
    }

    // Botões
    prevButton.addEventListener('click', () => plusSlides(-1));
    nextButton.addEventListener('click', () => plusSlides(1));
    
    // Pontos
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => currentSlide(index));
    });

    // Intervalo automático
    function resetInterval() {
        clearInterval(slideInterval);
        slideInterval = setInterval(() => plusSlides(1), 7000); // 7 segundos
    }

    showSlides(slideIndex);
    resetInterval();


    // ===================================
    // 3. Destacar link ativo no scroll
    // ===================================
    const sections = document.querySelectorAll('main section');
    const headerHeight = document.querySelector('.header').offsetHeight;

    const updateActiveLink = (currentId) => {
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === currentId) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPosition = window.scrollY + headerHeight + 50; // Adiciona um offset para melhor detecção

        sections.forEach(section => {
            if (section.offsetTop <= scrollPosition && section.offsetTop + section.offsetHeight > scrollPosition) {
                current = section.getAttribute('id');
            }
        });

        updateActiveLink(current);
    });

    // Inicializa o link ativo ao carregar a página
    updateActiveLink('inicio');

});