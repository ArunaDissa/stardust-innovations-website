// ── Mobile menu toggle ────────────────────────────────────────────────────────
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const btn = document.querySelector('.nav-menu-btn');
  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ── Generate premium twinkling stars ─────────────────────────────────────────
function createStars() {
  const container = document.getElementById('stars');
  if (!container) return;

  const goldColors = [
    'rgba(212,175,55,VAL)',   // gold
    'rgba(255,220,100,VAL)',  // light gold
    'rgba(255,255,255,VAL)',  // white
    'rgba(230,210,160,VAL)',  // warm white
    'rgba(255,235,180,VAL)',  // pale gold
  ];

  // Small dot stars — the background field
  for (let i = 0; i < 180; i++) {
    const star = document.createElement('div');
    star.classList.add('star');
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';

    const size = 0.8 + Math.random() * 2.2;
    const opacity = 0.2 + Math.random() * 0.75;
    const duration = 2.5 + Math.random() * 6;
    const colorTemplate = goldColors[Math.floor(Math.random() * goldColors.length)];
    const color = colorTemplate.replace('VAL', '1');
    const glowColor = colorTemplate.replace('VAL', '0.5');

    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.background = color;
    star.style.boxShadow = `0 0 ${size * 2}px ${size}px ${glowColor}`;
    star.style.setProperty('--duration', duration + 's');
    star.style.setProperty('--opacity', opacity.toString());
    star.style.animationDelay = (Math.random() * 6) + 's';
    container.appendChild(star);
  }

  // 4-point sparkle stars — the premium hero stars
  for (let i = 0; i < 22; i++) {
    const star = document.createElement('div');
    star.classList.add('star-sparkle');
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';

    const size = 12 + Math.random() * 24;
    const opacity = 0.5 + Math.random() * 0.5;
    const duration = 3 + Math.random() * 7;
    const rotate = (Math.random() * 30 - 15) + 'deg';
    const isGold = Math.random() > 0.4;
    const starColor = isGold
      ? `rgba(${212 + Math.random() * 30 | 0},${175 + Math.random() * 40 | 0},${55 + Math.random() * 30 | 0},1)`
      : 'rgba(255,255,255,1)';

    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.setProperty('--star-color', starColor);
    star.style.setProperty('--duration', duration + 's');
    star.style.setProperty('--opacity', opacity.toString());
    star.style.setProperty('--rotate', rotate);
    star.style.animationDelay = (Math.random() * 7) + 's';
    container.appendChild(star);
  }
}

// ── Smooth scroll for nav links ───────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Nav background on scroll ──────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(8,8,8,0.98)';
  } else {
    nav.style.background = 'rgba(8,8,8,0.85)';
  }
});

// ── Scroll reveal ─────────────────────────────────────────────────────────────
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  elements.forEach(el => observer.observe(el));
}

// ── Active nav on scroll ──────────────────────────────────────────────────────
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.remove('nav-active'));
        const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('nav-active');
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(section => observer.observe(section));
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  createStars();
  initReveal();
  initActiveNav();
});
