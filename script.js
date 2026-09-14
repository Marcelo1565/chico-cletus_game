// ═══════════════════════════════════════════
//  ESTADO GLOBAL — tudo declarado antes de qualquer uso
// ═══════════════════════════════════════════
const CELL = 76, COLS = 5, ROWS = 5;
const rei  = { hp:100, maxHp:100, cd:0 };
let units     = new Array(25).fill(null);
let buildings = new Array(25).fill(null);
let enemies=[], projs=[], floats=[], stickyPatches=[];
let hand=[], sel=null;
let wave=1, goma=9, gomaMax=20, state='prep';
let fabCount=0;
let spawnQueue=[], spawnClock=0, totalWave=0;
let upgrades = { dmg:0, spd:0, gomaWave:0, regen:0, synx2:false };
let handDirty=true;
let autoWaveTimer=null, awStartTime=0;
const AW_DELAY = 4000;
let totalKills=0, score=0, gameStarted=false;
let gameSpeed=1, paused=false;
let comboCount=0, comboTimer=null;
let lastTime=0, regenAcc=0, targetUpdateTimer=0;
let targetedCells = new Set();

// ═══════════════════════════════════════════
//  DOM REFS
// ═══════════════════════════════════════════
const arena    = document.getElementById('arena');
const gridEl   = document.getElementById('grid');
const reiEl    = document.getElementById('rei-el');
const reiHPBar = document.getElementById('rei-hpbar');

function arenaRect() { return arena.getBoundingClientRect(); }
function cellCenter(col,row) {
  const gr=gridEl.getBoundingClientRect(), ar=arenaRect();
  return { x: gr.left-ar.left+col*CELL+CELL/2, y: gr.top-ar.top+row*CELL+CELL/2 };
}
function reiCenter() {
  const r=reiEl.getBoundingClientRect(), ar=arenaRect();
  return { x: r.left-ar.left+r.width/2, y: r.top-ar.top+r.height/2 };
}

// ═══════════════════════════════════════════
//  ÁUDIO
// ═══════════════════════════════════════════
let audioCtx=null, muted=false;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq,type,dur,vol=0.18) {
  if (muted) return;
  try {
    const ctx=getCtx(), o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    o.start(); o.stop(ctx.currentTime+dur);
  } catch(e) {}
}
function sfxPlace()   { playTone(440,'sine',0.08,0.15); }
function sfxUpgrade() { playTone(660,'sine',0.12,0.18); setTimeout(()=>playTone(880,'sine',0.1,0.18),80); }
function sfxHit()     { playTone(180,'sawtooth',0.06,0.1); }
function sfxKill()    { playTone(520,'square',0.07,0.09); }
function sfxWave()    { playTone(220,'sine',0.15,0.2); setTimeout(()=>playTone(330,'sine',0.12,0.2),120); }
function sfxBoss()    { playTone(110,'sawtooth',0.3,0.25); setTimeout(()=>playTone(80,'sawtooth',0.2,0.3),200); }
function sfxWin()     { [440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.18,0.22),i*90)); }
function sfxCard()    { playTone(300,'sine',0.05,0.08); }
function sfxError()   { playTone(160,'sawtooth',0.08,0.12); }
function sfxCombo()   { playTone(880,'sine',0.06,0.1); setTimeout(()=>playTone(1100,'sine',0.08,0.12),60); }
function sfxHealer()  { playTone(600,'sine',0.07,0.12); }
function sfxEvent()   { [440,550,660].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.12,0.2),i*100)); }
function toggleMute() { muted=!muted; document.getElementById('btn-mute').textContent=muted?'🔇 Mudo':'🔊 Som'; }

// ═══════════════════════════════════════════
//  LEGENDA
// ═══════════════════════════════════════════
function toggleLegend() {
  const p = document.getElementById('legend-panel');
  p.style.display = p.style.display==='block' ? 'none' : 'block';
}

// ═══════════════════════════════════════════
//  PASSIVAS DAS TROPAS
// ═══════════════════════════════════════════
const PASSIVES = {
  atirador: { tag:'★ Crítico 20%',  desc:'20% chance de dano duplo' },
  tanque:   { tag:'🛡 Taunt',        desc:'Inimigos priorizam o Blocão' },
  sticky:   { tag:'🟤 Rastro auto',  desc:'Cria gosma a cada ataque' },
  healer:   { tag:'💚 Cura aura',    desc:'Cura aliados a cada ciclo' },
  lenda:    { tag:'👑 Lendário',     desc:'Ignora sinergias (já é top)' },
};
function hasTaunt() { return units.some(u=>u&&u.id==='tanque'); }

// ═══════════════════════════════════════════
//  PARTÍCULAS DE MORTE
// ═══════════════════════════════════════════
function spawnParticles(x, y, color, count=6) {
  for (let i=0; i<count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const angle = (i/count)*Math.PI*2 + Math.random()*.5;
    const dist  = 24 + Math.random()*24;
    const dx    = Math.cos(angle)*dist;
    const dy    = Math.sin(angle)*dist;
    const size  = 4+Math.random()*5;
    const dur   = (0.35+Math.random()*.25).toFixed(2)+'s';
    el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;`
      +`background:${color};--dx:${dx}px;--dy:${dy}px;--dur:${dur};`;
    arena.appendChild(el);
    setTimeout(()=>el.remove(), 650);
  }
}

// ═══════════════════════════════════════════
//  HIGH SCORE
// ═══════════════════════════════════════════
const HS_KEY = 'chicletao_hs';
function getHS() { return parseInt(localStorage.getItem(HS_KEY)||'0',10); }
function setHS(v) { localStorage.setItem(HS_KEY,v); }
document.getElementById('hs-val').textContent = getHS();
(function() {
  const hs = getHS();
  const el = document.getElementById('title-hs');
  if (el) el.textContent = hs > 0 ? '🏆 Recorde: Wave '+hs : '';
})();

// ═══════════════════════════════════════════
//  TELA DE TÍTULO — usa addEventListener, nunca onclick inline
// ═══════════════════════════════════════════
document.getElementById('btn-start').addEventListener('click', function() {
  document.getElementById('ov-title').style.display = 'none';
  if (!gameStarted) {
    gameStarted = true;
    for (let i=0; i<6; i++) hand.push(pickCard());
    handDirty = true;
  }
});

// ═══════════════════════════════════════════
//  VELOCIDADE
// ═══════════════════════════════════════════
function setSpeed(s) {
  gameSpeed = s;
  [1,2,3].forEach(v => {
    const b = document.getElementById('spd-'+v);
    if (b) b.classList.toggle('spd-active', v===s);
  });
}

// ═══════════════════════════════════════════
//  PAUSA
// ═══════════════════════════════════════════
function togglePause() {
  if (state==='dead'||state==='prep'||state==='upgrade') return;
  paused = !paused;
  const btn=document.getElementById('btn-pause'), ov=document.getElementById('ov-pause');
  if (paused) { if(btn) btn.textContent='▶ Resume'; if(ov) ov.style.display='flex'; }
  else        { if(btn) btn.textContent='⏸ Pausa';  if(ov) ov.style.display='none'; }
}
document.addEventListener('keydown', e => {
  if (e.key==='p'||e.key==='P'||e.key===' ') { e.preventDefault(); togglePause(); }
});

// ═══════════════════════════════════════════
//  COMBO
// ═══════════════════════════════════════════
function registerKill() {
  totalKills++;
  score += wave * 10 * (comboCount >= 3 ? 2 : 1);
  const sel = document.getElementById('hv-score'); if(sel) sel.innerText = score;
  comboCount++;
  clearTimeout(comboTimer);
  if (comboCount >= 3) {
    const rc = reiCenter();
    const el = document.createElement('div');
    el.className = 'combo-float';
    el.style.left = rc.x+'px'; el.style.top = (rc.y-50)+'px';
    el.style.color = comboCount>=6?'#ff4400':comboCount>=4?'#ff8800':'#ffaa00';
    el.textContent = 'COMBO x'+comboCount+'! 🔥';
    arena.appendChild(el);
    setTimeout(()=>el.remove(), 750);
    sfxCombo();
  }
  comboTimer = setTimeout(()=>{ comboCount=0; }, 2000);
}

// ═══════════════════════════════════════════
//  DECK
// ═══════════════════════════════════════════
const DECK = [
  {id:'mascador', name:'Mascador',      icon:'./chicleteMascador.png', emoji:null,  desc:'Soldado fiel do Rei',           cost:2, type:'unit',     hp:75,  dmg:14, spd:46, color:'#ff88bb', rarity:'common',  weight:9},
  {id:'acido',    name:'Chicle Ácido',  icon:'./chicleteAcido.png',   emoji:'🍋',  desc:'Rápido, pouca resistência',     cost:2, type:'unit',     hp:40,  dmg:11, spd:22, color:'#aadd22', rarity:'common',  weight:9},
  {id:'tanque',   name:'Blocão',        icon:'./chicleteTanque.png',  emoji:null,  desc:'Parede viva de chiclete',       cost:4, type:'unit',     hp:500, dmg:12, spd:60, color:'#ff44aa', rarity:'rare',    weight:7},
  {id:'atirador', name:'Franqueiro',    icon:null,                            emoji:'🎯',  desc:'Alto dano, vida baixa',         cost:3, type:'unit',     hp:52,  dmg:32, spd:75, color:'#cc8844', rarity:'rare',    weight:6},
  {id:'duplo',    name:'Par de Goma',   icon:null,                            emoji:'🍡',  desc:'Equilibrado e barato',          cost:2, type:'unit',     hp:60,  dmg:13, spd:44, color:'#ff66cc', rarity:'common',  weight:9},
  {id:'lenda',    name:'Rei da Bala',   icon:null,                            emoji:'🍮',  desc:'Lendário. Ponto final.',        cost:4, type:'unit',     hp:250, dmg:42, spd:60, color:'#ffd700', rarity:'legend',  weight:2},
  {id:'sticky',   name:'Goma Grudenta', icon:null,                            emoji:'🟤',  desc:'Gosma que lentifica inimigos',  cost:5, type:'unit',     hp:78,  dmg:16, spd:80, color:'#aa6633', rarity:'rare',    weight:5},
  {id:'healer',   name:'Chicle Cura',   icon:null,                            emoji:'💚',  desc:'Cura tropas aliadas próximas',  cost:3, type:'unit',     hp:55,  dmg:5,  spd:90, color:'#44dd88', rarity:'rare',    weight:4},
  {id:'fab',      name:'Fábrica',       icon:null,                            emoji:'🏭',  desc:'Gera +goma por wave',           cost:3, type:'building',                          rarity:'rare',    weight:5},
  {id:'fusao',    name:'Derretimento',  icon:null,                            emoji:'🔥',  desc:'Sacrifica 1 tropa → +3 cartas', cost:2, type:'sacrifice',                         rarity:'common',  weight:3},
  {id:'cura',     name:'Xarope King',   icon:null,                            emoji:'🧪',  desc:'Cura o Rei em +30 HP',          cost:2, type:'heal',                              rarity:'rare',    weight:3},
  {id:'gomada',   name:'Puxada de Goma',icon:null,                            emoji:'💧',  desc:'+6 goma agora',                 cost:1, type:'goma',                              rarity:'rare',    weight:1},
];

function pickCard() {
  const pool = DECK.filter(c => c.rarity!=='legend' || Math.random()<0.07);
  const total = pool.reduce((s,c)=>s+c.weight, 0);
  let r = Math.random()*total;
  for (const c of pool) { r-=c.weight; if(r<=0) return c; }
  return pool[pool.length-1];
}
function drawCard() {
  if (hand.length<10) { hand.push(pickCard()); handDirty=true; sfxCard(); checkAutoWave(); }
}

// ═══════════════════════════════════════════
//  GRID
// ═══════════════════════════════════════════
function buildGrid() {
  gridEl.innerHTML = '';
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const idx = r*COLS+c;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.idx = idx;
      cell.addEventListener('click', ()=>onCellClick(idx));
      cell.addEventListener('mouseenter', ()=>showCellPreview(idx));
      cell.addEventListener('mouseleave', hideCellPreview);
      cell.addEventListener('touchstart', e=>{ e.preventDefault(); showCellPreview(idx); }, {passive:false});
      cell.addEventListener('touchend',   e=>{ e.preventDefault(); onCellClick(idx); hideCellPreview(); }, {passive:false});
      gridEl.appendChild(cell);
    }
  }
}
buildGrid();
function getCellEl(idx) { return gridEl.children[idx]; }

// PREVIEW DE DANO
let previewEl = null;
function showCellPreview(idx) {
  hideCellPreview();
  if (sel===null || state!=='prep') return;
  const card = hand[sel];
  if (card.type !== 'unit') return;
  let lvl=1, dmg=card.dmg, hp=card.hp;
  const eu = units[idx];
  if (eu && eu.id===card.id) {
    lvl = Math.min(3,(eu.lvl||1)+1);
    const m = {1:{hp:1,dmg:1},2:{hp:1.6,dmg:1.5},3:{hp:2.5,dmg:2.2}}[lvl];
    dmg=Math.round(card.dmg*m.dmg); hp=Math.round(card.hp*m.hp);
  }
  const syn=synergy(), cell=getCellEl(idx), el=document.createElement('div');
  el.id = 'cell-preview';
  el.style.cssText = 'position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:rgba(10,0,5,.95);border:1px solid #ff4466;border-radius:6px;padding:5px 8px;font-size:9px;color:#ffaacc;white-space:nowrap;z-index:20;pointer-events:none;text-align:center;';
  el.innerHTML = '<b>'+card.name+(lvl>1?' Nv.'+lvl:'')+'</b><br>❤️'+hp+' ⚔️'+(dmg+syn)+'<span style="color:#555"> (+'+syn+' sin)</span>';
  cell.style.position = 'relative';
  cell.appendChild(el);
  previewEl = el;
}
function hideCellPreview() { if (previewEl) { previewEl.remove(); previewEl=null; } }

// INDICADOR DE ALVO
function updateTargetIndicators() {
  targetedCells.forEach(i => { const c=getCellEl(i); if(c) c.classList.remove('targeted'); });
  targetedCells.clear();
  enemies.forEach(e => {
    let minD=Infinity, tIdx=-1;
    units.forEach((u,i) => {
      if (!u) return;
      const cc=cellCenter(u.col,u.row), d=dist(e.x,e.y,cc.x,cc.y);
      if (d<minD && d<260) { minD=d; tIdx=u.row*COLS+u.col; }
    });
    if (tIdx>=0) { targetedCells.add(tIdx); const c=getCellEl(tIdx); if(c) c.classList.add('targeted'); }
  });
}

function refreshGrid() {
  const card = sel!==null ? hand[sel] : null;
  for (let i=0; i<25; i++) {
    const cell = getCellEl(i);
    const wasTargeted = cell.classList.contains('targeted');
    cell.className = 'cell';
    if (wasTargeted) cell.classList.add('targeted');
    if (!card || state!=='prep') continue;
    if (!units[i]&&!buildings[i]&&(card.type==='unit'||card.type==='building')) cell.classList.add('highlight');
    if (units[i]&&card.type==='unit'&&units[i].id===card.id&&(units[i].lvl||1)<3) cell.classList.add('upgradable');
    if (buildings[i]&&card.type==='building'&&buildings[i].id===card.id&&(buildings[i].lvl||1)<3) cell.classList.add('upgradable');
  }
}

// ═══════════════════════════════════════════
//  RENDER UNIDADE
// ═══════════════════════════════════════════
function makeUnitIcon(card) {
  if (card.icon) {
    const img = document.createElement('img');
    img.src = card.icon;
    img.onerror = () => { const sp=document.createElement('span'); sp.className='unit-emoji'; sp.textContent=card.emoji||'❓'; img.replaceWith(sp); };
    return img;
  }
  const sp = document.createElement('span');
  sp.className = 'unit-emoji'; sp.textContent = card.emoji||'❓';
  return sp;
}
function renderUnitEl(idx) {
  const cell = getCellEl(idx);
  cell.querySelectorAll('.unit-el,.fab-el').forEach(e=>e.remove());
  const u=units[idx], b=buildings[idx];
  if (u) {
    const lvl=u.lvl||1, el=document.createElement('div');
    el.className = 'unit-el'+(lvl===3?' lvl3':lvl===2?' lvl2':'');
    el.style.color = u.color;
    const hp=Math.max(0,u.hp/u.maxHp), hpColor=hp>.5?'#44cc88':hp>.25?'#ffcc00':'#ff2244';
    if (lvl>=2) {
      const s=document.createElement('span'); s.className='stars';
      s.style.color=lvl===3?'#ff44ff':'#ffd700'; s.textContent=lvl===3?'★★★':'★★';
      el.appendChild(s);
    }
    const bc = DECK.find(c=>c.id===u.id);
    el.appendChild(makeUnitIcon(bc||{icon:null,emoji:'❓'}));
    const hw=document.createElement('div'); hw.className='hp-wrap';
    hw.innerHTML = '<div class="hp-bar-bg"><div class="hp-bar" style="width:'+hp*100+'%;background:'+hpColor+'"></div></div>';
    el.appendChild(hw);
    // DPS indicator
    const dpsEl=document.createElement('div'); dpsEl.className='unit-dps';
    const syn=synergy(), cd=Math.max(180,u.spd*16-upgrades.spd*12);
    dpsEl.textContent = '⚔️'+Math.round((u.dmg+upgrades.dmg+syn)/(cd/1000))+'/s';
    el.appendChild(dpsEl);
    u.el=el; cell.appendChild(el);
  }
  if (b) {
    const lvl=b.lvl||1, el=document.createElement('div'); el.className='fab-el';
    el.style.borderColor = lvl===3?'#ff8800':lvl===2?'#ffd700':'#bb8800';
    el.innerHTML = (lvl>=2?'<span class="fab-lv" style="color:'+(lvl===3?'#ff8800':'#ffd700')+'">'+(lvl===3?'★★★':'★★')+'</span>':'')
      +'<span style="font-size:24px">🏭</span><span class="fab-bonus">+'+fabGoma(lvl)+'/wave</span>';
    b.el=el; cell.appendChild(el);
  }
}
function fabGoma(lvl) { return 4+(lvl-1)*2; }
function fabBonus() {
  let t=0,rank=0;
  buildings.forEach(b=>{ if(b&&b.id==='fab'){ rank++; t+=fabGoma(b.lvl||1)*Math.max(0.5,1-rank*.1); } });
  return Math.floor(t);
}

// ═══════════════════════════════════════════
//  AUTO-WAVE
// ═══════════════════════════════════════════
function checkAutoWave() {
  if (state!=='prep') return;
  if (hand.length<=2) {
    if (!autoWaveTimer) {
      awStartTime = performance.now();
      document.getElementById('auto-wave').style.display = 'block';
      autoWaveTimer = setInterval(()=>{
        const el = performance.now()-awStartTime;
        document.getElementById('aw-sec').innerText = Math.max(0,Math.ceil((AW_DELAY-el)/1000));
        document.getElementById('aw-fill').style.width = (el/AW_DELAY*100)+'%';
        if (el>=AW_DELAY) {
          clearInterval(autoWaveTimer); autoWaveTimer=null;
          document.getElementById('auto-wave').style.display='none';
          if (state==='prep') startWave();
        }
      }, 80);
    }
  } else {
    if (autoWaveTimer) { clearInterval(autoWaveTimer); autoWaveTimer=null; }
    document.getElementById('auto-wave').style.display='none';
  }
}

// ═══════════════════════════════════════════
//  RENDER MÃO
// ═══════════════════════════════════════════
function canUpgrade(card) {
  if (card.type==='building') return buildings.some(b=>b&&b.id===card.id&&(b.lvl||1)<3);
  if (card.type!=='unit') return false;
  return units.some(u=>u&&u.id===card.id&&(u.lvl||1)<3);
}
function cardIconHTML(c) {
  if (c.icon) {
    const img=document.createElement('img'); img.src=c.icon; img.className='ci';
    img.onerror=function(){ this.outerHTML='<span class="ci-emoji">'+(c.emoji||'❓')+'</span>'; };
    return img.outerHTML;
  }
  return '<span class="ci-emoji">'+(c.emoji||'❓')+'</span>';
}
function renderHand() {
  if (!handDirty) return; handDirty=false;
  const el=document.getElementById('hand'); el.innerHTML='';
  hand.forEach((c,i) => {
    const ok=goma>=c.cost&&state==='prep', up=canUpgrade(c);
    const div=document.createElement('div');
    div.className = 'card'+(sel===i?' sel':'')+(up?' has-upgrade':'')+(!ok?' dim':'');
    const statsHTML = c.type==='unit' ? '<div class="card-stats">⚔️'+c.dmg+' ❤️'+c.hp+'</div>' : '';
    const passHTML  = (c.type==='unit'&&PASSIVES[c.id]) ? '<div class="passive-tag">'+PASSIVES[c.id].tag+'</div>' : '';
    div.innerHTML = '<div class="cc">'+c.cost+'</div>'+cardIconHTML(c)
      +'<div class="cn">'+c.name+'</div>'+statsHTML+passHTML
      +'<div class="cd">'+c.desc+'</div><div class="cbar r-'+c.rarity+'"></div>';
    div.addEventListener('pointerdown', ev => {
      ev.stopPropagation(); if(state!=='prep') return;
      if (!ok) { sfxError(); return; }
      sel=(sel===i?null:i); handDirty=true; refreshGrid(); hideCellPreview();
    });
    el.appendChild(div);
  });
  refreshGrid();
}

// ═══════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════
function updateHUD() {
  document.getElementById('hv-wave').innerText = wave;
  document.getElementById('hv-goma').innerText = goma;
  document.getElementById('hv-goma-max').innerText = gomaMax;
  document.getElementById('bfgoma').style.width = (goma/gomaMax*100)+'%';
  document.getElementById('hv-fab-info').innerText = fabCount>0?'🏭×'+fabCount+' +'+fabBonus()+'/wave':'';
  document.getElementById('hv-hp').innerText = Math.max(0,Math.ceil(rei.hp));
  document.getElementById('hv-hp-max').innerText = rei.maxHp;
  document.getElementById('bfhp').style.width = Math.max(0,rei.hp/rei.maxHp*100)+'%';
  document.getElementById('hv-state').innerText = paused?'PAUSA':state.toUpperCase();
  reiHPBar.style.width = Math.max(0,rei.hp/rei.maxHp*100)+'%';
  reiHPBar.style.background = rei.hp/rei.maxHp>.5?'#ff6688':rei.hp/rei.maxHp>.25?'#ffcc00':'#ff2244';
  if (totalWave>0)
    document.getElementById('bfwave').style.width = Math.max(0,(1-(spawnQueue.length+enemies.length)/totalWave)*100)+'%';
  const killEl = document.getElementById('hv-kills'); if(killEl) killEl.innerText=totalKills;
}

let notifT=null;
function notify(txt) {
  const n=document.getElementById('notif'); n.innerText=txt; n.style.opacity='1';
  clearTimeout(notifT); notifT=setTimeout(()=>n.style.opacity='0', 2200);
}
let badgeT=null;
function showBadge(txt) {
  const b=document.getElementById('wave-badge'); b.innerText=txt; b.style.opacity='1';
  clearTimeout(badgeT); badgeT=setTimeout(()=>b.style.opacity='0', 2500);
}
let eventT=null;
function showEvent(txt) {
  const b=document.getElementById('event-banner'); b.innerText=txt; b.style.opacity='1'; sfxEvent();
  clearTimeout(eventT); eventT=setTimeout(()=>b.style.opacity='0', 3000);
}
function spawnFloat(x,y,txt,color='#ff4466') {
  const el=document.createElement('div'); el.className='float-el';
  el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color;
  el.innerText=txt; arena.appendChild(el);
  floats.push({el, y, vy:-1.2+(Math.random()-.5)*.4, life:1});
}
let shakeTimer=null;
function shakeScreen() {
  arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake');
  clearTimeout(shakeTimer); shakeTimer=setTimeout(()=>arena.classList.remove('shake'),300);
}

// ═══════════════════════════════════════════
//  CRIAR INIMIGO DOM
// ═══════════════════════════════════════════
function createEnemyEl(e) {
  const wrap=document.createElement('div'); wrap.className='enemy-el spawning';
  wrap.style.left=e.x+'px'; wrap.style.top=e.y+'px';
  const sz=e.type==='boss'?56:e.type==='tank'?42:e.type==='fast'?22:e.type==='healer'?32:30;
  e.sz=sz;
  const body=document.createElement('div'); body.className='enemy-body '+e.type;
  body.style.width=sz+'px'; body.style.height=sz+'px'; body.style.fontSize=(sz*.48)+'px';
  body.innerText=e.type==='boss'?'👹':e.type==='tank'?'🛡️':e.type==='fast'?'💨':e.type==='healer'?'💊':e.type==='runner'?'🏃':'💀';
  if (e.type!=='normal') {
    const badge=document.createElement('div'); badge.className='enemy-badge';
    const colors={boss:'#6600ff',tank:'#ff6600',fast:'#00cc66',healer:'#009944',runner:'#cc00aa'};
    badge.style.background=colors[e.type]||'#880022'; badge.style.color='#fff';
    badge.innerText=e.type==='boss'?'BOSS':e.type==='tank'?'TANK':e.type==='fast'?'FAST':e.type==='runner'?'RUNNER':'CURADOR';
    wrap.appendChild(badge);
  }
  const hpBg=document.createElement('div'); hpBg.className='enemy-hp-bg'; hpBg.style.width=sz+'px';
  const hpBar=document.createElement('div');
  hpBar.className='enemy-hp '+(e.type==='boss'?'boss-hp':e.type==='healer'?'healer-hp':'normal-hp');
  hpBar.style.width='100%';
  hpBg.appendChild(hpBar); wrap.appendChild(body); wrap.appendChild(hpBg);
  if (e.type==='boss') {
    const lbl=document.createElement('div'); lbl.className='boss-label';
    lbl.innerText='☠️ VENOM '+Math.ceil(e.hp); wrap.appendChild(lbl); e.bossLabel=lbl;
  }
  e.el=wrap; e.bodyEl=body; e.hpEl=hpBar; arena.appendChild(wrap);
  setTimeout(()=>wrap.classList.remove('spawning'), 260);
}
function createProjEl(p) {
  const el=document.createElement('div'); el.className='proj-el';
  el.style.width=(p.r*2)+'px'; el.style.height=(p.r*2)+'px';
  el.style.background=p.color; el.style.boxShadow='0 0 6px '+p.color;
  el.style.left=p.x+'px'; el.style.top=p.y+'px';
  p.el=el; arena.appendChild(el);
}

// ═══════════════════════════════════════════
//  CLICK NA CÉLULA
// ═══════════════════════════════════════════
function onCellClick(idx) {
  if (state!=='prep' || sel===null) return;
  const card=hand[sel], col=idx%COLS, row=Math.floor(idx/COLS);

  // upgrade unidade
  if (units[idx] && card.type==='unit') {
    const u=units[idx];
    if (u.id!==card.id)  { notify('❌ Carta diferente!'); sfxError(); return; }
    if ((u.lvl||1)>=3)   { notify('⭐ Já no nível máximo!'); sfxError(); return; }
    if (goma<card.cost)  { notify('🍬 Goma insuficiente!'); sfxError(); return; }
    goma-=card.cost; u.lvl=(u.lvl||1)+1;
    const LVL={1:{hp:1,dmg:1},2:{hp:1.6,dmg:1.5},3:{hp:2.5,dmg:2.2}};
    const base=DECK.find(c=>c.id===u.id);
    if (base) { const m=LVL[u.lvl]; u.maxHp=Math.round(base.hp*m.hp); u.hp=u.maxHp; u.dmg=Math.round(base.dmg*m.dmg); }
    renderUnitEl(idx);
    const cc=cellCenter(col,row);
    spawnFloat(cc.x,cc.y-20,'Nv.'+u.lvl+'! ⬆️', u.lvl===3?'#ff44ff':'#ffd700');
    notify('⬆️ '+card.name+' → Nível '+u.lvl+'!'); sfxUpgrade(); consume(); return;
  }
  // upgrade fábrica
  if (buildings[idx] && card.type==='building') {
    const b=buildings[idx];
    if (b.id!==card.id)  { notify('❌ Carta diferente!'); sfxError(); return; }
    if ((b.lvl||1)>=3)   { notify('⭐ Fábrica no máximo!'); sfxError(); return; }
    if (goma<card.cost)  { notify('🍬 Goma insuficiente!'); sfxError(); return; }
    goma-=card.cost; b.lvl=(b.lvl||1)+1; renderUnitEl(idx);
    const cc=cellCenter(col,row);
    spawnFloat(cc.x,cc.y-20,'Fábrica Nv.'+b.lvl,'#ffd700');
    notify('🏭 Fábrica → Nível '+b.lvl+'! (+'+fabGoma(b.lvl)+'/wave)'); sfxUpgrade(); consume(); return;
  }
  if (units[idx]||buildings[idx]) return;
  if (goma<card.cost) { notify('🍬 Goma insuficiente!'); sfxError(); return; }
  goma-=card.cost;

  if (card.type==='unit') {
    units[idx]={id:card.id,hp:card.hp,maxHp:card.hp,dmg:card.dmg,spd:card.spd,cd:0,color:card.color,lvl:1,col,row,el:null};
    renderUnitEl(idx); sfxPlace();
  }
  if (card.type==='building') {
    buildings[idx]={id:card.id,lvl:1,col,row,el:null}; fabCount++;
    renderUnitEl(idx); sfxPlace(); notify('🏭 Fábrica nv.1! +'+fabBonus()+'/wave');
  }
  if (card.type==='sacrifice') {
    const alive=units.findIndex(u=>u);
    if (alive!==-1) {
      const ac=cellCenter(units[alive].col,units[alive].row);
      spawnFloat(ac.x,ac.y-16,'💥 Sacrificado!','#ff4444');
      units[alive]=null; renderUnitEl(alive);
      for (let i=0;i<3;i++) drawCard();
      notify('🔥 Sacrifício! +3 cartas'); sfxPlace();
    } else { notify('Sem tropas para sacrificar!'); sfxError(); goma+=card.cost; consume(); return; }
  }
  if (card.type==='heal') {
    const h=Math.min(30,rei.maxHp-rei.hp); rei.hp=Math.min(rei.maxHp,rei.hp+30);
    spawnFloat(reiCenter().x,reiCenter().y-30,'+'+Math.round(h)+' HP','#ff88cc');
    notify('🧪 Rei curado! +'+Math.round(h)+' HP'); sfxUpgrade();
  }
  if (card.type==='goma') { goma=Math.min(gomaMax,goma+6); notify('💧 +6 Gomas!'); sfxPlace(); }
  consume();
}
function consume() { hand.splice(sel,1); sel=null; handDirty=true; checkAutoWave(); }

// ═══════════════════════════════════════════
//  WAVE
// ═══════════════════════════════════════════
function startWave() {
  if (state!=='prep') return;
  if (autoWaveTimer) { clearInterval(autoWaveTimer); autoWaveTimer=null; }
  document.getElementById('auto-wave').style.display='none';
  state='battle';
  document.getElementById('btn-wave').disabled=true;
  const pb=document.getElementById('btn-pause'); if(pb) pb.disabled=false;
  const isBoss=wave%5===0;
  if (isBoss) { notify('☠️ WAVE DO VENOM BOSS!'); sfxBoss(); } else sfxWave();
  showBadge(isBoss?'💀 WAVE '+wave+' — BOSS!':'⚔️ WAVE '+wave);
  checkSpecialEvent();
  buildSpawn();
}

// EVENTOS ESPECIAIS DE WAVE
function checkSpecialEvent() {
  if (wave%7===0 && wave>1) showEvent('🌊 HORDA DUPLA — inimigos em dobro!');
  else if (wave%6===0 && wave>1) showEvent('💨 HORDA VELOZ — todos rápidos!');
  else if (wave%4===0 && wave>3) showEvent('💊 CURADOR em campo — mate-o primeiro!');
}

function buildSpawn() {
  // ── BALANCEAMENTO ─────────────────────────────────────────
  // Fórmula: BASE + wave×LINEAR + wave²×QUAD
  //   wave 1→8 | wave 5→17 | wave 10→29 | wave 20→53
  // Para FÁCIL  → 2 / 1.0 / 0.10
  // Para MÉDIO  → 3 / 1.3 / 0.15
  const BASE_INIMIGOS=3, MULTI_LINEAR=1.8, MULTI_QUAD=0.25;
  let count = Math.round(BASE_INIMIGOS + wave*MULTI_LINEAR + wave*wave*MULTI_QUAD);

  const isDoubleHorde = wave%7===0 && wave>1;
  const isAllFast     = wave%6===0 && wave>1;
  const forceHealer   = wave%4===0 && wave>3;
  if (isDoubleHorde) count = Math.round(count*2);

  totalWave=count; spawnQueue=[]; spawnClock=0;
  const gr=gridEl.getBoundingClientRect(), ar=arenaRect();
  const gridTop=gr.top-ar.top, gridH=gr.height;

  for (let i=0; i<count; i++) {
    const r=Math.random();
    const isBoss   = wave%5===0 && i===0;
    const isHealer = forceHealer && i===1 && !isBoss;
    // Corredor: aparece a partir da wave 6, 12% de chance — ignora tropas, vai direto no Rei
    const isRunner = !isBoss && !isHealer && r>0.55 && r<=0.67 && wave>=6;
    const isTank   = !isBoss && !isHealer && !isRunner && r<0.22 && wave>1 && !isAllFast;
    const isFast   = !isBoss && !isHealer && !isRunner && !isTank && (isAllFast||(r>0.72&&wave>=3));

    // HP BASE — wave 1=100hp | wave 5=220hp | wave 10=440hp
    // Para FÁCIL → HP_BASE=55, HP_POR_WAVE=10, HP_QUAD=0.5
    const HP_BASE=100, HP_POR_WAVE=18, HP_QUAD=1.5;
    const baseHp = HP_BASE + wave*HP_POR_WAVE + wave*wave*HP_QUAD;

    // DANO BASE
    // Para FÁCIL → DMG_BASE_NORMAL=4, DMG_POR_WAVE=0.5
    const DMG_BASE_NORMAL=6, DMG_BASE_TANK=12, DMG_BASE_FAST=5, DMG_BASE_HEALER=2, DMG_BASE_RUNNER=8, DMG_POR_WAVE=0.9;
    const dmgBase = (isTank?DMG_BASE_TANK:isFast?DMG_BASE_FAST:isHealer?DMG_BASE_HEALER:isRunner?DMG_BASE_RUNNER:DMG_BASE_NORMAL)
                    + Math.floor(wave*DMG_POR_WAVE);

    const HP_TANK_MULT=3.0, HP_BOSS_MULT=7.0;
    const hp = isBoss?baseHp*HP_BOSS_MULT : isTank?baseHp*HP_TANK_MULT : isRunner?baseHp*0.7 : baseHp;

    // VELOCIDADE — acima de 3.0 fica difícil de ver
    // Para FÁCIL → SPD_NORMAL=0.7, SPD_POR_WAVE=0.018
    const SPD_NORMAL=1.1, SPD_POR_WAVE=0.038, SPD_FAST_BASE=2.1, SPD_FAST_WAVE=0.055, SPD_TANK=0.5, SPD_BOSS=0.6, SPD_HEALER=0.75;
    const speed = isBoss?SPD_BOSS : isTank?SPD_TANK : isFast?(SPD_FAST_BASE+wave*SPD_FAST_WAVE) : isHealer?SPD_HEALER : isRunner?(1.4+wave*0.04) : (SPD_NORMAL+wave*SPD_POR_WAVE);

    // INTERVALO — FÁCIL→350ms | MÉDIO→280ms | DIFÍCIL→180ms
    const SPAWN_INTERVALO = 180;

    spawnQueue.push({
      delay:   i*SPAWN_INTERVALO, spawned:false,
      x:       (wave>=10 && i%5===0) ? (ar.left-ar.left + gridEl.getBoundingClientRect().left - ar.left + Math.random()*gridEl.getBoundingClientRect().width) : ar.width+60+Math.random()*100,
      y:       (wave>=10 && i%5===0) ? (i%10===0 ? -40 : ar.height+40) : gridTop+15+Math.random()*(gridH-30),
      hp, maxHp:hp, speed,
      dmg:     isBoss?Math.round(dmgBase*2.0):dmgBase,
      healPower: isHealer?Math.round(8+wave*0.8):0,
      attackCd: 0,
      type:    isBoss?'boss':isTank?'tank':isFast?'fast':isHealer?'healer':isRunner?'runner':'normal',
      rageMode: false,
    });
  }
}

// ═══════════════════════════════════════════
//  UPGRADES PÓS-WAVE
// ═══════════════════════════════════════════
function showUpgrades() {
  sfxWin();
  const pb=document.getElementById('btn-pause'); if(pb) pb.disabled=true;
  const pool = [
    {icon:'⚔️',title:'Goma Afiada',      desc:'+8 dano para todas as tropas',      fn:()=>upgrades.dmg+=8},
    {icon:'⚡',title:'Chiclete Turbo',    desc:'Tropas atacam +25% mais rápido',    fn:()=>upgrades.spd+=9},
    {icon:'💧',title:'+6 Goma/wave',      desc:'Mais goma ao fim de cada wave',     fn:()=>upgrades.gomaWave+=6},
    {icon:'🏭',title:'Fábrica ++',        desc:'Cada fábrica sobe 1 nível',
      fn:()=>{buildings.forEach(b=>{if(b&&b.id==='fab'){b.lvl=Math.min(3,(b.lvl||1)+1);renderUnitEl(b.row*5+b.col);}});notify('🏭 Fábricas turbinadas!');}},
    {icon:'❤️',title:'Rei Blindado',      desc:'+35 HP máximo para o Rei',          fn:()=>{rei.maxHp+=35;rei.hp=Math.min(rei.hp+35,rei.maxHp);}},
    {icon:'🔄',title:'Regen de Chiclete', desc:'Rei recupera 2 HP/s',              fn:()=>upgrades.regen+=2},
    {icon:'🃏',title:'Mais Cartas',       desc:'Ganhe 4 cartas agora',              fn:()=>{for(let i=0;i<4;i++)drawCard();}},
    {icon:'💥',title:'Explosão de Goma',  desc:'+14 dano para todas as tropas',     fn:()=>upgrades.dmg+=14},
    {icon:'🫧',title:'Reserva de Goma',   desc:'Goma máxima +12',                   fn:()=>gomaMax+=12},
    {icon:'✌️',title:'Sinergias x2',      desc:'Bônus de sinergias dobrado',        fn:()=>upgrades.synx2=true},
    {icon:'🍬',title:'Goma Inicial',      desc:'+4 goma no início de cada preparo', fn:()=>upgrades.gomaWave+=4},
    {icon:'🌟',title:'Upgrade Aleatório', desc:'Sobe 1 nível em uma tropa aleatória em campo',
      fn:()=>{
        const alive=units.filter(u=>u&&(u.lvl||1)<3);
        if (alive.length) {
          const u=alive[Math.floor(Math.random()*alive.length)];
          u.lvl=Math.min(3,(u.lvl||1)+1);
          const base=DECK.find(c=>c.id===u.id);
          if (base) {
            const LVL={1:{hp:1,dmg:1},2:{hp:1.6,dmg:1.5},3:{hp:2.5,dmg:2.2}};
            const m=LVL[u.lvl]; u.maxHp=Math.round(base.hp*m.hp); u.hp=u.maxHp; u.dmg=Math.round(base.dmg*m.dmg);
          }
          renderUnitEl(u.row*COLS+u.col);
          notify('🌟 '+u.id+' subiu para Nv.'+u.lvl+'!');
        } else notify('Nenhuma tropa para upar!');
      }},
  ];
  const opts=[],used=new Set();
  while (opts.length<3) { const r=Math.floor(Math.random()*pool.length); if(!used.has(r)){used.add(r);opts.push(pool[r]);} }
  const wrap=document.getElementById('ov-up-cards'); wrap.innerHTML='';
  opts.forEach(u => {
    const d=document.createElement('div'); d.className='upc';
    d.innerHTML='<div class="upi">'+u.icon+'</div><div class="upt">'+u.title+'</div><div class="upd">'+u.desc+'</div>';
    d.onclick=()=>{
      u.fn(); sfxUpgrade();
      document.getElementById('ov-upgrade').style.display='none';
      const earned=Math.min(6+fabBonus()+upgrades.gomaWave, gomaMax);
      goma=Math.min(gomaMax,goma+earned);
      notify('+'+earned+' goma! 🍬');
      for (let i=0;i<3;i++) drawCard();
      state='prep'; document.getElementById('btn-wave').disabled=false;
      handDirty=true; checkAutoWave();
    };
    wrap.appendChild(d);
  });
  document.getElementById('ov-upgrade').style.display='flex';
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function dist(ax,ay,bx,by) { return Math.hypot(bx-ax,by-ay); }
function toward(o,tx,ty,spd) {
  const d=dist(o.x,o.y,tx,ty); if(d<1) return;
  o.x+=(tx-o.x)/d*spd; o.y+=(ty-o.y)/d*spd;
}
function nearestEnemy(x,y) {
  let best=null,bd=Infinity;
  enemies.forEach(e=>{ const d=dist(x,y,e.x,e.y); if(d<bd){bd=d;best=e;} });
  return best;
}
function synergy() {
  const c=units.filter(u=>u).length;
  const b=c>=12?16:c>=8?10:c>=5?6:c>=3?3:0;
  return upgrades.synx2?b*2:b;
}

// ═══════════════════════════════════════════
//  LOOP PRINCIPAL
// ═══════════════════════════════════════════
function loop(ts) {
  const rawDt   = Math.min(ts-lastTime, 50); lastTime=ts;
  const dt      = paused ? 0 : rawDt*gameSpeed;
  const physSpd = paused ? 0 : (rawDt/16.667)*gameSpeed;

  if (state==='battle' && dt>0) {
    const rp=reiCenter(), syn=synergy();

    // SPAWN
    spawnClock+=dt;
    spawnQueue.forEach(q=>{
      if (!q.spawned && spawnClock>=q.delay) {
        q.spawned=true;
        const e={x:q.x,y:q.y,hp:q.hp,maxHp:q.maxHp,speed:q.speed,dmg:q.dmg,
          healPower:q.healPower||0,healCd:0,attackCd:0,type:q.type,rageMode:false};
        createEnemyEl(e); enemies.push(e);
      }
    });
    spawnQueue=spawnQueue.filter(q=>!q.spawned);

    // REGEN REI
    regenAcc+=dt;
    if (regenAcc>=1000) { if(upgrades.regen>0) rei.hp=Math.min(rei.maxHp,rei.hp+upgrades.regen); regenAcc=0; }

    // REI ATACA
    rei.cd-=dt;
    if (enemies.length && rei.cd<=0) {
      const t=nearestEnemy(rp.x,rp.y);
      if (t) {
        const p={x:rp.x,y:rp.y,tgt:t,dmg:7+upgrades.dmg,color:'#ff88cc',spd:7,r:4};
        createProjEl(p); projs.push(p);
        rei.cd=850; reiEl.classList.add('atk');
        setTimeout(()=>reiEl.classList.remove('atk'),120);
      }
    }

    // TROPAS
    units.forEach(u=>{
      if (!u) return;
      u.cd=(u.cd||0)-dt;
      if (u.cd<=0 && enemies.length) {
        const cc=cellCenter(u.col,u.row);
        if (u.id==='healer') {
          units.forEach((ally,aidx)=>{
            if (!ally||ally===u) return;
            const acc=cellCenter(ally.col,ally.row);
            if (dist(cc.x,cc.y,acc.x,acc.y)<180 && ally.hp<ally.maxHp) {
              const h=Math.min(20,ally.maxHp-ally.hp); ally.hp+=h;
              spawnFloat(acc.x,acc.y-16,'+'+h,'#44ff88'); sfxHealer();
              const hpEl=getCellEl(aidx).querySelector('.hp-bar');
              if (hpEl){const pct=ally.hp/ally.maxHp;hpEl.style.width=pct*100+'%';hpEl.style.background=pct>.5?'#44cc88':pct>.25?'#ffcc00':'#ff2244';}
            }
          });
          u.cd=Math.max(180,u.spd*16-upgrades.spd*12);
        } else {
          const t=nearestEnemy(cc.x,cc.y);
          if (t) {
            const isCrit = u.id==='atirador' && Math.random()<0.20;
            const baseDmg=u.dmg+upgrades.dmg+syn;
            const dmg = isCrit ? baseDmg*2 : baseDmg;
            const p={x:cc.x,y:cc.y,tgt:t,dmg,color:isCrit?'#ffdd00':u.color,spd:5,r:isCrit?5:3,isCrit};
            createProjEl(p); projs.push(p);
            if (u.id==='sticky') stickyPatches.push({x:t.x,y:t.y,life:5000,r:32,el:null});
            u.cd=Math.max(180,u.spd*16-upgrades.spd*12);
          }
        }
      }
    });

    // INIMIGOS
    enemies.forEach(e=>{
      // RAGE MODE do boss
      if (e.type==='boss' && !e.rageMode && e.hp/e.maxHp<0.4) {
        e.rageMode=true; e.speed*=1.7; e.dmg=Math.round(e.dmg*1.5);
        e.bodyEl.classList.add('rage'); notify('☠️ VENOM EM FÚRIA!'); sfxBoss();
      }
      // curador inimigo
      if (e.type==='healer' && !e._dead) {
        e.healCd=(e.healCd||0)-dt;
        if (e.healCd<=0) {
          enemies.forEach(ally=>{
            if (ally===e||ally.type==='healer') return;
            if (dist(e.x,e.y,ally.x,ally.y)<90) {
              const h=Math.min(e.healPower||10,ally.maxHp-ally.hp);
              if (h>0){ally.hp+=h; spawnFloat(ally.x,ally.y-12,'+'+Math.round(h),'#44ff88');}
            }
          });
          e.healCd=1800;
        }
      }
      const onSticky=stickyPatches.some(p=>dist(e.x,e.y,p.x,p.y)<p.r);
      const moveSpd=e.speed*(onSticky?.4:1)*physSpd;
      let tgt=null,minD=Infinity;
      // Runner ignora tropas, fast ignora tropas; taunt: tanque é priorizado
      if (e.type!=='fast' && e.type!=='runner') {
        const taunter = hasTaunt() ? units.find(u=>u&&u.id==='tanque') : null;
        if (taunter) {
          const cc=cellCenter(taunter.col,taunter.row);
          tgt={u:taunter,cc}; minD=dist(e.x,e.y,cc.x,cc.y);
        } else {
          units.forEach(u=>{if(!u)return;const cc=cellCenter(u.col,u.row),d=dist(e.x,e.y,cc.x,cc.y);if(d<minD){minD=d;tgt={u,cc};}});
        }
      }
      if (tgt && minD<260) {
        toward(e,tgt.cc.x,tgt.cc.y,moveSpd); e.attackCd-=dt;
        if (minD<28 && e.attackCd<=0) {
          tgt.u.hp-=e.dmg; spawnFloat(tgt.cc.x,tgt.cc.y-16,'-'+e.dmg,'#ff4444'); sfxHit();
          if (tgt.u.el){tgt.u.el.classList.add('hit-flash');setTimeout(()=>tgt.u.el&&tgt.u.el.classList.remove('hit-flash'),200);}
          e.attackCd=e.type==='fast'?300:e.type==='boss'?420:520;
          const tidx=tgt.u.row*COLS+tgt.u.col, hp=Math.max(0,tgt.u.hp/tgt.u.maxHp);
          const hpEl=getCellEl(tidx).querySelector('.hp-bar');
          if (hpEl){hpEl.style.width=hp*100+'%';hpEl.style.background=hp>.5?'#44cc88':hp>.25?'#ffcc00':'#ff2244';}
        }
      } else {
        toward(e,rp.x,rp.y,moveSpd); e.attackCd-=dt;
        if (dist(e.x,e.y,rp.x,rp.y)<52 && e.attackCd<=0) {
          rei.hp-=e.dmg; spawnFloat(rp.x,rp.y-28,'-'+e.dmg,'#ff2244'); sfxHit(); shakeScreen();
          reiEl.classList.add('hit'); setTimeout(()=>reiEl.classList.remove('hit'),250);
          e.attackCd=e.type==='fast'?300:e.type==='boss'?420:520;
        }
      }
      e.el.style.left=e.x+'px'; e.el.style.top=e.y+'px';
      e.hpEl.style.width=Math.max(0,e.hp/e.maxHp*100)+'%';
      if (e.bossLabel) e.bossLabel.innerText='☠️ VENOM '+Math.ceil(e.hp);
    });

    // PROJÉTEIS
    projs.forEach(p=>{
      if (!p.tgt||p.tgt.hp<=0){p.hit=true;return;}
      toward(p,p.tgt.x,p.tgt.y,p.spd*physSpd);
      p.el.style.left=p.x+'px'; p.el.style.top=p.y+'px';
      if (dist(p.x,p.y,p.tgt.x,p.tgt.y)<14) {
        p.tgt.hp-=p.dmg;
        if (p.isCrit) {
          const cel=document.createElement('div'); cel.className='crit-float';
          cel.style.left=p.tgt.x+'px'; cel.style.top=(p.tgt.y-20)+'px';
          cel.textContent='★ CRÍTICO! '+p.dmg;
          arena.appendChild(cel); setTimeout(()=>cel.remove(),700);
        }
        if (p.tgt.hp<=0) {
          // partículas de morte
          const pColor = p.tgt.type==='boss'?'#aa44ff':p.tgt.type==='tank'?'#ff6600':p.tgt.type==='fast'?'#44ff88':p.tgt.type==='runner'?'#ff44cc':'#ff2244';
          spawnParticles(p.tgt.x, p.tgt.y, pColor, p.tgt.type==='boss'?12:6);
          registerKill();
          if (p.tgt.type==='boss') {
            for (let i=0;i<3;i++) {
              const ne={x:p.tgt.x+(Math.random()-.5)*40,y:p.tgt.y+(Math.random()-.5)*30,
                hp:p.tgt.maxHp*.18,maxHp:p.tgt.maxHp*.18,speed:p.tgt.speed*1.5,
                dmg:Math.ceil(p.tgt.dmg*.65),healPower:0,healCd:0,attackCd:0,type:'fast',rageMode:false};
              createEnemyEl(ne); enemies.push(ne);
            }
            notify('☠️ Venom se dividiu em 3!');
          }
          if (p.tgt.el) p.tgt.el.classList.add('dying');
        }
        p.hit=true;
      }
    });

    // STICKY
    stickyPatches.forEach(p=>{
      p.life-=dt;
      if (!p.el&&p.life>0){const el=document.createElement('div');el.className='sticky-el';el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.r*2+'px';el.style.height=p.r*1.2+'px';arena.appendChild(el);p.el=el;}
      if (p.el) p.el.style.opacity=Math.max(0,p.life/5000)*.5;
    });

    // FLOATS
    floats.forEach(f=>{ f.y+=f.vy*physSpd; f.life-=.02; f.el.style.top=f.y+'px'; f.el.style.opacity=f.life; });

    // INDICADORES DE ALVO (a cada 500ms)
    targetUpdateTimer-=dt;
    if (targetUpdateTimer<=0) { updateTargetIndicators(); targetUpdateTimer=500; }

    // LIMPEZA
    projs.filter(p=>p.hit).forEach(p=>{if(p.el)p.el.remove();}); projs=projs.filter(p=>!p.hit);
    enemies.filter(e=>e.hp<=0&&!e._dying).forEach(e=>{e._dying=true;setTimeout(()=>{if(e.el)e.el.remove();},320);});
    enemies=enemies.filter(e=>e.hp>0);
    units=units.map((u,idx)=>{
      if (u&&u.hp<=0){if(u.el&&!u._dying){u._dying=true;u.el.classList.add('dying');setTimeout(()=>renderUnitEl(idx),360);}return null;}
      return u;
    });
    floats.filter(f=>f.life<=0).forEach(f=>{if(f.el)f.el.remove();}); floats=floats.filter(f=>f.life>0);
    stickyPatches.filter(p=>p.life<=0).forEach(p=>{if(p.el)p.el.remove();}); stickyPatches=stickyPatches.filter(p=>p.life>0);

    // FIM DA WAVE
    if (spawnQueue.length===0 && enemies.length===0) {
      targetedCells.forEach(i=>{const c=getCellEl(i);if(c)c.classList.remove('targeted');}); targetedCells.clear();
      // Rei comemora
      goma = Math.min(gomaMax, goma + Math.min(wave, 8));
      spawnFloat(reiCenter().x, reiCenter().y - 40, '+'+Math.min(wave,8)+' goma bônus!', '#44ddff');
      reiEl.classList.add('celebrate');
      setTimeout(()=>reiEl.classList.remove('celebrate'), 1600);
      wave++; state='upgrade'; showUpgrades();
    }
    // GAME OVER
    if (rei.hp<=0 && state==='battle') {
      rei.hp=0;
      const hs=getHS(), newHS=wave>hs; if(newHS) setHS(wave);
      const hsScore = parseInt(localStorage.getItem('chicletao_hs_score')||'0',10);
      if(score > hsScore) localStorage.setItem('chicletao_hs_score', score);
      document.getElementById('go-msg').innerText = 'Você chegou até a wave '+wave;
      document.getElementById('go-stats').innerText = totalKills+' inimigos eliminados  |  '+score.toLocaleString('pt-BR')+' pts';
      document.getElementById('go-hs').innerText = newHS?'🏆 Novo recorde! Wave '+wave:'🏆 Recorde: Wave '+hs;
      document.getElementById('ov-go').style.display='flex';
      sfxBoss(); state='dead';
      const pb=document.getElementById('btn-pause'); if(pb) pb.disabled=true;
    }
  }

  updateHUD(); renderHand();
  
// ═══════════════════════════════════════════
//  DETECÇÃO DE ZOOM
// ═══════════════════════════════════════════
let zoomDismissed = false;
let zoomPaused    = false;

function getZoom() {
  // Método mais confiável cross-browser
  return Math.round(window.devicePixelRatio * 100 / (window.outerWidth / window.innerWidth || 1)) || Math.round(window.devicePixelRatio * 100);
}

function checkZoom() {
  if (zoomDismissed) return;
  // Usa window.devicePixelRatio comparado ao ratio "natural" da tela
  // A forma mais simples e cross-browser: compara innerWidth com screen width
  const zoom = Math.round((window.outerWidth / window.innerWidth) * 100);
  const ov   = document.getElementById('ov-zoom');
  const val  = document.getElementById('zoom-val');
  if (!ov) return;

  // Tolerância de ±5% para evitar falsos positivos por DPI
  const isZoomed = zoom < 95 || zoom > 105;

  if (isZoomed) {
    if (val) val.textContent = zoom;
    ov.style.display = 'flex';
    if (!zoomPaused && state === 'battle' && !paused) {
      paused = true;
      zoomPaused = true;
      const btn = document.getElementById('btn-pause');
      const ovp = document.getElementById('ov-pause');
      if (btn) btn.textContent = '▶ Resume';
      // Não mostra overlay de pausa — o de zoom já está visível
    }
  } else {
    ov.style.display = 'none';
    if (zoomPaused) {
      paused = false;
      zoomPaused = false;
      const btn = document.getElementById('btn-pause');
      if (btn) btn.textContent = '⏸ Pausa';
    }
  }
}

function dismissZoom() {
  zoomDismissed = true;
  document.getElementById('ov-zoom').style.display = 'none';
  if (zoomPaused) {
    paused = false;
    zoomPaused = false;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = '⏸ Pausa';
  }
}

// Checa no resize (zoom muda o innerWidth)
window.addEventListener('resize', checkZoom);
// Checa periodicamente (alguns browsers não disparam resize no zoom)
setInterval(checkZoom, 800);
// Checa na inicialização
checkZoom();

requestAnimationFrame(loop);
}


// ═══════════════════════════════════════════
//  DETECÇÃO DE ZOOM
// ═══════════════════════════════════════════
let zoomDismissed = false;
let zoomPaused    = false;

function getZoom() {
  // Método mais confiável cross-browser
  return Math.round(window.devicePixelRatio * 100 / (window.outerWidth / window.innerWidth || 1)) || Math.round(window.devicePixelRatio * 100);
}

function checkZoom() {
  if (zoomDismissed) return;
  // Usa window.devicePixelRatio comparado ao ratio "natural" da tela
  // A forma mais simples e cross-browser: compara innerWidth com screen width
  const zoom = Math.round((window.outerWidth / window.innerWidth) * 100);
  const ov   = document.getElementById('ov-zoom');
  const val  = document.getElementById('zoom-val');
  if (!ov) return;

  // Tolerância de ±5% para evitar falsos positivos por DPI
  const isZoomed = zoom < 95 || zoom > 105;

  if (isZoomed) {
    if (val) val.textContent = zoom;
    ov.style.display = 'flex';
    if (!zoomPaused && state === 'battle' && !paused) {
      paused = true;
      zoomPaused = true;
      const btn = document.getElementById('btn-pause');
      const ovp = document.getElementById('ov-pause');
      if (btn) btn.textContent = '▶ Resume';
      // Não mostra overlay de pausa — o de zoom já está visível
    }
  } else {
    ov.style.display = 'none';
    if (zoomPaused) {
      paused = false;
      zoomPaused = false;
      const btn = document.getElementById('btn-pause');
      if (btn) btn.textContent = '⏸ Pausa';
    }
  }
}

function dismissZoom() {
  zoomDismissed = true;
  document.getElementById('ov-zoom').style.display = 'none';
  if (zoomPaused) {
    paused = false;
    zoomPaused = false;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = '⏸ Pausa';
  }
}

// Checa no resize (zoom muda o innerWidth)
window.addEventListener('resize', checkZoom);
// Checa periodicamente (alguns browsers não disparam resize no zoom)
setInterval(checkZoom, 800);
// Checa na inicialização
checkZoom();

requestAnimationFrame(loop);