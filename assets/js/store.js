import { emptyGacha, awardTicket, applyDraw, applySale, CHARACTERS } from './gacha-core.js?v=face-v30';
import { firebaseReady, db, fDb } from './firebase.js';
import { starterVocabulary } from './starter-data.js';

const LS = 'ayk_english_demo_v2';
let demoState;
try { demoState = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { demoState = {}; }
demoState.vocabulary ||= starterVocabulary.map(v => ({...v}));
demoState.progress ||= {};
demoState.testResults ||= [];
demoState.soloScores ||= [];
demoState.profile ||= {displayName:'Ân Yan Demo',role:'admin'};
const saveDemo = () => localStorage.setItem(LS, JSON.stringify(demoState));
let activeUser = null;
export const setStoreUser = user => { activeUser = user; };
export const isLocalMode = (user = activeUser) => !firebaseReady || !!user?.isDemo;
const sortVocab = (a,b) => (a.session-b.session)||a.word.localeCompare(b.word);
const clean = value => JSON.parse(JSON.stringify(value));
const rows = snap => Object.entries(snap.val() || {}).map(([id, value]) => ({...value,id}));

export async function ensureUserProfile(user, displayName='') {
  if (isLocalMode(user)) return demoState.profile;
  const userRef = fDb.ref(db, `users/${user.uid}`);
  const snap = await fDb.get(userRef);
  if (snap.exists()) return snap.val();
  const profile = {uid:user.uid,email:user.email||'',displayName:displayName||user.displayName||user.email?.split('@')[0]||'Học viên',role:'student',createdAt:fDb.serverTimestamp()};
  // A transaction protects a profile created by a simultaneous sign-in callback.
  const result = await fDb.runTransaction(userRef, existing => existing || profile);
  return result.snapshot.val();
}

export async function getProfile(user) {
  if (isLocalMode(user)) return demoState.profile;
  const snap = await fDb.get(fDb.ref(db, `users/${user.uid}`));
  return snap.val() || {displayName:user.displayName||'Học viên',role:'student'};
}

export async function getVocabulary() {
  if (isLocalMode()) return [...demoState.vocabulary].sort(sortVocab);
  const snap = await fDb.get(fDb.ref(db,'vocabulary'));
  return rows(snap).sort(sortVocab);
}

export async function saveVocabulary(item) {
  const payload = clean({...item, session:Number(item.session)||1, updatedAt:Date.now()});
  if (isLocalMode()) {
    payload.id ||= `v-${Date.now()}`;
    const i = demoState.vocabulary.findIndex(x=>x.id===payload.id);
    if (i >= 0) demoState.vocabulary[i] = payload; else demoState.vocabulary.push(payload);
    saveDemo(); return payload;
  }
  const itemRef = payload.id ? fDb.ref(db,`vocabulary/${payload.id}`) : fDb.push(fDb.ref(db,'vocabulary'));
  const {id,...data} = payload;
  await fDb.update(itemRef,{...data,updatedAt:fDb.serverTimestamp()});
  return {...data,id:itemRef.key};
}

export async function deleteVocabulary(id) {
  if (isLocalMode()) { demoState.vocabulary=demoState.vocabulary.filter(x=>x.id!==id); saveDemo(); return; }
  await fDb.remove(fDb.ref(db,`vocabulary/${id}`));
}

export async function importStarterVocabulary() {
  if (isLocalMode()) { demoState.vocabulary=starterVocabulary.map(v=>({...v})); saveDemo(); return starterVocabulary.length; }
  const updates = {};
  starterVocabulary.forEach(({id,...data}) => {
    for (const [field,value] of Object.entries(data)) updates[`${id}/${field}`]=value;
    updates[`${id}/updatedAt`] = fDb.serverTimestamp();
  });
  await fDb.update(fDb.ref(db,'vocabulary'), updates);
  return starterVocabulary.length;
}

export async function getProgress(user) {
  if (isLocalMode(user)) return demoState.progress;
  const snap = await fDb.get(fDb.ref(db,`progress/${user.uid}`));
  return snap.val() || {};
}

export async function updateWordProgress(user,wordId,patch) {
  if (isLocalMode(user)) {
    const next = {...demoState.progress[wordId],...patch,uid:user.uid,wordId,updatedAt:Date.now()};
    demoState.progress[wordId]=next; saveDemo(); return next;
  }
  const progressRef=fDb.ref(db,`progress/${user.uid}/${wordId}`);
  await fDb.update(progressRef,clean({...patch,uid:user.uid,wordId,updatedAt:fDb.serverTimestamp()}));
  return (await fDb.get(progressRef)).val();
}

export const TEST_HISTORY_LIMIT=3;
export let testHistoryNeedsRules=false;
export function retainedTestResults(items){
 return [...items].sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)||String(b.id||b.attemptId||'').localeCompare(String(a.id||a.attemptId||''))).slice(0,TEST_HISTORY_LIMIT);
}
export async function saveTestResult(user,result) {
 const row=clean({...result,uid:user.uid,displayName:user.displayName||'Học viên',createdAt:Date.now()});
 if(isLocalMode(user)){
  const duplicate=row.attemptId&&demoState.testResults.some(r=>r.attemptId===row.attemptId);
  demoState.testResults=retainedTestResults(duplicate?demoState.testResults:[row,...demoState.testResults]);saveDemo();return;
 }
 const historyRef=fDb.ref(db,`testResults/${user.uid}`);
 const key=row.attemptId||fDb.push(historyRef).key;
 // Save and evict together; concurrent tabs cannot leave a fourth result behind.
 try{await fDb.runTransaction(historyRef,current=>{
  const next={...(current||{})};if(!next[key])next[key]=row;
  return Object.fromEntries(retainedTestResults(Object.entries(next).map(([id,value])=>({...value,id}))).map(({id,...value})=>[id,value]));
 });testHistoryNeedsRules=false;}catch(error){
  if(!/permission[_ -]?denied/i.test(String(error.code||error.message)))throw error;
  // Keep existing saving working until the owner publishes the retention rules.
  testHistoryNeedsRules=true;
  const resultRef=fDb.ref(db,`testResults/${user.uid}/${key}`);
  if(!(await fDb.get(resultRef)).exists())await fDb.set(resultRef,row);
 }
}
export async function getTestResults(user) {
 if(isLocalMode(user))return retainedTestResults(demoState.testResults);
 const historyRef=fDb.ref(db,`testResults/${user.uid}`);
 const snap=await fDb.get(fDb.query(historyRef,fDb.orderByChild('createdAt'),fDb.limitToLast(TEST_HISTORY_LIMIT)));
 return retainedTestResults(rows(snap));
}

export async function saveSoloScore(user,score,correct,total) {
  const row={uid:user.uid,displayName:user.displayName||'Học viên',score,correct,total,createdAt:Date.now()};
  if (isLocalMode(user)) {
    demoState.soloScores.push(row); demoState.soloScores.sort((a,b)=>b.score-a.score);
    demoState.soloScores=demoState.soloScores.slice(0,30); saveDemo(); return;
  }
  await fDb.set(fDb.push(fDb.ref(db,'soloScores')),{...row,createdAt:fDb.serverTimestamp()});
}

export async function getLeaderboard() {
  if (isLocalMode()) return [...demoState.soloScores].sort((a,b)=>b.score-a.score).slice(0,10);
  const q=fDb.query(fDb.ref(db,'soloScores'),fDb.orderByChild('score'),fDb.limitToLast(10));
  return rows(await fDb.get(q)).sort((a,b)=>b.score-a.score);
}

export async function getCurriculum(){
  if(isLocalMode())return {categories:demoState.categories||[],lessons:demoState.lessons||[]};
  try{const [cats,lessons]=await Promise.all([fDb.get(fDb.ref(db,'categories')),fDb.get(fDb.ref(db,'lessons'))]);return {categories:rows(cats),lessons:rows(lessons),needsRules:false}}catch(err){if(/permission.denied/i.test(String(err.code||err.message)))return {categories:[],lessons:[],needsRules:true};throw err}
}
export async function saveCategory(item){
  const name=String(item.name||'').trim();if(!name)throw new Error('Nhập tên danh mục.');
  const row={name,description:String(item.description||'').trim(),updatedAt:Date.now()};
  if(isLocalMode()){demoState.categories||=[];const id=item.id||`cat-${Date.now()}`;const i=demoState.categories.findIndex(x=>x.id===id);const saved={...row,id};i<0?demoState.categories.push(saved):demoState.categories.splice(i,1,saved);saveDemo();return saved}
  const ref=item.id?fDb.ref(db,`categories/${item.id}`):fDb.push(fDb.ref(db,'categories'));
  await fDb.update(ref,{...row,updatedAt:fDb.serverTimestamp()});return {...row,id:ref.key};
}
export async function saveLesson(item,maxNumber=0){
  const name=String(item.name||'').trim();if(!name||!item.categoryId)throw new Error('Nhập tên buổi và chọn danh mục.');
  let number=Number(item.number)||0;
  if(!number){if(isLocalMode())number=Math.max(maxNumber,...(demoState.lessons||[]).map(x=>x.number))+1;else{const allocation=await fDb.runTransaction(fDb.ref(db,'nextSession'),value=>Math.max(Number(value)||0,maxNumber)+1);if(!allocation.committed)throw new Error('Chưa tạo được buổi. Hãy thử lại.');number=allocation.snapshot.val()}}
  const row={number,name,categoryId:item.categoryId,description:String(item.description||'').trim(),updatedAt:Date.now()};
  if(isLocalMode()){demoState.lessons||=[];const i=demoState.lessons.findIndex(x=>x.number===number);i<0?demoState.lessons.push(row):demoState.lessons.splice(i,1,row);saveDemo();return row}
  await fDb.update(fDb.ref(db,`lessons/${number}`),{...row,updatedAt:fDb.serverTimestamp()});return row;
}

// Keep removed content recoverable; an empty cloud library stays empty.
async function requireContentAdmin(){if((await getProfile(activeUser)).role!=='admin')throw new Error('Chỉ admin được dọn hoặc khôi phục toàn bộ nội dung.')}
export async function resetLearningContent(){
  await requireContentAdmin();
  const vocabulary=await getVocabulary(),curriculum=await getCurriculum();
  if(curriculum.needsRules)throw new Error('Cần cập nhật quy tắc Firebase trước khi dọn nội dung.');
  const archive={vocabulary,categories:curriculum.categories,lessons:curriculum.lessons,createdAt:Date.now(),createdBy:activeUser.uid};
  if(isLocalMode()){demoState.contentArchive=archive;demoState.vocabulary=[];demoState.categories=[];demoState.lessons=[];saveDemo();return archive}
  archive.nextSession=(await fDb.get(fDb.ref(db,'nextSession'))).val()||0;
  const archiveRef=fDb.push(fDb.ref(db,'contentArchives'));
  await fDb.update(fDb.ref(db,''),{['contentArchives/'+archiveRef.key]:archive,vocabulary:null,categories:null,lessons:null,nextSession:null});
  return archive;
}
export async function restoreLearningContent(){
  await requireContentAdmin();
  if((await getVocabulary()).length||(await getCurriculum()).lessons.length||(await getCurriculum()).categories.length)throw new Error('Chỉ khôi phục khi thư viện đang trống để tránh ghi đè nội dung mới.');
  let archive;
  if(isLocalMode())archive=demoState.contentArchive;
  else{const q=fDb.query(fDb.ref(db,'contentArchives'),fDb.orderByChild('createdAt'),fDb.limitToLast(1));archive=rows(await fDb.get(q))[0]}
  if(!archive)throw new Error('Chưa có bản lưu để khôi phục.');
  if(isLocalMode()){demoState.vocabulary=archive.vocabulary||[];demoState.categories=archive.categories||[];demoState.lessons=archive.lessons||[];saveDemo();return}
  const toObject=(items,key)=>Object.fromEntries((items||[]).map(item=>{const {id,...row}=item;return [item[key],row]}));
  await fDb.update(fDb.ref(db,''),{vocabulary:toObject(archive.vocabulary,'id'),categories:toObject(archive.categories,'id'),lessons:toObject(archive.lessons,'number'),nextSession:Math.max(archive.nextSession||0,...(archive.lessons||[]).map(l=>l.number))||null});
}
export async function deleteLesson(number){
 const words=(await getVocabulary()).filter(w=>Number(w.session)===Number(number));
 if(words.length)throw new Error('Chuyển hoặc xóa các từ trong buổi trước khi xóa buổi.');
 if(isLocalMode()){demoState.lessons=(demoState.lessons||[]).filter(l=>l.number!==Number(number));saveDemo();return}
 await fDb.remove(fDb.ref(db,`lessons/${number}`));
}
export async function deleteCategory(id){
 const c=await getCurriculum();if(c.lessons.some(l=>l.categoryId===id)||(await getVocabulary()).some(w=>(c.lessons.find(l=>l.number===Number(w.session))?.categoryId||'foundations')===id))throw new Error('Chuyển hoặc xóa các buổi trong danh mục trước.');
 if(isLocalMode()){demoState.categories=(demoState.categories||[]).filter(c=>c.id!==id);saveDemo();return}
 await fDb.remove(fDb.ref(db,`categories/${id}`));
}

// Wallet and collection share one transaction, so concurrent tabs cannot overspend.
export async function getGacha(user){
 if(isLocalMode(user))return {...emptyGacha(),...(demoState.gachaByUser?.[user.uid]||{})};
 return {...emptyGacha(),...((await fDb.get(fDb.ref(db,`users/${user.uid}/gacha`))).val()||{})};
}
async function changeGacha(user,transform){
 if(isLocalMode(user)){demoState.gachaByUser||={};const next=transform(demoState.gachaByUser[user.uid]||emptyGacha());if(!next)throw new Error('Bạn chưa có vé AYK.');demoState.gachaByUser[user.uid]=next;saveDemo();return next;}
 const walletRef=fDb.ref(db,`users/${user.uid}/gacha`);
 // RTDB may call the updater with null before loading its local transaction cache.
 // Read the wallet first; keep that snapshot for the initial cache-miss callback.
 // Server conflict retries still use the latest current value, so changes stay atomic.
 const initial=(await fDb.get(walletRef)).val();
 const tx=await fDb.runTransaction(walletRef,current=>transform(current??initial??emptyGacha()));
 if(!tx.committed)throw new Error('Bạn chưa có vé AYK hoặc thao tác không hợp lệ.');return {...emptyGacha(),...tx.snapshot.val()};
}
export async function awardGachaTicket(user,result){return changeGacha(user,g=>awardTicket(g,result));}
export async function drawGacha(user,drawId,characterId){return changeGacha(user,g=>applyDraw(g,drawId,characterId));}
export async function equipGacha(user,id){return changeGacha(user,g=>!id?{...g,equipped:''}:g.inventory?.[id]&&CHARACTERS.some(c=>c.id===id)?{...g,equipped:id}:undefined);}

export async function sellGacha(user,saleId,selection){return changeGacha(user,g=>applySale(g,saleId,selection));}
