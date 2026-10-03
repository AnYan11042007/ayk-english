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

export async function saveTestResult(user,result) {
  const row=clean({...result,uid:user.uid,displayName:user.displayName||'Học viên',createdAt:Date.now()});
  if (isLocalMode(user)) { demoState.testResults.unshift(row); saveDemo(); return; }
  await fDb.set(fDb.push(fDb.ref(db,`testResults/${user.uid}`)),{...row,createdAt:fDb.serverTimestamp()});
}

export async function getTestResults(user) {
  if (isLocalMode(user)) return demoState.testResults;
  const snap=await fDb.get(fDb.ref(db,`testResults/${user.uid}`));
  return rows(snap).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
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
  const archiveRef=fDb.push(fDb.ref(db,'contentArchives'));
  await fDb.update(fDb.ref(db,''),{['contentArchives/'+archiveRef.key]:archive,vocabulary:null,categories:null,lessons:null});
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
  await fDb.update(fDb.ref(db,''),{vocabulary:toObject(archive.vocabulary,'id'),categories:toObject(archive.categories,'id'),lessons:toObject(archive.lessons,'number')});
}
export async function deleteLesson(number){
 const words=(await getVocabulary()).filter(w=>Number(w.session)===Number(number));
 if(words.length)throw new Error('Chuyển hoặc xóa các từ trong buổi trước khi xóa buổi.');
 if(isLocalMode()){demoState.lessons=(demoState.lessons||[]).filter(l=>l.number!==Number(number));saveDemo();return}
 await fDb.remove(fDb.ref(db,`lessons/${number}`));
}
export async function deleteCategory(id){
 const c=await getCurriculum();if(c.lessons.some(l=>l.categoryId===id))throw new Error('Chuyển hoặc xóa các buổi trong danh mục trước.');
 if(isLocalMode()){demoState.categories=(demoState.categories||[]).filter(c=>c.id!==id);saveDemo();return}
 await fDb.remove(fDb.ref(db,`categories/${id}`));
}
