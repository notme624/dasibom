/*
 * 다시봄 데이터 창고 (store)
 * ------------------------------------------------------------
 * 소비자 웹(index.html)과 판매자 웹(seller.html)이 같은 데이터를 함께 쓰는 곳이에요.
 * 지금은 브라우저 저장소(localStorage)에 저장하기 때문에
 * "같은 브라우저"에서 연 두 화면끼리만 연결돼요.
 *
 * 나중에 실제 서버(예: Supabase, Firebase)나 앱으로 옮길 때는
 * 이 파일 안의 read / write 부분만 서버 요청으로 바꾸면 돼요.
 * 화면 쪽 코드는 DasibomStore.xxx() 만 부르기 때문에 그대로 쓸 수 있어요.
 */
(function () {
  const PREFIX = 'dasibom-v2-';

  const DEMO_PRODUCTS = [
    { id: 'demo5', name: '소량 양파', region: '춘천', seller: '춘천 작은밭', category: '소량 잉여 농산물', price: 1500, unit: '2개', place: '춘천 장학리 · 상세 위치 협의', description: '한 끼에 사용할 만큼 양파 두 알씩 담았어요.', emoji: '🧅' },
    { id: 'demo1', name: '못난이 감자', region: '홍천', seller: '홍천 작은밭', category: '못난이 농산물', price: 3000, unit: '1kg', place: '홍천 농가 · 상세 위치 협의', description: '모양은 일정하지 않지만 맛있게 먹을 수 있는 감자예요.', emoji: '🥔' },
    { id: 'demo2', name: '소량 대파', region: '춘천', seller: '춘천 봄장터', category: '소량 잉여 농산물', price: 1500, unit: '2줄기', place: '춘천 지역 · 수령 장소 협의', description: '한 단이 부담스러울 때 필요한 만큼 구매해요.', emoji: '🌿' },
    { id: 'demo3', name: '못난이 당근', region: '홍천', seller: '홍천 햇살농가', category: '못난이 농산물', price: 2000, unit: '3개', place: '홍천 농가 · 상세 위치 협의', description: '크기와 모양이 조금씩 다른 당근이에요.', emoji: '🥕' },
    { id: 'demo4', name: '소량 고구마', region: '춘천', seller: '춘천 작은농장', category: '소량 잉여 농산물', price: 3500, unit: '1kg', place: '춘천 지역 · 수령 장소 협의', description: '소량으로 나눠 구매할 수 있는 고구마예요.', emoji: '🍠' }
  ].map(p => ({ ...p, phone: '', status: 'on', isDemo: true, createdAt: '2026-11-01T00:00:00.000Z' }));

  const DEMO_SELLERS = [
    { id: 's-demo1', name: '춘천 작은밭', region: '춘천' },
    { id: 's-demo2', name: '홍천 작은밭', region: '홍천' },
    { id: 's-demo3', name: '춘천 봄장터', region: '춘천' },
    { id: 's-demo4', name: '홍천 햇살농가', region: '홍천' },
    { id: 's-demo5', name: '춘천 작은농장', region: '춘천' }
  ].map(s => ({ ...s, mode: '시범 판매자', products: '', isDemo: true, createdAt: '2026-11-01T00:00:00.000Z' }));

  // 예약 상태: 요청됨 → 수락됨 / 거절됨 → 수령 완료
  const RESERVATION_STATUS = {
    requested: { label: '확인 대기', tone: 'wait' },
    accepted: { label: '예약 확정', tone: 'ok' },
    declined: { label: '예약 불가', tone: 'no' },
    done: { label: '수령 완료', tone: 'done' },
    cancelled: { label: '취소됨', tone: 'no' }
  };

  const EMOJI = { 감자: '🥔', 당근: '🥕', 고구마: '🍠', 토마토: '🍅', 양파: '🧅', 사과: '🍎', 대파: '🌿', 파: '🌿', 배추: '🥬', 상추: '🥬', 호박: '🎃', 옥수수: '🌽', 고추: '🌶️', 오이: '🥒', 버섯: '🍄', 마늘: '🧄', 배: '🍐', 딸기: '🍓', 포도: '🍇' };

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      if (raw === null) return fallback;
      const v = JSON.parse(raw);
      return Array.isArray(fallback) && !Array.isArray(v) ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function write(name, value) {
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function now() {
    return new Date().toISOString();
  }

  // 처음 열었을 때 예시 데이터 채우기
  function ensureSeeded() {
    if (localStorage.getItem(PREFIX + 'products') === null) write('products', DEMO_PRODUCTS);
    if (localStorage.getItem(PREFIX + 'sellers') === null) write('sellers', DEMO_SELLERS);
    if (localStorage.getItem(PREFIX + 'reservations') === null) write('reservations', []);
  }

  const Store = {
    STATUS: RESERVATION_STATUS,

    /* ---------- 상품 ---------- */
    products() {
      return read('products', []);
    },
    product(id) {
      return Store.products().find(p => p.id === id) || null;
    },
    onSaleProducts() {
      return Store.products().filter(p => p.status !== 'off');
    },
    productsBySeller(seller) {
      return Store.products().filter(p => p.seller === seller);
    },
    addProduct(data) {
      const p = {
        id: uid('p-'),
        name: data.name,
        region: data.region,
        seller: data.seller,
        category: data.category,
        price: Number(data.price),
        unit: data.unit,
        place: data.place,
        description: data.description || '',
        phone: data.phone || '',
        emoji: Store.emojiFor(data.name),
        status: 'on',
        mode: data.mode || '판매자 직접 등록',
        isDemo: false,
        createdAt: now()
      };
      return write('products', [p, ...Store.products()]) ? p : null;
    },
    updateProduct(id, patch) {
      const list = Store.products().map(p => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p));
      return write('products', list);
    },
    removeProduct(id) {
      return write('products', Store.products().filter(p => p.id !== id));
    },
    emojiFor(name) {
      const key = Object.keys(EMOJI).find(w => String(name).includes(w));
      return key ? EMOJI[key] : '🥬';
    },

    /* ---------- 판매자 ---------- */
    sellers() {
      return read('sellers', []);
    },
    addSeller(data) {
      const name = String(data.name || '').trim();
      if (!name) return null;
      const existing = Store.sellers().find(s => s.name === name);
      if (existing) return existing;
      const s = { id: uid('s-'), name, region: data.region, mode: data.mode || '직접 등록', products: data.products || '', isDemo: false, createdAt: now() };
      return write('sellers', [...Store.sellers(), s]) ? s : null;
    },
    currentSeller() {
      const name = read('current-seller', null);
      return name && Store.sellers().some(s => s.name === name) ? name : null;
    },
    setCurrentSeller(name) {
      return write('current-seller', name);
    },

    /* ---------- 예약 ---------- */
    reservations() {
      return read('reservations', []);
    },
    reservationsForSeller(seller) {
      return Store.reservations().filter(r => r.seller === seller);
    },
    // 소비자 쪽: 이 브라우저에서 신청한 예약만
    myReservations() {
      const mine = read('my-reservations', []);
      return Store.reservations().filter(r => mine.includes(r.id));
    },
    addReservation(data) {
      const p = Store.product(data.productId);
      if (!p) return null;
      const quantity = Number(data.quantity) || 1;
      const r = {
        id: uid('r-'),
        productId: p.id,
        product: p.name,
        emoji: p.emoji,
        seller: p.seller,
        unit: p.unit,
        price: p.price,
        quantity,
        total: p.price * quantity,
        place: p.place,
        customer: data.customer,
        date: data.date,
        message: data.message || '',
        sellerNote: '',
        status: 'requested',
        createdAt: now(),
        updatedAt: now()
      };
      const ok = write('reservations', [r, ...Store.reservations()]) && write('my-reservations', [r.id, ...read('my-reservations', [])]);
      return ok ? r : null;
    },
    updateReservation(id, patch) {
      const list = Store.reservations().map(r => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r));
      return write('reservations', list);
    },

    /* ---------- 운영 ---------- */
    exportAll() {
      return { products: Store.products(), sellers: Store.sellers(), reservations: Store.reservations(), exportedAt: now() };
    },
    resetDemo() {
      ['products', 'sellers', 'reservations', 'my-reservations', 'current-seller'].forEach(k => localStorage.removeItem(PREFIX + k));
      ensureSeeded();
    },

    /*
     * 다른 화면(탭)에서 데이터가 바뀌면 알려 줘요.
     * 소비자 탭에서 예약하면 판매자 탭이, 판매자 탭에서 수락하면 소비자 탭이 바로 바뀌어요.
     */
    subscribe(callback) {
      let last = snapshot();
      function check() {
        const next = snapshot();
        if (next !== last) {
          const prev = last;
          last = next;
          callback(prev ? JSON.parse(prev) : null);
        }
      }
      window.addEventListener('storage', e => {
        if (!e.key || e.key.startsWith(PREFIX)) check();
      });
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
      setInterval(check, 2000); // storage 이벤트가 안 오는 환경(파일로 직접 열기 등) 대비
      return () => { last = snapshot(); };
    }
  };

  function snapshot() {
    return JSON.stringify({ products: read('products', []), sellers: read('sellers', []), reservations: read('reservations', []) });
  }

  /* ---------- 화면 공통 도우미 ---------- */
  const UI = {
    money(v) {
      return Number(v).toLocaleString('ko-KR') + '원';
    },
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    date(iso) {
      if (!iso) return '';
      const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    },
    ago(iso) {
      const diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 60) return '방금 전';
      if (diff < 3600) return Math.floor(diff / 60) + '분 전';
      if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
      return Math.floor(diff / 86400) + '일 전';
    },
    today() {
      return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    },
    badge(status) {
      const s = RESERVATION_STATUS[status] || { label: status, tone: 'wait' };
      return `<span class="badge ${s.tone}">${UI.esc(s.label)}</span>`;
    },
    show(id) {
      document.getElementById(id).showModal();
    },
    close(id) {
      document.getElementById(id).close();
    },
    notify(message) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = message;
      t.style.display = 'block';
      clearTimeout(UI._toast);
      UI._toast = setTimeout(() => (t.style.display = 'none'), 4000);
    },
    download(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  ensureSeeded();
  window.DasibomStore = Store;
  window.DasibomUI = UI;
})();
