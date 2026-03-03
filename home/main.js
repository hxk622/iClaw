import './styles.css';

const ENV_NAME = import.meta.env.PROD ? 'prod' : 'dev';
const ENV_LABEL = ENV_NAME === 'prod' ? 'PROD' : 'DEV';

const DOWNLOADS = {
  dev: [
    {
      title: 'Mac Apple Silicon (dev)',
      status: 'ready',
      href: 'http://127.0.0.1:9000/iclaw-dev/iClaw_1.0.0_aarch64-dev.dmg',
      note: 'M 系列芯片',
    },
    {
      title: 'Mac Intel (dev)',
      status: 'ready',
      href: 'http://127.0.0.1:9000/iclaw-dev/iClaw_1.0.0_x64-dev.dmg',
      note: 'Intel 芯片',
    },
    { title: 'Windows', status: 'soon', note: '敬请期待' },
    { title: 'iOS', status: 'soon', note: '敬请期待' },
    { title: 'Android', status: 'soon', note: '敬请期待' },
  ],
  prod: [
    {
      title: 'Mac Apple Silicon',
      status: 'ready',
      href: 'https://115.191.6.179/iclaw-prod/iClaw_1.0.0_aarch64.dmg',
      note: 'M 系列芯片',
    },
    {
      title: 'Mac Intel',
      status: 'ready',
      href: 'https://115.191.6.179/iclaw-prod/iClaw_1.0.0_x64.dmg',
      note: 'Intel 芯片',
    },
    { title: 'Windows', status: 'soon', note: '敬请期待' },
    { title: 'iOS', status: 'soon', note: '敬请期待' },
    { title: 'Android', status: 'soon', note: '敬请期待' },
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
  card.className = 'download-card';

  const title = document.createElement('h3');
  title.textContent = item.title;

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = item.note;

  const action = document.createElement(item.status === 'ready' ? 'a' : 'button');
  action.className = `action ${item.status === 'ready' ? 'ready' : 'soon'}`;

  if (item.status === 'ready') {
    action.textContent = '下载';
    action.href = item.href;
    action.target = '_blank';
    action.rel = 'noreferrer';
  } else {
    action.textContent = '敬请期待';
    action.disabled = true;
  }

  card.append(title, note, action);
  grid.append(card);
}
