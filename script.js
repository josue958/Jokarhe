/**
 * JOKARHE SYSTEMS - PREMIUM LANDING PAGE
 * Vanilla JavaScript (No Frameworks)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    /* --------------------------------------------------------------------------
       1. CUSTOM CURSOR
       -------------------------------------------------------------------------- */
    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor');
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    document.querySelectorAll('a, button, .faq-question, .feature-card, .service-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(2)';
            cursor.style.backgroundColor = 'rgba(0, 184, 216, 0.1)';
        });
        el.addEventListener('mouseleave', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            cursor.style.backgroundColor = 'transparent';
        });
    });

    /* --------------------------------------------------------------------------
       2. NAVBAR STICKY & MOBILE MENU
       -------------------------------------------------------------------------- */
    const navbar = document.querySelector('.navbar');
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    mobileBtn.addEventListener('click', () => {
        mobileBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileBtn.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    /* --------------------------------------------------------------------------
       3. SCROLL REVEAL ANIMATIONS
       -------------------------------------------------------------------------- */
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
        observer.observe(el);
    });

    /* --------------------------------------------------------------------------
       4. TYPING EFFECT (HERO)
       -------------------------------------------------------------------------- */
    const heroTitle = document.querySelector('.hero-title .gradient-text');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        let i = 0;
        
        function typeWriter() {
            if (i < text.length) {
                heroTitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        }
        
        setTimeout(typeWriter, 1200);
    }

    /* --------------------------------------------------------------------------
       5. COUNTERS (STATISTICS)
       -------------------------------------------------------------------------- */
    const counters = document.querySelectorAll('.stat-number');
    let hasCounted = false;

    const countUp = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 2000;
            const increment = target / (duration / 16);
            
            let current = 0;
            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.innerText = Math.ceil(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.innerText = target + (target > 1000 ? '+' : '');
                }
            };
            updateCounter();
        });
    };

    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasCounted) {
                countUp();
                hasCounted = true;
            }
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }

    /* --------------------------------------------------------------------------
       6. FAQ ACCORDION
       -------------------------------------------------------------------------- */
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(faq => faq.classList.remove('active'));
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    /* --------------------------------------------------------------------------
       7. FLOATING "UP" BUTTON
       -------------------------------------------------------------------------- */
    const fabUp = document.querySelector('.fab-up');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            fabUp.classList.add('visible');
        } else {
            fabUp.classList.remove('visible');
        }
    });

    fabUp.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    /* --------------------------------------------------------------------------
       8. FORM VALIDATION
       -------------------------------------------------------------------------- */
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            // Obtener valores del formulario
            const name = document.getElementById('form-name').value;
            const company = document.getElementById('form-company').value || 'N/A';
            const email = document.getElementById('form-email').value;
            const phone = document.getElementById('form-phone').value || 'N/A';
            const message = document.getElementById('form-message').value;
            
            // Preparar mensaje para WhatsApp
            const waText = `Hola Jokarhe Systems.%0AMi nombre es ${name} (Empresa: ${company}).%0AMi correo es ${email} y teléfono ${phone}.%0A%0AMensaje:%0A${message}`;
            // Se usa el número de pruebas proporcionado. El prefijo +52 o sin prefijo dependerá del registro real, usamos el sugerido:
            const whatsappUrl = `https://wa.me/5255547036?text=${waText}`;
            
            // Preparar enlace mailto
            const mailtoBody = `Nombre: ${name}\nEmpresa/Institución: ${company}\nCorreo: ${email}\nTeléfono: ${phone}\n\nMensaje:\n${message}`;
            const mailtoUrl = `mailto:josue958@gmail.com?subject=Nuevo Contacto de ${encodeURIComponent(name)}&body=${encodeURIComponent(mailtoBody)}`;
            
            btn.innerHTML = 'Enviando...';
            btn.disabled = true;
            
            // 1. Abrir cliente de correo (en la misma ventana para minimizar bloqueos de popup)
            window.location.href = mailtoUrl;
            
            // 2. Abrir WhatsApp en una nueva pestaña (algunos navegadores pueden requerir interacción directa para permitir ambas)
            window.open(whatsappUrl, '_blank');
            
            setTimeout(() => {
                btn.innerHTML = '¡Mensaje Enviado! ✓';
                btn.style.background = 'var(--color-success)';
                form.reset();
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }, 1500);
        });
    }
});
