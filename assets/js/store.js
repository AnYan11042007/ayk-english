import { firebaseReady, db, fDb } from './firebase.js';
import { starterVocabulary } from './starter-data.js';

const LS = 'ayk_english_demo_v2';
const demoState = JSON.parse(localStorage.getItem(LS) || '{}');
demoState.vocabulary ||= starterVocabulary;
demoState.progress ||= {};
demoState.testResults ||= [];
demoState.soloScores ||= [];
demoState.profile ||= {displayName:'Ân Yan Demo',role:'admin'};
const saveDemo = () => localStorage.setItem(LS, JSON.stringify(demoState));
saveDemo();

export async function ensureUserProfile(user, displayName=''){
  if (!firebaseReady || user?.isDemo) return demoState.profile;
  const ref = fDb.doc(db,'users',user.uid);
  const snap = await fDb.getDoc(ref);
  if (!snap.exists()) {
    const profile = {uid:user.uid,email:user.email||'',displayName:displayName||user.displayName||user.email?.split('@')[0]||'Học viên',role:'student',createdAt:fDb.serverTimestamp()};
    await fDb.setDoc(ref,profile);
    return profile;
  }
  return snap.data();
}

export async function getProfile(user){
  if (!firebaseReady || user?.isDemo) return demoState.profile;
  const snap = await fDb.getDoc(fDb.doc(db,'users',user.uid));
  return snap.exists()?snap.data():{displayName:user.displayName||'Học viên',role:'student'};
}

export async function getVocabulary(){
  if (!firebaseReady) return [...demoState.vocabulary].sort(sortVocab);
  const snap = await fDb.getDocs(fDb.collection(db,'vocabulary'));
  if (snap.empty) return [...starterVocabulary];
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort(sortVocab);
}
function sortVocab(a,b){return (a.session-b.session)||a.word.localeCompare(b.word)}

export async function saveVocabulary(item){
  const payload={...item,session:Number(item.session)||1,updatedAt:Date.now()};
  if (!firebaseReady) {
    const i=demoState.vocabulary.findIndex(x=>x.id===payload.id);
    if(i>=0) demoState.vocabulary[i]=payload; else {payload.id=payload.id||`v-${Date.now()}`;demoState.vocabulary.push(payload)}
    saveDemo(); return payload;
  }
  if(payload.id){const {id,...data}=payload;await fDb.setDoc(fDb.doc(db,'vocabulary',id),{...data,updatedAt:fDb.serverTimestamp()},{merge:true});return payload}
  const {id,...data}=payload;const ref=await fDb.addDoc(fDb.collection(db,'vocabulary'),{...data,createdAt:fDb.serverTimestamp(),updatedAt:fDb.serverTimestamp()});return {id:ref.id,...data};
}

export async function deleteVocabulary(id){
  if(!firebaseReady){demoState.vocabulary=demoState.vocabulary.filter(x=>x.id!==id);saveDemo();return}
  await fDb.deleteDoc(fDb.doc(db,'vocabulary',id));
}

export async function importStarterVocabulary(){
  if(!firebaseReady){demoState.vocabulary=[...starterVocabulary];saveDemo();return starterVocabulary.length}
  const batch=fDb.writeBatch(db);
  starterVocabulary.forEach(v=>{const {id,...data}=v;batch.set(fDb.doc(db,'vocabulary',id),{...data,createdAt:fDb.serverTimestamp(),updatedAt:fDb.serverTimestamp()},{merge:true})});
  await batch.commit(); return starterVocabulary.length;
}

export async function getProgress(user){
  if(!firebaseReady || user?.isDemo) return demoState.progress;
  const q=fDb.query(fDb.collection(db,'progress'),fDb.where('uid','==',user.uid));
  const snap=await fDb.getDocs(q);const out={};snap.forEach(d=>{out[d.data().wordId]=d.data()});return out;
}

export async function updateWordProgress(user,wordId,patch){
  const old=(await getProgress(user))[wordId]||{};
  const next={...old,...patch,uid:user.uid,wordId,updatedAt:Date.now()};
  if(!firebaseReady || user?.isDemo){demoState.progress[wordId]=next;saveDemo();return next}
  await fDb.setDoc(fDb.doc(db,'progress',`${user.uid}_${wordId}`),{...next,updatedAt:fDb.serverTimestamp()},{merge:true});return next;
}

export async function saveTestResult(user,result){
  const row={...result,uid:user.uid,displayName:user.displayName||'Học viên',createdAt:Date.now()};
  if(!firebaseReady || user?.isDemo){demoState.testResults.unshift(row);saveDemo();return}
  await fDb.addDoc(fDb.collection(db,'testResults'),{...row,createdAt:fDb.serverTimestamp()});
}

export async function getTestResults(user){
  if(!firebaseReady || user?.isDemo) return demoState.testResults;
  const q=fDb.query(fDb.collection(db,'testResults'),fDb.where('uid','==',user.uid));
  const snap=await fDb.getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ts(b.createdAt)-ts(a.createdAt));
}

export async function saveSoloScore(user,score,correct,total){
  const row={uid:user.uid,displayName:user.displayName||'Học viên',score,correct,total,createdAt:Date.now()};
  if(!firebaseReady || user?.isDemo){demoState.soloScores.push(row);demoState.soloScores.sort((a,b)=>b.score-a.score);demoState.soloScores=demoState.soloScores.slice(0,30);saveDemo();return}
  await fDb.addDoc(fDb.collection(db,'soloScores'),{...row,createdAt:fDb.serverTimestamp()});
}

export async function getLeaderboard(){
  if(!firebaseReady) return [...demoState.soloScores].sort((a,b)=>b.score-a.score).slice(0,10);
  const q=fDb.query(fDb.collection(db,'soloScores'),fDb.orderBy('score','desc'),fDb.limit(10));
  const snap=await fDb.getDocs(q);return snap.docs.map(d=>d.data());
}

function ts(v){return v?.toMillis?.()||v?.seconds*1000||Number(v)||0}
