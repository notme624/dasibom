/*
 * 다시봄 데이터 창고 (store)
 * ------------------------------------------------------------
 * 소비자 웹(index.html)과 판매자 웹(seller.html)이 같은 데이터를 함께 쓰는 곳이에요.
 * 지금은 브라우저 저장소(localStorage)에 저장하기 때문에
 * "같은 브라우저"에서 연 두 화면끼리만 연결돼요.
 *
 * 나중에 실제 서버(클라우드)로 옮길 때는 이 파일 안의 read / write 부분만
 * 서버 요청으로 바꾸면 돼요. 화면 쪽 코드는 DasibomStore.xxx() 만 부르기 때문에
 * 그대로 쓸 수 있어요. (기획서의 '백엔드 설계도' 참고)
 */
(function () {
  const PREFIX = 'dasibom-v3-';

  /* ---------- 운영 규칙 (한곳에서 바꾸기) ---------- */
  const POLICY = {
    noShowLimit: 2,            // 노쇼가 이 횟수에 닿으면 다시봄 전체에서 예약 제한
    requestExpireHours: 24,    // 판매자가 이 시간 안에 확인하지 않으면 자동 만료
    maxQuantityPerReservation: 20,
    retentionMonths: 6         // 개인정보 보관 기간 (처리방침과 맞추기)
  };

  const SLOTS = ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-20:00'];

  const DEMO_SELLERS = [
    { id: 's-demo1', name: '춘천 작은밭', region: '춘천', type: 'personal', phone: '010-1234-0001' },
    { id: 's-demo2', name: '홍천 작은밭', region: '홍천', type: 'personal', phone: '010-1234-0002' },
    { id: 's-demo3', name: '춘천 봄장터', region: '춘천', type: 'business', phone: '033-000-0003', bizName: '춘천 봄장터', bizNumber: '123-45-67890', mailOrderNumber: '' },
    { id: 's-demo4', name: '홍천 햇살농가', region: '홍천', type: 'personal', phone: '010-1234-0004' },
    { id: 's-demo5', name: '춘천 작은농장', region: '춘천', type: 'personal', phone: '010-1234-0005' }
  ].map(s => ({ bizName: '', bizNumber: '', mailOrderNumber: '', email: '', products: '', mode: '시범 판매자', blocked: [], originNoticeAt: '2026-11-01T00:00:00.000Z', isDemo: true, createdAt: '2026-11-01T00:00:00.000Z', ...s }));

  const DEMO_PRODUCTS = [
    { id: 'demo5', name: '소량 양파', region: '춘천', seller: '춘천 작은밭', category: '소량 잉여 농산물', price: 1500, unit: '2개', stock: 12, origin: '국내산(강원 춘천)', place: '춘천 장학리 마을회관 앞', placeDetail: '마을회관 앞 파란 지붕 창고, 도착하면 전화 주세요', description: '한 끼에 사용할 만큼 양파 두 알씩 담았어요.', emoji: '🧅' },
    { id: 'demo1', name: '못난이 감자', region: '홍천', seller: '홍천 작은밭', category: '못난이 농산물', price: 3000, unit: '1kg', stock: 8, origin: '국내산(강원 홍천)', place: '홍천 오일장 입구', placeDetail: '오일장 입구 농협 앞 하얀 트럭', description: '모양은 일정하지 않지만 맛있게 먹을 수 있는 감자예요.', emoji: '🥔' },
    { id: 'demo2', name: '소량 대파', region: '춘천', seller: '춘천 봄장터', category: '소량 잉여 농산물', price: 1500, unit: '2줄기', stock: 15, origin: '국내산(강원 춘천)', place: '춘천 풍물시장', placeDetail: '풍물시장 2번 출입구 옆 봄장터 매대', description: '한 단이 부담스러울 때 필요한 만큼 구매해요.', emoji: '🌿' },
    { id: 'demo3', name: '못난이 당근', region: '홍천', seller: '홍천 햇살농가', category: '못난이 농산물', price: 2000, unit: '3개', stock: 6, origin: '국내산(강원 홍천)', place: '홍천 화촌면 농가', placeDetail: '화촌면 햇살농가 창고 (확정 문자에 안내)', description: '크기와 모양이 조금씩 다른 당근이에요.', emoji: '🥕' },
    { id: 'demo4', name: '소량 고구마', region: '춘천', seller: '춘천 작은농장', category: '소량 잉여 농산물', price: 3500, unit: '1kg', stock: 3, origin: '국내산(강원 춘천)', place: '춘천 신북읍 농장', placeDetail: '신북읍 작은농장 입구 보관함', description: '소량으로 나눠 구매할 수 있는 고구마예요.', emoji: '🍠' }
  ].map(p => ({ phone: '', slots: SLOTS.slice(0, 3), endDate: '', status: 'on', isDemo: true, createdAt: '2026-11-01T00:00:00.000Z', ...p }));

  // 예약 상태
  const RESERVATION_STATUS = {
    requested: { label: '확인 대기', tone: 'wait' },
    accepted: { label: '예약 확정', tone: 'ok' },
    declined: { label: '예약 불가', tone: 'no' },
    done: { label: '수령 완료', tone: 'done' },
    cancelled: { label: '취소됨', tone: 'no' },
    expired: { label: '자동 만료', tone: 'off' },
    noshow: { label: '노쇼', tone: 'no' }
  };
  // 수량을 다시 돌려놓는 상태 (판매 안 된 것)
  const RELEASES_STOCK = ['declined', 'cancelled', 'expired', 'noshow'];

  const EMOJI = { 애호박: '🥒', 단호박: '🎃', 감자: '🥔', 당근: '🥕', 고구마: '🍠', 토마토: '🍅', 양파: '🧅', 사과: '🍎', 대파: '🌿', 쪽파: '🌿', 파: '🌿', 배추: '🥬', 상추: '🥬', 호박: '🎃', 옥수수: '🌽', 고추: '🌶️', 오이: '🥒', 버섯: '🍄', 마늘: '🧄', 배: '🍐', 딸기: '🍓', 포도: '🍇' };

  // 품목별 보관 요령 (일반적인 가정 보관 기준)
  const STORAGE_TIPS = [
    { keys: ['양파'], tips: ['망이나 바구니에 담아 서늘하고 바람이 잘 통하는 곳에 걸어 두세요.', '감자와 함께 두면 둘 다 빨리 상해요. 따로 보관하세요.', '껍질을 깐 양파는 랩으로 싸서 냉장하고 일주일 안에 드세요.'] },
    { keys: ['감자'], tips: ['햇빛이 들지 않는 서늘하고 어두운 곳에 두세요. 빛을 받으면 껍질이 초록색이 되고 싹이 나요.', '사과를 한 알 같이 넣어 두면 싹이 덜 나요.', '냉장고에 넣으면 단맛이 변하기 쉬워요. 실온의 서늘한 곳이 좋아요.'] },
    { keys: ['대파', '쪽파', '파'], tips: ['흙을 털고 신문지에 싸서 세워 두면 오래가요.', '오래 두려면 송송 썰어 물기를 빼고 냉동하세요. 바로 요리에 쓸 수 있어요.', '뿌리 부분을 물에 담가 두면 조금씩 다시 자라요.'] },
    { keys: ['당근'], tips: ['물기를 닦고 키친타월이나 신문지에 싸서 냉장고 채소칸에 세워 두세요.', '잎이 붙어 있으면 잘라 내야 수분이 덜 빠져요.', '흙이 묻은 채로 두는 편이 씻은 당근보다 오래가요.'] },
    { keys: ['고구마'], tips: ['냉장고에 넣지 마세요. 차가우면 금방 상해요.', '신문지에 하나씩 싸서 바람이 잘 통하는 실온(10~15℃ 정도)에 두세요.', '오래 두려면 쪄서 식힌 뒤 냉동하세요.'] },
    { keys: ['토마토'], tips: ['덜 익은 토마토는 실온에서 익힌 뒤 드세요.', '다 익으면 꼭지를 아래로 해서 냉장하고 빨리 드세요.'] },
    { keys: ['배추'], tips: ['통째로는 신문지에 싸서 서늘한 곳에 세워 두세요.', '자른 배추는 자른 면을 랩으로 싸서 냉장하세요.'] },
    { keys: ['상추'], tips: ['씻지 말고 젖은 키친타월로 감싸 밀폐 용기에 넣어 냉장하세요.', '먹기 직전에 씻으면 더 오래 싱싱해요.'] },
    { keys: ['호박'], tips: ['애호박은 랩으로 싸서 냉장하고 빨리 드세요.', '단호박·늙은호박은 통째로 바람이 잘 통하는 실온에 두세요.'] },
    { keys: ['옥수수'], tips: ['따자마자 단맛이 줄어요. 받은 날 바로 쪄 드세요.', '찐 옥수수는 식혀서 하나씩 싸서 냉동하세요.'] },
    { keys: ['고추'], tips: ['물기를 닦고 밀폐 용기나 비닐에 넣어 냉장하세요.', '오래 두려면 꼭지를 떼고 냉동하세요.'] },
    { keys: ['오이'], tips: ['하나씩 키친타월에 싸서 세워 냉장하세요.', '너무 차가운 곳은 피하고 일주일 안에 드세요.'] },
    { keys: ['버섯'], tips: ['씻지 말고 키친타월이나 종이봉투에 싸서 냉장하세요.', '물이 닿으면 빨리 물러져요. 요리 직전에 손질하세요.'] },
    { keys: ['마늘'], tips: ['통마늘은 망에 담아 서늘하고 바람이 잘 통하는 곳에 두세요.', '깐 마늘은 냉장, 오래 두려면 다져서 얇게 펴 냉동하세요.'] },
    { keys: ['사과'], tips: ['비닐에 싸서 냉장하면 오래가요.', '사과는 다른 과일·채소를 빨리 익게 해요. 따로 보관하세요.'] },
    { keys: ['배'], tips: ['하나씩 신문지에 싸서 냉장하세요.'] },
    { keys: ['딸기'], tips: ['씻지 말고 꼭지를 단 채 냉장하고, 먹기 직전에 씻으세요.', '빨리 무르니 1~2일 안에 드세요.'] },
    { keys: ['포도'], tips: ['씻지 말고 송이째 비닐에 넣어 냉장하세요.'] }
  ];
  const DEFAULT_TIPS = ['받은 날 상태를 확인하고, 상한 것은 골라내 따로 두세요.', '직사광선을 피해 서늘한 곳에 두고 되도록 빨리 드세요.'];

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      if (raw === null) return fallback;
      const v = JSON.parse(raw);
      if (Array.isArray(fallback) && !Array.isArray(v)) return fallback;
      return v;
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

  function today() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function normPhone(p) {
    return String(p || '').replace(/\D/g, '');
  }

  // 숫자만 입력해도 010-1234-5678 모양으로 맞춰요
  function fmtPhone(p) {
    const d = normPhone(p);
    if (d.startsWith('02')) return d.length === 9 ? `02-${d.slice(2, 5)}-${d.slice(5)}` : `02-${d.slice(2, 6)}-${d.slice(6)}`;
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return String(p || '').trim();
  }

  function ensureSeeded() {
    if (localStorage.getItem(PREFIX + 'products') === null) write('products', DEMO_PRODUCTS);
    if (localStorage.getItem(PREFIX + 'sellers') === null) write('sellers', DEMO_SELLERS);
    if (localStorage.getItem(PREFIX + 'reservations') === null) write('reservations', []);
    if (localStorage.getItem(PREFIX + 'customers') === null) write('customers', {});
  }

  /* 검사 도우미 */
  const Check = {
    phone(p) {
      return /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(String(p || '').trim());
    },
    bizNumber(n) {
      return /^\d{3}-?\d{2}-?\d{5}$/.test(String(n || '').trim());
    },
    date(d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
    }
  };

  const Store = {
    STATUS: RESERVATION_STATUS,
    POLICY,
    SLOTS,
    Check,
    today,
    normPhone,
    fmtPhone,

    /* ---------- 상품 ---------- */
    products() {
      return read('products', []);
    },
    product(id) {
      return Store.products().find(p => p.id === id) || null;
    },
    // 소비자에게 보이는 상품: 판매 중 + 판매 종료일 전
    visibleProducts() {
      const t = today();
      return Store.products().filter(p => p.status !== 'off' && (!p.endDate || p.endDate >= t));
    },
    isSoldOut(p) {
      return Number(p.stock) <= 0;
    },
    productsBySeller(seller) {
      return Store.products().filter(p => p.seller === seller);
    },
    // 상품 데이터 검사: 문제가 있으면 오류 문장 목록을 돌려줘요
    validateProduct(d) {
      const errors = [];
      if (!String(d.name || '').trim()) errors.push('농산물 이름');
      if (!['못난이 농산물', '소량 잉여 농산물', '일반 농산물'].includes(d.category)) errors.push('분류(못난이 농산물 / 소량 잉여 농산물 / 일반 농산물)');
      const price = Number(String(d.price).replace(/[,원\s]/g, ''));
      if (!Number.isFinite(price) || price < 0 || price > 10000000) errors.push('가격');
      if (!String(d.unit || '').trim()) errors.push('판매 단위');
      const stock = Number(String(d.stock).replace(/[,개\s]/g, ''));
      if (!Number.isInteger(stock) || stock < 1 || stock > 9999) errors.push('수량(1 이상 정수)');
      if (!String(d.origin || '').trim()) errors.push('원산지');
      if (!String(d.place || '').trim()) errors.push('수령 장소');
      if (d.endDate && !Check.date(d.endDate)) errors.push('판매 종료일(예: 2026-12-31)');
      return errors;
    },
    addProduct(data) {
      const p = {
        id: uid('p-'),
        name: String(data.name).trim(),
        region: data.region,
        seller: data.seller,
        category: data.category,
        price: Number(String(data.price).replace(/[,원\s]/g, '')),
        unit: String(data.unit).trim(),
        stock: Number(String(data.stock).replace(/[,개\s]/g, '')),
        origin: String(data.origin).trim(),
        place: String(data.place).trim(),
        placeDetail: String(data.placeDetail || '').trim(),
        slots: Array.isArray(data.slots) && data.slots.length ? data.slots : SLOTS.slice(0, 3),
        endDate: data.endDate || '',
        description: String(data.description || '').trim(),
        phone: data.phone || '',
        photo: data.photo || '',
        emoji: Store.emojiFor(data.name),
        status: 'on',
        mode: data.mode || '판매자 직접 등록',
        isDemo: false,
        createdAt: now()
      };
      return write('products', [p, ...Store.products()]) ? p : null;
    },
    // 여러 개 한 번에 올리기: 모두 검사를 통과해야 저장해요
    addProducts(list) {
      const products = Store.products();
      const created = list.map(d => ({
        id: uid('p-'),
        name: String(d.name).trim(),
        region: d.region,
        seller: d.seller,
        category: d.category,
        price: Number(String(d.price).replace(/[,원\s]/g, '')),
        unit: String(d.unit).trim(),
        stock: Number(String(d.stock).replace(/[,개\s]/g, '')),
        origin: String(d.origin).trim(),
        place: String(d.place).trim(),
        placeDetail: String(d.placeDetail || '').trim(),
        slots: SLOTS.slice(0, 3),
        endDate: d.endDate || '',
        description: String(d.description || '').trim(),
        phone: '',
        emoji: Store.emojiFor(d.name),
        status: 'on',
        mode: '판매자 일괄 등록',
        isDemo: false,
        createdAt: now()
      }));
      return write('products', [...created, ...products]) ? created : null;
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
    storageTips(name) {
      const hit = STORAGE_TIPS.find(t => t.keys.some(k => String(name).includes(k)));
      return hit ? hit.tips : DEFAULT_TIPS;
    },

    /* ---------- 판매자 ---------- */
    sellers() {
      return read('sellers', []);
    },
    seller(name) {
      return Store.sellers().find(s => s.name === name) || null;
    },
    validateSeller(d) {
      const errors = [];
      if (!String(d.name || '').trim()) errors.push('판매자 또는 농가 이름');
      if (!Check.phone(d.phone)) errors.push('연락처(예: 010-1234-5678)');
      if (d.type === 'business') {
        if (!String(d.bizName || '').trim()) errors.push('상호');
        if (!Check.bizNumber(d.bizNumber)) errors.push('사업자등록번호(예: 123-45-67890)');
      }
      if (!d.originNotice) errors.push('원산지 표시제도 안내 확인');
      if (!d.agreeTerms) errors.push('판매자 이용약관·개인정보 동의');
      return errors;
    },
    addSeller(data) {
      const name = String(data.name || '').trim();
      if (!name || Store.seller(name)) return null;
      const s = {
        id: uid('s-'),
        name,
        region: data.region,
        type: data.type === 'business' ? 'business' : 'personal',
        phone: fmtPhone(data.phone),
        email: String(data.email || '').trim(),
        bizName: data.type === 'business' ? String(data.bizName).trim() : '',
        bizNumber: data.type === 'business' ? String(data.bizNumber).trim() : '',
        mailOrderNumber: data.type === 'business' ? String(data.mailOrderNumber || '').trim() : '',
        mode: data.mode || '직접 등록',
        products: data.products || '',
        blocked: [],
        originNoticeAt: now(), // 원산지 표시제도 안내를 확인한 시각 (고지 증빙)
        termsAgreedAt: now(),
        isDemo: false,
        createdAt: now()
      };
      return write('sellers', [...Store.sellers(), s]) ? s : null;
    },
    updateSeller(name, patch) {
      return write('sellers', Store.sellers().map(s => (s.name === name ? { ...s, ...patch, updatedAt: now() } : s)));
    },
    currentSeller() {
      const name = read('current-seller', null);
      return name && Store.seller(name) ? name : null;
    },
    setCurrentSeller(name) {
      return write('current-seller', name);
    },

    /* ---------- 소비자 기록 · 노쇼 · 차단 ---------- */
    customers() {
      return read('customers', {});
    },
    customer(phone) {
      return Store.customers()[normPhone(phone)] || null;
    },
    // 예약할 수 있는지 확인: { ok, reason }
    canReserve(phone, sellerName) {
      const c = Store.customer(phone);
      if (c && c.blocked) return { ok: false, reason: `노쇼 기록으로 다시봄 예약이 제한된 번호예요. 해제를 원하시면 고객센터로 문의해 주세요.` };
      const s = Store.seller(sellerName);
      if (s && (s.blocked || []).includes(normPhone(phone))) return { ok: false, reason: '이 판매자의 상품은 예약할 수 없어요.' };
      return { ok: true };
    },
    blockCustomer(phone, reason) {
      const key = normPhone(phone);
      const all = Store.customers();
      all[key] = { ...(all[key] || { phone, name: '', noShows: 0 }), blocked: true, blockedReason: reason || '운영자 차단', blockedAt: now() };
      return write('customers', all);
    },
    unblockCustomer(phone) {
      const key = normPhone(phone);
      const all = Store.customers();
      if (!all[key]) return true;
      all[key] = { ...all[key], blocked: false, noShows: 0, blockedReason: '', unblockedAt: now() };
      return write('customers', all);
    },
    sellerBlock(sellerName, phone) {
      const s = Store.seller(sellerName);
      if (!s) return false;
      const key = normPhone(phone);
      return Store.updateSeller(sellerName, { blocked: [...new Set([...(s.blocked || []), key])] });
    },
    sellerUnblock(sellerName, phone) {
      const s = Store.seller(sellerName);
      if (!s) return false;
      return Store.updateSeller(sellerName, { blocked: (s.blocked || []).filter(x => x !== normPhone(phone)) });
    },

    /* ---------- 예약 ---------- */
    reservations() {
      return read('reservations', []);
    },
    reservation(id) {
      return Store.reservations().find(r => r.id === id) || null;
    },
    reservationsForSeller(seller) {
      return Store.reservations().filter(r => r.seller === seller);
    },
    myReservations() {
      const mine = read('my-reservations', []);
      return Store.reservations().filter(r => mine.includes(r.id));
    },
    // 성공하면 { reservation }, 실패하면 { error }
    addReservation(data) {
      const p = Store.product(data.productId);
      if (!p || p.status === 'off') return { error: '지금은 예약할 수 없는 상품이에요.' };
      const quantity = Number(data.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return { error: '예약 수량을 확인해 주세요.' };
      if (quantity > Number(p.stock)) return { error: `남은 수량이 ${p.stock}묶음이에요.` };
      if (!Check.phone(data.phone)) return { error: '연락처를 확인해 주세요. (예: 010-1234-5678)' };
      if (!data.privacy) return { error: '개인정보 수집·이용에 동의해야 예약할 수 있어요.' };
      if (!Check.date(data.date) || data.date < today()) return { error: '수령 날짜를 확인해 주세요.' };
      if (p.endDate && data.date > p.endDate) return { error: `이 상품은 ${p.endDate}까지 받을 수 있어요.` };
      if (!(p.slots || SLOTS).includes(data.slot)) return { error: '수령 시간대를 골라 주세요.' };
      const allowed = Store.canReserve(data.phone, p.seller);
      if (!allowed.ok) return { error: allowed.reason };

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
        customer: String(data.customer).trim(),
        phone: fmtPhone(data.phone),
        date: data.date,
        slot: data.slot,
        message: data.message || '',
        sellerNote: '',
        privacyAgreedAt: now(),
        status: 'requested',
        createdAt: now(),
        updatedAt: now()
      };
      const products = Store.products().map(x => (x.id === p.id ? { ...x, stock: Number(x.stock) - quantity } : x));
      const all = Store.customers();
      const key = normPhone(r.phone);
      all[key] = { noShows: 0, blocked: false, ...(all[key] || {}), phone: r.phone, name: r.customer, lastReservedAt: now() };
      const ok = write('products', products) && write('reservations', [r, ...Store.reservations()]) &&
        write('my-reservations', [r.id, ...read('my-reservations', [])]) && write('customers', all);
      return ok ? { reservation: r } : { error: '예약을 저장하지 못했어요. 다시 시도해 주세요.' };
    },
    // 상태를 바꾸고, 판매되지 않은 수량은 돌려놓고, 노쇼면 기록해요
    setReservationStatus(id, status, patch = {}) {
      const r = Store.reservation(id);
      if (!r) return false;
      const before = r.status;
      let ok = write('reservations', Store.reservations().map(x => (x.id === id ? { ...x, ...patch, status, updatedAt: now() } : x)));
      const held = !RELEASES_STOCK.includes(before);
      if (ok && held && RELEASES_STOCK.includes(status)) {
        ok = write('products', Store.products().map(p => (p.id === r.productId ? { ...p, stock: Number(p.stock) + Number(r.quantity) } : p)));
      }
      if (ok && status === 'noshow' && before !== 'noshow') {
        const all = Store.customers();
        const key = normPhone(r.phone);
        const c = { noShows: 0, blocked: false, ...(all[key] || {}), phone: r.phone, name: r.customer };
        c.noShows = Number(c.noShows || 0) + 1;
        c.lastNoShowAt = now();
        if (c.noShows >= POLICY.noShowLimit && !c.blocked) {
          c.blocked = true;
          c.blockedReason = `노쇼 ${c.noShows}회 (자동)`;
          c.blockedAt = now();
        }
        all[key] = c;
        ok = write('customers', all);
      }
      return ok;
    },
    updateReservation(id, patch) {
      return write('reservations', Store.reservations().map(r => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r)));
    },

    /*
     * 자동 정리: 판매자가 정해진 시간 안에 확인하지 않았거나
     * 수령 날짜가 지난 '확인 대기' 예약은 자동 만료하고 수량을 돌려놓아요.
     */
    sweep() {
      const limit = POLICY.requestExpireHours * 3600 * 1000;
      const t = today();
      Store.reservations().forEach(r => {
        if (r.status !== 'requested') return;
        const old = Date.now() - new Date(r.createdAt).getTime() > limit;
        if (old || r.date < t) Store.setReservationStatus(r.id, 'expired', { sellerNote: '판매자 확인이 없어 자동으로 만료됐어요.' });
      });
    },
    expiresAt(r) {
      return new Date(new Date(r.createdAt).getTime() + POLICY.requestExpireHours * 3600 * 1000);
    },

    /* ---------- 운영 ---------- */
    exportAll() {
      return { products: Store.products(), sellers: Store.sellers(), reservations: Store.reservations(), customers: Store.customers(), policy: POLICY, exportedAt: now() };
    },
    resetDemo() {
      ['products', 'sellers', 'reservations', 'my-reservations', 'current-seller', 'customers'].forEach(k => localStorage.removeItem(PREFIX + k));
      ensureSeeded();
    },

    /*
     * 성과 지표: 다시봄이 지금까지 만든 변화
     * (수령 완료된 예약 기준)
     */
    impact() {
      const done = Store.reservations().filter(r => r.status === 'done');
      const products = Store.products();
      const cat = id => (products.find(p => p.id === id) || {}).category || '';
      const activeSellers = new Set(products.filter(p => p.status !== 'off').map(p => p.seller));
      return {
        rescuedBundles: done.reduce((a, r) => a + Number(r.quantity), 0),
        uglyBundles: done.filter(r => cat(r.productId) === '못난이 농산물').reduce((a, r) => a + Number(r.quantity), 0),
        deals: done.length,
        amount: done.reduce((a, r) => a + Number(r.total), 0),
        farms: activeSellers.size,
        sellers: Store.sellers().length,
        onSale: Store.visibleProducts().filter(p => !Store.isSoldOut(p)).length,
        noShowRate: (() => {
          const closed = Store.reservations().filter(r => ['done', 'noshow'].includes(r.status)).length;
          const ns = Store.reservations().filter(r => r.status === 'noshow').length;
          return closed ? Math.round((ns / closed) * 100) : 0;
        })()
      };
    },

    /*
     * 시연용 데이터: 발표·캡처할 때 여러 상태의 예약이 한눈에 보이도록 채워요.
     * (기존 데이터는 지우고 다시 만들어요)
     */
    seedScenario() {
      Store.resetDemo();
      const t = today();
      const book = (productId, customer, phone, quantity, slot, message) => {
        const res = Store.addReservation({ productId, customer, phone, quantity, date: t, slot, message, privacy: true });
        return res.reservation ? res.reservation.id : null;
      };
      // 수령 완료된 거래들 (성과 지표용)
      const doneIds = [['demo1', '김하늘', '010-2001-0001', 2], ['demo3', '박서준', '010-2001-0002', 1], ['demo4', '윤조', '010-3003-0001', 1], ['demo2', '최유나', '010-2001-0004', 3], ['demo5', '이도윤', '010-2001-0003', 2], ['demo1', '한지우', '010-2001-0006', 1]]
        .map(([pid, name, phone, q]) => {
          const id = book(pid, name, phone, q, '09:00-12:00', '');
          if (id) {
            Store.updateReservation(id, { status: 'accepted', sellerNote: '예약 확정됐어요. 시간 맞춰 뵐게요!' });
            Store.setReservationStatus(id, 'done', { sellerNote: '맛있게 드세요! 다음에 또 들러 주세요.' });
          }
          return id;
        });
      // 확정된 예약 (픽업 안내·출발 알림 화면용)
      const a = book('demo5', '윤조', '010-3003-0001', 1, '15:00-18:00', '퇴근길에 들를게요!');
      if (a) Store.updateReservation(a, { status: 'accepted', sellerNote: '예약 확정됐어요. 오후 3시~6시 사이에 마을회관 앞으로 오세요!' });
      // 확인 대기 예약 (판매자 화면용)
      book('demo5', '서하은', '010-3003-0002', 2, '12:00-15:00', '점심시간에 받으러 갈게요.');
      book('demo5', '강태오', '010-3003-0003', 1, '09:00-12:00', '');
      // 노쇼 1회 기록이 있는 소비자
      const n = book('demo5', '임시우', '010-3003-0004', 1, '09:00-12:00', '');
      if (n) {
        Store.updateReservation(n, { status: 'accepted' });
        Store.setReservationStatus(n, 'noshow', { sellerNote: '연락 없이 수령하지 않아 노쇼로 기록됐어요.' });
      }
      const again = book('demo5', '임시우', '010-3003-0004', 1, '15:00-18:00', '지난번엔 죄송했어요. 이번엔 꼭 갈게요.');
      Store.setCurrentSeller('춘천 작은밭');
      // 소비자 화면의 '내 예약'은 윤조님 예약만 보이게 (확정 1건 + 수령 완료 1건)
      write('my-reservations', [a, doneIds[2]].filter(Boolean));
      return { again };
    },

    /* 화면 설정 (큰 글씨) */
    bigText() {
      return read('big-text', false) === true;
    },
    setBigText(on) {
      write('big-text', !!on);
      document.documentElement.classList.toggle('big-text', !!on);
    },

    /*
     * 다른 화면(탭)에서 데이터가 바뀌면 알려 줘요.
     */
    subscribe(callback) {
      let last = snapshot();
      function check() {
        Store.sweep();
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
      setInterval(check, 2000);
      return () => { last = snapshot(); };
    }
  };

  function snapshot() {
    return JSON.stringify({ products: read('products', []), sellers: read('sellers', []), reservations: read('reservations', []), customers: read('customers', {}) });
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
    until(date) {
      const diff = (date.getTime() - Date.now()) / 1000;
      if (diff <= 0) return '곧';
      if (diff < 3600) return Math.ceil(diff / 60) + '분';
      return Math.floor(diff / 3600) + '시간 ' + Math.floor((diff % 3600) / 60) + '분';
    },
    today,
    badge(status) {
      const s = RESERVATION_STATUS[status] || { label: status, tone: 'wait' };
      return `<span class="badge ${s.tone}">${UI.esc(s.label)}</span>`;
    },
    sellerBadge(s) {
      if (!s) return '';
      return s.type === 'business'
        ? '<span class="badge biz" title="사업자등록을 확인한 판매자">사업자 판매자</span>'
        : '<span class="badge personal" title="사업자등록 없이 참여한 개인 농가">개인 농가</span>';
    },
    slotLabel(slot) {
      const [a, b] = String(slot).split('-');
      const fmt = t => {
        const [h, m] = t.split(':').map(Number);
        const ap = h < 12 ? '오전' : '오후';
        const hh = h % 12 === 0 ? 12 : h % 12;
        return `${ap} ${hh}시${m ? ' ' + m + '분' : ''}`;
      };
      return a && b ? `${fmt(a)} ~ ${fmt(b)}` : slot;
    },
    mapLinks(place) {
      const q = encodeURIComponent(place);
      return {
        naver: `https://map.naver.com/p/search/${q}`,
        kakao: `https://map.kakao.com/link/search/${q}`
      };
    },
    /*
     * 휴대폰 캘린더에 넣을 일정 파일(.ics)을 만들어요.
     * 수령 시작 시각에 일정을 만들고, '출발 시각'에 알림이 울리게 해요.
     */
    calendarFile({ title, date, slot, travelMinutes, place, note }) {
      const start = String(slot).split('-')[0] || '10:00';
      const end = String(slot).split('-')[1] || start;
      const stamp = d => d.replace(/-/g, '');
      const time = t => t.replace(':', '') + '00';
      const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const before = Number(travelMinutes) + 10; // 이동 시간 + 여유 10분
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dasibom//pickup//KO', 'CALSCALE:GREGORIAN',
        'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:${uid('ev-')}@dasibom`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;TZID=Asia/Seoul:${stamp(date)}T${time(start)}`,
        `DTEND;TZID=Asia/Seoul:${stamp(date)}T${time(end)}`,
        `SUMMARY:${icsText(title)}`,
        `LOCATION:${icsText(place)}`,
        `DESCRIPTION:${icsText(note)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText('지금 출발하세요 · ' + title)}`, `TRIGGER:-PT${before}M`, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ];
      return lines.join('\r\n');
    },
    departTime(slot, travelMinutes) {
      const [h, m] = (String(slot).split('-')[0] || '10:00').split(':').map(Number);
      const total = h * 60 + m - Number(travelMinutes) - 10;
      const t = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    },
    /*
     * 휴대폰 사진은 커서 저장 공간을 많이 차지해요.
     * 긴 쪽을 maxSize 픽셀로 줄이고 JPEG로 압축해서 돌려줘요.
     */
    shrinkImage(file, maxSize = 720, quality = 0.72) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error('사진 파일만 올릴 수 있어요.'));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')); };
        img.src = url;
      });
    },
    // 상품 그림: 사진이 있으면 사진, 없으면 이모지
    thumb(p, size = 52) {
      const box = `width:${size}px;height:${size}px;border-radius:12px;flex:none;`;
      return p && p.photo
        ? `<img src="${UI.esc(p.photo)}" alt="" style="${box}object-fit:cover;display:block">`
        : `<div style="${box}background:#efe8d4;display:grid;place-items:center;font-size:${Math.round(size * 0.58)}px" aria-hidden="true">${(p && p.emoji) || '🥬'}</div>`;
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
      UI._toast = setTimeout(() => (t.style.display = 'none'), 4500);
    },
    downloadText(text, filename, type) {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    download(data, filename) {
      UI.downloadText(JSON.stringify(data, null, 2), filename, 'application/json');
    },
    /*
     * 앱으로 설치: 안드로이드·크롬은 설치 창을 띄우고,
     * 아이폰은 '공유 → 홈 화면에 추가' 방법을 알려 줘요.
     */
    initInstall(buttonId) {
      const b = document.getElementById(buttonId);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
      if (!b) return;
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (standalone) { b.hidden = true; return; }
      let deferred = null;
      window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
      window.addEventListener('appinstalled', () => { b.hidden = true; UI.notify('다시봄을 설치했어요. 홈 화면에서 열어 보세요.'); });
      b.onclick = async () => {
        if (deferred) {
          deferred.prompt();
          await deferred.userChoice.catch(() => null);
          deferred = null;
          return;
        }
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        UI.notify(ios
          ? '사파리 아래쪽 공유 버튼(□↑)을 누르고 ‘홈 화면에 추가’를 고르면 앱처럼 설치돼요.'
          : '브라우저 메뉴(⋮)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 고르면 앱처럼 설치돼요.');
      };
    },
    // 큰 글씨 버튼 공통
    initBigText(buttonId) {
      document.documentElement.classList.toggle('big-text', Store.bigText());
      const b = document.getElementById(buttonId);
      if (!b) return;
      const paint = () => {
        b.setAttribute('aria-pressed', String(Store.bigText()));
        b.textContent = Store.bigText() ? '글씨 보통' : '큰 글씨';
      };
      b.onclick = () => { Store.setBigText(!Store.bigText()); paint(); };
      paint();
    }
  };

  function icsText(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
  }

  ensureSeeded();
  Store.sweep();
  window.DasibomStore = Store;
  window.DasibomUI = UI;
})();
