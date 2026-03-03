import './styles.css';

const ENV_NAME = import.meta.env.PROD ? 'prod' : 'dev';
const ENV_LABEL = ENV_NAME === 'prod' ? 'PROD' : 'DEV';

const DOWNLOADS = {
  dev: [
    {
      title: 'Mac Apple Silicon (dev)',
      status: 'ready',
      href: 'http://127.0.0.1:9000/iclaw-dev/iClaw_1.0.0_aarch64_dev.dmg',
      note: 'M 系列芯片 · 开发版',
      icon: '⬢',
      tone: 'cyan',
    },
    {
      title: 'Mac Intel (dev)',
      status: 'ready',
      href: 'http://127.0.0.1:9000/iclaw-dev/iClaw_1.0.0_x64_dev.dmg',
      note: 'Intel 芯片 · 开发版',
      icon: '◆',
      tone: 'violet',
    },
    { title: 'Windows', status: 'soon', note: '敬请期待', icon: '▣', tone: 'amber' },
    { title: 'iOS', status: 'soon', note: '敬请期待', icon: '◉', tone: 'cyan' },
    { title: 'Android', status: 'soon', note: '敬请期待', icon: '△', tone: 'violet' },
  ],
  prod: [
    {
      title: 'Mac Apple Silicon',
      status: 'ready',
      href: 'https://iclaw.aiyuanxi.com/downloads/iClaw_1.0.0_aarch64_prod.dmg',
      note: 'M 系列芯片 · 正式版',
      icon: '⬢',
      tone: 'cyan',
    },
    {
      title: 'Mac Intel',
      status: 'ready',
      href: 'https://iclaw.aiyuanxi.com/downloads/iClaw_1.0.0_x64_prod.dmg',
      note: 'Intel 芯片 · 正式版',
      icon: '◆',
      tone: 'violet',
    },
    { title: 'Windows', status: 'soon', note: '敬请期待', icon: '▣', tone: 'amber' },
    { title: 'iOS', status: 'soon', note: '敬请期待', icon: '◉', tone: 'cyan' },
    { title: 'Android', status: 'soon', note: '敬请期待', icon: '△', tone: 'violet' },
  ],
};

const envPill = document.querySelector('#env-pill');
const grid = document.querySelector('#downloads-grid');

if (!envPill || !grid) {
  throw new Error('Download page mount failed');
}

envPill.textContent = `当前环境：${ENV_LABEL}`;

for (const item of DOWNLOADS[ENV_NAME]) {
  const card = document.createElement('article');
  card.className = `download-card tone-${item.tone}`;

  const icon = document.createElement('div');
  icon.className = 'platform-icon';
  icon.textContent = item.icon;

  const title = document.createElement('h3');
  title.textContent = item.title;

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = item.note;

  const action = document.createElement(item.status === 'ready' ? 'a' : 'button');
  action.className = `action ${item.status === 'ready' ? 'ready' : 'soon'}`;

  if (item.status === 'ready') {
    action.textContent = '立即下载';
    action.href = item.href;
    action.target = '_blank';
    action.rel = 'noreferrer';
  } else {
    action.textContent = '敬请期待';
    action.disabled = true;
  }

  card.append(icon, title, note, action);
  grid.append(card);
}

const downloadCards = Array.from(document.querySelectorAll('.download-card'));

// Spring-like card hover motion.
for (const card of downloadCards) {
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let raf = 0;

  const tick = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    card.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(1)`;
    if (Math.abs(tx - cx) > 0.08 || Math.abs(ty - cy) > 0.08) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
    }
  };

  const queue = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    tx = nx * 10;
    ty = ny * 7;
    queue();
  });

  card.addEventListener('pointerleave', () => {
    tx = 0;
    ty = 0;
    queue();
  });
}

// Enter animation when cards appear in viewport.
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('is-visible');
      io.unobserve(el);
    }
  },
  { threshold: 0.2 },
);

downloadCards.forEach((card, idx) => {
  card.style.transitionDelay = `${idx * 70}ms`;
  io.observe(card);
});

// Spring-like pointer parallax for hero layers.
const hero = document.querySelector('.hero');
const layers = Array.from(document.querySelectorAll('.spring-layer'));
if (hero && layers.length > 0) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let raf = 0;

  const animate = () => {
    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;

    layers.forEach((el, idx) => {
      const depth = (idx + 1) * 0.55;
      const x = currentX * depth;
      const y = currentY * depth;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });

    if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
      raf = requestAnimationFrame(animate);
    } else {
      raf = 0;
    }
  };

  const queue = () => {
    if (!raf) raf = requestAnimationFrame(animate);
  };

  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    targetX = ((event.clientX - cx) / rect.width) * 26;
    targetY = ((event.clientY - cy) / rect.height) * 18;
    queue();
  });

  hero.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    queue();
  });
}
