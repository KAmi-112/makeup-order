// Independent enhancement for the existing workbench build; does not read order data.
const key = 'xiaohe-mascot-hidden';
const girlUrl = new URL('./mascot-girl-v2.png', import.meta.url).href;
const dogUrl = new URL('./mascot-dog-v2.png', import.meta.url).href;
let host = null, root = null, restore = null, gesture = null, timer = null;
function hiddenPreference() { try { return localStorage.getItem(key) === '1'; } catch { return false; } }
function setHidden(value) {
  if (!root || !restore) return;
  root.hidden = value; restore.hidden = !value;
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* optional preference */ }
}
function mount(shell) {
  host = document.createElement('div'); host.id = 'xiaohe-mascot-host';
  host.innerHTML = '<div class="mascot"><span class="mascot-message" role="status" hidden></span><button class="mascot-close" type="button" aria-label="隐藏吉祥物">×</button><div class="mascot-touch" role="button" tabindex="0" aria-label="小荷吉祥物，点击互动或拖动位置"><img class="mascot-girl" alt="" draggable="false"><img class="mascot-dog" alt="" draggable="false"></div></div><button class="mascot-restore" type="button" hidden>🌸 显示小荷</button>';
  shell.appendChild(host); root = host.querySelector('.mascot'); restore = host.querySelector('.mascot-restore');
  host.querySelector('.mascot-girl').src = girlUrl; host.querySelector('.mascot-dog').src = dogUrl;
  const touch = host.querySelector('.mascot-touch'), message = host.querySelector('.mascot-message');
  const say = () => { message.textContent = ['今天也一起加油吧！','小狗也来陪你啦～','记得休息一下哦！'][Math.floor(Math.random()*3)]; message.hidden = false; root.classList.add('mascot-bounce'); clearTimeout(timer); timer = setTimeout(() => { if (root) root.classList.remove('mascot-bounce'); message.hidden = true; }, 2000); };
  host.querySelector('.mascot-close').addEventListener('click', () => { setHidden(true); restore.focus(); });
  restore.addEventListener('click', () => { setHidden(false); touch.focus(); });
  touch.addEventListener('pointerdown', e => { if (e.button !== 0) return; const r = root.getBoundingClientRect(); gesture = { x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false }; touch.setPointerCapture(e.pointerId); });
  touch.addEventListener('pointermove', e => { if (!gesture) return; const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y; if (Math.hypot(dx,dy)>6) gesture.moved=true; if (!gesture.moved) return; root.style.left = Math.max(0,Math.min(gesture.left+dx,innerWidth-root.offsetWidth))+'px'; root.style.top = Math.max(0,Math.min(gesture.top+dy,innerHeight-root.offsetHeight))+'px'; root.style.right='auto'; root.style.bottom='auto'; });
  touch.addEventListener('pointerup', () => { if (gesture && !gesture.moved) say(); gesture=null; });
  touch.addEventListener('pointercancel', () => { gesture=null; });
  touch.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); say(); } });
  setHidden(hiddenPreference());
}
function syncMascot() {
  const shell = document.querySelector('.app-shell');
  if (shell && (!host || !host.isConnected)) mount(shell);
  if (!shell && host) { clearTimeout(timer); host.remove(); host=null; root=null; restore=null; }
}
const observer = new MutationObserver(syncMascot);
observer.observe(document.documentElement, { childList:true, subtree:true });
syncMascot();
document.addEventListener('focusin', e => { if (host) host.classList.toggle('mascot-editing', Boolean(e.target.matches?.('input,textarea,select,[contenteditable="true"]'))); });
document.addEventListener('focusout', e => { if (host) host.classList.toggle('mascot-editing', Boolean(e.relatedTarget?.matches?.('input,textarea,select,[contenteditable="true"]'))); });
window.addEventListener('resize', () => { if (!root || !root.style.left) return; root.style.left=Math.max(0,Math.min(parseFloat(root.style.left),innerWidth-root.offsetWidth))+'px'; root.style.top=Math.max(0,Math.min(parseFloat(root.style.top),innerHeight-root.offsetHeight))+'px'; });

