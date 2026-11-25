if(new URLSearchParams(location.search).get('tag')==='0')document.documentElement.classList.add('notag');
// 타임라인: ?c=1|2|3 (콘텐츠 분류) &speed=slow|fast|edge
// slow: preview 2.0s · 타일 완료 4.2s / fast: preview 0.3s · 완료 0.7s / edge: preview 0.65s · 완료 1.1s
const q=new URLSearchParams(location.search);
const C=q.get('c')||'1', SP=q.get('speed')||'slow';
const T={slow:{p:2000,d:4200},fast:{p:300,d:700},edge:{p:650,d:1100}}[SP];
const GRACE=500; // 이 시간 안에 preview 가 오면 로딩 바탕·로고를 아예 띄우지 않는다(깜빡임 방지)
const IMG={ // 분류별 바탕 후보 / 장면(=파노 preview) — 실제 데이터 출처는 custom-image-survey.md
  1:{bg:'img/c1-custom.jpg',scene:'img/c1-pano500.jpg',label:'① 커스텀 이미지 (VR 2704 xo6jh8ib)'},
  2:{bg:'img/c2-pano500.jpg',scene:'img/c2-pano500.jpg',label:'② 기본 썸네일 (VR 2699 ntbcbojq)'},
  3:{bg:null,scene:'img/c3-pano250.jpg',label:'③ flat pano (VR 802 gfisdzqk)',flatPrev:'img/c3-pano250.jpg'}}[C];
const st=document.getElementById('stage');
st.insertAdjacentHTML('afterbegin',`<div class="layer bg" id="bg"></div><div class="layer scene" id="scene"><img src="${IMG.scene}"></div><div class="chrome"><img class="logo" src="img/logo_blue.png"><span class="row"><span class="spin"></span><span>Loading...</span></span></div><div id="tag">${window.DESIGN} · ${IMG.label} · ${SP} (preview ${T.p}ms / done ${T.d}ms)</div>`);
if(window.buildBg) window.buildBg(document.getElementById('bg'),IMG);
const b=document.body; let previewed=false;
setTimeout(()=>{ if(!previewed){b.classList.add('shown')} },GRACE);
setTimeout(()=>{ previewed=true; b.classList.add('refining'); },T.p);
setTimeout(()=>{ b.classList.remove('refining'); b.classList.add('done'); },T.d);
document.title='ready'; window.__t0=performance.now();
