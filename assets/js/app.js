import { renderGacha, renderInventory, stopGachaPreview, showCompanion, clearCompanion, reactCompanion } from './gacha-ui.js?v=aurora-v27';
import { studySummary, addStudyWord } from './motivation.js?v=aurora-v27';
import { animateStudyView, celebrateStudy, setupStudyEffects } from './effects.js?v=aurora-v27';
import { RAPID_MODES, createRapidGame, beginRapidQuestion, submitRapidAnswer, advanceRapidGame } from './rapid-games.js?v=aurora-v27';
import {defaultCategories, buildLessons, categoryForWord} from './curriculum.js';
import { firebaseReady, auth, fAuth } from './firebase.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import * as store from './store.js?v=aurora-v27';
import { aiLookup, searchCommonsImages, normalizeVocabularyInput, googleTranslateUrl, cambridgeDictionaryUrl } from './ai.js?v=aurora-v27';
import { POS_TYPES, vocabularyParts, vocabularyPosLabel } from './vocabulary.js?v=aurora-v27';
import { lookupPronunciationAudio, loadPronunciationElement } from './pronunciation-audio.js?v=aurora-v27';
import { LISTENING_RULES, getWordStress, pronunciationStress, listeningAnswerFields, listeningPool, createListeningAttempt, listeningClock, parseListeningAnswer, gradeListeningAttempt } from './listening-test.js?v=aurora-v27';

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const shuffle = a => [...a].sort(()=>Math.random()-.5);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const state={
  user:null,profile:null,vocab:[],progress:{},testResults:[],view:'dashboard',
  session:1,flashIndex:0,flashReveal:false,search:'',pos:'all',
  test:null,listening:null,listeningSessions:null,adminEdit:null,adminImages:[],adminSelectedImage:'',adminSearch:'',adminSession:'all',categories:[],lessons:[],category:'all',vocabSession:'all',adminCategory:'all',game:null
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
  const resume=saved.get('ayk_resume_'+user.uid);
  state.session=sessions().includes(resume?.session)?resume.session:sessions()[0]||1;
  $('#userName').textContent=userDisplayName();$('#avatar').textContent=initials(userDisplayName());
  $('#adminNav').classList.toggle('hidden',!canTeach());
  loginScreen.classList.add('hidden');appEl.classList.remove('hidden');
  const allowed=['dashboard','learn','review','vocabulary','sessions','tests','games','gacha','inventory',...(canTeach()?['admin']:[])];
  state.view=['solo','exercises'].includes(resume?.view)?'games':allowed.includes(resume?.view)?resume.view:canTeach()?'admin':'dashboard';
  if(typeof URLSearchParams==='function'&&new URLSearchParams(window.location?.search||'').get('character')==='aurora')state.view='gacha';
  if(user.isDemo)saved.set('ayk_demo_session',true);else saved.remove('ayk_demo_session');
  finishLoading();
  document.body.classList.toggle('admin-mode',isAdmin());
  $('#passwordSetup').classList.add('hidden');
  updateSidebarProgress();navigate(state.view);
  store.getGacha(user).then(g=>{if(state.user?.uid===user.uid)showCompanion(g);}).catch(()=>{});
}

function updateSidebarProgress(){
  const p=progressPct();$('#sideProgress').style.setProperty('--p',p);$('#sideProgress span').textContent=`${p}%`;$('#sideProgressText').textContent=`${masteredCount()}/${state.vocab.length} từ đã học`;
}

async function refreshData(){
  state.vocab=await store.getVocabulary();state.progress=await store.getProgress(state.user);state.testResults=await store.getTestResults(state.user);await refreshCurriculum();updateSidebarProgress();
}

function navigate(view){
  if(['solo','exercises'].includes(view))view='games';
  if(view==='more'){ $('#sidebar').classList.add('open'); return; }
  if(view==='admin'&&!canTeach()) return toast('Bạn không có quyền Admin.','error');
  if((state.test?.active||state.listening?.active)&&view!=='tests'&&!confirm('Bài kiểm tra đang làm sẽ bị hủy. Rời trang?'))return;
  if(view!=='games'&&state.game?.rapid){stopRapidTimer();state.game=null;}
  if(view!=='tests')stopTest();
  state.view=view;saved.set('ayk_resume_'+state.user.uid,{view,session:state.session});$('#sidebar').classList.remove('open');
  $$('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  $$('#bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  renderView();window.scrollTo({top:0,behavior:'smooth'});
}

function renderView(){
  stopGachaPreview();
  const renderers={dashboard:renderDashboard,learn:renderLearn,review:renderReview,vocabulary:renderVocabulary,sessions:renderSessions,tests:renderTests,admin:renderAdmin,games:renderGames,gacha:()=>renderGacha(viewRoot,state.user,store,{toast,navigate}),inventory:()=>renderInventory(viewRoot,state.user,store,{toast,navigate})};
  (renderers[state.view]||renderDashboard)();
}

function pageTitle(title,sub,actions=''){return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${actions}</div>`}
function studyHistory(){return saved.get('ayk_study_'+state.user?.uid)||{days:{}}}
function noteStudyWord(word){
 if(!word?.id||!state.user)return;
 const before=studySummary(studyHistory()),result=addStudyWord(studyHistory(),word.id);saved.set('ayk_study_'+state.user.uid,result.history);
 const after=studySummary(result.history);
 if(result.added){if(after.count===5){celebrateStudy();toast('🎉 Hoàn thành mục tiêu 5 từ hôm nay!','success')}else if(after.count<5)toast(`✨ Thêm một từ nhớ chắc! ${after.count}/5 từ hôm nay.`,'success')}
 if(before.count===0&&after.count===1)$('#userName').textContent=userDisplayName();
}
function inspirationPanel(){
 const daily=studySummary(studyHistory()),pool=wordsOfSession(),word=pool.find(w=>!state.progress[w.id]?.mastered)||pool[0];
 const milestones=[['🌱','Bước đầu tiên',masteredCount()>=1],['🎯','5 từ đã thuộc',masteredCount()>=5],['🔥','3 ngày liên tiếp',daily.streak>=3],['🏆','Mục tiêu hôm nay',daily.count>=5]];
 return `<div class="inspiration-grid"><section class="daily-mission panel"><div class="mission-heading"><span class="eyebrow">YOUR DAILY SPARK</span><span class="streak-chip">🔥 ${daily.streak} ngày liên tiếp</span></div><h2>${daily.count>=5?'Hôm nay bạn làm rất tốt!':'5 từ nhớ chắc. Một bước tiến thật.'}</h2><p>${daily.count>=5?'Mục tiêu đã hoàn thành. Chơi một lượt để củng cố trí nhớ nhé.':'Học flashcard hoặc trả lời đúng trong trò chơi để thắp sáng mục tiêu hôm nay.'}</p><div class="daily-dots" aria-label="${daily.count} trên 5 từ hôm nay">${Array.from({length:5},(_,i)=>`<span class="${i<daily.count?'lit':''}">${i<daily.count?'✓':'✦'}</span>`).join('')}<b>${Math.min(daily.count,5)}/5 từ</b></div><div class="mission-meter" role="progressbar" aria-label="Mục tiêu hôm nay" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${Math.min(5,daily.count)}"><i style="width:${daily.percent}%"></i></div><div class="mission-bottom"><button class="btn primary" data-go="${daily.count>=5?'games':'learn'}">${daily.count>=5?'Chơi để nhớ lâu →':'Thắp sáng mục tiêu →'}</button><small>Tiến độ hằng ngày lưu trên trình duyệt này.</small></div></section><section class="discovery-card panel"><div class="discovery-top"><span>✦ MỘT TỪ, MỘT KHỞI ĐẦU</span><span class="discovery-orbit" aria-hidden="true">Aa</span></div>${word?`<h2>${esc(word.word)}</h2><div class="ipa">${esc(word.ipa||'')}</div><p>${esc(word.meaning)}</p><div class="discovery-actions"><button class="btn ghost" data-speak="${esc(word.word)}">🔊 Nghe từ</button><button class="btn secondary" id="discoverWord" data-word="${esc(word.id)}">Khám phá →</button></div>`:'<h2>Sẵn sàng khám phá?</h2><p>Chọn buổi đã có từ vựng để bắt đầu hành trình.</p><button class="btn secondary" data-go="sessions">Chọn buổi học →</button>'}</section></div><section class="achievement-strip"><div><span class="eyebrow">LITTLE WINS MATTER</span><h3>Từng bước nhỏ đều đáng tự hào</h3></div><div class="achievement-badges">${milestones.map(([icon,title,unlocked])=>`<div class="achievement ${unlocked?'unlocked':''}" title="${unlocked?'Đã đạt':'Chưa đạt'}"><span>${icon}</span><small>${title}</small><b>${unlocked?'✓':'○'}</b></div>`).join('')}</div></section>`;
}
function featureCards(){
  const fs=[['learn','📘','Học','Flashcard từ vựng'],['games','🎮','Trò chơi','11 cách luyện từ'],['review','↻','Ôn bài','Xem lại từ khó'],['vocabulary','Aa','Từ vựng','Tra và lọc từ'],['sessions','▦','Theo buổi','Học theo lịch'],['tests','▤','Kiểm tra','Đánh giá năng lực'],['gacha','🥚','Gacha','Nhận người bạn 3D']];
  return `<div class="feature-grid">${fs.map(x=>`<button class="feature-card" data-go="${x[0]}"><div class="fi">${x[1]}</div><b>${x[2]}</b><small>${x[3]}</small></button>`).join('')}</div>`;
}

function renderDashboard(){
  const p=progressPct(), today=wordsOfSession(state.session).slice(0,4), latest=state.testResults[0];
  viewRoot.innerHTML=`
    <div class="welcome-grid"><section class="hero"><div class="hero-energy" aria-hidden="true"><span class="energy-ring"></span><span class="energy-ring"></span><i>✦</i><i>✧</i><i>✦</i><i>✧</i><b>LEARN</b><b>PLAY</b><b>LEVEL UP</b></div><div class="hero-copy"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>Mỗi ngày một chút.<br>Tiếng Anh tiến xa <span class="hero-dot">✦</span></h1><p>Chào ${esc(userDisplayName())}. Không cần giỏi ngay hôm nay. Chỉ cần tốt hơn hôm qua một từ mới.</p><button class="btn hero-cta" data-go="learn">Tiếp tục học <span>↗</span></button><div class="hero-badges"><span>✦ Học theo nhịp của bạn</span><span>📚 ${state.vocab.length} từ trong thư viện</span><span>⚡ 11 cách chơi để nhớ lâu</span></div></div><div class="hero-illustration" aria-hidden="true"><img class="hero-girl" src="./assets/images/learning-girl.webp" alt=""></div></section><aside class="panel welcome-progress"><div class="panel-title"><h3>Tiến độ của bạn</h3><button class="link-btn" data-go="vocabulary">Xem chi tiết ↗</button></div><div class="progress-ring" style="--p:${p}"><span>${p}%</span></div><div class="progress-legend"><span><i></i> Đã thuộc <b>${masteredCount()}</b></span><span><i></i> Cần ôn <b>${wrongWords().length}</b></span><span><i></i> Tổng từ <b>${state.vocab.length}</b></span></div><div class="encouragement">🏆 Mỗi từ mới là một bước tiến!</div></aside></div>
    ${inspirationPanel()}${learningJourney()}${gameShelf()}
    <div class="section-heading"><h2>Khám phá góc học tập</h2><span>Chọn cách học bạn yêu thích</span></div>${featureCards()}
    <div class="dashboard-grid">
      <div class="panel wide"><div class="panel-title"><h3>🎯 Tiến độ học tập</h3><button class="link-btn" data-go="vocabulary">Xem từ vựng →</button></div><div class="progress-flex"><div class="progress-ring" style="--p:${p}"><span>${p}%</span></div><div class="stats-row w-full"><div class="stat"><small>Từ đã thuộc</small><strong>${masteredCount()}</strong></div><div class="stat"><small>Tổng từ</small><strong>${state.vocab.length}</strong></div><div class="stat"><small>Buổi học</small><strong>${sessions().length}</strong></div><div class="stat"><small>Bài kiểm tra</small><strong>${state.testResults.length}</strong></div></div></div></div>
      <div class="panel"><div class="panel-title"><h3>⭐ Cột mốc của bạn</h3><span class="badge">3 mục</span></div><div class="task-list"><div class="task ${masteredCount()>=5?'done':''}">☑ Học ít nhất 5 từ</div><div class="task ${state.testResults.length?'done':''}">☑ Hoàn thành 1 bài kiểm tra</div><div class="task ${studySummary(studyHistory()).count>=5?'done':''}">☑ Hoàn thành mục tiêu hôm nay</div></div></div>
      <div class="panel"><div class="panel-title"><h3>📊 Kiểm tra gần nhất</h3><button class="link-btn" data-go="tests">Mở →</button></div>${latest?`<div class="score-box"><div class="score-number">${latest.score}%</div><b>${latest.correct}/${latest.total} câu đúng</b><p class="muted">${fmtDate(latest.createdAt)}</p></div>`:`<div class="empty"><div class="emoji">📝</div><p>Chưa có bài kiểm tra.</p></div>`}</div>
    </div>
    <div class="panel section-gap"><div class="panel-title"><h3>📘 Từ vựng • ${esc(lessonName(state.session))}</h3><button class="link-btn" data-go="sessions">Xem tất cả →</button></div>${sessionTabs()}<div class="vocab-grid section-gap">${today.map(vocabCard).join('')||empty('Chưa có từ vựng trong buổi này.')}</div></div>`;
  bindCommon();bindGameStarts();bindJourney();bindVocabCards();bindSessionTabs(()=>renderDashboard());
  $('#discoverWord')?.addEventListener('click',e=>{state.flashIndex=Math.max(0,wordsOfSession().findIndex(w=>w.id===e.currentTarget.dataset.word));state.flashReveal=false;navigate('learn')});
}

function gameShelf(){
 const cards=[['match','▦','Ghép thẻ','Tìm từ và nghĩa tương ứng','mint'],['spelling','♫','Nghe & viết','Nghe phát âm, luyện chính tả','peach'],['scramble','Aa','Xếp chữ','Giải mã chữ cái thành từ','purple'],['listening','◉','Tai nghe tinh tường','Nghe rồi chọn đúng từ','blue'],['missing','A_','Chữ nào còn thiếu?','Điền chữ để hoàn thành từ','yellow'],...RAPID_MODES];
 return `<div class="section-heading"><h2>Chơi để nhớ lâu hơn</h2><span>11 trò chơi · từ vựng của buổi đang chọn</span></div><div class="play-shelf">${cards.map(([id,icon,title,sub,color])=>`<button class="play-card ${color}" data-game="${id}"><span class="play-art" aria-hidden="true">${icon}<i>✦</i></span><strong>${title}</strong><small>${sub}</small><span class="play-arrow">Chơi ngay ↗</span></button>`).join('')}</div>`;
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
  openModal(`<h2>${esc(v.word)} <span class="pos">${esc(vocabularyPosLabel(v))}</span></h2><p class="ipa">${esc(v.ipa||'')}</p>${v.imageUrl?`<img src="${esc(v.imageUrl)}" style="width:100%;height:220px;object-fit:cover;border-radius:16px" alt="">`:''}${v.imageSource?`<p class="muted"><a href="${esc(v.imageSource)}" target="_blank" rel="noopener noreferrer">Nguồn ảnh Wikimedia · ${esc(v.imageLicense||'Xem giấy phép')}</a></p>`:''}${v.dictionarySource?`<p class="muted"><a href="${esc(v.dictionarySource)}" target="_blank" rel="noopener noreferrer">Nguồn từ điển · ${v.dictionarySource.includes('wiktionary.org')?'Wiktionary (CC BY-SA)':'Free Dictionary'}</a></p>`:''}<h3>${esc(v.meaning)}</h3><p>${esc(v.example||'')}</p><p class="muted">Sai: ${p.wrongCount||0} lần • ${p.mastered?'Đã thuộc':'Đang học'}</p><div class="modal-actions"><button class="btn secondary" id="modalSpeak">🔊 Phát âm</button><button class="btn ghost" data-close>Đóng</button></div>`);$('#modalSpeak').onclick=()=>speak(v.word);bindModalClose();
}

function renderLearn(){
  const words=wordsOfSession();if(!words.length){viewRoot.innerHTML=pageTitle('Học','Flashcard theo từng buổi')+empty('Buổi này chưa có từ vựng.');return}
  state.flashIndex=clamp(state.flashIndex,0,words.length-1);const v=words[state.flashIndex],pr=state.progress[v.id]||{};
  viewRoot.innerHTML=`${pageTitle('Học từ vựng','Flashcard: nhìn từ → đoán nghĩa → tự đánh giá')}${sessionTabs()}<div class="flash-wrap"><div class="flash-card">${v.imageUrl?`<img class="flash-image" src="${esc(v.imageUrl)}" alt="">`:`<div style="font-size:68px">${v.emoji||'📝'}</div>`}<div><span class="pos">${esc(vocabularyPosLabel(v))}</span><div class="big-word">${esc(v.word)}</div><div class="ipa">${esc(v.ipa||'')} <button class="link-btn" id="flashSpeak">🔊</button></div></div>${state.flashReveal?`<div class="flash-answer"><h2>${esc(v.meaning)}</h2><p>${esc(v.example||'')}</p></div>`:`<button class="btn primary" id="revealBtn">Hiện đáp án</button>`}</div><div class="flash-nav"><button class="btn ghost" id="prevFlash">← Trước</button>${state.flashReveal?`<button class="btn danger" id="dontKnow">Chưa nhớ</button><button class="btn success" id="knowWord">Đã nhớ ✓</button>`:''}<button class="btn ghost" id="nextFlash">Sau →</button></div><p class="text-right muted">${state.flashIndex+1}/${words.length} • ${pr.mastered?'Đã thuộc':'Đang học'}</p></div>`;
  bindSessionTabs(()=>renderLearn());$('#flashSpeak').onclick=()=>speak(v.word);$('#revealBtn')?.addEventListener('click',()=>{state.flashReveal=true;renderLearn()});
  $('#prevFlash').onclick=()=>{state.flashIndex=(state.flashIndex-1+words.length)%words.length;state.flashReveal=false;renderLearn()};$('#nextFlash').onclick=()=>{state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()};
  $('#knowWord')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:true,lastReviewed:Date.now()});noteStudyWord(v);state.progress=await store.getProgress(state.user);updateSidebarProgress();state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
  $('#dontKnow')?.addEventListener('click',async()=>{await store.updateWordProgress(state.user,v.id,{mastered:false,wrongCount:(pr.wrongCount||0)+1,lastReviewed:Date.now()});state.progress=await store.getProgress(state.user);state.flashIndex=(state.flashIndex+1)%words.length;state.flashReveal=false;renderLearn()});
}

function renderReview(){
  const list=wrongWords();viewRoot.innerHTML=`${pageTitle('Ôn bài','Ưu tiên từ bạn từng trả lời sai hoặc đã đánh dấu sao',`<button class="btn primary" id="reviewNow" ${list.length?'':'disabled'}>Ôn ngay</button>`)}<div class="panel"><div class="panel-title"><h3>Danh sách cần ôn</h3><span class="badge">${list.length} từ</span></div><div class="vocab-grid">${list.map(vocabCard).join('')||empty('Chưa có từ cần ôn. Hãy học và đánh dấu sao các từ quan trọng.')}</div></div>`;bindVocabCards();bindCommon();
  $('#reviewNow')?.addEventListener('click',()=>{try{stopRapidTimer();state.game=createRapidGame('rapid-type',list,15,getWordStress);navigate('games')}catch(e){toast(e.message,'error')}});
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
function startTest(count){if(state.vocab.length<4)return toast('Cần ít nhất 4 từ để tạo bài kiểm tra.','error');const qs=makeQuestions(state.vocab,Math.min(count,state.vocab.length));state.test={active:true,questions:qs,index:0,correct:0,answers:[],seconds:Math.max(120,qs.length*20)};state.test.timerId=setInterval(()=>{state.test.seconds--;const e=$('#testTimer');if(e)e.textContent=secondsText(state.test.seconds);if(state.test.seconds<=0)finishTest()},1000);renderTests()}
function secondsText(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function stopTest(){stopListeningTest();if(state.test?.timerId)clearInterval(state.test.timerId);if(state.test?.active)state.test=null}
async function finishTest(){if(!state.test?.active)return;clearInterval(state.test.timerId);const t=state.test;t.active=false;t.score=Math.round(t.correct/t.questions.length*100);await store.saveTestResult(state.user,{score:t.score,correct:t.correct,total:t.questions.length,answers:t.answers});state.testResults=await store.getTestResults(state.user);renderTests()}
function renderTests(){
  if(state.listening){renderListeningTest();return;}
  if(!state.test){viewRoot.innerHTML=`${pageTitle('Kiểm tra','Bài nghe có trọng âm hoặc bài chọn nghĩa có thời gian')}${listeningSetupHtml()}<h2 class="section-gap">Kiểm tra chọn nghĩa</h2><div class="dashboard-grid"><div class="panel"><h2>10 câu</h2><p class="muted">Bài ngắn để kiểm tra nhanh.</p><button class="btn primary" data-start-test="10">Bắt đầu</button></div><div class="panel"><h2>20 câu</h2><p class="muted">Bao quát nhiều từ hơn.</p><button class="btn primary" data-start-test="20">Bắt đầu</button></div><div class="panel"><h2>30 câu</h2><p class="muted">Thử thách dài hơn nếu đủ từ.</p><button class="btn primary" data-start-test="30">Bắt đầu</button></div></div><div class="panel section-gap"><div class="panel-title"><h3>🕘 Lịch sử kiểm tra</h3><span class="badge">3 bài mới nhất</span></div><p class="muted">Giữ 3 bài mới nhất. Khi lưu bài thứ tư, bài cũ nhất tự xóa khỏi database.</p>${store.testHistoryNeedsRules?'<p class="history-warning">Kết quả mới đã được lưu. Chủ web cần xuất bản quy tắc Firebase để bật tự xóa bài cũ.</p>':''}<div class="table-scroll"><table class="leaderboard"><thead><tr><th>Ngày</th><th>Điểm</th><th>Đúng</th></tr></thead><tbody>${state.testResults.slice(0,3).map(r=>`<tr><td>${fmtDate(r.createdAt)}</td><td><b>${r.score}%</b></td><td>${r.correct}/${r.total}</td></tr>`).join('')||`<tr><td colspan="3">Chưa có dữ liệu</td></tr>`}</tbody></table></div></div>`;$$('[data-start-test]').forEach(b=>b.onclick=()=>startTest(Number(b.dataset.startTest)));bindListeningSetup();return}
  const t=state.test;if(!t.active){viewRoot.innerHTML=`${pageTitle('Kết quả kiểm tra','Kết quả đã được lưu')}<div class="panel quiz-card score-box"><div class="score-number">${t.score}%</div><h2>${t.correct}/${t.questions.length} câu đúng</h2><p class="muted">${t.score>=80?'Rất ổn! Tiếp tục giữ nhịp học.':t.score>=60?'Khá tốt. Ôn thêm các từ sai để chắc hơn.':'Nên quay lại mục Ôn bài và luyện từ khó.'}</p><div class="flex gap-8" style="justify-content:center"><button class="btn primary" id="newTest">Làm bài mới</button><button class="btn secondary" id="reviewWrong">Ôn từ sai</button></div></div>`;$('#newTest').onclick=()=>{state.test=null;renderTests()};$('#reviewWrong').onclick=()=>{state.test=null;navigate('review')};return}
  const q=t.questions[t.index];viewRoot.innerHTML=`${pageTitle('Kiểm tra',`Câu ${t.index+1}/${t.questions.length}`,`<div class="timer">⏱ <span id="testTimer">${secondsText(t.seconds)}</span></div>`)}<div class="panel quiz-card"><div class="quiz-progress"><span style="width:${t.index/t.questions.length*100}%"></span></div><span class="badge">Chọn nghĩa đúng</span><div class="solo-word">${esc(q.word.word)}</div><div class="choice-list">${q.choices.map(c=>`<button class="choice" data-test-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;$$('[data-test-choice]').forEach(b=>b.onclick=async()=>{const correct=b.dataset.testChoice===q.word.meaning;t.answers.push({wordId:q.word.id,answer:b.dataset.testChoice,correct});if(correct){t.correct++;await store.updateWordProgress(state.user,q.word.id,{mastered:true,lastReviewed:Date.now()})}else{const p=state.progress[q.word.id]||{};await store.updateWordProgress(state.user,q.word.id,{mastered:false,wrongCount:(p.wrongCount||0)+1,lastReviewed:Date.now()})}state.progress=await store.getProgress(state.user);t.index++;if(t.index>=t.questions.length)await finishTest();else renderTests()});
}

function listeningSetupHtml(){
  const selected=state.listeningSessions||[state.session];
  const pool=listeningPool(state.vocab,selected);
  return `<section class="panel listening-setup"><div class="listening-banner listening-reward-banner"><span class="reward-headphones">🎧</span><div><span class="auth-kicker">BÀI KIỂM TRA MỚI</span><h2>Nghe · viết từ · trọng âm</h2><p>20 từ, 30 giây mỗi câu. Đạt từ 75% để hoàn thành.</p><div class="listen-ticket-reward"><span>🎟</span><b>Đạt ≥75% · Nhận 1 vé Gacha AYK</b><i>✦</i></div><p class="reward-caption">Mỗi bài đạt nhận một vé — lưu lại không nhận trùng.</p></div></div><div class="listening-rules"><span>3 lượt đọc / câu</span><span>0s · 10s · 20s</span><span>15s rà soát</span><span>Chấm trong tối đa 12s</span></div><p>Điền nhanh vào 3 ô: <b>Tiếng Anh | Trọng âm (1/2/3/...) | Tiếng Việt</b>. Có thể viết hoa hoặc thường. Ghi một nghĩa đã học, có đủ dấu tiếng Việt.</p><p class="muted">Mỗi lần nghe có 10 giây để điền. Đồng hồ vẫn chạy khi chuyển tab. Hết 30 giây sẽ tự chuyển câu. Bấm Bỏ bài & chấm ngay để kết thúc sớm.</p><fieldset class="listening-lessons"><legend>Tích chọn một hoặc nhiều buổi</legend>${state.lessons.map(l=>`<label><input type="checkbox" data-listen-session="${l.number}" ${selected.map(Number).includes(Number(l.number))?'checked':''}><div><b>${esc(l.name)}</b><small>${esc(categoryName(l.categoryId))} · ${listeningPool(state.vocab,[l.number]).length} từ đủ dữ liệu</small></div></label>`).join('')||'<p class="muted">Chưa có buổi học. Giáo viên cần thêm từ vựng trước.</p>'}</fieldset><div class="listen-ready"><span id="listenPoolCount">${pool.length}/20 từ khác nhau đủ dữ liệu</span><div class="flex gap-8"><button class="btn secondary" id="listenSoundCheck">🔊 Nghe thử</button><button class="btn primary" id="startListening" ${pool.length<20?'disabled':''}>Bắt đầu bài nghe 20 câu →</button></div></div><p class="muted">Cần ít nhất 20 từ khác nhau có nghĩa và trọng âm. Nếu thiếu, chọn thêm buổi; giáo viên có thể bổ sung hoặc chỉnh trọng âm.</p></section>`;
}
function bindListeningSetup(){
  $$('[data-listen-session]').forEach(c=>c.onchange=()=>{state.listeningSessions=$$('[data-listen-session]:checked').map(x=>Number(x.dataset.listenSession));const pool=listeningPool(state.vocab,state.listeningSessions);$('#listenPoolCount').textContent=`${pool.length}/20 từ khác nhau đủ dữ liệu`;$('#startListening').disabled=pool.length<20});
  $('#listenSoundCheck').onclick=()=>speak('Hello');
  $('#startListening').onclick=()=>startListeningTest($$('[data-listen-session]:checked').map(x=>Number(x.dataset.listenSession)));
}
function stopListeningTest(){
  const t=state.listening;if(!t)return;
  clearInterval(t.timerId);window.speechSynthesis?.cancel();t.audioElements?.forEach(a=>{a.pause();a.currentTime=0});
  if(t.active)state.listening=null;
}
function startListeningTest(selected){
  try{
    stopListeningTest();state.test=null;
    state.listening=createListeningAttempt(state.vocab,selected);state.listeningSessions=selected;
    if(!window.speechSynthesis?.getVoices().some(v=>/^en[-_]/i.test(v.lang))||typeof SpeechSynthesisUtterance==='undefined'){prepareListeningAudio(state.listening);return;}
    state.listening.timerId=setInterval(tickListeningTest,200);
    tickListeningTest();
  }catch(err){toast(err.message,'error');}
}
async function prepareListeningAudio(t){
  t.phase='audio-preparing';clearInterval(t.timerId);window.speechSynthesis?.cancel();renderListeningTest();
  t.audioElements?.forEach(a=>a.pause());const loaded=new Map();let next=0,done=0;
  try{
    const outcomes=await Promise.allSettled(Array.from({length:4},async()=>{
      while(next<t.questions.length&&state.listening===t&&t.active){const i=next++,q=t.questions[i],record=await lookupPronunciationAudio(q.word);
        const element=await loadPronunciationElement(record.url);loaded.set(i,element);q.audioSource=record.source;q.audioLicense=record.license;
        done++;if(state.listening===t){const status=$('#listenAudioLoading');if(status)status.textContent=`Đã sẵn sàng ${done}/20 bản ghi âm`;}
      }
    }));
    if(state.listening!==t||!t.active){loaded.forEach(a=>a.pause());return;}
    const failed=outcomes.find(r=>r.status==='rejected');if(failed)throw failed.reason;
    t.audioElements=t.questions.map((q,i)=>loaded.get(i));t.phase='audio-ready';renderListeningTest();
  }catch(err){if(state.listening!==t||!t.active)return;t.phase='audio-error';t.audioError='Chưa tải đủ âm thanh từ từ điển. Bài chưa tính giờ. '+err.message+' Kiểm tra mạng rồi thử lại.';t.useRecordedAudio=true;renderListeningTest();}
}
function playListeningWord(t,index,windowIndex){
  if(state.listening!==t||t.phase!=='questions')return;
  if(t.audioElements){const audio=t.audioElements[index];audio.pause();audio.currentTime=0;audio.play().catch(()=>{if(state.listening!==t||t.phase!=='questions')return;t.phase='audio-error';t.audioError='Âm thanh bị chặn hoặc chưa phát được. Bấm thử lại để nghe đủ 30 giây.';renderListeningTest();});const label=$('#listenReplay');if(label)label.textContent=`Lượt đọc ${windowIndex+1}/3`;return;}
  const utterance=new SpeechSynthesisUtterance(t.questions[index].word);utterance.lang='en-GB';utterance.rate=.85;
  const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>/^en-GB$/i.test(v.lang))||voices.find(v=>/^en[-_]/i.test(v.lang));if(voice)utterance.voice=voice;
  utterance.onerror=e=>{if(['interrupted','canceled'].includes(e.error)||state.listening!==t||t.phase!=='questions'||t.index!==index)return;t.useRecordedAudio=true;prepareListeningAudio(t);};
  window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
  const label=$('#listenReplay');if(label)label.textContent=`Lượt đọc ${windowIndex+1}/3`;
}
function tickListeningTest(){
  const t=state.listening;if(!t?.active||['audio-error','audio-preparing','audio-ready'].includes(t.phase))return;
  const clock=listeningClock(t);
  if(clock.phase==='questions'){
    if(t.index!==clock.index){
      for(let i=Math.max(0,t.index);i<clock.index;i++)t.timedOut[i]=!parseListeningAnswer(t.answers[i]);
      t.index=clock.index;t.phase='questions';renderListeningTest();
    }
    const timer=$('#listenTimer');if(timer)timer.textContent=clock.seconds+'s';
    const bar=$('#listenQuestionBar');if(bar)bar.style.width=(clock.seconds/30*100)+'%';
    const bit=1<<clock.window;
    if(!(t.spoken[t.index]&bit)){t.spoken[t.index]|=bit;playListeningWord(t,t.index,clock.window);}
    return;
  }
  if(clock.phase==='review'){
    if(t.phase!=='review'){for(let i=Math.max(0,t.index);i<20;i++)t.timedOut[i]=!parseListeningAnswer(t.answers[i]);t.phase='review';window.speechSynthesis?.cancel();t.audioElements?.forEach(a=>a.pause());renderListeningTest();}
    const timer=$('#listenReviewTimer');if(timer)timer.textContent=clock.seconds+'s';return;
  }
  completeListeningTest(t);
}
function listeningFieldsHtml(answer,prefix,reviewIndex){
  const fields=listeningAnswerFields(answer),review=reviewIndex===undefined?'':` data-listen-review="${reviewIndex}"`;
  return `<div class="listening-fields"><label for="${prefix}English">Tiếng Anh<input class="form-control" id="${prefix}English" data-listen-field="english"${review} value="${esc(fields.english)}" placeholder="Từ tiếng Anh" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120"></label><label for="${prefix}Stress">Trọng âm<input class="form-control" id="${prefix}Stress" data-listen-field="stress"${review} value="${esc(fields.stress)}" placeholder="1/2/3/..." inputmode="numeric" pattern="[1-9][0-9]?" maxlength="2" autocomplete="off"></label><label for="${prefix}Meaning">Tiếng Việt<input class="form-control" id="${prefix}Meaning" data-listen-field="meaning"${review} value="${esc(fields.meaning)}" placeholder="Nghĩa tiếng Việt" autocomplete="off" spellcheck="false" maxlength="500"></label></div>`;
}
function bindListeningExit(t){$('#listenAbandon')?.addEventListener('click',()=>completeListeningTest(t,true));}
function readListeningAnswer(t,index){
  const q=t.questions[index];
  if(t.audioElements){const a=t.audioElements[index];t.audioElements.forEach(audio=>audio.pause());a.currentTime=0;a.play().catch(()=>toast('Chưa phát được bản ghi âm.','error'));return;}
  if(!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return toast('Giọng đọc chưa sẵn sàng trên trình duyệt này.','error');
  window.speechSynthesis.cancel();const word=new SpeechSynthesisUtterance(q.word);word.lang='en-GB';word.rate=.85;
  const voices=window.speechSynthesis.getVoices(),en=voices.find(v=>v.lang==='en-GB')||voices.find(v=>/^en[-_]/i.test(v.lang));if(en)word.voice=en;
  const explanation=new SpeechSynthesisUtterance(`Trọng âm ${q.stress}. ${q.meaning}`);explanation.lang='vi-VN';const vi=voices.find(v=>/^vi[-_]/i.test(v.lang));if(vi)explanation.voice=vi;
  window.speechSynthesis.speak(word);if(vi)window.speechSynthesis.speak(explanation);
}
function renderListeningTest(){
  const t=state.listening;if(!t)return;
  const header=(title,sub,timer='')=>`${t.active?'<div class="listen-exit-bar"><button class="btn ghost" id="listenAbandon">← Bỏ bài & chấm ngay</button><span class="muted">Câu chưa làm tính là sai</span></div>':''}${pageTitle(title,sub,timer)}`;
  if(t.phase==='audio-preparing'){viewRoot.innerHTML=`${header('Chuẩn bị bài nghe','Đồng hồ chưa bắt đầu')}<section class="panel quiz-card"><h2>🎧 Đang tải âm thanh từ từ điển</h2><p id="listenAudioLoading">Chuẩn bị 20 bản ghi âm...</p><p class="muted">Chỉ tính giờ sau khi âm thanh sẵn sàng và bạn bấm bắt đầu.</p></section>`;bindListeningExit(t);return;}
  if(t.phase==='audio-ready'){viewRoot.innerHTML=`${header('Bài nghe đã sẵn sàng','20 bản ghi âm đã tải xong')}<section class="panel quiz-card"><h2>🎧 Sẵn sàng nghe và viết?</h2><p>Mỗi từ được phát 3 lần tại 0, 10, 20 giây. Hết 30 giây sẽ chuyển câu.</p><button class="btn primary" id="listenAudioBegin">Bắt đầu với âm thanh từ điển →</button></section>`;$('#listenAudioBegin').onclick=()=>{t.startedAt=Date.now()-Math.max(0,t.index)*LISTENING_RULES.questionMs;t.reviewEndsAt=t.startedAt+LISTENING_RULES.count*LISTENING_RULES.questionMs+LISTENING_RULES.reviewMs;t.spoken[Math.max(0,t.index)]=0;t.index=Math.max(0,t.index);t.phase='questions';t.timerId=setInterval(tickListeningTest,200);renderListeningTest();tickListeningTest();};bindListeningExit(t);return;}
  if(t.phase==='audio-error'){
    viewRoot.innerHTML=`${header('Kiểm tra nghe','Âm thanh chưa sẵn sàng')}<div class="panel quiz-card"><h2>🔊 Kiểm tra âm thanh</h2><p>${esc(t.audioError)}</p><button class="btn primary" id="retryListenAudio">Thử lại câu này</button></div>`;
    $('#retryListenAudio').onclick=()=>{if(t.useRecordedAudio&&!t.audioElements){prepareListeningAudio(t);return;}t.startedAt=Date.now()-Math.max(0,t.index)*LISTENING_RULES.questionMs;t.reviewEndsAt=t.startedAt+LISTENING_RULES.count*LISTENING_RULES.questionMs+LISTENING_RULES.reviewMs;t.spoken[t.index]=0;t.phase='questions';renderListeningTest();tickListeningTest();};bindListeningExit(t);return;
  }
  if(t.phase==='questions'){
    const clock=listeningClock(t);
    viewRoot.innerHTML=`${header('Kiểm tra nghe',`Câu ${t.index+1}/20 · nghe và điền 3 ô`,`<div class="timer listening-clock">⏱ <span id="listenTimer">${clock.seconds}s</span></div>`)}<section class="panel quiz-card listening-question"><div class="quiz-top"><span class="badge">${esc(lessonName(t.questions[t.index].session))}</span><span id="listenReplay">Lượt đọc ${clock.window+1}/3</span></div><div class="listen-wave" aria-hidden="true">${Array(9).fill('<i></i>').join('')}</div><h2>Nghe và điền câu trả lời</h2><div class="quiz-progress"><span id="listenQuestionBar" style="width:${clock.seconds/30*100}%"></span></div><form id="listenAnswerForm">${listeningFieldsHtml(t.answers[t.index],'listen')}<p id="listenSyntaxHint" class="muted" aria-live="polite">${parseListeningAnswer(t.answers[t.index])?'Đã điền đủ 3 ô ✓':'Dùng Tab để chuyển ô. Trọng âm chỉ điền số.'}</p></form><p class="muted">Đọc tại 0, 10, 20 giây. Hết 30 giây tự chuyển; sau câu cuối có 15 giây rà soát.</p><div class="quiz-progress"><span style="width:${t.index/20*100}%"></span></div><div class="listening-rules"><span>Đã qua ${t.index}/20 câu</span><span>3 lượt đọc × 10 giây</span></div></section>`;
    const index=t.index;$('#listenAnswerForm').onsubmit=e=>e.preventDefault();
    $$('[data-listen-field]').forEach(input=>input.oninput=e=>{if(state.listening!==t||t.phase!=='questions'||listeningClock(t).index!==index){tickListeningTest();return;}t.answers[index]={...listeningAnswerFields(t.answers[index]),[input.dataset.listenField]:e.target.value};$('#listenSyntaxHint').textContent=parseListeningAnswer(t.answers[index])?'Đã điền đủ 3 ô ✓':'Điền 3 ô; trọng âm chỉ ghi số.';});
    $('#listenEnglish').focus();bindListeningExit(t);return;
  }
  if(t.phase==='review'){
    viewRoot.innerHTML=`${header('Rà soát bài · 15 giây cuối','Sửa 3 ô trước khi bài tự khóa, chưa hiện đáp án',`<div class="timer listening-clock">⏱ <span id="listenReviewTimer">${listeningClock(t).seconds}s</span></div>`)}<section class="panel"><p>Kiểm tra chính tả, trọng âm và dấu tiếng Việt. Hết giờ sẽ chấm ngay.</p><div class="listening-review listening-review-fields">${t.answers.map((a,i)=>`<article><b>Câu ${i+1}</b>${listeningFieldsHtml(a,'review'+i,i)}</article>`).join('')}</div></section>`;
    $$('[data-listen-review]').forEach(input=>input.oninput=e=>{if(state.listening!==t||t.phase!=='review'||Date.now()>=t.reviewEndsAt){tickListeningTest();return;}const i=Number(input.dataset.listenReview);t.answers[i]={...listeningAnswerFields(t.answers[i]),[input.dataset.listenField]:e.target.value};});bindListeningExit(t);return;
  }
  if(t.phase==='grading'){viewRoot.innerHTML=`${header('Đang chấm bài','Câu trả lời đã được khóa')}<div class="panel quiz-card score-box"><h2>Đang kiểm tra 20 câu...</h2><p>Kết quả sẽ hiện trong tối đa 12 giây.</p></div>`;return;}
  const r=t.result;
  viewRoot.innerHTML=`${header('Kết quả kiểm tra nghe','Chấm tự động theo đáp án giáo viên · chỉ rõ từng ô sai')}<section class="panel quiz-card score-box"><div class="score-number">${r.score}%</div><h2>${r.correct}/20 câu đúng · ${r.passed?'ĐẠT ✓':'CẦN HỌC LẠI'}</h2>${r.endedEarly?'<span class="badge">Đã bỏ bài và chấm ngay · câu chưa làm tính là sai</span>':''}<p>${r.passed?'Bạn đã đạt mốc 75%. Tiếp tục luyện để nhớ lâu hơn.':'Chưa đạt 75%. Học lại các buổi đã chọn và luyện các từ sai.'}</p>${t.gachaAwarded?'<p class="gacha-ticket">🎟 +1 vé Gacha AYK đã vào tài khoản!</p>':''}<p id="listenSaveStatus" class="muted">${t.saveStatus==='saved'?(t.progressWarning?'Đã lưu điểm; một số tiến độ từ chưa đồng bộ.':'Đã lưu kết quả.'):t.saveStatus==='failed'?'Chưa lưu được lên tài khoản. Kết quả vẫn hiển thị ở đây.':'Đang lưu kết quả...'}</p><div class="flex gap-8" style="justify-content:center"><button class="btn primary" id="listenNewTest">Chọn buổi & làm bài mới</button><button class="btn secondary" id="listenLearnAgain">${r.passed?'Ôn từ sai':'Học lại buổi đã chọn'}</button>${t.saveStatus==='failed'?'<button class="btn secondary" id="listenSaveRetry">Thử lưu lại</button>':''}</div></section><section class="panel section-gap"><div class="panel-title"><h3>Đáp án & chỗ cần sửa</h3><span class="badge">Đúng cả 3 ô = 5%</span></div><div class="listening-result-list">${r.answers.map((a,i)=>`<article class="listening-result ${a.correct?'correct':'wrong'}"><div><b>${i+1}. ${esc(a.word)}</b><button class="btn ghost" data-listen-answer="${i}" aria-label="Nghe đáp án câu ${i+1}">🔊 Nghe đáp án</button></div><div class="listening-checks">${[['Tiếng Anh','english',a.wordCorrect],['Trọng âm','stress',a.stressCorrect],['Tiếng Việt','meaning',a.meaningCorrect]].map(([label,key,ok])=>`<div class="listening-check ${ok?'is-correct':'is-wrong'}"><small>${label} ${ok?'✓':'✗'}</small><b>${esc(a.answer[key]||'(chưa điền)')}</b>${!ok?`<span>Đúng: ${esc(key==='stress'?a.stresses.join(' / '):a.expectedFields[key])}</span>`:''}</div>`).join('')}</div><p><b>Đáp án:</b> ${esc(a.expected)}</p>${a.correct?'<p class="listen-feedback">Đúng đủ từ, trọng âm và nghĩa ✓</p>':`<ul class="listen-feedback">${a.feedback.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`}${t.questions[i].audioSource?`<p class="muted"><a href="${esc(t.questions[i].audioSource)}" target="_blank" rel="noopener noreferrer">Nguồn âm thanh ↗</a> ${esc(t.questions[i].audioLicense||'')}</p>`:''}</article>`).join('')}</div></section>`;
  $('#listenNewTest').onclick=()=>{state.listening=null;state.test=null;renderTests();};
  $('#listenLearnAgain').onclick=()=>{const selected=t.sessions;state.listening=null;state.session=selected[0]||state.session;navigate(r.passed?'review':'learn');};
  $('#listenSaveRetry')?.addEventListener('click',()=>persistListeningResult(t));
  $$('[data-listen-answer]').forEach(button=>button.onclick=()=>readListeningAnswer(t,Number(button.dataset.listenAnswer)));
}
function completeListeningTest(t,endedEarly=false){
  if(state.listening!==t||!t.active)return;
  t.endedEarly=endedEarly;t.active=false;t.phase='grading';clearInterval(t.timerId);window.speechSynthesis?.cancel();t.audioElements?.forEach(a=>a.pause());renderListeningTest();
  t.result=gradeListeningAttempt(t);t.phase='result';t.saveStatus='saving';
  state.testResults=[{...t.result,createdAt:Date.now()},...state.testResults.filter(r=>r.attemptId!==t.attemptId)];
  renderListeningTest();persistListeningResult(t);
}
async function persistListeningResult(t){
  if(t.saving||t.saveStatus==='saved')return;t.saving=true;t.saveStatus='saving';const user=state.user;
  try{
    await store.saveTestResult(user,t.result);
    if(t.result.score>=75){await store.awardGachaTicket(user,t.result);t.gachaAwarded=true;reactCompanion(true);}
    t.saveStatus='saved';
    if(!t.progressStarted){
      t.progressStarted=true;
      const progressJobs=t.result.answers.filter(a=>!t.result.endedEarly||Object.values(a.answer).some(v=>v.trim())).map(a=>{const p=state.progress[a.wordId]||{};return store.updateWordProgress(user,a.wordId,{mastered:a.correct,wrongCount:(p.wrongCount||0)+(a.correct?0:1),lastReviewed:Date.now()});});
      const progressResults=await Promise.allSettled(progressJobs);
      t.progressWarning=progressResults.some(r=>r.status==='rejected');
    }
    if(state.user?.uid===user.uid){
      const [results,progress]=await Promise.allSettled([store.getTestResults(user),store.getProgress(user)]);
      if(results.status==='fulfilled')state.testResults=results.value;
      if(progress.status==='fulfilled'){state.progress=progress.value;updateSidebarProgress();}
      else t.progressWarning=true;
    }
  }catch(err){t.saveStatus='failed';console.warn('Listening result save failed:',err.message)}
  finally{t.saving=false;if(state.listening===t&&state.view==='tests'&&t.phase==='result')renderListeningTest();}
}

function adminEditorHtml(){const e=state.adminEdit||{};return `<div class="panel admin-editor"><div class="panel-title"><h3>${e.id?'Sửa':'Thêm'} từ vựng</h3><span class="badge">Tra nghĩa & chọn ảnh</span></div><form id="adminForm" class="admin-form"><label>Từ tiếng Anh<input class="form-control" id="aWord" required value="${esc(e.word||'')}"></label><fieldset class="pos-picker"><legend>Loại từ · chọn nhiều</legend>${POS_TYPES.map(p=>`<label><input type="checkbox" name="aPos" value="${p}" ${vocabularyParts(e).includes(p)?'checked':''}> ${p}</label>`).join('')}<small id="posHint" class="muted">Tra từ để xem những loại từ có trong từ điển.</small></fieldset><label>Buổi học<select class="form-control" id="aSession" required>${state.lessons.map(l=>`<option value="${l.number}" ${l.number===Number(e.session||state.session)?'selected':''}>${esc(l.name)} · ${esc(categoryName(l.categoryId))}</option>`).join('')}</select></label><label>Chủ đề<input class="form-control" id="aTopic" value="${esc(e.topic||'')}"></label><div class="full-span flex gap-8"><button class="btn secondary" type="button" id="aiBtn">✨ Tự điền nghĩa, IPA, trọng âm & ảnh</button><a class="btn secondary" id="cambridgeBtn" href="${esc(cambridgeDictionaryUrl(e.word||''))}" target="_blank" rel="noopener noreferrer">Cambridge Anh–Việt ↗</a><a class="btn secondary" id="googleTranslateBtn" href="${esc(googleTranslateUrl(e.word||''))}" target="_blank" rel="noopener noreferrer">Google Dịch ↗</a><span id="aiStatus" class="muted" aria-live="polite"></span></div><div class="full-span muted">Mở Cambridge Anh–Việt để đối chiếu nghĩa và trọng âm. Tự điền hiện dùng từ đã duyệt + MyMemory/Wiktionary; chưa kết nối API Cambridge.</div><label>Nghĩa tiếng Việt<input class="form-control" id="aMeaning" required value="${esc(e.meaning||'')}"></label><label>IPA<input class="form-control" id="aIpa" value="${esc(e.ipa||'')}"></label><label>Trọng âm (1, 2, 3...)<input class="form-control" type="number" min="1" max="20" step="1" id="aStress" value="${esc(e.stress||'')}" placeholder="Tự nhận từ IPA nếu để trống"><small class="muted">Giáo viên kiểm tra vị trí âm tiết được nhấn trước khi dùng để thi.</small></label><label>Nghĩa khác được chấp nhận<input class="form-control" id="aAcceptedMeanings" value="${esc((Array.isArray(e.acceptedMeanings)?e.acceptedMeanings:String(e.acceptedMeanings||'').split(';')).join('; '))}" placeholder="Nghĩa 1; nghĩa 2"><small class="muted">Tách bằng dấu ;. Dùng để chấm bài nghe.</small></label><label class="full-span">Ví dụ<input class="form-control" id="aExample" value="${esc(e.example||'')}"></label><label class="full-span">URL ảnh<input class="form-control" id="aImage" value="${esc(e.imageUrl||'')}"></label><div class="full-span flex gap-8"><input class="form-control" id="imageQuery" aria-label="Từ khóa tìm ảnh" placeholder="Từ khóa ảnh cụ thể, ví dụ: school classroom"><button class="btn secondary" type="button" id="imageSearchBtn">Tìm ảnh</button><button class="btn ghost" type="button" id="clearImageBtn">Bỏ ảnh</button></div><div class="full-span" id="imageArea">${adminImageHtml()}</div><div class="full-span flex gap-8"><button class="btn primary" type="submit">${e.id?'Cập nhật':'Lưu từ vựng'}</button>${e.id?`<button class="btn ghost" type="button" id="cancelEdit">Hủy sửa</button>`:''}</div></form></div>`}
function openWordEditor(item=null){state.adminEdit=item?{...item}:null;state.adminImages=[];state.adminSelectedImage=item?.imageUrl||'';state.adminLookupWord=item?.word||'';state.adminLookupSource={dictionarySource:item?.dictionarySource||'',translationSource:item?.translationSource||'',stressVariants:item?.stressVariants||[]};state.adminImageSource=item?.imageSource||'';state.adminImageLicense=item?.imageLicense||'';if(!state.lessons.length)return toast('Tạo danh mục và buổi học trước khi thêm từ.','error');openModal('<button class="btn ghost modal-dismiss" type="button" data-close>Đóng ×</button>'+adminEditorHtml());bindModalClose();bindAdminForm();$('#aWord').focus()}
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
  const syncTranslate=()=>{$('#googleTranslateBtn').href=googleTranslateUrl($('#aWord').value);$('#cambridgeBtn').href=cambridgeDictionaryUrl($('#aWord').value)};
  let generatedWord='',generatedValues={};
  $('#aWord').addEventListener('input',()=>{syncTranslate();if(generatedWord&&normalizeVocabularyInput($('#aWord').value).word!==generatedWord){for(const [id,value]of Object.entries(generatedValues))if($('#'+id).value===value)$('#'+id).value='';generatedValues={};generatedWord='';$('#aiStatus').textContent='Tra lại để cập nhật nghĩa và ví dụ cho từ mới.';}});syncTranslate();
  const selectedParts=()=>$$('[name="aPos"]:checked').map(e=>e.value);
  const applyParts=parts=>$$('[name="aPos"]').forEach(e=>e.checked=parts.includes(e.value));
  $('#aiBtn').onclick=async()=>{
    const parsed=normalizeVocabularyInput($('#aWord').value,selectedParts());
    if(!parsed.word)return toast('Nhập từ tiếng Anh trước.','error');
    const lookupForm=$('#adminForm'),lookupButton=$('#aiBtn'),saveButton=lookupForm.querySelector('button[type="submit"]');lookupButton.disabled=true;saveButton.disabled=true;$('#aiStatus').textContent='Đang tra nghĩa, loại từ, IPA và trọng âm...';
    try{
      const r=await aiLookup(parsed.word,parsed.partsOfSpeech);
      if(!lookupForm.isConnected||normalizeVocabularyInput($('#aWord').value).word!==parsed.word)return;
      state.adminLookupWord=parsed.word;state.adminLookupSource={dictionarySource:r.dictionarySource||'',translationSource:r.translationSource||'',stressVariants:r.stressVariants||[]};
      $('#aWord').value=parsed.word;applyParts(r.partsOfSpeech||[r.pos]);syncTranslate();
      $('#posHint').textContent='Có trong từ điển: '+(r.availablePartsOfSpeech||r.partsOfSpeech||[r.pos]).join(' / ')+'. Chọn các loại từ bạn muốn học.';
      if(r.meaning)$('#aMeaning').value=r.meaning;$('#aStress').value=r.stress||getWordStress({word:r.word,ipa:r.ipa})||'';if(r.source!=='local-dictionary'){$('#aIpa').value=r.ipa||'';$('#aExample').value=r.example||''}else{if(r.ipa)$('#aIpa').value=r.ipa;if(r.example)$('#aExample').value=r.example;}
      generatedWord=parsed.word;generatedValues={};for(const [id,key]of [['aMeaning','meaning'],['aIpa','ipa'],['aStress','stress'],['aExample','example']])if(r[key])generatedValues[id]=$('#'+id).value;
      $('#aiStatus').textContent=r.note;
      if(r.meaning&&r.imageSearchKeyword){
        $('#imageQuery').value=r.imageSearchKeyword;$('#aiStatus').textContent='Đã điền nghĩa và ví dụ. Đang tìm ảnh theo nghĩa...';
        const images=await searchCommonsImages(r.imageSearchKeyword);
        if(!lookupForm.isConnected||normalizeVocabularyInput($('#aWord').value).word!==parsed.word)return;
        state.adminImages=images;state.adminSelectedImage=$('#aImage').value;
        const match=images.find(im=>r.imageSearchKeyword.toLowerCase().split(/\s+/).filter(t=>t.length>2&&!['the','and','with','that','this','from','have','into'].includes(t)).some(t=>im.title.toLowerCase().includes(t)));
        if(match&&!$('#aImage').value){$('#aImage').value=match.url;state.adminSelectedImage=match.url;state.adminImageSource=match.source||'';state.adminImageLicense=match.license||'';generatedValues.aImage=match.url;}
        $('#imageArea').innerHTML=adminImageHtml();bindImageChoices();$('#aiStatus').textContent=r.note+(match?' Đã gắn ảnh gợi ý; bạn có thể thay hoặc bỏ.':' Chưa có ảnh phù hợp, bạn có thể tìm ảnh khác.');
      }
    }catch(err){if(lookupForm.isConnected)$('#aiStatus').textContent=err.name==='TimeoutError'?'Dịch vụ phản hồi chậm. Bấm tra lại sau.':err.message}finally{lookupButton.disabled=false;saveButton.disabled=false}
  };
  $('#imageSearchBtn').onclick=async()=>{const keyword=$('#imageQuery').value.trim();if(!keyword)return toast('Nhập từ khóa ảnh cụ thể trước.','error');$('#imageSearchBtn').disabled=true;try{state.adminImages=await searchCommonsImages(keyword);state.adminSelectedImage=$('#aImage').value;$('#imageArea').innerHTML=state.adminImages.length?adminImageHtml():'<p class="muted">Chưa tìm được ảnh. Thử từ khóa khác hoặc tự nhập URL ảnh.</p>';bindImageChoices()}finally{$('#imageSearchBtn').disabled=false}};
  $('#clearImageBtn').onclick=()=>{$('#aImage').value='';state.adminSelectedImage='';state.adminImageSource='';state.adminImageLicense='';$$('[data-img]').forEach(b=>b.classList.remove('selected'))};
  bindImageChoices();
  $('#adminForm').onsubmit=async e=>{e.preventDefault();const item={id:state.adminEdit?.id||'',...normalizeVocabularyInput($('#aWord').value,selectedParts()),session:Number($('#aSession').value),topic:$('#aTopic').value.trim(),meaning:$('#aMeaning').value.trim(),ipa:$('#aIpa').value.trim(),stress:$('#aStress').value?Number($('#aStress').value):null,acceptedMeanings:$('#aAcceptedMeanings').value.split(';').map(s=>s.trim()).filter(Boolean),example:$('#aExample').value.trim(),...(state.adminLookupWord===normalizeVocabularyInput($('#aWord').value).word?state.adminLookupSource:{dictionarySource:'',translationSource:''}),imageUrl:$('#aImage').value.trim(),imageSource:$('#aImage').value.trim()?state.adminImageSource||'':'',imageLicense:$('#aImage').value.trim()?state.adminImageLicense||'':'',emoji:'📝'};if(!state.lessons.some(l=>l.number===item.session))return toast('Tạo hoặc chọn một buổi học trước.','error');if(item.stress!==null&&(!Number.isInteger(item.stress)||item.stress<1||item.stress>20))return toast('Trọng âm phải là số từ 1 đến 20.','error');const syllables=pronunciationStress(item.ipa).syllables;if(item.stress&&syllables&&item.stress>syllables)return toast(`IPA đang có ${syllables} âm tiết, không thể nhấn âm ${item.stress}. Kiểm tra lại IPA hoặc trọng âm.`,'error');if(!item.partsOfSpeech.length)return toast('Chọn ít nhất một loại từ.','error');if(!item.word||!item.meaning)return toast('Thiếu từ hoặc nghĩa.','error');try{await store.saveVocabulary(item);modal.close();state.adminEdit=null;state.adminImages=[];state.adminSelectedImage='';await refreshData();toast('Đã lưu từ vựng.','success');renderAdmin()}catch(err){console.error(err);toast('Không lưu được: '+err.message,'error')}};
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
$('#logoutBtn').onclick=async()=>{clearCompanion();stopGachaPreview();stopRapidTimer();saved.remove('ayk_demo_session');saved.remove('ayk_resume_'+state.user.uid);stopTest();if(firebaseReady&&!state.user?.isDemo)await fAuth.signOut(auth);store.setStoreUser(null);state.game=null;state.user=null;state.profile=null;state.view='dashboard';document.body.classList.remove('admin-mode');$('#passwordSetup').classList.add('hidden');appEl.classList.add('hidden');loginScreen.classList.remove('hidden')};
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
 stopRapidTimer();
 if(type.startsWith('rapid-')){try{state.game=createRapidGame(type,wordsOfSession(),rapidSeconds,getWordStress);navigate('games')}catch(e){toast(e.message,'error')}return;}
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
 state.progress=await store.getProgress(state.user);updateSidebarProgress();if(correct)noteStudyWord(word);
}
function renderGames(){
 const g=state.game;
 if(g?.rapid){renderRapidGame(g);return}
 if(!g){viewRoot.innerHTML=`${pageTitle('Chơi một chút, nhớ lâu hơn.','Chọn buổi học, rồi khám phá cách luyện bạn thích.')}<div class="toolbar"><select id="gameLesson" class="form-control" aria-label="Buổi chơi">${state.lessons.map(l=>`<option value="${l.number}" ${l.number===state.session?'selected':''}>${esc(l.name)} · ${esc(categoryName(l.categoryId))}</option>`).join('')}</select><span class="badge">${wordsOfSession().length} từ trong buổi</span><label class="rapid-setting">Nhịp chơi nhanh <select id="rapidSeconds" class="form-control">${[5,10,15].map(n=>`<option value="${n}" ${rapidSeconds===n?'selected':''}>${n} giây / câu</option>`).join('')}</select></label></div>${gameShelf()}<div class="panel section-gap practice-shortcuts"><span>✦ Thêm một cách học</span><button class="btn secondary" data-go="review">Ôn từ khó ↗</button></div>`;$('#gameLesson').onchange=e=>{state.session=Number(e.target.value);saved.set('ayk_resume_'+state.user.uid,{view:'games',session:state.session});renderGames()};$('#rapidSeconds').onchange=e=>{rapidSeconds=Number(e.target.value)};bindCommon();bindGameStarts();return}
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


let rapidTimer=null,rapidAutoTimer=null,rapidSeconds=5;
function stopRapidTimer(){clearInterval(rapidTimer);clearTimeout(rapidAutoTimer);rapidTimer=null;rapidAutoTimer=null;}
function rapidExit(){stopRapidTimer();state.game=null;renderGames();}
function rapidTick(g){
 if(state.game!==g||state.view!=='games'||g.answered||g.done){stopRapidTimer();return}
 const remaining=Math.max(0,g.deadline-Date.now());
 const clock=$('#rapidClock'),bar=$('#rapidBar');
 if(clock){clock.textContent=(remaining/1000).toFixed(1)+'s';clock.classList.toggle('urgent',remaining<=2000)}
 if(bar)bar.style.width=(remaining/(g.seconds*1000)*100)+'%';
 if(!remaining)answerRapid(g,$('#rapidInput')?.value||'');
}
function answerRapid(g,value){
 const result=submitRapidAnswer(g,value);if(!result)return;
 reactCompanion(result.correct);g.transitionAt=Date.now()+(result.correct?650:2400);stopRapidTimer();renderRapidGame(g);if(result.correct){noteStudyWord(result.word);if(g.combo===3||g.combo===5)celebrateStudy()}
 // Fast games save mistakes for revision. A single lucky guess does not mark a word mastered.
 if(!result.correct){const user=state.user;const old=state.progress[result.word.id]||{};const patch={wrongCount:(old.wrongCount||0)+1,lastReviewed:Date.now()};state.progress[result.word.id]={...old,...patch};updateSidebarProgress();store.updateWordProgress(user,result.word.id,patch).catch(()=>toast('Chưa lưu được từ cần ôn. Bạn vẫn có thể luyện lại ngay.','error'))}
}
function renderRapidGame(g){
 stopRapidTimer();const auto=['rapid-meaning','rapid-word','rapid-bool','rapid-lives'].includes(g.type),autoRunning=auto&&!g.autoPaused;const title=RAPID_MODES.find(m=>m[0]===g.type)[2];
 const heading=pageTitle(title,`${esc(lessonName(state.session))} · ${g.seconds} giây / câu`,'<button class="btn ghost" id="rapidExit">← Chọn trò khác</button>');
 if(!g.started){
 viewRoot.innerHTML=heading+`<section class="panel rapid-intro"><span class="rapid-hero">⚡</span><h2>Sẵn sàng tăng phản xạ?</h2><p>${g.words.length} từ được xáo trộn từ buổi bạn chọn. ${g.type==='rapid-type'?'Gõ từ tiếng Anh, không phân biệt hoa thường.':g.type==='rapid-stress'?'Chọn số âm tiết được nhấn theo trọng âm đã lưu.':'Chọn đáp án trước khi đồng hồ về 0.'}</p><div class="rapid-rules"><span>⏱ ${g.seconds}s mỗi câu</span><span>🔥 Chuỗi trả lời đúng</span><span>↻ Ôn lại câu sai</span>${g.type==='rapid-lives'?'<span>♥ 3 mạng mỗi lượt</span>':''}</div><p class="muted">${auto?'Chọn xong sẽ tự sang câu tiếp theo. Câu sai giữ đáp án lâu hơn; bạn có thể tạm dừng để xem kỹ.':'Đồng hồ dừng khi hiện đáp án. Bấm tiếp tục khi bạn đã xem xong.'}</p><button id="rapidStart" class="btn primary">Bắt đầu chơi →</button></section>`;
 $('#rapidStart').onclick=()=>{beginRapidQuestion(g);renderRapidGame(g)};
 }else if(g.done){
 const wrong=g.results.filter(r=>!r.correct),unique=[...new Map(wrong.map(r=>[r.word.id,r.word])).values()];
 viewRoot.innerHTML=heading+`<section class="panel rapid-result"><span class="rapid-hero">${g.correct/g.attempts>=.75?'🏆':'🌱'}</span><h2>${g.correct/g.attempts>=.75?'Phản xạ thật tốt!':'Thêm một lượt để nhớ chắc hơn!'}</h2><div class="score-number">${g.correct}/${g.attempts}</div><p>Đúng ${Math.round(g.correct/g.attempts*100)}% · Chuỗi tốt nhất: ${g.bestCombo} · ${unique.length} từ cần ôn</p>${g.type==='rapid-lives'&&g.lives<=0?'<p class="muted">Bạn đã hết 3 mạng. Luyện lại những từ vừa sai nhé.</p>':''}<div class="rapid-actions"><button class="btn primary" id="rapidAgain">Chơi lại</button>${unique.length?'<button class="btn secondary" id="rapidReview">↻ Luyện riêng từ sai</button>':''}</div><div class="rapid-review-list">${g.results.map(r=>`<article class="rapid-review-row ${r.correct?'correct':'incorrect'}"><strong>${r.correct?'✓':'↻'} ${esc(r.word.word)}</strong><span>${esc(r.word.meaning)}</span><small>${esc(r.word.ipa||'')} ${getWordStress(r.word)?'· Nhấn âm '+getWordStress(r.word):''}</small>${!r.correct?`<small>${r.timedOut?'Hết giờ':'Bạn chọn: '+esc(r.answer)} · Đáp án: ${esc(r.expected)}</small>`:''}<button class="btn ghost" data-speak="${esc(r.word.word)}" aria-label="Nghe ${esc(r.word.word)}">🔊</button></article>`).join('')}</div></section>`;
 $('#rapidAgain').onclick=()=>startLearningGame(g.type);
 $('#rapidReview')?.addEventListener('click',()=>{state.game=createRapidGame('rapid-type',unique,15,getWordStress);renderGames()});bindCommon();
 }else{
 const q=g.question,r=g.results.at(-1);
 viewRoot.innerHTML=heading+`<section class="panel rapid-arena"><div class="rapid-stats"><span>Câu ${g.index+1}/${g.words.length}</span><span>✓ ${g.correct} · 🔥 ${g.combo}</span>${g.type==='rapid-lives'?`<span aria-label="${g.lives} mạng còn lại">${'♥'.repeat(g.lives)}${'♡'.repeat(3-g.lives)}</span>`:''}<strong id="rapidClock">${g.answered?'Đã trả lời':g.seconds+'s'}</strong></div><div class="rapid-track"><div id="rapidBar" style="width:${g.answered?0:100}%"></div></div><p class="muted">${g.type==='rapid-word'||g.type==='rapid-type'?'Từ tiếng Anh nào có nghĩa là':g.type==='rapid-stress'?'Nhấn vào âm tiết số mấy?':g.type==='rapid-bool'?'Cặp từ và nghĩa này đúng hay sai?':'Chọn nghĩa tiếng Việt của từ'}</p><h2 class="rapid-prompt">${esc(q.prompt)}</h2>${g.type==='rapid-type'?`<form id="rapidForm"><label for="rapidInput">Từ tiếng Anh</label><input id="rapidInput" class="form-control" autocomplete="off" autocapitalize="none" spellcheck="false" ${g.answered?'disabled':''} value="${g.answered?esc(r.answer):''}"><button class="btn primary" ${g.answered?'disabled':''}>Trả lời ↵</button></form>`:`<div class="rapid-options">${q.options.map((option,i)=>`<button class="rapid-option ${g.answered&&option===q.answer?'right':''} ${g.answered&&!r.correct&&option===r.answer?'wrong':''}" data-rapid-option="${i}" ${g.answered?'disabled':''}><span>${i+1}</span>${esc(option)}</button>`).join('')}</div>`}${g.answered?`<div class="rapid-feedback ${r.correct?'correct':'incorrect'}" role="status"><strong>${r.correct?'✓ Chính xác!':r.timedOut?'⏱ Hết giờ!':'↻ Chưa đúng.'}</strong><p><b>${esc(q.word.word)}</b> — ${esc(q.word.meaning)}</p><p>${esc(q.word.ipa||'')}${getWordStress(q.word)?' · Nhấn âm '+getWordStress(q.word):''}</p>${q.word.example?`<p class="muted">${esc(q.word.example)}</p>`:''}<button class="btn ghost" data-speak="${esc(q.word.word)}">🔊 Nghe lại</button></div>${autoRunning?'<p class="auto-next-note" role="status">↗ Tự chuyển câu… <button class="link-btn" id="rapidPause">Giữ đáp án</button></p>':'<button class="btn primary" id="rapidNext">'+(g.index+1>=g.words.length||(g.type==='rapid-lives'&&g.lives<=0)?'Xem kết quả':'Câu tiếp theo →')+'</button>'}${auto&&g.autoPaused?'<button class="btn ghost" id="rapidResume">Bật tự chuyển</button>':''}`:'<p class="muted">Tập trung vào độ chính xác trước, rồi tăng tốc nhé!</p>'}</section>`;
 $$('[data-rapid-option]').forEach(b=>b.onclick=()=>answerRapid(g,q.options[Number(b.dataset.rapidOption)]));
 $('#rapidForm')?.addEventListener('submit',e=>{e.preventDefault();answerRapid(g,$('#rapidInput').value)});
 $('#rapidNext')?.addEventListener('click',()=>{advanceRapidGame(g);renderRapidGame(g)});
 $('#rapidPause')?.addEventListener('click',()=>{g.autoPaused=true;renderRapidGame(g)});
 $('#rapidResume')?.addEventListener('click',()=>{g.autoPaused=false;g.transitionAt=Date.now()+1000;renderRapidGame(g)});
 if(g.answered&&autoRunning){const index=g.index;rapidAutoTimer=setTimeout(()=>{if(state.game!==g||state.view!=='games'||g.index!==index||!g.answered||g.autoPaused)return;advanceRapidGame(g);renderRapidGame(g)},Math.max(0,(g.transitionAt||Date.now()+2400)-Date.now()))}bindCommon();
 if(!g.answered){rapidTimer=setInterval(()=>rapidTick(g),100);rapidTick(g);$('#rapidInput')?.focus()}
 }
 $('#rapidExit').onclick=rapidExit;
}

setupStudyEffects();
const motionButton=$('#motionBtn');
function syncMotionButton(){const off=document.body.classList.contains('low-motion');motionButton.textContent=off?'✦':'✨';motionButton.setAttribute?.('aria-pressed',String(!off));motionButton.title=off?'Bật hiệu ứng':'Tắt hiệu ứng';}
if(saved.get('ayk_low_motion'))document.body.classList.add('low-motion');
syncMotionButton();motionButton.onclick=()=>{document.body.classList.toggle('low-motion');saved.set('ayk_low_motion',document.body.classList.contains('low-motion'));syncMotionButton();if(document.body.classList.contains('low-motion'))document.getAnimations?.().forEach(a=>a.cancel())};
// PWA
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
