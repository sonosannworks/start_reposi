/* ===========================
   Portfolio Script
=========================== */

/* ---- 共通ヘッダー（nav.html）の読み込みと初期化 ---- */
function loadSiteNav() {
  const placeholder = document.getElementById('site-nav-placeholder');
  if (!placeholder) return Promise.resolve();

  return fetch('nav.html')
    .then(res => res.text())
    .then(html => {
      placeholder.innerHTML = html;
      initSiteNav();
    })
    .catch(err => console.error('ナビゲーションの読み込みに失敗しました:', err));
}

function initSiteNav() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (!nav || !navToggle || !navLinks) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });

  // ナビリンクをクリックしたらメニューを閉じる
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });

  // 現在のページに対応するリンクをハイライト
  const currentFile = location.pathname.split('/').pop() || 'index.html';
  navLinks.querySelectorAll('a').forEach(link => {
    const hrefFile = (link.getAttribute('href') || '').split('#')[0].split('/').pop();
    if (hrefFile && hrefFile === currentFile) {
      link.style.color = 'var(--accent)';
    }
  });
}

/* ---- webAIサイトからの遷移時: ポートフォリオヘッダーの代わりに
   web&AIサポートサイトのヘッダーを表示する ----
   ※ index.html では呼び出さない。対象ページ側で明示的に呼び出す。 */
const WEBAI_SITE_BASE = 'https://sonosannworks.github.io/web-AI-/';

// header.html の取得に失敗した場合に使うフォールバック（同サイトの header.html を複製）
const WEBAI_HEADER_FALLBACK = `
<header class="site-header">
  <div class="inner header-inner">
    <a href="#" class="logo">
      <span class="logo-en">sonosann</span>
      <span class="logo-jp">Web&AIサポート</span>
    </a>

    <nav class="global-nav" id="global-nav">
      <ul>
        <li><a href="#hero">ホーム</a></li>
        <li><a href="#service">サービス</a></li>
        <li><a href="#app">導入事例</a></li>
        <li><a href="#about">会社概要</a></li>
        <li class="nav-item-app nav-item-app-first">
          <a class="nav-app-link" href="https://start-reposi.vercel.app/mini-games.html?from=webai" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            認知症miniGAME
          </a>
        </li>
        <li class="nav-item-app">
          <a class="nav-app-link" href="https://start-reposi.vercel.app/cmsupport.html?from=webai" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            ケアプラン作成支援アプリ
          </a>
        </li>
      </ul>
    </nav>

    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfcuPxjBmkqhXWLq02e_RkbfR6JX9WB--kRG6Df52_uLF89pw/viewform" class="btn btn-primary btn-header" target="_blank" rel="noopener">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4.4 3.3A.6.6 0 0 1 3.6 20V16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></svg>
      無料相談する
    </a>

    <button class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="global-nav" aria-label="メニューを開く">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>
`;

function initWebAiHeaderSwap() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'webai') return;

  // ポートフォリオ側の通常ヘッダーを非表示にする（CSSはクラスで制御するため挿入順序に依存しない）
  document.documentElement.classList.add('webai-mode');

  const mount = document.createElement('div');
  mount.id = 'webai-header-mount';
  document.body.insertBefore(mount, document.body.firstChild);

  fetch(WEBAI_SITE_BASE + 'header.html')
    .then(res => {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.text();
    })
    .then(html => renderWebAiHeader(mount, html))
    .catch(err => {
      console.error('web&AIサポートサイトのヘッダー取得に失敗したため、複製版を表示します:', err);
      renderWebAiHeader(mount, WEBAI_HEADER_FALLBACK);
    });
}

function renderWebAiHeader(mount, html) {
  mount.innerHTML = html;

  // ロゴ・セクションリンク（#で始まるもの）はweb&AIサポートサイトの絶対URLへ書き換える
  mount.querySelectorAll('.logo, .global-nav a:not(.nav-app-link)').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      a.setAttribute('href', WEBAI_SITE_BASE + href);
    }
  });

  const toggle = mount.querySelector('#nav-toggle');
  const nav = mount.querySelector('#global-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {

  loadSiteNav();

  // ---- スライドショー生成関数 ----
  function createSlideshow(folder, count, wrapId, prevId, nextId, dotsId, counterId, altPrefix) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const dotsContainer = document.getElementById(dotsId);
    const counter = document.getElementById(counterId);

    let current = 0;
    let autoTimer = null;

    for (let i = 1; i <= count; i++) {
      const item = document.createElement('div');
      item.className = 'slide-item';
      const img = document.createElement('img');
      img.src = `${folder}/${i}.png`;
      img.alt = `${altPrefix} ${i}`;
      img.loading = 'lazy';
      item.appendChild(img);
      wrap.appendChild(item);

      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 1 ? ' active' : '');
      dot.addEventListener('click', () => goTo(i - 1));
      dotsContainer.appendChild(dot);
    }

    const dots = dotsContainer.querySelectorAll('.dot');

    function update() {
      wrap.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
      counter.textContent = `${current + 1} / ${count}`;
    }

    function goTo(index) {
      current = (index + count) % count;
      update();
    }

    prev.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
    next.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

    function startAuto() {
      autoTimer = setInterval(() => goTo(current + 1), 4000);
    }
    function resetAuto() {
      clearInterval(autoTimer);
      startAuto();
    }
    startAuto();

    let startX = 0;
    wrap.parentElement.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    wrap.parentElement.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        diff > 0 ? goTo(current + 1) : goTo(current - 1);
        resetAuto();
      }
    });

    update();
  }

  // ---- AI Works スライドショー ----
  createSlideshow('image', 5, 'aiSlidesWrap', 'aiPrev', 'aiNext', 'aiDots', 'aiCounter', 'AI作品');

  // ---- Competition Works スライドショー ----
  createSlideshow('work', 9, 'workSlidesWrap', 'workPrev', 'workNext', 'workDots', 'workCounter', 'コンペ作品');

  // ---- スクロールアニメーション ----
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.section-title, .about-grid, .web-card, .skill-group, .channel-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // visible クラス
  const style = document.createElement('style');
  style.textContent = '.visible { opacity: 1 !important; transform: translateY(0) !important; }';
  document.head.appendChild(style);

}); // DOMContentLoaded ここまで