import {defaultCategories, buildLessons, categoryForWord} from './curriculum.js';
import { firebaseReady, auth, fAuth } from './firebase.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import * as store from './store.js?v=lookup-v10';
import { aiLookup, searchCommonsImages, normalizeVocabularyInput, googleTranslateUrl } from './ai.js?v=lookup-v10';
import { POS_TYPES, vocabularyParts, vocabularyPosLabel } from './vocabulary.js?v=lookup-v10';

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const shuffle = a => [...a].sort(()=>Math.random()-.5);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const state={
  user:null,profile:null,vocab:[],progress:{},testResults:[],leaderboard:[],view:'dashboard',
  session:1,flashIndex:0,flashReveal:false,search:'',pos:'all',
  exercise:null,test:null,solo:null,adminEdit:null,adminImages:[],adminSelectedImage:'',adminSearch:'',adminSession:'all',categories:[],lessons:[],category:'all',vocabSession:'all',adminCategory:'all',game:null
};

const DEMO_USER={uid:'demo-user',displayName:'Ân Yan Demo',email:'demo@ayk.local',isDemo:true};
const saved={get(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}},remove(key){try{localStorage.removeItem(key)}catch{}}};
function finishLoading(){$('#authLoading').classList.add('hidden')}
function showLogin(){finishLoading();appEl.classList.add('hidden');loginScreen.classList.remove('hidden')}
const loginScreen=$('#loginScreen'), appEl=$('#app'), viewRoot=$('#viewRoot'), authForm=$('#authForm');
const toastEl=$('#toast'), modal=$('#modal'), modalContent=$('#modalContent');
let toastTimer;

function toast(msg,type=''){
  toastEl.textContent=msg;toastEl.className=`toast show ${type}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.className='toast',2600);
}
function fmtDate(v){
  const d=v?.toDate?.()||new Date(v?.seconds? v.seconds*1000 : v||Date.now());
  return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function initials(name='AYK'){return name.split(/\s+/).filter(Boolean).slice(-2).map(x=>x[0]).join('').toUpperCase()||'AY'}
function speak(text){if(!('speechSynthesis'in window))return toast('Trình duyệt chưa hỗ trợ phát âm.','error'); speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='en-US';speechSynthesis.speak(u)}

function isAdmin(){return state.profile?.role==='admin'}
function canTeach(){return ['admin','teacher'].includes(state.profile?.role)}
function lessonName(n){return state.lessons.find(x=>x.number===Number(n))?.name||`Buổi ${n}`}
function categoryName(id){return state.categories.find(x=>x.id===id)?.name||'Tiếng Anh nền tảng'}
async function refreshCurriculum(){const c=await store.getCurriculum();state.lessons=buildLessons(state.vocab,c.lessons);state.categories=[...defaultCategories.filter(d=>state.lessons.some(l=>l.categoryId===d.id)&&!c.categories.some(x=>x.id===d.id)),...c.categories];state.curriculumNeedsRules=!!c.needsRules}
function userDisplayName(){return state.profile?.displayName||state.user?.displayName||state.user?.email?.split('@')[0]||'Học viên'}
function sessions(){return [...new Set([...state.lessons.map(x=>x.number),...state.vocab.map(x=>Number(x.session)||1)])].sort((a,b)=>a-b)}
function wordsOfSession(s=state.session){return state.vocab.filter(x=>Number(x.session)===Number(s))}
function masteredCount(){return state.vocab.filter(w=>state.progress[w.id]?.mastered).length}
function progressPct(){return state.vocab.length?Math.round(masteredCount()/state.vocab.length*100):0}
function wrongWords(){return state.vocab.filter(w=>(state.progress[w.id]?.wrongCount||0)>0 || state.progress[w.id]?.starred)}

async function bootstrapUser(user){
  state.user=user;
  store.setStoreUser(user);
  state.profile=await store.ensureUserProfile(user,user.displayName||'');
  state.vocab=await store.getVocabulary();
  await refreshCurriculum();
  state.progress=await store.getProgress(user);
  state.testResults=await store.getTestResults(user);
  state.leaderboard=await store.getLeaderboard();
  const resume=saved.get('ayk_resume_'+user.uid);
  state.session=sessions().includes(resume?.session)?resume.session:sessions()[0]||1;
  $('#userName').textContent=userDisplayName();$('#avatar').textContent=initials(userDisplayName());
  $('#adminNav').classList.toggle('hidden',!canTeach());
  loginScreen.classList.add('hidden');appEl.classList.remove('hidden');
  const allowed=['dashboard','learn','review','vocabulary','sessions','exercises','tests','solo','games',...(canTeach()?['admin']:[])];
  state.view=allowed.includes(resume?.view)?resume.view:canTeach()?'admin':'dashboard';
  if(user.isDemo)saved.set('ayk_demo_session',true);else saved.remove('ayk_demo_session');
  finishLoading();
  document.body.classList.toggle('admin-mode',isAdmin());
  $('#passwordSetup').classList.add('hidden');
  updateSidebarProgress();navigate(state.view);
}

function updateSidebarProgress(){
  const p=progressPct();$('#sideProgress').style.setProperty('--p',p);$('#sideProgress span').textContent=`${p}%`;$('#sideProgressText').textContent=`${masteredCount()}/${state.vocab.length} từ đã học`;
}

async function refreshData(){
  state.vocab=await store.getVocabulary();state.progress=await store.getProgress(state.user);state.testResults=await store.getTestResults(state.user);state.leaderboard=await store.getLeaderboard();await refreshCurriculum();updateSidebarProgress();
}

function navigate(view){
  if(view==='more'){ $('#sidebar').classList.add('open'); return; }
  if(view==='admin'&&!canTeach()) return toast('Bạn không có quyền Admin.','error');
  if(state.test?.active&&view!=='tests'&&!confirm('Bài kiểm tra đang làm sẽ bị hủy. Rời trang?'))return;
  if(view!=='tests')stopTest(); if(view!=='solo')stopSolo();
  state.view=view;saved.set('ayk_resume_'+state.user.uid,{view,session:state.session});$('#sidebar').classList.remove('open');
  $$('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  $$('#bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  renderView();window.scrollTo({top:0,behavior:'smooth'});
}

function renderView(){
  const renderers={dashboard:renderDashboard,learn:renderLearn,review:renderReview,vocabulary:renderVocabulary,sessions:renderSessions,exercises:renderExercises,tests:renderTests,solo:renderSolo,admin:renderAdmin,games:renderGames};
  (renderers[state.view]||renderDashboard)();
}

function pageTitle(title,sub,actions=''){return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${actions}</div>`}
function featureCards(){
  const fs=[['learn','📘','Học','Flashcard từ vựng'],['games','🎮','Trò chơi','5 cách luyện từ'],['review','↻','Ôn bài','Xem lại từ khó'],['vocabulary','Aa','Từ vựng','Tra và lọc từ'],['sessions','▦','Theo buổi','Học theo lịch'],['exercises','✎','Làm bài tập','Luyện tập nhanh'],['tests','▤','Kiểm tra','Đánh giá năng lực'],['solo','🏆','Solo bài','Thử thách điểm']];
  return `<div class="feature-grid">${fs.map(x=>`<button class="feature-card" data-go="${x[0]}"><div class="fi">${x[1]}</div><b>${x[2]}</b><small>${x[3]}</small></button>`).join('')}</div>`;
}

function renderDashboard(){
  const p=progressPct(), today=wordsOfSession(state.session).slice(0,4), latest=state.testResults[0];
  viewRoot.innerHTML=`
    <div class="welcome-grid"><section class="hero"><div class="hero-copy"><span class="eyebrow">YOUR PERSONAL LEARNING SPACE</span><h1>Học một chút,<br>tiến xa hơn <span class="hero-dot">✦</span></h1><p>Chào ${esc(userDisplayName())}. Dành một chút thời gian cho tiếng Anh — mỗi từ mới là một bước tiến của bạn.</p><button class="btn hero-cta" data-go="learn">Tiếp tục học <span>↗</span></button><div class="hero-badges"><span>✦ Học theo nhịp của bạn</span><span>📚 ${state.vocab.length} từ trong thư viện</span><span>🏆 Solo & bảng xếp hạng</span></div></div><div class="hero-illustration" aria-hidden="true"><img class="hero-girl" src="./assets/images/learning-girl.webp" alt=""></div></section><aside class="panel welcome-progress"><div class="panel-title"><h3>Tiến độ của bạn</h3><button class="link-btn" data-go="vocabulary">Xem chi tiết ↗</button></div><div class="progress-ring" style="--p:${p}"><span>${p}%</span></div><div class="progress-legend"><span><i></i> Đã thuộc <b>${masteredCount()}</b></span><span><i></i> Cần ôn <b>${wrongWords().length}</b></span><span><i></i> Tổng từ <b>${state.vocab.length}</b></span></div><div class="encouragement">🏆 Mỗi từ mới là một bước tiến!</div></aside></div>
    ${learningJourney()}${gameShelf()}
    <div class="section-heading"><h2>Khám phá góc học tập</h2><span>Chọn cách học bạn yêu thích</span></div>${featureCards()}
    <div class="dashboard-grid">
      <div class="panel wide"><div class="panel-title"><h3>🎯 Tiến độ học tập</h3><button class="link-btn" data-go="vocabulary">Xem từ vựng →</button></div><div class="progress-flex"><div class="progress-ring" style="--p:${p}"><span>${p}%</span></div><div class="stats-row w-full"><div class="stat"><small>Từ đã thuộc</small><strong>${masteredCount()}</strong></div><div class="stat"><small>Tổng từ</small><strong>${state.vocab.length}</strong></div><div class="stat"><small>Buổi học</small><strong>${sessions().length}</strong></div><div class="stat"><small>Bài kiểm tra</small><strong>${state.testResults.length}</strong></div></div></div></div>
      <div class="panel"><div class="panel-title"><h3>⭐ Cột mốc của bạn</h3><span class="badge">3 mục</span></div><div class="task-list"><div class="task ${masteredCount()>=5?'done':''}">☑ Học ít nhất 5 từ</div><div class="task ${state.testResults.length?'done':''}">☑ Hoàn thành 1 bài kiểm tra</div><div class="task ${state.leaderboard.some(x=>x.uid===state.user.uid)?'done':''}">☑ Chơi Solo 1 lần</div></div></div>
      <div class="panel"><div class="panel-title"><h3>📊 Kiểm tra gần nhất</h3><button class="link-btn" data-go="tests">Mở →</button></div>${latest?`<div class="score-box"><div class="score-number">${latest.score}%</div><b>${latest.correct}/${latest.total} câu đúng</b><p class="muted">${fmtDate(latest.createdAt)}</p></div>`:`<div class="empty"><div class="emoji">📝</div><p>Chưa có bài kiểm tra.</p></div>`}</div>
    </div>
    <div class="panel section-gap"><div class="panel-title"><h3>📘 Từ vựng • ${esc(lessonName(state.session))}</h3><button class="link-btn" data-go="sessions">Xem tất cả →</button></div>${sessionTabs()}<div class="vocab-grid section-gap">${today.map(vocabCard).join('')||empty('Chưa có từ vựng trong buổi này.')}</div></div>`;
  bindCommon();bindGameStarts();bindJourney();bindVocabCards();bindSessionTabs(()=>renderDashboard());
}

function gameShelf(){
 const cards=[['match','▦','Ghép thẻ','Tìm từ và nghĩa tương ứng','mint'],['spelling','♫','Nghe & viết','Nghe phát âm, luyện chính tả','peach'],['scramble','Aa','Xếp chữ','Giải mã chữ cái thành từ','purple'],['listening','◉','Tai nghe tinh tường','Nghe rồi chọn đúng từ','blue'],['missing','A_','Chữ nào còn thiếu?','Điền chữ để hoàn thành từ','yellow']];
 return `<div class="section-heading"><h2>Chơi để nhớ lâu hơn</h2><span>5 trò chơi · từ vựng của buổi đang chọn</span></div><div class="play-shelf">${cards.map(([id,icon,title,sub,color])=>`<button class="play-card ${color}" data-game="${id}"><span class="play-art" aria-hidden="true">${icon}<i>✦</i></span><strong>${title}</strong><small>${sub}</small><span class="play-arrow">Chơi ngay ↗</span></button>`).join('')}</div>`;
}
function learningJourney(){
 return `<section class="panel journey section-gap"><div class="panel-title"><h2>Hành trình của bạn</h2><button class="link-btn" data-go="sessions">Tất cả buổi →</button></div><div class="journey-track">${state.lessons.slice(0,6).map((l,i)=>{const words=wordsOfSession(l.number),done=words.filter(w=>state.progress[w.id]?.mastered).length;return `<button class="journey-step ${state.session===l.number?'current':''}" data-journey="${l.number}"><span class="journey-node">${words.length&&done===words.length?'✓':['📘','🎧','💬','🌱','🎯','⭐'][i]}</span><b>${esc(l.name)}</b><small>${done}/${words.length} từ đã thuộc</small><span class="journey-meter"><i style="width:${words.length?done/words.length*100:0}%"></i></span></button>`}).join('')||empty('Giáo viên sẽ thêm buổi học tại đây.')}</div></section>`;
}
function bindJourney(){$$('[data-journey]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.journey);state.flashIndex=0;state.flashReveal=false;navigate('learn')})}

function sessionTabs(){return `<div class="session-strip">${sessions().map(s=>`<button class="session-pill ${s===state.session?'active':''}" data-session="${s}">${esc(lessonName(s))}</button>`).join('')}</div>`}
function empty(msg){return `<div class="empty"><div class="emoji">📭</div><p>${msg}</p></div>`}
function vocabCard(v){
  const pr=state.progress[v.id]||{};return `<article class="vocab-card" data-id="${esc(v.id)}"><div class="vocab-img">${v.imageUrl?`<img src="${esc(v.imageUrl)}" alt="${esc(v.word)}" loading="lazy" referrerpolicy="no-referrer">`:`<span>${v.emoji||'📝'}</span>`}</div><div class="vocab-body"><div class="vocab-word"><h3>${esc(v.word)}</h3><span class="pos">${esc(vocabularyPosLabel(v))}</span><button class="star-btn ${pr.starred?'active':''}" data-star="${esc(v.id)}">★</button></div><div class="ipa">${esc(v.ipa||'')} <button class="link-btn" data-speak="${esc(v.word)}">🔊</button></div><div class="meaning">${esc(v.meaning)}</div><div class="card-actions"><button class="btn primary" data-practice="${esc(v.id)}">Luyện tập</button><button class="btn ghost" data-detail="${esc(v.id)}">Chi tiết</button></div></div></article>`;
}
function bindSessionTabs(cb){$$('[data-session]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.session);state.flashIndex=0;state.flashReveal=false;cb()})}
function bindCommon(){
  $$('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
  $$('[data-speak]').forEach(b=>b.onclick=e=>{e.stopPropagation();speak(b.dataset.speak)});
}
function bindVocabCards(){
  $$('[data-star]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=b.dataset.star,old=state.progress[id]?.starred||false;await store.updateWordProgress(state.user,id,{starred:!old});state.progress=await store.getProgress(state.user);renderView()});
  $$('[data-detail]').forEach(b=>b.onclick=()=>showWordDetail(b.dataset.detail));
  $$('[data-practice]').forEach(b=>b.onclick=()=>{const v=state.vocab.find(x=>x.id===b.dataset.practice);state.session=v.session;state.flashIndex=Math.max(0,wordsOfSession(v.session).findIndex(x=>x.id===v.id));state.flashReveal=false;navigate('learn')});
}
function showWordDetail(id){
  const v=state.vocab.find(x=>x.id===id);if(!v)return;const p=state.progress[id]||{};
  openModal(`<h2>${esc(v.word)} <span class="pos">${esc(vocabularyPosLabel(v))}</span></h2><p class="ipa">${esc(v.ipa||'')}</p>${v.imageUrl?`<img src="${esc(v.imageUrl)}" style="width:100%;height:220px;object-fit:cover;border-radius:16px" alt="">`:''}${v.imageSource?`<p class="muted"><a href="${esc(v.imageSource)}" target="_blank" rel="noopener noreferrer">Nguồn ảnh Wikimedia · ${esc(v.imageLicense||'Xem giấy phép')}</a></p>`:''}<h3>${esc(v.meaning)}</h3><p>${esc(v.example||'')}</p><p class="muted">Sai: ${p.wrongCount||0} lần • ${p.mastered?'Đã thuộc':'Đang học'}</p><div class="modal-actions"><button class="btn secondary" id="modalSpeak">🔊 Phát âm</button><button class="btn ghost" data-close>Đóng</button></div>`);$('#modalSpeak').onclick=()=>speak(v.word);bindModalClose();
}

function renderLearn(){
  const words=wordsOfSession();if(!words.length){viewRoot.innerHTML=pageTitle('Học','Flashcard theo từng buổi')+empty('Buổi này chưa có từ vựng.');return}
  state.flashIndex=clamp(state.flashIndex,0,words.length-1);const v=words[state.flashIndex],pr=state.progress[v.id]||{};
  viewRoot.innerHTML=`${pageTitle('Học từ vựng','Flashcard: nhìn từ → đoán nghĩa → tự đánh giá')}${sessionTabs()}<div class="flash-wrap"><div class="flash-card">${v.imageUrl?`<img class="flash-image" src="${esc(v.imageUrl)}" alt="">`:`<div style="font-size:68px">${v.emoji||'📝'}</div>`}<div><span class="pos">${esc(vocabularyPosLabel(v))}</span><div class="big-word">${esc(v.word)}</div><div class="ipa">${esc(v.ipa||'')} <button class="link-btn" id="flashSpeak">🔊</button></div></div>${state.flashReveal?`<div class="flash-answer"><h2>${esc(v.meaning)}</h2><p>${esc(v.example||'')}</p></div>`:`<button class="btn primary" id="revealBtn">Hiện đáp án</button>`}</div><div class="flash-nav"><button class="btn ghost" id="prevFlash">← Trước</button>${state.flashReveal?`<button class="btn danger" id="dontKnow">Chưa nhớ</button><button class="btn success" id="knowWord">Đã nhớ ✓</button>`:''}<button class="btn ghost" id="nextFlash">Sau →</button></div><p class="text-right muted">${state.flashIndex+1}/${words.length} • ${pr.mastered?'Đã thuộc':'Đang học'}</p></div>`;
  bindSessionTabs(()=>renderLearn());$('#flashSpeak').onclick=()=>speak(v.word);$('#revealBtn')?.addEventListener('click',()=>{state.flashReveal=true;renderLearn()});
  $('#prevFlash').onclick=()=>{state.flashIndex=(state.flashIndex-1+words.length)%words.length;state.flashReveal=false;renderLearn()};$('#nextFlash').onclick=()=>{state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()};
  $('#knowWord')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:true,lastReviewed:Date.now()});state.progress=await store.getProgress(state.user);updateSidebarProgress();state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
  $('#dontKnow')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:false,wrongCount:(pr.wrongCount||0)+1,lastReviewed:Date.now()});state.progress=await store.getProgress(state.user);state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
}

function renderReview(){
  const list=wrongWords();viewRoot.innerHTML=`${pageTitle('Ôn bài','Ưu tiên từ bạn từng trả lời sai hoặc đã đánh dấu sao',`<button class="btn primary" id="reviewNow" ${list.length?'':'disabled'}>Ôn ngay</button>`)}<div class="panel"><div class="panel-title"><h3>Danh sách cần ôn</h3><span class="badge">${list.length} từ</span></div><div class="vocab-grid">${list.map(vocabCard).join('')||empty('Chưa có từ cần ôn. Hãy học và đánh dấu sao các từ quan trọng.')}</div></div>`;bindVocabCards();bindCommon();
  $('#reviewNow')?.addEventListener('click',()=>startQuickQuiz(list,'review'));
}

function filteredVocab(){return state.vocab.filter(v=>(state.category==='all'||categoryForWord(v,state.lessons)===state.category)&&(state.vocabSession==='all'||Number(v.session)===Number(state.vocabSession))&&(state.pos==='all'||vocabularyParts(v).includes(state.pos))&&(!state.search||`${v.word} ${v.meaning} ${v.topic}`.toLowerCase().includes(state.search.toLowerCase())))}
function renderVocabulary(){
  const list=filteredVocab();viewRoot.innerHTML=`${pageTitle('Từ vựng','Tìm kiếm, nghe phát âm, đánh dấu và luyện tập')}<div class="toolbar"><input class="form-control" id="vocabSearch" placeholder="Tìm từ hoặc nghĩa..." value="${esc(state.search)}">${categorySelect("vocabCategory",state.category)}<select class="form-control" id="vocabSession" aria-label="Lọc từ theo buổi"><option value="all">Tất cả buổi</option>${state.lessons.filter(l=>state.category==='all'||l.categoryId===state.category).map(l=>`<option value="${l.number}" ${String(l.number)===String(state.vocabSession)?'selected':''}>${esc(l.name)}</option>`).join('')}</select><select class="form-control" id="posFilter"><option value="all">Tất cả loại từ</option>${['n','v','adj','adv'].map(p=>`<option ${state.pos===p?'selected':''}>${p}</option>`).join('')}</select><span class="badge">${list.length} từ</span></div><div class="vocab-grid">${list.map(vocabCard).join('')||empty('Không tìm thấy từ phù hợp.')}</div>`;
  $('#vocabCategory').onchange=e=>{state.category=e.target.value;state.vocabSession='all';renderVocabulary()};$('#vocabSession').onchange=e=>{state.vocabSession=e.target.value;renderVocabulary()};$('#vocabSearch').oninput=e=>{const caret=e.target.selectionStart;state.search=e.target.value;renderVocabulary();$('#vocabSearch').focus();$('#vocabSearch').setSelectionRange(caret,caret)};$('#posFilter').onchange=e=>{state.pos=e.target.value;renderVocabulary()};bindVocabCards();bindCommon();
}

function categorySelect(id,value='all'){return `<select class="form-control" id="${id}" aria-label="Danh mục"><option value="all">Tất cả danh mục</option>${state.categories.map(c=>`<option value="${esc(c.id)}" ${c.id===value?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`}
function renderSessions(){
 const selected=state.lessons.filter(l=>state.category==='all'||l.categoryId===state.category);
 viewRoot.innerHTML=`${pageTitle('Buổi học của bạn','Chọn danh mục, khám phá buổi học và luyện từ vựng.',canTeach()?'<button class="btn secondary" data-go="admin">Quản lý nội dung →</button>':'')}<div class="toolbar">${categorySelect('lessonCategory',state.category)}</div><div class="lesson-groups">${state.categories.filter(c=>selected.some(l=>l.categoryId===c.id)).map(c=>`<section><div class="section-heading"><h2>${esc(c.name)}</h2><span>${esc(c.description||'')}</span></div><div class="dashboard-grid">${selected.filter(l=>l.categoryId===c.id).map(l=>{const ws=wordsOfSession(l.number),done=ws.filter(w=>state.progress[w.id]?.mastered).length;return `<article class="panel lesson-card"><span class="badge">${esc(c.name)}</span><h2>${esc(l.name)}</h2><p class="muted">${esc(l.description||'Học và luyện tập từ vựng trong buổi này.')}</p><div class="lesson-meta">${ws.length} từ · ${done} đã thuộc</div><div class="card-actions"><button class="btn primary" data-open-session="${l.number}">Bắt đầu học →</button><button class="btn ghost" data-view-session="${l.number}">Xem từ</button></div></article>`}).join('')}</div></section>`).join('')||empty('Chưa có buổi học trong danh mục này.')}</div>`;
 $('#lessonCategory').onchange=e=>{state.category=e.target.value;renderSessions()};bindCommon();
 $$('[data-open-session]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.openSession);state.flashIndex=0;navigate('learn')});
 $$('[data-view-session]').forEach(b=>b.onclick=()=>{state.vocabSession=b.dataset.viewSession;state.category='all';state.search='';navigate('vocabulary')});
}
function curriculumManager(){const selected=state.adminCategory;
 return `<section class="content-tree"><div class="panel category-panel"><div class="panel-title"><h3>Danh mục chủ đề</h3><button class="btn primary compact" id="newCategory">+ Danh mục</button></div><button class="category-item ${selected==='all'?'active':''}" data-category-pick="all"><span>📚</span><b>Tất cả danh mục</b></button>${state.categories.map((c,i)=>`<div class="category-row"><button class="category-item ${selected===c.id?'active':''}" data-category-pick="${esc(c.id)}"><span>${['📁','🌱','🎓','🏡','🎮'][i%5]}</span><div><b>${esc(c.name)}</b><small>${state.lessons.filter(l=>l.categoryId===c.id).length} buổi học</small></div></button><button class="link-btn" data-manage-category="${esc(c.id)}" aria-label="Sửa danh mục ${esc(c.name)}">✎</button><button class="link-btn danger" data-delete-category="${esc(c.id)}" aria-label="Xóa danh mục ${esc(c.name)}">×</button></div>`).join('')||'<p class="muted">Thêm danh mục đầu tiên cho lớp của bạn.</p>'}</div><div class="panel lesson-panel"><div class="panel-title"><h3>Danh mục & buổi học</h3><button class="btn primary compact" id="newLesson">+ Buổi học</button></div><div class="lesson-list">${state.lessons.filter(l=>selected==='all'||l.categoryId===selected).map(l=>`<article class="lesson-line ${String(l.number)===state.adminSession?'active':''}"><button class="lesson-pick" data-lesson-pick="${l.number}"><span class="lesson-number">${l.number}</span><div><b>${esc(l.name)}</b><small>${wordsOfSession(l.number).length} từ · ${esc(categoryName(l.categoryId))}</small></div></button><div class="flex gap-8"><button class="link-btn" data-add-to-lesson="${l.number}">+ Từ</button><button class="link-btn" data-edit-lesson="${l.number}" aria-label="Sửa buổi ${esc(l.name)}">✎</button><button class="link-btn danger" data-delete-lesson="${l.number}" aria-label="Xóa buổi ${esc(l.name)}">×</button></div></article>`).join('')||'<div class="empty">Tạo buổi học, rồi thêm từ vựng của bạn.</div>'}</div></div></section>`;
}
function editCategory(id=''){
 if(state.curriculumNeedsRules)return toast('Chủ website cần cập nhật quy tắc Firebase để lưu danh mục.','error');
 const c=state.categories.find(c=>c.id===id)||{};
 openModal(`<h2>${id?'Chỉnh danh mục':'Danh mục mới'}</h2><form id="categoryForm"><label>Tên danh mục<input class="form-control" id="categoryName" required maxlength="100" value="${esc(c.name||'')}" placeholder="Ví dụ: Giao tiếp hằng ngày"></label><label>Mô tả<input class="form-control" id="categoryDescription" value="${esc(c.description||'')}"></label><div class="modal-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn primary" type="submit">Lưu danh mục</button></div></form>`);bindModalClose();
 $('#categoryForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{await store.saveCategory({id,name:$('#categoryName').value,description:$('#categoryDescription').value});await refreshCurriculum();modal.close();renderAdmin();toast('Đã lưu danh mục.','success')}catch(err){toast(err.message,'error')}finally{btn.disabled=false}};
}
function editLesson(number=0){
 if(state.curriculumNeedsRules)return toast('Chủ website cần cập nhật quy tắc Firebase để lưu buổi học.','error');
 if(!state.categories.length)return toast('Thêm danh mục trước khi tạo buổi học.','error');
 const l=state.lessons.find(l=>l.number===number)||{};
 openModal(`<h2>${number?'Chỉnh buổi học':'Buổi học mới'}</h2><form id="lessonForm"><label>Tên buổi học<input class="form-control" id="lessonName" required maxlength="120" value="${esc(l.name||'')}" placeholder="Ví dụ: Buổi 1 — Chào hỏi"></label><label>Danh mục<select class="form-control" id="lessonCategoryId">${state.categories.map(c=>`<option value="${esc(c.id)}" ${c.id===(l.categoryId||state.adminCategory)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Mô tả<input class="form-control" id="lessonDescription" value="${esc(l.description||'')}"></label><p class="muted">Đổi tên hoặc danh mục vẫn giữ nguyên các từ và tiến độ của buổi.</p><div class="modal-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn primary" type="submit">Lưu buổi học</button></div></form>`);bindModalClose();
 $('#lessonForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const saved=await store.saveLesson({number,name:$('#lessonName').value,categoryId:$('#lessonCategoryId').value,description:$('#lessonDescription').value},Math.max(0,...sessions()));await refreshCurriculum();state.session=saved.number;state.adminCategory='all';modal.close();renderAdmin();toast('Đã lưu buổi học.','success')}catch(err){toast(err.message,'error')}finally{btn.disabled=false}};
}
function bindCurriculum(){
 $('#newCategory').onclick=()=>editCategory();$('#newLesson').onclick=()=>editLesson();
 $$('[data-manage-category]').forEach(b=>b.onclick=()=>editCategory(b.dataset.manageCategory));
 $$('[data-category-pick]').forEach(b=>b.onclick=()=>{state.adminCategory=b.dataset.categoryPick;state.adminSession='all';renderAdmin()});
 $$('[data-lesson-pick]').forEach(b=>b.onclick=()=>{state.adminSession=b.dataset.lessonPick;state.session=Number(b.dataset.lessonPick);renderAdmin()});
 $$('[data-delete-category]').forEach(b=>b.onclick=async()=>{if(!confirm('Xóa danh mục trống này?'))return;try{await store.deleteCategory(b.dataset.deleteCategory);state.adminCategory='all';await refreshData();renderAdmin();toast('Đã xóa danh mục.','success')}catch(err){toast(err.message,'error')}});
 $$('[data-delete-lesson]').forEach(b=>b.onclick=async()=>{if(!confirm('Xóa buổi học trống này?'))return;try{await store.deleteLesson(Number(b.dataset.deleteLesson));state.adminSession='all';await refreshData();renderAdmin();toast('Đã xóa buổi.','success')}catch(err){toast(err.message,'error')}});
 $$('[data-edit-lesson]').forEach(b=>b.onclick=()=>editLesson(Number(b.dataset.editLesson)));
 $$('[data-add-to-lesson]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.addToLesson);openWordEditor()});
}

function makeQuestions(words,count=8){
  const base=shuffle(words).slice(0,Math.min(count,words.length));return base.map(w=>{let distract=shuffle(state.vocab.filter(x=>x.id!==w.id&&x.meaning!==w.meaning)).slice(0,3).map(x=>x.meaning);return {word:w,choices:shuffle([w.meaning,...distract])}})
}
function startQuickQuiz(words,mode='exercise'){if(words.length<2)return toast('Cần ít nhất 2 từ vựng để tạo bài.','error');state.exercise={questions:makeQuestions(words,Math.min(10,words.length)),index:0,correct:0,answered:false,selected:null,mode};navigate('exercises')}
function renderExercises(){
  if(!state.exercise){viewRoot.innerHTML=`${pageTitle('Làm bài tập','Luyện nhanh dạng chọn nghĩa đúng')}<div class="dashboard-grid"><div class="panel"><h3>🎯 Luyện tất cả từ</h3><p class="muted">10 câu ngẫu nhiên từ toàn bộ thư viện.</p><button class="btn primary" id="exAll">Bắt đầu</button></div><div class="panel"><h3>📘 Luyện theo buổi</h3><p class="muted">Chọn buổi hiện tại: ${esc(lessonName(state.session))}</p>${sessionTabs()}<button class="btn primary section-gap" id="exSession">Luyện ${esc(lessonName(state.session))}</button></div><div class="panel"><h3>⭐ Luyện từ khó</h3><p class="muted">${wrongWords().length} từ đang cần ôn.</p><button class="btn secondary" id="exWrong">Luyện từ khó</button></div></div>`;bindSessionTabs(()=>renderExercises());$('#exAll').onclick=()=>startQuickQuiz(state.vocab);$('#exSession').onclick=()=>startQuickQuiz(wordsOfSession());$('#exWrong').onclick=()=>startQuickQuiz(wrongWords());return}
  const qz=state.exercise;if(qz.index>=qz.questions.length){const pct=Math.round(qz.correct/qz.questions.length*100);viewRoot.innerHTML=`${pageTitle('Kết quả luyện tập','Bài luyện đã hoàn thành')}<div class="panel quiz-card score-box"><div class="score-number">${pct}%</div><h2>${qz.correct}/${qz.questions.length} câu đúng</h2><p class="muted">Sai ở đâu, hệ thống đã ghi lại để đưa vào mục Ôn bài.</p><button class="btn primary" id="againEx">Làm bài khác</button></div>`;$('#againEx').onclick=()=>{state.exercise=null;renderExercises()};return}
  const q=qz.questions[qz.index];viewRoot.innerHTML=`${pageTitle('Làm bài tập',`Câu ${qz.index+1}/${qz.questions.length}`)}<div class="panel quiz-card"><div class="quiz-top"><span class="badge">Chọn nghĩa đúng</span><b>${qz.correct} điểm</b></div><div class="quiz-progress"><span style="width:${qz.index/qz.questions.length*100}%"></span></div><div class="solo-word">${esc(q.word.word)}</div><p class="ipa text-right">${esc(q.word.ipa||'')} <button class="link-btn" id="qSpeak">🔊</button></p><div class="choice-list">${q.choices.map(c=>`<button class="choice ${qz.answered?(c===q.word.meaning?'correct':(c===qz.selected?'wrong':'')):''}" data-choice="${esc(c)}" ${qz.answered?'disabled':''}>${esc(c)}</button>`).join('')}</div>${qz.answered?`<div class="section-gap"><p><b>Ví dụ:</b> ${esc(q.word.example||'')}</p><button class="btn primary" id="nextEx">Câu tiếp theo →</button></div>`:''}</div>`;
  $('#qSpeak').onclick=()=>speak(q.word.word);$$('[data-choice]').forEach(b=>b.onclick=async()=>{if(qz.answered)return;qz.answered=true;qz.selected=b.dataset.choice;const correct=qz.selected===q.word.meaning;if(correct){qz.correct++;await store.updateWordProgress(state.user,q.word.id,{mastered:true,lastReviewed:Date.now()})}else{const p=state.progress[q.word.id]||{};await store.updateWordProgress(state.user,q.word.id,{mastered:false,wrongCount:(p.wrongCount||0)+1,lastReviewed:Date.now()})}state.progress=await store.getProgress(state.user);updateSidebarProgress();renderExercises()});$('#nextEx')?.addEventListener('click',()=>{qz.index++;qz.answered=false;qz.selected=null;renderExercises()});
}

function startTest(count){if(state.vocab.length<4)return toast('Cần ít nhất 4 từ để tạo bài kiểm tra.','error');const qs=makeQuestions(state.vocab,Math.min(count,state.vocab.length));state.test={active:true,questions:qs,index:0,correct:0,answers:[],seconds:Math.max(120,qs.length*20)};state.test.timerId=setInterval(()=>{state.test.seconds--;const e=$('#testTimer');if(e)e.textContent=secondsText(state.test.seconds);if(state.test.seconds<=0)finishTest()},1000);renderTests()}
function secondsText(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function stopTest(){if(state.test?.timerId)clearInterval(state.test.timerId);if(state.test?.active)state.test=null}
async function finishTest(){if(!state.test?.active)return;clearInterval(state.test.timerId);const t=state.test;t.active=false;t.score=Math.round(t.correct/t.questions.length*100);await store.saveTestResult(state.user,{score:t.score,correct:t.correct,total:t.questions.length,answers:t.answers});state.testResults=await store.getTestResults(state.user);renderTests()}
function renderTests(){
  if(!state.test){viewRoot.innerHTML=`${pageTitle('Kiểm tra','Chọn số câu, làm có thời gian và lưu kết quả')}<div class="dashboard-grid"><div class="panel"><h2>10 câu</h2><p class="muted">Bài ngắn để kiểm tra nhanh.</p><button class="btn primary" data-start-test="10">Bắt đầu</button></div><div class="panel"><h2>20 câu</h2><p class="muted">Bao quát nhiều từ hơn.</p><button class="btn primary" data-start-test="20">Bắt đầu</button></div><div class="panel"><h2>30 câu</h2><p class="muted">Thử thách dài hơn nếu đủ từ.</p><button class="btn primary" data-start-test="30">Bắt đầu</button></div></div><div class="panel section-gap"><div class="panel-title"><h3>🕘 Lịch sử kiểm tra</h3></div><div class="table-scroll"><table class="leaderboard"><thead><tr><th>Ngày</th><th>Điểm</th><th>Đúng</th></tr></thead><tbody>${state.testResults.slice(0,10).map(r=>`<tr><td>${fmtDate(r.createdAt)}</td><td><b>${r.score}%</b></td><td>${r.correct}/${r.total}</td></tr>`).join('')||`<tr><td colspan="3">Chưa có dữ liệu</td></tr>`}</tbody></table></div></div>`;$$('[data-start-test]').forEach(b=>b.onclick=()=>startTest(Number(b.dataset.startTest)));return}
  const t=state.test;if(!t.active){viewRoot.innerHTML=`${pageTitle('Kết quả kiểm tra','Kết quả đã được lưu')}<div class="panel quiz-card score-box"><div class="score-number">${t.score}%</div><h2>${t.correct}/${t.questions.length} câu đúng</h2><p class="muted">${t.score>=80?'Rất ổn! Tiếp tục giữ nhịp học.':t.score>=60?'Khá tốt. Ôn thêm các từ sai để chắc hơn.':'Nên quay lại mục Ôn bài và luyện từ khó.'}</p><div class="flex gap-8" style="justify-content:center"><button class="btn primary" id="newTest">Làm bài mới</button><button class="btn secondary" id="reviewWrong">Ôn từ sai</button></div></div>`;$('#newTest').onclick=()=>{state.test=null;renderTests()};$('#reviewWrong').onclick=()=>{state.test=null;navigate('review')};return}
  const q=t.questions[t.index];viewRoot.innerHTML=`${pageTitle('Kiểm tra',`Câu ${t.index+1}/${t.questions.length}`,`<div class="timer">⏱ <span id="testTimer">${secondsText(t.seconds)}</span></div>`)}<div class="panel quiz-card"><div class="quiz-progress"><span style="width:${t.index/t.questions.length*100}%"></span></div><span class="badge">Chọn nghĩa đúng</span><div class="solo-word">${esc(q.word.word)}</div><div class="choice-list">${q.choices.map(c=>`<button class="choice" data-test-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;$$('[data-test-choice]').forEach(b=>b.onclick=async()=>{const correct=b.dataset.testChoice===q.word.meaning;t.answers.push({wordId:q.word.id,answer:b.dataset.testChoice,correct});if(correct){t.correct++;await store.updateWordProgress(state.user,q.word.id,{mastered:true,lastReviewed:Date.now()})}else{const p=state.progress[q.word.id]||{};await store.updateWordProgress(state.user,q.word.id,{mastered:false,wrongCount:(p.wrongCount||0)+1,lastReviewed:Date.now()})}state.progress=await store.getProgress(state.user);t.index++;if(t.index>=t.questions.length)await finishTest();else renderTests()});
}

function startSolo(){if(state.vocab.length<4)return toast('Cần ít nhất 4 từ vựng.','error');state.solo={active:true,seconds:60,score:0,correct:0,total:0,current:null};nextSoloQuestion();state.solo.timerId=setInterval(()=>{state.solo.seconds--;const e=$('#soloTimer');if(e)e.textContent=state.solo.seconds;if(state.solo.seconds<=0)finishSolo()},1000);renderSolo()}
function nextSoloQuestion(){const w=state.vocab[Math.floor(Math.random()*state.vocab.length)];state.solo.current={word:w,choices:shuffle([w.meaning,...shuffle(state.vocab.filter(x=>x.id!==w.id&&x.meaning!==w.meaning)).slice(0,3).map(x=>x.meaning)])}}
function stopSolo(){if(state.solo?.timerId)clearInterval(state.solo.timerId);if(state.solo?.active)state.solo=null}
async function finishSolo(){if(!state.solo?.active)return;clearInterval(state.solo.timerId);const s=state.solo;s.active=false;await store.saveSoloScore(state.user,s.score,s.correct,s.total);state.leaderboard=await store.getLeaderboard();renderSolo()}
function renderSolo(){
  if(!state.solo){viewRoot.innerHTML=`${pageTitle('Solo bài','60 giây • đúng +100 • sai -25 • bảng xếp hạng')}<div class="dashboard-grid"><div class="panel solo-stage wide"><div style="font-size:72px">🏆</div><h1>AYK Speed Solo</h1><p class="muted">Trả lời càng nhiều từ càng tốt trong 60 giây.</p><button class="btn primary" id="startSolo">Bắt đầu Solo</button></div><div class="panel"><div class="panel-title"><h3>🏅 Top điểm</h3></div>${leaderboardHtml()}</div></div>`;$('#startSolo').onclick=startSolo;return}
  const s=state.solo;if(!s.active){viewRoot.innerHTML=`${pageTitle('Solo hoàn thành','Điểm đã được lưu vào bảng xếp hạng')}<div class="dashboard-grid"><div class="panel score-box"><div class="score-number">${s.score}</div><h2>${s.correct}/${s.total} câu đúng</h2><button class="btn primary" id="soloAgain">Chơi lại</button></div><div class="panel"><h3>🏅 Bảng xếp hạng</h3>${leaderboardHtml()}</div></div>`;$('#soloAgain').onclick=()=>{state.solo=null;startSolo()};return}
  const q=s.current;viewRoot.innerHTML=`${pageTitle('Solo bài',`Điểm: ${s.score}`,`<div class="timer">⚡ <span id="soloTimer">${s.seconds}</span>s</div>`)}<div class="panel quiz-card solo-stage"><span class="badge">${s.correct} đúng / ${s.total} câu</span><div class="solo-word">${esc(q.word.word)}</div><div class="choice-list">${q.choices.map(c=>`<button class="choice" data-solo-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;$$('[data-solo-choice]').forEach(b=>b.onclick=()=>{s.total++;if(b.dataset.soloChoice===q.word.meaning){s.correct++;s.score+=100}else s.score=Math.max(0,s.score-25);nextSoloQuestion();renderSolo()});
}
function leaderboardHtml(){return `<div class="table-scroll"><table class="leaderboard"><thead><tr><th>#</th><th>Học viên</th><th>Điểm</th></tr></thead><tbody>${state.leaderboard.map((r,i)=>`<tr><td class="rank">${i<3?['🥇','🥈','🥉'][i]:i+1}</td><td>${esc(r.displayName||'Học viên')}</td><td><b>${r.score}</b></td></tr>`).join('')||`<tr><td colspan="3">Chưa có điểm Solo</td></tr>`}</tbody></table></div>`}

function adminEditorHtml(){const e=state.adminEdit||{};return `<div class="panel admin-editor"><div class="panel-title"><h3>${e.id?'Sửa':'Thêm'} từ vựng</h3><span class="badge">Tra nghĩa & chọn ảnh</span></div><form id="adminForm" class="admin-form"><label>Từ tiếng Anh<input class="form-control" id="aWord" required value="${esc(e.word||'')}"></label><fieldset class="pos-picker"><legend>Loại từ · chọn nhiều</legend>${POS_TYPES.map(p=>`<label><input type="checkbox" name="aPos" value="${p}" ${vocabularyParts(e).includes(p)?'checked':''}> ${p}</label>`).join('')}<small id="posHint" class="muted">Tra từ để xem những loại từ có trong từ điển.</small></fieldset><label>Buổi học<select class="form-control" id="aSession" required>${state.lessons.map(l=>`<option value="${l.number}" ${l.number===Number(e.session||state.session)?'selected':''}>${esc(l.name)} · ${esc(categoryName(l.categoryId))}</option>`).join('')}</select></label><label>Chủ đề<input class="form-control" id="aTopic" value="${esc(e.topic||'')}"></label><div class="full-span flex gap-8"><button class="btn secondary" type="button" id="aiBtn">✨ Tự điền nghĩa, ví dụ & ảnh</button><a class="btn secondary" id="googleTranslateBtn" href="${esc(googleTranslateUrl(e.word||''))}" target="_blank" rel="noopener noreferrer">Google Dịch ↗</a><span id="aiStatus" class="muted" aria-live="polite"></span></div><div class="full-span muted">Google Dịch tự động cần máy chủ đã được kích hoạt. Bạn có thể chỉnh mọi gợi ý trước khi lưu.</div><label>Nghĩa tiếng Việt<input class="form-control" id="aMeaning" required value="${esc(e.meaning||'')}"></label><label>IPA<input class="form-control" id="aIpa" value="${esc(e.ipa||'')}"></label><label class="full-span">Ví dụ<input class="form-control" id="aExample" value="${esc(e.example||'')}"></label><label class="full-span">URL ảnh<input class="form-control" id="aImage" value="${esc(e.imageUrl||'')}"></label><div class="full-span flex gap-8"><input class="form-control" id="imageQuery" aria-label="Từ khóa tìm ảnh" placeholder="Từ khóa ảnh cụ thể, ví dụ: school classroom"><button class="btn secondary" type="button" id="imageSearchBtn">Tìm ảnh</button><button class="btn ghost" type="button" id="clearImageBtn">Bỏ ảnh</button></div><div class="full-span" id="imageArea">${adminImageHtml()}</div><div class="full-span flex gap-8"><button class="btn primary" type="submit">${e.id?'Cập nhật':'Lưu từ vựng'}</button>${e.id?`<button class="btn ghost" type="button" id="cancelEdit">Hủy sửa</button>`:''}</div></form></div>`}
function openWordEditor(item=null){state.adminEdit=item?{...item}:null;state.adminImages=[];state.adminSelectedImage=item?.imageUrl||'';state.adminImageSource=item?.imageSource||'';state.adminImageLicense=item?.imageLicense||'';if(!state.lessons.length)return toast('Tạo danh mục và buổi học trước khi thêm từ.','error');openModal('<button class="btn ghost modal-dismiss" type="button" data-close>Đóng ×</button>'+adminEditorHtml());bindModalClose();bindAdminForm();$('#aWord').focus()}
function renderAdmin(){
  if(!canTeach()){navigate('dashboard');return}
  const e=state.adminEdit||{};viewRoot.innerHTML=`<div class="admin-heading"><div><span class="auth-kicker">AYK / QUẢN TRỊ</span><h1>Nội dung học & giáo viên.</h1><p class="muted">Chào ${esc(userDisplayName())}. Cùng xây dựng một thư viện tiếng Anh thật hay.</p></div><div class="flex gap-8"><button class="btn ghost" id="exportVocab">Xuất CSV ↓</button><button class="btn primary" id="addWord">+ Thêm từ</button>${isAdmin()?'<button class="btn ghost danger" id="resetContent">Dọn toàn bộ nội dung</button><button class="btn ghost" id="restoreContent">Khôi phục bản lưu</button>':''}</div></div><div class="admin-stats"><div><span>THƯ VIỆN TỪ VỰNG</span><strong>${state.vocab.length}<small>từ</small></strong><i>Aa</i></div><div><span>BUỔI HỌC</span><strong>${sessions().length}<small>buổi</small></strong><i>▦</i></div><div><span>CÓ ẢNH MINH HỌA</span><strong>${state.vocab.filter(v=>v.imageUrl).length}<small>từ</small></strong><i>▧</i></div><div><span>CẦN THÊM PHÁT ÂM</span><strong>${state.vocab.filter(v=>!v.ipa).length}<small>từ</small></strong><i>◌</i></div></div><div class="admin-banner"><span>✦</span><div><b>Nội dung tốt, trải nghiệm học tốt.</b><p>Thêm nghĩa, phiên âm và một ví dụ gần gũi cho mỗi từ.</p></div><span class="badge">${state.user?.isDemo?'Bản demo · lưu trên máy':'Quản trị viên'}</span></div>${state.curriculumNeedsRules?'<div class="panel section-gap"><b>Kết nối danh mục chưa hoàn tất</b><p class="muted">Chủ website cần cập nhật quy tắc Firebase mới để giáo viên lưu danh mục và buổi học. Các chức năng học và từ vựng hiện tại vẫn dùng được.</p></div>':''}<div class="admin-workspace">${curriculumManager()}<div class="panel admin-library"><div class="panel-title"><div><h3>Thư viện từ vựng</h3><p class="muted">Tìm, chỉnh sửa và sắp xếp nội dung học.</p></div><span class="badge">${state.vocab.length} từ</span></div><div class="toolbar admin-toolbar"><input class="form-control" id="adminSearch" aria-label="Tìm từ trong quản trị" placeholder="Tìm từ hoặc nghĩa…" value="${esc(state.adminSearch)}">${categorySelect("adminCategory",state.adminCategory)}<select class="form-control" id="adminSession" aria-label="Lọc buổi học"><option value="all">Tất cả buổi</option>${sessions().map(n=>`<option value="${n}" ${String(n)===state.adminSession?'selected':''}>${esc(lessonName(n))}</option>`).join('')}</select></div><div class="table-scroll" style="max-height:690px"><table class="admin-table"><thead><tr><th>Buổi</th><th>Từ</th><th>Loại</th><th>Nghĩa</th><th>Thao tác</th></tr></thead><tbody>${adminFilteredWords().map(v=>`<tr><td><span class="badge">${esc(lessonName(v.session))}</span></td><td><b>${esc(v.word)}</b></td><td><span class="pos">${esc(vocabularyPosLabel(v))}</span></td><td>${esc(v.meaning)}</td><td><button class="link-btn" data-edit="${esc(v.id)}">Sửa</button> <button class="link-btn" style="color:#d33" data-delete="${esc(v.id)}">Xóa</button></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Chưa có từ phù hợp.</div></td></tr>'}</tbody></table></div></div></div>`;
  bindCurriculum();bindAdmin();
}
function adminImageHtml(){if(!state.adminImages.length)return '<p class="muted">Ảnh là tùy chọn. Nhập từ khóa cụ thể và tự chọn ảnh phù hợp; các từ trừu tượng như basic có thể để trống ảnh.</p>';return `<div><b>Chọn ảnh minh họa</b><div class="image-results">${state.adminImages.map((im,i)=>`<button type="button" class="image-option ${state.adminSelectedImage===im.url?'selected':''}" data-img="${i}" title="${esc(im.title)}"><img src="${esc(im.url)}" alt=""></button>`).join('')}</div></div>`}
function adminFilteredWords(){return state.vocab.filter(v=>(state.adminCategory==='all'||categoryForWord(v,state.lessons)===state.adminCategory)&&(state.adminSession==='all'||String(v.session)===state.adminSession)&&`${v.word} ${v.meaning} ${v.topic||''}`.toLowerCase().includes(state.adminSearch.toLowerCase()))}
function exportVocabulary(){
  const cols=['word','meaning','pos','session','topic','ipa','example','imageUrl'];
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv='\uFEFF'+[cols,...adminFilteredWords().map(v=>cols.map(k=>k==='pos'?vocabularyPosLabel(v):v[k]))].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download='AYK-vocabulary.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bindAdmin(){
  $('#exportVocab').onclick=exportVocabulary;$('#adminCategory').onchange=e=>{state.adminCategory=e.target.value;state.adminSession='all';renderAdmin()};
  $('#adminSession').onchange=e=>{state.adminSession=e.target.value;renderAdmin()};
  $('#adminSearch').oninput=e=>{const start=e.target.selectionStart;state.adminSearch=e.target.value;renderAdmin();$('#adminSearch').focus();$('#adminSearch').setSelectionRange(start,start)};
  $('#addWord').onclick=()=>openWordEditor();
  $('#resetContent')?.addEventListener('click',async()=>{if(!confirm('Làm trống toàn bộ từ vựng, buổi học và danh mục? Nội dung cũ được giữ trong bản lưu để khôi phục. Tài khoản và lịch sử học vẫn giữ nguyên.'))return;try{await store.resetLearningContent();state.adminCategory='all';state.adminSession='all';state.game=null;state.exercise=null;await refreshData();renderAdmin();toast('Đã dọn nội dung. Bạn có thể tạo danh mục mới.','success')}catch(err){toast('Chưa dọn được: '+err.message,'error')}});
  $('#restoreContent')?.addEventListener('click',async()=>{try{await store.restoreLearningContent();await refreshData();renderAdmin();toast('Đã khôi phục nội dung.','success')}catch(err){toast(err.message,'error')}});

  $$('[data-edit]').forEach(b=>b.onclick=()=>{openWordEditor(state.vocab.find(x=>x.id===b.dataset.edit))});
  $$('[data-delete]').forEach(b=>b.onclick=async()=>{const v=state.vocab.find(x=>x.id===b.dataset.delete);if(!confirm(`Xóa từ “${v?.word}”?`))return;try{await store.deleteVocabulary(b.dataset.delete);await refreshData();toast('Đã xóa từ.','success');renderAdmin()}catch(err){toast('Không xóa được: '+err.message,'error')}});
}
function bindAdminForm(){
 $('#cancelEdit')?.addEventListener('click',()=>modal.close());
  const syncTranslate=()=>{$('#googleTranslateBtn').href=googleTranslateUrl($('#aWord').value)};
  let generatedWord='',generatedValues={};
  $('#aWord').addEventListener('input',()=>{syncTranslate();if(generatedWord&&normalizeVocabularyInput($('#aWord').value).word!==generatedWord){for(const [id,value]of Object.entries(generatedValues))if($('#'+id).value===value)$('#'+id).value='';generatedValues={};generatedWord='';$('#aiStatus').textContent='Tra lại để cập nhật nghĩa và ví dụ cho từ mới.';}});syncTranslate();
  const selectedParts=()=>$$('[name="aPos"]:checked').map(e=>e.value);
  const applyParts=parts=>$$('[name="aPos"]').forEach(e=>e.checked=parts.includes(e.value));
  $('#aiBtn').onclick=async()=>{
    const parsed=normalizeVocabularyInput($('#aWord').value,selectedParts());
    if(!parsed.word)return toast('Nhập từ tiếng Anh trước.','error');
    $('#aiBtn').disabled=true;$('#aiStatus').textContent='Đang tra nghĩa, loại từ và ví dụ...';
    try{
      const r=await aiLookup(parsed.word,parsed.partsOfSpeech);
      if(normalizeVocabularyInput($('#aWord').value).word!==parsed.word)return;
      $('#aWord').value=parsed.word;applyParts(r.partsOfSpeech||[r.pos]);syncTranslate();
      $('#posHint').textContent='Có trong từ điển: '+(r.availablePartsOfSpeech||r.partsOfSpeech||[r.pos]).join(' / ')+'. Chọn các loại từ bạn muốn học.';
      if(r.meaning)$('#aMeaning').value=r.meaning;if(r.source==='google-cloud-translation'){$('#aIpa').value=r.ipa||'';$('#aExample').value=r.example||''}else{if(r.ipa)$('#aIpa').value=r.ipa;if(r.example)$('#aExample').value=r.example;}
      generatedWord=parsed.word;generatedValues={};for(const [id,key]of [['aMeaning','meaning'],['aIpa','ipa'],['aExample','example']])if(r[key])generatedValues[id]=$('#'+id).value;
      $('#aiStatus').textContent=r.note;
      if(r.meaning&&r.imageSearchKeyword){
        $('#imageQuery').value=r.imageSearchKeyword;$('#aiStatus').textContent='Đã điền nghĩa và ví dụ. Đang tìm ảnh theo nghĩa...';
        const images=await searchCommonsImages(r.imageSearchKeyword);
        if(normalizeVocabularyInput($('#aWord').value).word!==parsed.word)return;
        state.adminImages=images;state.adminSelectedImage=$('#aImage').value;
        const match=images.find(im=>r.imageSearchKeyword.toLowerCase().split(/\s+/).filter(t=>t.length>2&&!['the','and','with','that','this','from','have','into'].includes(t)).some(t=>im.title.toLowerCase().includes(t)));
        if(match&&!$('#aImage').value){$('#aImage').value=match.url;state.adminSelectedImage=match.url;state.adminImageSource=match.source||'';state.adminImageLicense=match.license||'';generatedValues.aImage=match.url;}
        $('#imageArea').innerHTML=adminImageHtml();bindImageChoices();$('#aiStatus').textContent=r.note+(match?' Đã gắn ảnh gợi ý; bạn có thể thay hoặc bỏ.':' Chưa có ảnh phù hợp, bạn có thể tìm ảnh khác.');
      }
    }catch(err){$('#aiStatus').textContent=err.message}finally{$('#aiBtn').disabled=false}
  };
  $('#imageSearchBtn').onclick=async()=>{const keyword=$('#imageQuery').value.trim();if(!keyword)return toast('Nhập từ khóa ảnh cụ thể trước.','error');$('#imageSearchBtn').disabled=true;try{state.adminImages=await searchCommonsImages(keyword);state.adminSelectedImage=$('#aImage').value;$('#imageArea').innerHTML=state.adminImages.length?adminImageHtml():'<p class="muted">Chưa tìm được ảnh. Thử từ khóa khác hoặc tự nhập URL ảnh.</p>';bindImageChoices()}finally{$('#imageSearchBtn').disabled=false}};
  $('#clearImageBtn').onclick=()=>{$('#aImage').value='';state.adminSelectedImage='';state.adminImageSource='';state.adminImageLicense='';$$('[data-img]').forEach(b=>b.classList.remove('selected'))};
  bindImageChoices();
  $('#adminForm').onsubmit=async e=>{e.preventDefault();const item={id:state.adminEdit?.id||'',...normalizeVocabularyInput($('#aWord').value,selectedParts()),session:Number($('#aSession').value),topic:$('#aTopic').value.trim(),meaning:$('#aMeaning').value.trim(),ipa:$('#aIpa').value.trim(),example:$('#aExample').value.trim(),imageUrl:$('#aImage').value.trim(),imageSource:$('#aImage').value.trim()?state.adminImageSource||'':'',imageLicense:$('#aImage').value.trim()?state.adminImageLicense||'':'',emoji:'📝'};if(!state.lessons.some(l=>l.number===item.session))return toast('Tạo hoặc chọn một buổi học trước.','error');if(!item.partsOfSpeech.length)return toast('Chọn ít nhất một loại từ.','error');if(!item.word||!item.meaning)return toast('Thiếu từ hoặc nghĩa.','error');try{await store.saveVocabulary(item);modal.close();state.adminEdit=null;state.adminImages=[];state.adminSelectedImage='';await refreshData();toast('Đã lưu từ vựng.','success');renderAdmin()}catch(err){console.error(err);toast('Không lưu được: '+err.message,'error')}};
}
function bindImageChoices(){$$('[data-img]').forEach(b=>b.onclick=()=>{const im=state.adminImages[Number(b.dataset.img)];state.adminSelectedImage=im.url;state.adminImageSource=im.source||'';state.adminImageLicense=im.license||'';$('#aImage').value=im.url;$$('[data-img]').forEach(x=>x.classList.toggle('selected',x===b))})}

function openModal(html){modalContent.innerHTML=`<div class="modal-inner">${html}</div>`;modal.showModal()}
function bindModalClose(){$$('[data-close]',modal).forEach(b=>b.onclick=()=>modal.close())}
modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});

// NAV / HEADER
$$('#mainNav [data-view],#bottomNav [data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('ayk_theme',document.body.classList.contains('dark')?'dark':'light')};
if(localStorage.getItem('ayk_theme')==='dark')document.body.classList.add('dark');
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){state.search=e.target.value;navigate('vocabulary')}});

// AUTH
let registerMode=false,registrationInProgress=false;
$('#toggleAuth').onclick=()=>{registerMode=!registerMode;authForm.classList.toggle('register',registerMode);$('#authTitle').textContent=registerMode?'Bắt đầu hành trình.':'Chào bạn trở lại.';$('#email').type=registerMode?'email':'text';$('#identityLabel').textContent=registerMode?'Email':'Email hoặc tên đăng nhập';$('#email').placeholder=registerMode?'you@example.com':'Email hoặc tên đăng nhập';$('#authSub').textContent=registerMode?'Tạo tài khoản để lưu tiến độ học.':'Tiếp tục hành trình học tiếng Anh của bạn.';$('#authSubmit').textContent=registerMode?'Đăng ký':'Đăng nhập';$('#toggleAuth').textContent=registerMode?'Đăng nhập':'Đăng ký'};
$('#configNote').textContent=isFirebaseConfigured()?(firebaseReady?'Đã cấu hình Firebase Realtime Database.':'Có config Firebase nhưng chưa khởi tạo được.'):'Chưa cấu hình Firebase — nút “Xem bản demo” vẫn dùng đầy đủ dữ liệu mẫu trên máy này.';
authForm.onsubmit=async e=>{e.preventDefault();if(!firebaseReady)return toast('Chưa cấu hình Firebase. Hãy dùng bản demo hoặc điền firebase-config.js.','error');const identity=$('#email').value.trim();const email=!registerMode&&!identity.includes('@')?`${identity.toLowerCase()}@${firebaseConfig.authDomain}`:identity,password=$('#password').value,name=$('#displayName').value.trim();registrationInProgress=registerMode;$('#authSubmit').disabled=true;try{if(registerMode){const cred=await fAuth.createUserWithEmailAndPassword(auth,email,password);if(name)await fAuth.updateProfile(cred.user,{displayName:name});await store.ensureUserProfile(cred.user,name);toast('Đăng ký thành công.','success');await handleAuthenticatedUser(cred.user)}else await fAuth.signInWithEmailAndPassword(auth,email,password)}catch(err){toast(authError(err.code),'error')}finally{registrationInProgress=false;$('#authSubmit').disabled=false}};
$('#googleLogin').onclick=async()=>{if(!firebaseReady)return toast('Chưa cấu hình Firebase.','error');try{await fAuth.signInWithPopup(auth,new fAuth.GoogleAuthProvider())}catch(err){toast(authError(err.code),'error')}};
$('#demoBtn').onclick=()=>bootstrapUser(DEMO_USER).catch(err=>toast(err.message,'error'));
$('#logoutBtn').onclick=async()=>{saved.remove('ayk_demo_session');saved.remove('ayk_resume_'+state.user.uid);stopTest();stopSolo();if(firebaseReady&&!state.user?.isDemo)await fAuth.signOut(auth);store.setStoreUser(null);state.game=null;state.user=null;state.profile=null;state.view='dashboard';document.body.classList.remove('admin-mode');$('#passwordSetup').classList.add('hidden');appEl.classList.add('hidden');loginScreen.classList.remove('hidden')};
function authError(code=''){return ({'auth/invalid-credential':'Sai email hoặc mật khẩu.','auth/email-already-in-use':'Email đã được sử dụng.','auth/weak-password':'Mật khẩu cần ít nhất 6 ký tự.','auth/requires-recent-login':'Hãy đăng nhập Google lại rồi đặt mật khẩu.','auth/provider-already-linked':'Tài khoản đã có mật khẩu. Hãy đăng nhập lại.','auth/credential-already-in-use':'Email đã có tài khoản mật khẩu. Hãy đăng nhập bằng email để tiếp tục.','auth/popup-closed-by-user':'Bạn đã đóng cửa sổ Google.'}[code]||`Lỗi đăng nhập: ${code}`)}
let pendingGoogleUser=null;
function needsPassword(user){return user.providerData.some(p=>p.providerId==='google.com')&&!user.providerData.some(p=>p.providerId==='password')}
async function handleAuthenticatedUser(user){
  if(needsPassword(user)){
    finishLoading();pendingGoogleUser=user;loginScreen.classList.add('hidden');appEl.classList.add('hidden');$('#passwordSetup').classList.remove('hidden');
    $('#setupIdentity').textContent=`Chào ${user.displayName||'bạn'}. Đặt mật khẩu cho ${user.email} để hoàn tất tài khoản.`;
    $('#setupPassword').focus();return;
  }
  pendingGoogleUser=null;await bootstrapUser(user);
}
$('#passwordSetupForm').onsubmit=async e=>{
  e.preventDefault();const password=$('#setupPassword').value;
  if(password!==$('#setupConfirm').value)return toast('Hai mật khẩu chưa trùng nhau.','error');
  const user=pendingGoogleUser||auth?.currentUser;if(!user?.email)return toast('Phiên đăng nhập đã hết. Hãy đăng nhập lại.','error');
  $('#setupSubmit').disabled=true;$('#setupSubmit').textContent='Đang hoàn tất…';
  try{
    if(!user.providerData.some(p=>p.providerId==='password'))await fAuth.linkWithCredential(user,fAuth.EmailAuthProvider.credential(user.email,password));
    $('#passwordSetupForm').reset();toast('Tài khoản đã sẵn sàng. Chào mừng bạn!','success');await handleAuthenticatedUser(user);
  }catch(err){toast(authError(err.code),'error')}finally{$('#setupSubmit').disabled=false;$('#setupSubmit').textContent='Hoàn tất & bắt đầu học →'}
};
$('#setupLogout').onclick=async()=>{await fAuth.signOut(auth);pendingGoogleUser=null;$('#passwordSetupForm').reset();$('#passwordSetup').classList.add('hidden');loginScreen.classList.remove('hidden')};
async function restoreSession(user){
  if(registrationInProgress)return;
  try{
    if(user)await handleAuthenticatedUser(user);
    else if(saved.get('ayk_demo_session'))await bootstrapUser(DEMO_USER);
    else if(!state.user?.isDemo){pendingGoogleUser=null;$('#passwordSetup').classList.add('hidden');showLogin()}
  }catch(err){console.error(err);finishLoading();$('#authLoading').classList.remove('hidden');$('#loadingMessage').textContent='Chưa tải được dữ liệu. Phiên đăng nhập vẫn được giữ; thử tải lại trang.';$('#loadingRetry').classList.remove('hidden')}
}
$('#loadingRetry').onclick=()=>window.location.reload();
if(firebaseReady)fAuth.onAuthStateChanged(auth,restoreSession,()=>{showLogin();toast('Không khôi phục được phiên đăng nhập. Hãy thử lại.','error')});
else restoreSession(null);

function startLearningGame(type){
 let words=shuffle(wordsOfSession());if(type==='match')words=[...new Map(words.map(w=>[w.meaning,w])).values()];
 if(words.length<(['match','listening'].includes(type)?2:1))return toast('Buổi này chưa đủ từ. Hãy chọn buổi khác.','error');
 words=words.slice(0,type==='match'?6:10);
 state.game={type,words,index:0,correct:0,attempts:0,answered:false,selected:[],matched:[],busy:false,done:false};
 if(type==='match')state.game.cards=shuffle(words.flatMap(w=>[{id:`${w.id}-word`,wordId:w.id,text:w.word},{id:`${w.id}-meaning`,wordId:w.id,text:w.meaning}]));
 else state.game.scrambled=shuffle([...words[0].word]).join('');
 if(type==='listening')state.game.options=shuffle(words.slice(0,4));
 navigate('games');
}
function bindGameStarts(){$$('[data-game]').forEach(b=>b.onclick=()=>startLearningGame(b.dataset.game))}
async function recordGameAnswer(word,correct){
 const old=state.progress[word.id]||{};
 await store.updateWordProgress(state.user,word.id,correct?{mastered:true,lastReviewed:Date.now()}:{wrongCount:(old.wrongCount||0)+1,lastReviewed:Date.now()});
 state.progress=await store.getProgress(state.user);updateSidebarProgress();
}
function renderGames(){
 const g=state.game;
 if(!g){viewRoot.innerHTML=`${pageTitle('Chơi một chút, nhớ lâu hơn.','Chọn buổi học, rồi khám phá cách luyện bạn thích.')}<div class="toolbar"><select id="gameLesson" class="form-control" aria-label="Buổi chơi">${state.lessons.map(l=>`<option value="${l.number}" ${l.number===state.session?'selected':''}>${esc(l.name)} · ${esc(categoryName(l.categoryId))}</option>`).join('')}</select><span class="badge">${wordsOfSession().length} từ trong buổi</span></div>${gameShelf()}<div class="panel section-gap practice-shortcuts"><span>✦ Thêm một cách học</span><button class="btn secondary" data-go="review">Ôn từ khó ↗</button><button class="btn secondary" data-go="solo">Thử thách Solo ↗</button><button class="btn secondary" data-go="exercises">Trắc nghiệm nhanh ↗</button></div>`;$('#gameLesson').onchange=e=>{state.session=Number(e.target.value);saved.set('ayk_resume_'+state.user.uid,{view:'games',session:state.session});renderGames()};bindCommon();bindGameStarts();return}
 const title={match:'Ghép từ với nghĩa',spelling:'Nghe và viết từ',scramble:'Xếp chữ thành từ',listening:'Tai nghe tinh tường',missing:'Chữ nào còn thiếu?'}[g.type];
 if(g.done){viewRoot.innerHTML=`${pageTitle('Một bước tiến mới!',esc(lessonName(state.session)))}<div class="panel quiz-card score-box"><span class="game-symbol">✦</span><h2>${esc(title)}</h2><div class="score-number">${g.correct}/${g.words.length}</div><p class="muted">${g.type==='match'?'Cặp thẻ đã ghép':'Từ viết đúng'} · ${g.attempts} lượt trả lời</p><div class="flex gap-8" style="justify-content:center"><button class="btn primary" id="gameAgain">Chơi lại</button><button class="btn ghost" id="gameBack">Chọn trò khác</button></div></div>`;$('#gameAgain').onclick=()=>startLearningGame(g.type);$('#gameBack').onclick=()=>{state.game=null;renderGames()};return}
 if(g.type==='match'){
 viewRoot.innerHTML=`${pageTitle(title,`${esc(lessonName(state.session))} · ${g.correct}/${g.words.length} cặp`, '<button class="btn ghost" id="gameBack">Chọn trò khác</button>')}<div class="panel quiz-card"><p class="muted">Chọn một từ và nghĩa tương ứng. Bạn có thể thử lại, không giới hạn thời gian.</p><div class="match-grid">${g.cards.map(c=>`<button class="match-card ${g.selected.includes(c.id)?'selected':''} ${g.matched.includes(c.wordId)?'matched':''}" data-match="${esc(c.id)}" ${g.busy||g.matched.includes(c.wordId)?'disabled':''}>${esc(c.text)}${g.matched.includes(c.wordId)?' ✓':''}</button>`).join('')}</div><p class="game-feedback" aria-live="polite">${esc(g.feedback||'Sẵn sàng? Tìm cặp đầu tiên nhé.')}</p></div>`;
 $$('[data-match]').forEach(b=>b.onclick=async()=>{if(g.busy||g.selected.includes(b.dataset.match))return;g.selected.push(b.dataset.match);if(g.selected.length<2){renderGames();return}g.busy=true;g.attempts++;const [a,c]=g.selected.map(id=>g.cards.find(x=>x.id===id));const correct=a.wordId===c.wordId;try{if(correct){await recordGameAnswer(g.words.find(w=>w.id===a.wordId),true);g.matched.push(a.wordId);g.correct++;g.feedback='Đúng rồi! Bạn đã tìm được một cặp.'}else g.feedback='Chưa đúng. Hãy chọn lại hai thẻ nhé.';g.selected=[];g.done=g.correct===g.words.length}catch(err){g.selected=[];g.feedback='Chưa lưu được tiến độ: '+err.message}finally{g.busy=false;if(state.view==='games'&&state.game===g)renderGames()}});
 }else if(g.type==='listening'){
 const w=g.words[g.index];viewRoot.innerHTML=`${pageTitle(title,`${esc(lessonName(state.session))} · Từ ${g.index+1}/${g.words.length}`,'<button class="btn ghost" id="gameBack">Chọn trò khác</button>')}<div class="panel quiz-card"><button class="listen-game" id="gameListen">♫ <span>Nghe từ</span></button><p class="muted">Nghe và chọn từ tiếng Anh tương ứng.</p><div class="match-grid">${g.options.map(v=>`<button class="match-card ${g.answered&&v.id===w.id?'matched':''}" data-listen-choice="${esc(v.id)}" ${g.answered||g.busy?'disabled':''}>${esc(v.word)}</button>`).join('')}</div>${g.answered?`<p class="game-feedback">${g.lastCorrect?'Đúng rồi!':'Đáp án:'} ${esc(w.word)} · ${esc(w.meaning)}</p><button class="btn secondary" id="gameNext">Tiếp tục →</button>`:''}</div>`;
 $('#gameListen').onclick=()=>speak(w.word);
 $$('[data-listen-choice]').forEach(b=>b.onclick=async()=>{if(g.busy||g.answered)return;g.busy=true;try{const correct=b.dataset.listenChoice===w.id;await recordGameAnswer(w,correct);g.correct+=correct?1:0;g.attempts++;g.lastCorrect=correct;g.answered=true}catch(err){toast(err.message,'error')}finally{g.busy=false;if(state.game===g&&state.view==='games')renderGames()}});
 $('#gameNext')?.addEventListener('click',()=>{g.index++;g.answered=false;g.done=g.index>=g.words.length;if(!g.done){const word=g.words[g.index];g.options=shuffle([word,...shuffle(g.words.filter(v=>v.id!==word.id)).slice(0,3)])}renderGames()});
 }else{
 const w=g.words[g.index];viewRoot.innerHTML=`${pageTitle(title,`${esc(lessonName(state.session))} · Từ ${g.index+1}/${g.words.length}`,'<button class="btn ghost" id="gameBack">Chọn trò khác</button>')}<div class="panel quiz-card word-game"><span class="badge">${esc(w.meaning)}</span>${g.type==='missing'?`<div class="scrambled-word">${esc([...w.word].map((c,i)=>i===Math.floor(w.word.length/2)?'_':c).join(''))}</div><p class="muted">Viết từ đầy đủ vào ô bên dưới.</p>`:g.type==='scramble'?`<div class="scrambled-word">${esc(g.scrambled)}</div>`:'<button class="listen-game" id="gameListen">♫ <span>Nghe từ</span></button>'}<form id="wordGameForm"><label class="muted" for="gameAnswer">Từ tiếng Anh của bạn</label><input class="form-control" id="gameAnswer" required autocomplete="off" autocapitalize="none" spellcheck="false" ${g.answered?'disabled':''}><button class="btn primary section-gap" ${g.answered||g.busy?'disabled':''}>Kiểm tra đáp án</button></form>${g.answered?`<p class="game-feedback" aria-live="polite">${g.lastCorrect?'Đúng rồi!':'Đáp án đúng:'} <b>${esc(w.word)}</b></p><p class="muted">${esc(w.example||'')}</p><button class="btn secondary" id="gameNext">${g.index+1===g.words.length?'Xem kết quả':'Từ tiếp theo →'}</button>`:''}</div>`;
 $('#gameListen')?.addEventListener('click',()=>speak(w.word));
 $('#wordGameForm').onsubmit=async e=>{e.preventDefault();if(g.answered||g.busy)return;g.busy=true;const answer=$('#gameAnswer').value.trim().toLowerCase();const correct=answer===w.word.trim().toLowerCase();try{await recordGameAnswer(w,correct);g.attempts++;g.correct+=correct?1:0;g.lastCorrect=correct;g.answered=true}catch(err){toast(err.message,'error')}finally{g.busy=false;if(state.view==='games'&&state.game===g)renderGames()}};
 $('#gameNext')?.addEventListener('click',()=>{g.index++;g.answered=false;g.done=g.index>=g.words.length;if(!g.done)g.scrambled=shuffle([...g.words[g.index].word]).join('');renderGames()});
 }
 $('#gameBack').onclick=()=>{state.game=null;renderGames()};
}

// PWA
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
