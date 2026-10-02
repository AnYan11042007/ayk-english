import { firebaseReady, auth, fAuth } from './firebase.js';
import { isFirebaseConfigured } from './firebase-config.js';
import * as store from './store.js';
import { aiLookup, searchCommonsImages } from './ai.js';

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const shuffle = a => [...a].sort(()=>Math.random()-.5);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const state={
  user:null,profile:null,vocab:[],progress:{},testResults:[],leaderboard:[],view:'dashboard',
  session:1,flashIndex:0,flashReveal:false,search:'',pos:'all',
  exercise:null,test:null,solo:null,adminEdit:null,adminImages:[],adminSelectedImage:''
};

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
function userDisplayName(){return state.profile?.displayName||state.user?.displayName||state.user?.email?.split('@')[0]||'Học viên'}
function sessions(){return [...new Set(state.vocab.map(x=>Number(x.session)||1))].sort((a,b)=>a-b)}
function wordsOfSession(s=state.session){return state.vocab.filter(x=>Number(x.session)===Number(s))}
function masteredCount(){return Object.values(state.progress).filter(x=>x.mastered).length}
function progressPct(){return state.vocab.length?Math.round(masteredCount()/state.vocab.length*100):0}
function wrongWords(){return state.vocab.filter(w=>(state.progress[w.id]?.wrongCount||0)>0 || state.progress[w.id]?.starred)}

async function bootstrapUser(user){
  state.user=user;
  state.profile=await store.ensureUserProfile(user,user.displayName||'');
  state.vocab=await store.getVocabulary();
  state.progress=await store.getProgress(user);
  state.testResults=await store.getTestResults(user);
  state.leaderboard=await store.getLeaderboard();
  state.session=sessions()[0]||1;
  $('#userName').textContent=userDisplayName();$('#avatar').textContent=initials(userDisplayName());
  $('#adminNav').classList.toggle('hidden',!isAdmin());
  loginScreen.classList.add('hidden');appEl.classList.remove('hidden');
  updateSidebarProgress();renderView();
}

function updateSidebarProgress(){
  const p=progressPct();$('#sideProgress').style.setProperty('--p',p);$('#sideProgress span').textContent=`${p}%`;$('#sideProgressText').textContent=`${masteredCount()}/${state.vocab.length} từ đã học`;
}

async function refreshData(){
  state.vocab=await store.getVocabulary();state.progress=await store.getProgress(state.user);state.testResults=await store.getTestResults(state.user);state.leaderboard=await store.getLeaderboard();updateSidebarProgress();
}

function navigate(view){
  if(view==='more'){ $('#sidebar').classList.add('open'); return; }
  if(view==='admin'&&!isAdmin()) return toast('Bạn không có quyền Admin.','error');
  if(state.test?.active&&view!=='tests'&&!confirm('Bài kiểm tra đang làm sẽ bị hủy. Rời trang?'))return;
  if(view!=='tests')stopTest(); if(view!=='solo')stopSolo();
  state.view=view;$('#sidebar').classList.remove('open');
  $$('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  $$('#bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  renderView();window.scrollTo({top:0,behavior:'smooth'});
}

function renderView(){
  const renderers={dashboard:renderDashboard,learn:renderLearn,review:renderReview,vocabulary:renderVocabulary,sessions:renderSessions,exercises:renderExercises,tests:renderTests,solo:renderSolo,admin:renderAdmin};
  (renderers[state.view]||renderDashboard)();
}

function pageTitle(title,sub,actions=''){return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${actions}</div>`}
function featureCards(){
  const fs=[['learn','📘','Học','Flashcard từ vựng'],['review','↻','Ôn bài','Xem lại từ khó'],['vocabulary','Aa','Từ vựng','Tra và lọc từ'],['sessions','▦','Theo buổi','Học theo lịch'],['exercises','✎','Làm bài tập','Luyện tập nhanh'],['tests','▤','Kiểm tra','Đánh giá năng lực'],['solo','🏆','Solo bài','Thử thách điểm']];
  return `<div class="feature-grid">${fs.map(x=>`<button class="feature-card" data-go="${x[0]}"><div class="fi">${x[1]}</div><b>${x[2]}</b><small>${x[3]}</small></button>`).join('')}</div>`;
}

function renderDashboard(){
  const p=progressPct(), today=wordsOfSession(state.session).slice(0,4), latest=state.testResults[0];
  viewRoot.innerHTML=`
    <section class="hero"><div class="hero-copy"><span class="eyebrow">AYK ENGLISH • STUDY DASHBOARD</span><h1>Chào mừng trở lại,<br>${esc(userDisplayName())}! 👋</h1><p>Mỗi ngày một ít: học từ mới, ôn từ khó và thử thách bản thân bằng bài kiểm tra ngắn.</p><div class="hero-badges"><span>🔥 Chuỗi mục tiêu: 12 ngày</span><span>📚 ${state.vocab.length} từ trong thư viện</span><span>🏆 Solo & bảng xếp hạng</span></div></div></section>
    ${featureCards()}
    <div class="dashboard-grid">
      <div class="panel wide"><div class="panel-title"><h3>🎯 Tiến độ học tập</h3><button class="link-btn" data-go="vocabulary">Xem từ vựng →</button></div><div class="progress-flex"><div class="progress-ring" style="--p:${p}"><span>${p}%</span></div><div class="stats-row w-full"><div class="stat"><small>Từ đã thuộc</small><strong>${masteredCount()}</strong></div><div class="stat"><small>Tổng từ</small><strong>${state.vocab.length}</strong></div><div class="stat"><small>Buổi học</small><strong>${sessions().length}</strong></div><div class="stat"><small>Bài kiểm tra</small><strong>${state.testResults.length}</strong></div></div></div></div>
      <div class="panel"><div class="panel-title"><h3>⭐ Nhiệm vụ hôm nay</h3><span class="badge">3 mục</span></div><div class="task-list"><div class="task ${masteredCount()>=5?'done':''}">☑ Học ít nhất 5 từ</div><div class="task ${state.testResults.length?'done':''}">☑ Hoàn thành 1 bài kiểm tra</div><div class="task ${state.leaderboard.some(x=>x.uid===state.user.uid)?'done':''}">☑ Chơi Solo 1 lần</div></div></div>
      <div class="panel"><div class="panel-title"><h3>📊 Kiểm tra gần nhất</h3><button class="link-btn" data-go="tests">Mở →</button></div>${latest?`<div class="score-box"><div class="score-number">${latest.score}%</div><b>${latest.correct}/${latest.total} câu đúng</b><p class="muted">${fmtDate(latest.createdAt)}</p></div>`:`<div class="empty"><div class="emoji">📝</div><p>Chưa có bài kiểm tra.</p></div>`}</div>
    </div>
    <div class="panel section-gap"><div class="panel-title"><h3>📘 Từ vựng • Buổi ${state.session}</h3><button class="link-btn" data-go="sessions">Xem tất cả →</button></div>${sessionTabs()}<div class="vocab-grid section-gap">${today.map(vocabCard).join('')||empty('Chưa có từ vựng trong buổi này.')}</div></div>`;
  bindCommon();bindVocabCards();bindSessionTabs(()=>renderDashboard());
}

function sessionTabs(){return `<div class="session-strip">${sessions().map(s=>`<button class="session-pill ${s===state.session?'active':''}" data-session="${s}">Buổi ${s}</button>`).join('')}</div>`}
function empty(msg){return `<div class="empty"><div class="emoji">📭</div><p>${msg}</p></div>`}
function vocabCard(v){
  const pr=state.progress[v.id]||{};return `<article class="vocab-card" data-id="${esc(v.id)}"><div class="vocab-img">${v.imageUrl?`<img src="${esc(v.imageUrl)}" alt="${esc(v.word)}" loading="lazy" referrerpolicy="no-referrer">`:`<span>${v.emoji||'📝'}</span>`}</div><div class="vocab-body"><div class="vocab-word"><h3>${esc(v.word)}</h3><span class="pos">${esc(v.pos)}</span><button class="star-btn ${pr.starred?'active':''}" data-star="${esc(v.id)}">★</button></div><div class="ipa">${esc(v.ipa||'')} <button class="link-btn" data-speak="${esc(v.word)}">🔊</button></div><div class="meaning">${esc(v.meaning)}</div><div class="card-actions"><button class="btn primary" data-practice="${esc(v.id)}">Luyện tập</button><button class="btn ghost" data-detail="${esc(v.id)}">Chi tiết</button></div></div></article>`;
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
  openModal(`<h2>${esc(v.word)} <span class="pos">${esc(v.pos)}</span></h2><p class="ipa">${esc(v.ipa||'')}</p>${v.imageUrl?`<img src="${esc(v.imageUrl)}" style="width:100%;height:220px;object-fit:cover;border-radius:16px" alt="">`:''}<h3>${esc(v.meaning)}</h3><p>${esc(v.example||'')}</p><p class="muted">Sai: ${p.wrongCount||0} lần • ${p.mastered?'Đã thuộc':'Đang học'}</p><div class="modal-actions"><button class="btn secondary" id="modalSpeak">🔊 Phát âm</button><button class="btn ghost" data-close>Đóng</button></div>`);$('#modalSpeak').onclick=()=>speak(v.word);bindModalClose();
}

function renderLearn(){
  const words=wordsOfSession();if(!words.length){viewRoot.innerHTML=pageTitle('Học','Flashcard theo từng buổi')+empty('Buổi này chưa có từ vựng.');return}
  state.flashIndex=clamp(state.flashIndex,0,words.length-1);const v=words[state.flashIndex],pr=state.progress[v.id]||{};
  viewRoot.innerHTML=`${pageTitle('Học từ vựng','Flashcard: nhìn từ → đoán nghĩa → tự đánh giá')}${sessionTabs()}<div class="flash-wrap"><div class="flash-card">${v.imageUrl?`<img class="flash-image" src="${esc(v.imageUrl)}" alt="">`:`<div style="font-size:68px">${v.emoji||'📝'}</div>`}<div><span class="pos">${esc(v.pos)}</span><div class="big-word">${esc(v.word)}</div><div class="ipa">${esc(v.ipa||'')} <button class="link-btn" id="flashSpeak">🔊</button></div></div>${state.flashReveal?`<div class="flash-answer"><h2>${esc(v.meaning)}</h2><p>${esc(v.example||'')}</p></div>`:`<button class="btn primary" id="revealBtn">Hiện đáp án</button>`}</div><div class="flash-nav"><button class="btn ghost" id="prevFlash">← Trước</button>${state.flashReveal?`<button class="btn danger" id="dontKnow">Chưa nhớ</button><button class="btn success" id="knowWord">Đã nhớ ✓</button>`:''}<button class="btn ghost" id="nextFlash">Sau →</button></div><p class="text-right muted">${state.flashIndex+1}/${words.length} • ${pr.mastered?'Đã thuộc':'Đang học'}</p></div>`;
  bindSessionTabs(()=>renderLearn());$('#flashSpeak').onclick=()=>speak(v.word);$('#revealBtn')?.addEventListener('click',()=>{state.flashReveal=true;renderLearn()});
  $('#prevFlash').onclick=()=>{state.flashIndex=(state.flashIndex-1+words.length)%words.length;state.flashReveal=false;renderLearn()};$('#nextFlash').onclick=()=>{state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()};
  $('#knowWord')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:true,lastReviewed:Date.now()});state.progress=await store.getProgress(state.user);updateSidebarProgress();state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
  $('#dontKnow')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:false,wrongCount:(pr.wrongCount||0)+1,lastReviewed:Date.now()});state.progress=await store.getProgress(state.user);state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
}

function renderReview(){
  const list=wrongWords();viewRoot.innerHTML=`${pageTitle('Ôn bài','Ưu tiên từ bạn từng trả lời sai hoặc đã đánh dấu sao',`<button class="btn primary" id="reviewNow" ${list.length?'':'disabled'}>Ôn ngay</button>`)}<div class="panel"><div class="panel-title"><h3>Danh sách cần ôn</h3><span class="badge">${list.length} từ</span></div><div class="vocab-grid">${list.map(vocabCard).join('')||empty('Chưa có từ cần ôn. Hãy học và đánh dấu sao các từ quan trọng.')}</div></div>`;bindVocabCards();bindCommon();
  $('#reviewNow')?.addEventListener('click',()=>startQuickQuiz(list,'review'));
}

function filteredVocab(){return state.vocab.filter(v=>(state.pos==='all'||v.pos===state.pos)&&(!state.search||`${v.word} ${v.meaning} ${v.topic}`.toLowerCase().includes(state.search.toLowerCase())))}
function renderVocabulary(){
  const list=filteredVocab();viewRoot.innerHTML=`${pageTitle('Từ vựng','Tìm kiếm, nghe phát âm, đánh dấu và luyện tập')}<div class="toolbar"><input class="form-control" id="vocabSearch" placeholder="Tìm từ hoặc nghĩa..." value="${esc(state.search)}"><select class="form-control" id="posFilter"><option value="all">Tất cả loại từ</option>${['n','v','adj','adv'].map(p=>`<option ${state.pos===p?'selected':''}>${p}</option>`).join('')}</select><span class="badge">${list.length} từ</span></div><div class="vocab-grid">${list.map(vocabCard).join('')||empty('Không tìm thấy từ phù hợp.')}</div>`;
  $('#vocabSearch').oninput=e=>{state.search=e.target.value;renderVocabulary()};$('#posFilter').onchange=e=>{state.pos=e.target.value;renderVocabulary()};bindVocabCards();bindCommon();
}

function renderSessions(){
  const cards=sessions().map(s=>{const ws=wordsOfSession(s),done=ws.filter(w=>state.progress[w.id]?.mastered).length,p=ws.length?Math.round(done/ws.length*100):0;return `<div class="panel"><div class="flex between center"><div><span class="badge">BUỔI ${s}</span><h2>${esc(ws[0]?.topic||'Vocabulary session')}</h2><p class="muted">${ws.length} từ • ${done} đã thuộc</p></div><div class="progress-ring small" style="--p:${p};background:conic-gradient(var(--teal) ${p}%,#dfe7f2 0)"><span>${p}%</span></div></div><div class="card-actions"><button class="btn primary" data-open-session="${s}">Học buổi ${s}</button><button class="btn ghost" data-view-session="${s}">Xem từ</button></div></div>`}).join('');
  viewRoot.innerHTML=`${pageTitle('Học theo buổi','Mỗi buổi là một nhóm từ có cùng chủ đề')}<div class="dashboard-grid">${cards}</div>`;
  $$('[data-open-session]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.openSession);state.flashIndex=0;navigate('learn')});$$('[data-view-session]').forEach(b=>b.onclick=()=>{state.session=Number(b.dataset.viewSession);state.search='';navigate('vocabulary')});
}

function makeQuestions(words,count=8){
  const base=shuffle(words).slice(0,Math.min(count,words.length));return base.map(w=>{let distract=shuffle(state.vocab.filter(x=>x.id!==w.id&&x.meaning!==w.meaning)).slice(0,3).map(x=>x.meaning);return {word:w,choices:shuffle([w.meaning,...distract])}})
}
function startQuickQuiz(words,mode='exercise'){if(words.length<2)return toast('Cần ít nhất 2 từ vựng để tạo bài.','error');state.exercise={questions:makeQuestions(words,Math.min(10,words.length)),index:0,correct:0,answered:false,selected:null,mode};navigate('exercises')}
function renderExercises(){
  if(!state.exercise){viewRoot.innerHTML=`${pageTitle('Làm bài tập','Luyện nhanh dạng chọn nghĩa đúng')}<div class="dashboard-grid"><div class="panel"><h3>🎯 Luyện tất cả từ</h3><p class="muted">10 câu ngẫu nhiên từ toàn bộ thư viện.</p><button class="btn primary" id="exAll">Bắt đầu</button></div><div class="panel"><h3>📘 Luyện theo buổi</h3><p class="muted">Chọn buổi hiện tại: Buổi ${state.session}</p>${sessionTabs()}<button class="btn primary section-gap" id="exSession">Luyện buổi ${state.session}</button></div><div class="panel"><h3>⭐ Luyện từ khó</h3><p class="muted">${wrongWords().length} từ đang cần ôn.</p><button class="btn secondary" id="exWrong">Luyện từ khó</button></div></div>`;bindSessionTabs(()=>renderExercises());$('#exAll').onclick=()=>startQuickQuiz(state.vocab);$('#exSession').onclick=()=>startQuickQuiz(wordsOfSession());$('#exWrong').onclick=()=>startQuickQuiz(wrongWords());return}
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

function renderAdmin(){
  if(!isAdmin()){navigate('dashboard');return}
  const e=state.adminEdit||{};viewRoot.innerHTML=`${pageTitle('Admin','Quản lý từ vựng và dùng AI hỗ trợ trước khi lưu',`<button class="btn secondary" id="importStarter">Nhập dữ liệu mẫu</button>`)}<div class="admin-grid"><div class="panel"><div class="panel-title"><h3>✨ ${e.id?'Sửa':'Thêm'} từ vựng</h3><span class="badge">AI + ảnh minh họa</span></div><form id="adminForm" class="admin-form"><label>Từ tiếng Anh<input class="form-control" id="aWord" required value="${esc(e.word||'')}"></label><label>Loại từ<select class="form-control" id="aPos"><option>n</option><option ${e.pos==='v'?'selected':''}>v</option><option ${e.pos==='adj'?'selected':''}>adj</option><option ${e.pos==='adv'?'selected':''}>adv</option></select></label><label>Buổi<input class="form-control" id="aSession" type="number" min="1" required value="${esc(e.session||state.session||1)}"></label><label>Chủ đề<input class="form-control" id="aTopic" value="${esc(e.topic||'')}"></label><div class="full-span flex gap-8"><button class="btn secondary" type="button" id="aiBtn">✨ AI tra nghĩa + ảnh</button><span id="aiStatus" class="muted"></span></div><label>Nghĩa tiếng Việt<input class="form-control" id="aMeaning" required value="${esc(e.meaning||'')}"></label><label>IPA<input class="form-control" id="aIpa" value="${esc(e.ipa||'')}"></label><label class="full-span">Ví dụ<input class="form-control" id="aExample" value="${esc(e.example||'')}"></label><label class="full-span">URL ảnh<input class="form-control" id="aImage" value="${esc(e.imageUrl||'')}"></label><div class="full-span" id="imageArea">${adminImageHtml()}</div><div class="full-span flex gap-8"><button class="btn primary" type="submit">${e.id?'Cập nhật':'Lưu từ vựng'}</button>${e.id?`<button class="btn ghost" type="button" id="cancelEdit">Hủy sửa</button>`:''}</div></form></div><div class="panel"><div class="panel-title"><h3>📚 Danh sách từ</h3><span class="badge">${state.vocab.length} từ</span></div><div class="table-scroll" style="max-height:690px"><table class="admin-table"><thead><tr><th>Buổi</th><th>Từ</th><th>Loại</th><th>Nghĩa</th><th></th></tr></thead><tbody>${state.vocab.map(v=>`<tr><td>${v.session}</td><td><b>${esc(v.word)}</b></td><td><span class="pos">${esc(v.pos)}</span></td><td>${esc(v.meaning)}</td><td><button class="link-btn" data-edit="${esc(v.id)}">Sửa</button> <button class="link-btn" style="color:#d33" data-delete="${esc(v.id)}">Xóa</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
  bindAdmin();
}
function adminImageHtml(){if(!state.adminImages.length)return '<p class="muted">AI sẽ gợi ý từ khóa và tìm ảnh Wikimedia Commons để bạn duyệt.</p>';return `<div><b>Chọn ảnh minh họa</b><div class="image-results">${state.adminImages.map((im,i)=>`<button type="button" class="image-option ${state.adminSelectedImage===im.url?'selected':''}" data-img="${i}" title="${esc(im.title)}"><img src="${esc(im.url)}" alt=""></button>`).join('')}</div></div>`}
function bindAdmin(){
  $('#importStarter').onclick=async()=>{if(!confirm('Nhập/cập nhật 24 từ mẫu vào Firestore?'))return;await store.importStarterVocabulary();await refreshData();toast('Đã nhập dữ liệu mẫu.','success');renderAdmin()};
  $('#cancelEdit')?.addEventListener('click',()=>{state.adminEdit=null;state.adminImages=[];state.adminSelectedImage='';renderAdmin()});
  $$('[data-edit]').forEach(b=>b.onclick=()=>{state.adminEdit={...state.vocab.find(x=>x.id===b.dataset.edit)};state.adminImages=[];state.adminSelectedImage=state.adminEdit.imageUrl||'';renderAdmin()});
  $$('[data-delete]').forEach(b=>b.onclick=async()=>{const v=state.vocab.find(x=>x.id===b.dataset.delete);if(!confirm(`Xóa từ “${v?.word}”?`))return;await store.deleteVocabulary(b.dataset.delete);await refreshData();toast('Đã xóa từ.','success');renderAdmin()});
  $('#aiBtn').onclick=async()=>{const word=$('#aWord').value.trim(),pos=$('#aPos').value;if(!word)return toast('Nhập từ tiếng Anh trước.','error');$('#aiBtn').disabled=true;$('#aiStatus').textContent='Đang tra AI...';try{const r=await aiLookup(word,pos);$('#aMeaning').value=r.meaning||'';$('#aIpa').value=r.ipa||'';$('#aExample').value=r.example||'';$('#aiStatus').textContent='Đang tìm ảnh...';state.adminImages=await searchCommonsImages(r.imageSearchKeyword||word);state.adminSelectedImage=state.adminImages[0]?.url||'';if(state.adminSelectedImage)$('#aImage').value=state.adminSelectedImage;$('#imageArea').innerHTML=adminImageHtml();bindImageChoices();$('#aiStatus').textContent=r.note||'Xong ✓'}catch(err){console.error(err);toast('Không tra AI được: '+err.message,'error');$('#aiStatus').textContent='Có lỗi'}finally{$('#aiBtn').disabled=false}};
  bindImageChoices();
  $('#adminForm').onsubmit=async e=>{e.preventDefault();const item={id:state.adminEdit?.id||'',word:$('#aWord').value.trim().toLowerCase(),pos:$('#aPos').value,session:Number($('#aSession').value),topic:$('#aTopic').value.trim(),meaning:$('#aMeaning').value.trim(),ipa:$('#aIpa').value.trim(),example:$('#aExample').value.trim(),imageUrl:$('#aImage').value.trim(),emoji:'📝'};if(!item.word||!item.meaning)return toast('Thiếu từ hoặc nghĩa.','error');try{await store.saveVocabulary(item);state.adminEdit=null;state.adminImages=[];state.adminSelectedImage='';await refreshData();toast('Đã lưu từ vựng.','success');renderAdmin()}catch(err){console.error(err);toast('Không lưu được: '+err.message,'error')}};
}
function bindImageChoices(){$$('[data-img]').forEach(b=>b.onclick=()=>{const im=state.adminImages[Number(b.dataset.img)];state.adminSelectedImage=im.url;$('#aImage').value=im.url;$$('[data-img]').forEach(x=>x.classList.toggle('selected',x===b))})}

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
let registerMode=false;
$('#toggleAuth').onclick=()=>{registerMode=!registerMode;authForm.classList.toggle('register',registerMode);$('#authTitle').textContent=registerMode?'Tạo tài khoản':'Đăng nhập';$('#authSub').textContent=registerMode?'Tạo tài khoản để lưu tiến độ học.':'Tiếp tục hành trình học tiếng Anh của bạn.';$('#authSubmit').textContent=registerMode?'Đăng ký':'Đăng nhập';$('#toggleAuth').textContent=registerMode?'Đăng nhập':'Đăng ký'};
$('#configNote').textContent=isFirebaseConfigured()?(firebaseReady?'Firebase đã kết nối.':'Có config Firebase nhưng chưa kết nối được.'):'Chưa cấu hình Firebase — nút “Xem bản demo” vẫn dùng đầy đủ dữ liệu mẫu trên máy này.';
authForm.onsubmit=async e=>{e.preventDefault();if(!firebaseReady)return toast('Chưa cấu hình Firebase. Hãy dùng bản demo hoặc điền firebase-config.js.','error');const email=$('#email').value.trim(),password=$('#password').value,name=$('#displayName').value.trim();try{if(registerMode){const cred=await fAuth.createUserWithEmailAndPassword(auth,email,password);if(name)await fAuth.updateProfile(cred.user,{displayName:name});await store.ensureUserProfile(cred.user,name);toast('Đăng ký thành công.','success')}else await fAuth.signInWithEmailAndPassword(auth,email,password)}catch(err){toast(authError(err.code),'error')}};
$('#googleLogin').onclick=async()=>{if(!firebaseReady)return toast('Chưa cấu hình Firebase.','error');try{await fAuth.signInWithPopup(auth,new fAuth.GoogleAuthProvider())}catch(err){toast(authError(err.code),'error')}};
$('#demoBtn').onclick=()=>bootstrapUser({uid:'demo-user',displayName:'Ân Yan Demo',email:'demo@ayk.local',isDemo:true});
$('#logoutBtn').onclick=async()=>{stopTest();stopSolo();if(firebaseReady&&!state.user?.isDemo)await fAuth.signOut(auth);state.user=null;state.profile=null;appEl.classList.add('hidden');loginScreen.classList.remove('hidden')};
function authError(code=''){return ({'auth/invalid-credential':'Sai email hoặc mật khẩu.','auth/email-already-in-use':'Email đã được sử dụng.','auth/weak-password':'Mật khẩu quá yếu.','auth/popup-closed-by-user':'Bạn đã đóng cửa sổ Google.'}[code]||`Lỗi đăng nhập: ${code}`)}
if(firebaseReady)fAuth.onAuthStateChanged(auth,user=>{if(user)bootstrapUser(user);else if(!state.user?.isDemo){appEl.classList.add('hidden');loginScreen.classList.remove('hidden')}});

// PWA
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
