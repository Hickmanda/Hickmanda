(() => {
  const badge = document.querySelector('#badge');
  const area = document.querySelector('.badge-area');
  const hero = document.querySelector('.hero');
  const strap = ['strap', 'strap-shadow', 'strap-stitch'].map(id => document.getElementById(id));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.querySelector('#motion-toggle');
  let savedMotion = null;
  try { savedMotion = sessionStorage.getItem('portfolio-motion'); } catch {}
  let paused = savedMotion ? savedMotion === 'paused' : reduced.matches;
  let spin = 0;
  let tiltVelocity = 0, spinVelocity = 0;
  const strapLength = 248;
  let anchorY = -120, entryDistance = 650, entryOffset = 0, entryProgress = paused ? 1 : 0;
  let x = paused ? 0 : 38, y = paused ? 0 : -24, vx = 0, vy = 0, tilt = paused ? 0 : -12;
  let dragging = false, pointerId = null, moved = false, last = 0, frame = null, visible = true;
  let startX = 0, startY = 0, originX = 0, originY = 0, flipped = false, lastScroll = window.scrollY;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  function measureSuspension() {
    const rect = area.getBoundingClientRect();
    const scale = rect.height / area.offsetHeight || 1;
    // The fixing point stays above the document's top edge, even after scrolling.
    anchorY = -(rect.top + window.scrollY + 50) / scale;
    entryDistance = -anchorY + strapLength + badge.offsetHeight + 30;
    if (entryProgress === 0) entryOffset = -entryDistance;
  }
  const canvas = document.querySelector('#ambient-canvas');
  canvas.classList.add('global-ambient');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let canvasW = 1, canvasH = 1, pointer = { x: -1000, y: -1000 };
  const points = Array.from({ length: 58 }, (_, i) => ({ u: ((i * 73 + 17) % 101) / 101, v: ((i * 37 + 11) % 97) / 97, phase: i * 2.4, r: i % 4 === 0 ? 1.8 : 1 }));
  function resizeCanvas() {
    canvasW = canvas.clientWidth || hero.clientWidth; canvasH = canvas.clientHeight || hero.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvasW * ratio); canvas.height = Math.round(canvasH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); drawAmbient(0);
  }
  function drawAmbient(time) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    const t = paused ? 0 : time * .00032;
    for (let wave = 0; wave < 5; wave++) {
      ctx.beginPath();
      for (let px = 0; px <= canvasW; px += 12) {
        const py = canvasH * (.14 + wave * .18) + Math.sin(px / canvasW * 5 + t + wave) * 38 + Math.sin(px / canvasW * 9 - t * .8) * 12;
        if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(191,167,241,${.04 + wave * .006})`; ctx.lineWidth = 1; ctx.stroke();
    }
    const coords = points.map(p => {
      let px = p.u * canvasW + Math.sin(t + p.phase) * 42, py = p.v * canvasH + Math.cos(t * .8 + p.phase) * 34;
      const dx = px - pointer.x, dy = py - pointer.y, distance = Math.hypot(dx, dy);
      if (!paused && distance < 130 && distance > 0) { const push = (1 - distance / 130) * 18; px += dx / distance * push; py += dy / distance * push; }
      return { x: px, y: py, r: p.r };
    });
    coords.forEach((p, i) => {
      for (let j = i + 1; j < coords.length; j++) {
        const q = coords[j], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 145) {
          ctx.strokeStyle = `rgba(171,178,229,${(1 - d / 145) * .24})`; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          if ((i + j) % 5 === 0) { const travel = (t * .42 + i * .13) % 1; const fade = Math.sin(travel * Math.PI) * (1 - d / 145); ctx.fillStyle = `rgba(219,201,255,${fade * .65})`; ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * travel, p.y + (q.y - p.y) * travel, 1.7, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.fillStyle = i % 3 === 0 ? 'rgba(128,225,207,.5)' : 'rgba(186,160,255,.38)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
  }
  function draw() {
    const angle = clamp(-Math.atan2(x, strapLength) * 180 / Math.PI, -20, 20);
    tiltVelocity = (tiltVelocity + (angle - tilt) * .022) * .91;
    tilt += tiltVelocity;
    const cardY = y + entryOffset;
    badge.style.transform = `translate3d(${x}px,${cardY}px,0) rotateZ(${tilt}deg)`;
    badge.querySelector('.badge-inner').style.transform = `rotateX(${clamp(-vy * .45, -6, 6)}deg) rotateY(${spin + (flipped ? 180 : 0)}deg)`;
    const width = area.offsetWidth || 440;
    const sx = x * 440 / width;
    const endY = strapLength + cardY;
    const length = endY - anchorY;
    const path = `M 220 ${anchorY} C ${220 + sx * .15 - vx * 2} ${anchorY + length * .35}, ${220 + sx * .72 - vx} ${anchorY + length * .74}, ${220 + sx} ${endY}`;
    strap.forEach(p => p.setAttribute('d', path));
    badge.style.setProperty('--shine-x', `${50 + tilt * 2}%`);
    badge.style.setProperty('--light-x', `${50 + spin * 1.3}%`);
  }
  function animate(time) {
    frame = null;
    if (paused || !visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min((time - last) / 16.667, 2) : 1; last = time;
    if (entryProgress < 1) {
      entryProgress = Math.min(1, entryProgress + dt / 96);
      const t = entryProgress - 1;
      const eased = 1 + 2.05 * t * t * t + 1.05 * t * t;
      entryOffset = -entryDistance * (1 - eased);
    }
    if (!dragging) {
      const targetSpin = Math.sin(time * .00046) * 28 - vx * 1.8;
      spinVelocity = (spinVelocity + (targetSpin - spin) * .012 * dt) * Math.pow(.94, dt);
      spin += spinVelocity * dt;
      const targetX = Math.sin(time * .00065) * 17;
      const targetY = -(x * x) / (strapLength * 2);
      vx = (vx + (targetX - x) * .014 * dt) * Math.pow(.94, dt);
      vy = (vy + (targetY - y) * .023 * dt) * Math.pow(.88, dt);
      x += vx * dt; y += vy * dt;
    }
    draw(); drawAmbient(time); frame = requestAnimationFrame(animate);
  }
  function start() { if (!frame && !paused && visible && !document.hidden) { last = 0; frame = requestAnimationFrame(animate); } }
  function release() {
    if (!dragging) return;
    dragging = false; badge.classList.remove('dragging');
    if (pointerId !== null && badge.hasPointerCapture(pointerId)) badge.releasePointerCapture(pointerId);
    pointerId = null;
    if (paused) { x = y = vx = vy = tilt = 0; draw(); } else start();
  }
  badge.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointerId !== null) return;
    entryProgress = 1; entryOffset = 0;
    dragging = true; moved = false; pointerId = e.pointerId; startX = e.clientX; startY = e.clientY; originX = x; originY = y; vx = vy = 0;
    badge.setPointerCapture(e.pointerId); badge.classList.add('dragging');
  });
  badge.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 6) moved = true;
    const limit = Math.max(15, Math.min(95, (area.offsetWidth - 260) / 2 - 5));
    const nextX = clamp(originX + dx, -limit, limit), nextY = -(nextX * nextX) / (strapLength * 2) + clamp((originY + dy) * .2, -15, 12);
    vx = clamp(nextX - x, -10, 10); vy = clamp(nextY - y, -10, 10); x = nextX; y = nextY; draw();
  });
  badge.addEventListener('pointerup', release);
  badge.addEventListener('pointercancel', () => { moved = true; release(); });
  badge.addEventListener('lostpointercapture', release);
  badge.addEventListener('click', () => {
    if (moved) { moved = false; return; }
    flipped = !flipped; badge.classList.toggle('flipped', flipped); badge.setAttribute('aria-pressed', String(flipped));
    badge.querySelector('.badge-front').setAttribute('aria-hidden', String(flipped)); badge.querySelector('.badge-back').setAttribute('aria-hidden', String(!flipped));
    if (!paused) { vx += flipped ? 3 : -3; start(); }
  });
  badge.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') moved = false;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); if (paused) return;
    if (e.key === 'ArrowLeft') vx -= 5; if (e.key === 'ArrowRight') vx += 5;
    if (e.key === 'ArrowUp') vy -= 4; if (e.key === 'ArrowDown') vy += 4;
    start();
  });
  function updateMotion() {
    document.body.classList.toggle('motion-paused', paused);
    document.body.classList.toggle('motion-enabled', !paused);
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', paused ? 'Resume animations' : 'Pause animations');
    motionToggle.title = paused ? 'Resume animations' : 'Pause animations';
    motionToggle.querySelector('path').setAttribute('d', paused ? 'M6 3l10 7-10 7z' : 'M5 4h3v12H5zm7 0h3v12h-3z');
    if (paused) { if (frame) cancelAnimationFrame(frame); frame = null; entryProgress = 1; entryOffset = 0; x = y = vx = vy = tilt = spin = tiltVelocity = spinVelocity = 0; draw(); drawAmbient(0); } else start();
  }
  motionToggle.addEventListener('click', () => { paused = !paused; try { sessionStorage.setItem('portfolio-motion', paused ? 'paused' : 'active'); } catch {} updateMotion(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; updateMotion(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible && frame) { cancelAnimationFrame(frame); frame = null; } else start(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', start);
  window.addEventListener('resize', () => { measureSuspension(); draw(); resizeCanvas(); });
  document.fonts.ready.then(() => { measureSuspension(); draw(); });
  window.addEventListener('scroll', () => {
    const delta = window.scrollY - lastScroll; lastScroll = window.scrollY;
    if (!paused && visible && !dragging) { vx += clamp(delta * .009, -.25, .25); start(); }
  }, { passive: true });
  hero.addEventListener('pointermove', e => {
    if (paused || e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; hero.style.setProperty('--pointer-x', `${pointer.x / r.width * 100}%`); hero.style.setProperty('--pointer-y', `${pointer.y / r.height * 100}%`);
  });
  hero.addEventListener('pointerleave', () => { pointer = { x: -1000, y: -1000 }; });
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('revealed');
    else if (entry.boundingClientRect.top > window.innerHeight || entry.boundingClientRect.bottom < 0) entry.target.classList.remove('revealed');
  }), { threshold: 0, rootMargin: '0px 0px -45px 0px' });
  document.querySelectorAll('.section-heading>div,.section-heading>p,.project,.about>div:first-child>*,.about-copy>p,.skills-grid>div,.closing>*').forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--reveal-delay', `${i % 3 * 85}ms`); reveal.observe(el); });
  const navLinks = [...document.querySelectorAll('.dock a[href^="#"]')];
  const sections = navLinks.map(a => document.querySelector(a.getAttribute('href')));
  function updateNav() {
    let current = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= window.innerHeight * .45) current = section;
    navLinks.forEach(a => { const active = a.getAttribute('href') === `#${current.id}`; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  let navQueued = false;
  window.addEventListener('scroll', () => { if (!navQueued) { navQueued = true; requestAnimationFrame(() => { updateNav(); navQueued = false; }); } }, { passive: true });
  measureSuspension(); resizeCanvas(); updateNav(); updateMotion(); draw(); start();
})();



