import asyncio, http.server, threading, functools, json, sys
from playwright.async_api import async_playwright
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8810
OUT=sys.argv[2] if len(sys.argv)>2 else '/tmp/ux/result.json'
class Q(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),functools.partial(Q,directory='/home/claude/dasibom'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
B=f'http://127.0.0.1:{PORT}/'
AUDIT="""(min)=>{
 const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&r.bottom>0&&r.top<innerHeight*3};
 const zoom=parseFloat(getComputedStyle(document.body).zoom)||1;
 const scope=document.querySelector('dialog[open]')||document;
 const small=new Set();
 const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
 let n; while(n=walker.nextNode()){ const t=n.textContent.trim(); if(t.length<2) continue; const el=n.parentElement; if(!el||!vis(el)) continue;
   const fs=parseFloat(getComputedStyle(el).fontSize)*zoom; if(fs<min) small.add(t.slice(0,24)+' ('+fs.toFixed(1)+'px)'); }
 const targets=[...scope.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,label:has(input)')].filter(vis);
 const tiny=[],under44=[];
 targets.forEach(e=>{ if(e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) return; const r=e.getBoundingClientRect(); const w=r.width*zoom,h=r.height*zoom;
   const name=(e.innerText||e.value||e.getAttribute('aria-label')||e.name||e.tagName).trim().slice(0,18);
   if(h<24||w<24) tiny.push(name+' '+Math.round(w)+'x'+Math.round(h)); else if(h<44) under44.push(name+' '+Math.round(w)+'x'+Math.round(h)); });
 return {overflow: document.documentElement.scrollWidth>innerWidth+1, smallText:[...small], tinyTargets:tiny, under44:under44, targets:targets.length};
}"""
class Run:
  def __init__(s,page,name): s.p=page; s.name=name; s.steps=0; s.fields=0; s.audits=[]; s.notes=[]
  async def tap(s,sel,**k): s.steps+=1; await s.p.locator(sel).first.click(**k)
  async def fill(s,sel,v,only_if_empty=False):
    if only_if_empty and (await s.p.locator(sel).first.input_value()): return
    s.steps+=1; s.fields+=1; await s.p.locator(sel).first.fill(v)
  async def check(s,sel): s.steps+=1; await s.p.locator(sel).first.check()
  async def select(s,sel,v): s.steps+=1; s.fields+=1; await s.p.locator(sel).first.select_option(v)
  async def audit(s,label,min_px):
    await s.p.wait_for_timeout(250); a=await s.p.evaluate(AUDIT,min_px); a['screen']=label; s.audits.append(a)
async def main():
  res={}
  async with async_playwright() as pw:
    br=await pw.chromium.launch()
    def ctx(): return br.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,locale='ko-KR',timezone_id='Asia/Seoul')
    # ---------- A: 70대 텃밭 판매자, 큰 글씨 ----------
    c=await ctx(); p=await c.new_page(); errs=[]; p.on('pageerror',lambda e: errs.append(str(e))); p.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await p.goto(B+'seller.html'); await p.evaluate("localStorage.clear()"); await p.reload()
    A=Run(p,'A')
    await A.tap('#bigTextBtn')
    await A.audit('판매자 첫 화면(참여)',16)
    await A.fill('#newSellerName','순자네 텃밭'); await A.fill('#newSellerPhone','01012345678')
    await A.check('#joinForm [name=originNotice]'); await A.check('#joinForm [name=agreeTerms]')
    await A.tap('#joinForm button[type=submit]')
    ok=await p.is_visible('#dash'); A.notes.append('참여 성공' if ok else '참여 실패: '+(await p.text_content('#joinError')))
    await A.audit('판매자 대시보드',16)
    await A.tap('#sellerWho >> text=+ 농산물 올리기')
    await A.audit('농산물 올리기 창',16)
    await A.fill('#addName','상추'); await A.fill('#addPrice','2000'); await A.fill('#addUnit','한 봉지'); await A.fill('#addStock','5'); await A.fill('#addPlace','홍천 마을회관 앞')
    await A.tap('#addSubmit'); await p.wait_for_timeout(200)
    added=not await p.locator('#addDialog').evaluate('d=>d.open'); A.notes.append('상품 올리기 성공' if added else '실패: '+(await p.text_content('#addError')))
    A.required=await p.evaluate("document.querySelectorAll('#joinForm [required]').length")
    res['A']={'persona':'70대 텃밭 판매자 (큰 글씨)','task':'판매자로 참여하고 상추 1개 올리기','steps':A.steps,'fields':A.fields,'notes':A.notes,'audits':A.audits,'errors':errs}
    await c.close()
    # ---------- B: 20대 자취생 ----------
    c=await ctx(); p=await c.new_page(); errs=[]; p.on('pageerror',lambda e: errs.append(str(e)))
    await p.goto(B+'index.html'); await p.evaluate("localStorage.clear()"); await p.reload()
    Bv=Run(p,'B')
    await Bv.audit('소비자 첫 화면',12)
    await Bv.tap('text=농산물 둘러보기')
    await Bv.audit('농산물 목록',12)
    await Bv.tap("article.product:has-text('소량 양파') >> text=예약 신청")
    await Bv.audit('예약 신청 창',12)
    today=await p.evaluate("DasibomStore.today()")
    await Bv.fill('#reserveDate',today,True); await Bv.fill('#reserveCustomer','민지',True); await Bv.fill('#reservePhone','01022223333',True)
    await Bv.check('#reserveDialog [name=privacy]'); await Bv.tap('#reserveDialog button[type=submit]')
    rid=await p.evaluate("DasibomStore.myReservations()[0]?.id")
    Bv.notes.append('예약 성공' if rid else '예약 실패: '+(await p.text_content('#reserveError')))
    # 판매자 확정(다른 사람 몫) — 단계 수에 넣지 않음
    await p.evaluate(f"DasibomStore.updateReservation('{rid}',{{status:'accepted',sellerNote:'확정됐어요'}})")
    await p.wait_for_timeout(2300)
    await Bv.tap('header >> text=내 예약')
    await Bv.audit('내 예약 (확정)',12)
    await Bv.select('#mineList select','30')
    async with p.expect_download() as d: await Bv.tap('text=휴대폰 캘린더에 출발 알림 추가')
    Bv.notes.append('출발 알림 파일 받기 성공' if (await d.value) else '실패')
    await p.locator('#mineDialog .close').click()
    R=Run(p,'B2')
    await R.tap("article.product:has-text('소량 대파') >> text=예약 신청")
    await R.fill('#reserveDate',today,True); await R.fill('#reserveCustomer','민지',True); await R.fill('#reservePhone','01022223333',True)
    await R.check('#reserveDialog [name=privacy]'); await R.tap('#reserveDialog button[type=submit]')
    n=await p.evaluate("DasibomStore.myReservations().length")
    Bv.notes.append(f'다시 예약: {R.steps}단계·입력 {R.fields}칸 ' + ('성공' if n==2 else '실패'))
    res['B']={'persona':'20대 자취생','task':'양파 예약 → 확정 후 출발 알림 넣기','steps':Bv.steps,'fields':Bv.fields,'notes':Bv.notes,'audits':Bv.audits,'errors':errs}
    await c.close()
    # ---------- C: 50대 소비자, 큰 글씨 ----------
    c=await ctx(); p=await c.new_page(); errs=[]; p.on('pageerror',lambda e: errs.append(str(e))); p.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await p.goto(B+'index.html'); await p.evaluate("localStorage.clear()"); await p.reload()
    C=Run(p,'C')
    await C.tap('#bigTextBtn')
    await C.audit('소비자 첫 화면(큰 글씨)',16)
    await C.tap("article.product:has-text('못난이 감자') >> text=예약 신청")
    await C.audit('예약 신청 창(큰 글씨)',16)
    today=await p.evaluate("DasibomStore.today()")
    await C.fill('#reserveDate',today,True); await C.fill('#reserveCustomer','영희',True); await C.fill('#reservePhone','010-4444-5555',True)
    await C.check('#reserveDialog [name=privacy]'); await C.tap('#reserveDialog button[type=submit]')
    await C.tap('header >> text=내 예약')
    await C.audit('내 예약(큰 글씨)',16)
    await C.tap('#mineList >> text=예약 취소')
    st=await p.evaluate("DasibomStore.myReservations()[0]?.status")
    C.notes.append('취소 성공' if st=='cancelled' else '취소 실패: '+str(st))
    res['C']={'persona':'50대 소비자 (큰 글씨)','task':'감자 예약하고 취소하기','steps':C.steps,'fields':C.fields,'notes':C.notes,'audits':C.audits,'errors':errs}
    await br.close()
  json.dump(res,open(OUT,'w'),ensure_ascii=False,indent=1)
asyncio.run(main())
