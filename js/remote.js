'use strict';
let _girlsList=[];let wkLbUrls=[],wkLbIdx=0,wkLbX=0;
const _we={interests:new Set(),preferences:new Set(),zodiac:null};
const CAT_ORDER=[{id:4,name:'⭐ Modelos Destacadas'},{id:3,name:' Modelos'},{id:2,name:' Medias'},{id:1,name:' Inicial'}];
const DEFAULT_GIRL_CATS=[{id:1,name:'Inicial'},{id:2,name:'Medias'},{id:3,name:'Modelos'},{id:4,name:'Modelos Destacadas'}];
function girlCats(){return window._girlCategories||DEFAULT_GIRL_CATS;}
async function loadGirlCats(){try{const{data}=await db.from('app_branding').select('girl_categories').eq('id',1).single();window._girlCategories=data?.girl_categories||DEFAULT_GIRL_CATS;}catch(e){window._girlCategories=DEFAULT_GIRL_CATS;}}
function isNewGirl(created){if(!created)return false;return (Date.now()-new Date(created).getTime())<=3*24*60*60*1000;}
function toggleWChip(el,g,v){const s=_we[g];if(s.has(v)){s.delete(v);el.classList.remove('active');}else{s.add(v);el.classList.add('active');}}
function pickWZodiac(el,v){_we.zodiac=v;document.querySelectorAll('.wz-chip').forEach(z=>z.classList.remove('active'));el.classList.add('active');}
function injectGirlStyle(){if(document.getElementById('fendyx-girl-style'))return;const st=document.createElement('style');st.id='fendyx-girl-style';st.textContent=`
 @keyframes gFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
 @keyframes gShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
 @keyframes gPulse{0%,100%{box-shadow:0 0 6px rgba(0,255,157,.4)}50%{box-shadow:0 0 16px rgba(0,255,157,.8)}}
 .adult-section{margin:16px 0;padding:14px;border-radius:18px;background:rgba(255,255,255,.02);border:1px solid var(--border)}
 .adult-section h3{margin:0 0 12px 0;font-size:1.1rem;display:flex;align-items:center;gap:8px}
 .adult-section h3 .cat-badge{font-size:.7rem;padding:3px 10px;border-radius:999px;background:var(--gradient);color:#04060c;font-weight:800}
 .girls-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
