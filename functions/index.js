const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { parseRequest, buildLookup } = require('./lookup-core');

const credential=applicationDefault();
initializeApp({credential,databaseURL:'https://english-ayk-default-rtdb.asia-southeast1.firebasedatabase.app'});
const db=getDatabase();

async function translate(texts,source,target){
  const {access_token}=await credential.getAccessToken();
  const response=await fetch('https://translation.googleapis.com/language/translate/v2',{
    method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({q:texts,source,target,format:'text'}),signal:AbortSignal.timeout(10000)
  });
  if(!response.ok){console.error('Cloud Translation HTTP status',response.status);throw new HttpsError('failed-precondition','Google Dịch chưa sẵn sàng. Chủ web cần bật Cloud Translation và cấu hình thanh toán.');}
  const json=await response.json();
  return (json.data?.translations||[]).map(t=>t.translatedText);
}
async function fetchDictionary(word){
  const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,{signal:AbortSignal.timeout(6000)});
  return r.ok?r.json():[];
}
exports.lookupVocabulary=onCall({region:'asia-southeast1',timeoutSeconds:45,memory:'256MiB',maxInstances:1},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Bạn cần đăng nhập.');
  const user=await db.ref(`users/${request.auth.uid}`).get();
  if(!['admin','teacher'].includes(user.val()?.role))throw new HttpsError('permission-denied','Chỉ admin và giáo viên được tra từ để soạn bài.');
  let parsed;try{parsed=parseRequest(request.data)}catch(err){throw new HttpsError('invalid-argument',err.message)}
  const now=Date.now();
  const quota=await db.ref(`lookupLimits/${request.auth.uid}`).transaction(old=>{
    const current=old&&now-old.startedAt<60000?old:{startedAt:now,count:0};
    if(current.count>=10)return;
    return {...current,count:current.count+1};
  });
  if(!quota.committed)throw new HttpsError('resource-exhausted','Bạn đã tra 10 lần trong một phút. Hãy thử lại sau.');
  const cacheId=Buffer.from(`${parsed.word}:${parsed.partsOfSpeech.slice().sort().join(',')}`).toString('base64url');
  const ref=db.ref(`lookupCache/${cacheId}`);const cached=await ref.get();
  if(cached.exists()&&now-cached.val().createdAt<7*86400000)return cached.val().result;
  try{
    const result=await buildLookup(parsed,{fetchDictionary,translate});
    await ref.set({createdAt:now,result});return result;
  }catch(err){
    if(err instanceof HttpsError)throw err;
    console.error('Vocabulary lookup failed:',err.message);
    throw new HttpsError('unavailable','Chưa thể tra đầy đủ từ này. Kiểm tra kết nối hoặc thử loại từ khác.');
  }
});
