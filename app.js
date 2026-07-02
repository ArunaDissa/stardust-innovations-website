// ══════════════════════════════════════════════════════════════════════════
// STARDUST INNOVATIONS — interactive layer
// Canvas starfield w/ parallax + shooting stars, scroll reveals, card tilt
// ══════════════════════════════════════════════════════════════════════════

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mobile menu toggle ────────────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const btn = document.querySelector('.nav-menu-btn');
  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ── Canvas starfield ──────────────────────────────────────────────────────────
// Three parallax depth layers of twinkling stars + occasional shooting stars.
function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let stars = [];
  let shootingStars = [];
  const mouse = { x: 0.5, y: 0.5 };
  const parallax = { x: 0.5, y: 0.5 };

  const PALETTE = [
    [212, 175, 55],   // gold
    [240, 212, 120],  // light gold
    [255, 255, 255],  // white
    [180, 190, 255],  // cool blue-white
    [160, 220, 255],  // pale cyan
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function buildStars() {
    stars = [];
    const count = Math.min(260, Math.floor((width * height) / 6500));
    for (let i = 0; i < count; i++) {
      const depth = Math.random(); // 0 = far, 1 = near
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        depth,
        radius: 0.4 + depth * 1.6,
        color,
        baseAlpha: 0.25 + Math.random() * 0.65,
        twinkleSpeed: 0.4 + Math.random() * 1.6,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnShootingStar() {
    const fromLeft = Math.random() > 0.5;
    shootingStars.push({
      x: fromLeft ? -60 : Math.random() * width,
      y: Math.random() * height * 0.45,
      vx: 9 + Math.random() * 7,
      vy: 3 + Math.random() * 3,
      life: 1,
      decay: 0.012 + Math.random() * 0.01,
      length: 90 + Math.random() * 110,
    });
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / width;
    mouse.y = e.clientY / height;
  });

  let time = 0;
  function frame() {
    time += 0.016;
    ctx.clearRect(0, 0, width, height);

    // Ease the parallax toward the mouse for a floaty feel
    parallax.x += (mouse.x - parallax.x) * 0.03;
    parallax.y += (mouse.y - parallax.y) * 0.03;

    for (const s of stars) {
      const twinkle = REDUCED_MOTION
        ? 1
        : 0.6 + 0.4 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
      const alpha = s.baseAlpha * twinkle;

      const offsetX = (parallax.x - 0.5) * s.depth * -46;
      const offsetY = (parallax.y - 0.5) * s.depth * -46;
      const x = s.x + offsetX;
      const y = s.y + offsetY;

      const [r, g, b] = s.color;
      ctx.beginPath();
      ctx.arc(x, y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.shadowBlur = s.radius * 5;
      ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.8})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Shooting stars
    if (!REDUCED_MOTION && Math.random() < 0.004 && shootingStars.length < 2) {
      spawnShootingStar();
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const m = shootingStars[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life -= m.decay;

      if (m.life <= 0 || m.x > width + 200 || m.y > height + 200) {
        shootingStars.splice(i, 1);
        continue;
      }

      const angle = Math.atan2(m.vy, m.vx);
      const tailX = m.x - Math.cos(angle) * m.length;
      const tailY = m.y - Math.sin(angle) * m.length;
      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255,245,210,${0.9 * m.life})`);
      grad.addColorStop(1, 'rgba(255,245,210,0)');

      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,240,${m.life})`;
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();

  if (REDUCED_MOTION) {
    // Draw one static frame — no animation loop
    for (const s of stars) {
      const [r, g, b] = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${s.baseAlpha})`;
      ctx.fill();
    }
  } else {
    requestAnimationFrame(frame);
  }
}

// ── 3D tilt on cards ──────────────────────────────────────────────────────────
function initTilt() {
  if (REDUCED_MOTION || !window.matchMedia('(hover: hover)').matches) return;

  document.querySelectorAll('.tilt').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(900px) rotateX(${py * -5}deg) rotateY(${px * 7}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ── Smooth scroll for nav links ───────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Nav appearance on scroll ──────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ── Scroll reveal ─────────────────────────────────────────────────────────────
function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  elements.forEach((el) => observer.observe(el));
}

// ── Active nav on scroll ──────────────────────────────────────────────────────
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => link.classList.remove('nav-active'));
        const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('nav-active');
      }
    });
  }, { threshold: 0.35 });

  sections.forEach((section) => observer.observe(section));
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initTilt();
  initReveal();
  initActiveNav();
});
