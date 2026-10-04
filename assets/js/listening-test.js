export const LISTENING_RULES=Object.freeze({count:20,questionMs:15000,replayMs:5000,reviewMs:15000,gradingMs:12000,passPercent:75});
export function normalizeExamText(value){return String(value||'').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/[’‘]/g,"'").replace(/\s+/g,' ')}
export function getWordStress(word){
  const explicit=Number(word.stress);
  if(Number.isInteger(explicit)&&explicit>=1&&explicit<=20)return explicit;
  if(/\s/.test(String(word.word||'')))return null;
  const ipa=String(word.ipa||'').split(/[,;]/)[0].trim().replace(/^[/\[]|[/\]]$/g,'');
  if(!ipa)return null;
  const nuclei=s=>(s.match(/[aeiouyɑɐɒæəɛɜɝɞɪʊʌɔœøɯɨɤɶɚɘɵ]+[ːˑ̃]*/giu)||[]).length;
  const marker=ipa.indexOf('ˈ');
  if(marker>=0)return nuclei(ipa.slice(0,marker))+1;
  return nuclei(ipa)===1?1:null;
}
export function acceptedVietnameseMeanings(word){
  const meaning=String(word.meaning||'').replace(/\((?:n|v|adj|adv)\)/gi,'').trim();
  const provided=Array.isArray(word.acceptedMeanings)?word.acceptedMeanings:String(word.acceptedMeanings||'').split(/[;\n]/);
  return [...new Set([meaning,...meaning.split(/[;,/]/),...provided].map(normalizeExamText).map(s=>s.replace(/[.!?]+$/,'')).filter(Boolean))];
}
export function listeningPool(vocabulary,selectedSessions){
  const selected=new Set(selectedSessions.map(Number)),unique=new Map();
  for(const word of vocabulary){
    const key=normalizeExamText(word.word);const stress=getWordStress(word),meanings=acceptedVietnameseMeanings(word);
    if(!selected.has(Number(word.session))||!key||/\s/.test(key)||!stress||!meanings.length)continue;
    if(unique.has(key)){
      const existing=unique.get(key);
      if(existing.stress===stress)existing.meanings=[...new Set([...existing.meanings,...meanings])];
      continue;
    }
    unique.set(key,{wordId:word.id,word:word.word,stress,meanings,meaning:word.meaning,session:Number(word.session),ipa:word.ipa||''});
  }
  return [...unique.values()];
}
function randomize(array,random){const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function createListeningAttempt(vocabulary,selectedSessions,now=Date.now(),random=Math.random){
  if(!selectedSessions.length)throw new Error('Tích chọn ít nhất một buổi học.');
  const pool=listeningPool(vocabulary,selectedSessions);
  if(pool.length<LISTENING_RULES.count)throw new Error(`Mới có ${pool.length}/20 từ khác nhau đủ nghĩa và trọng âm. Chọn thêm buổi hoặc bổ sung dữ liệu từ vựng.`);
  const initial=[];
  for(const session of randomize([...new Set(selectedSessions.map(Number))],random)){
    const candidates=pool.filter(w=>w.session===session&&!initial.some(x=>x.wordId===w.wordId));
    if(candidates.length&&initial.length<20)initial.push(randomize(candidates,random)[0]);
  }
  const remainder=randomize(pool.filter(w=>!initial.some(x=>x.wordId===w.wordId)),random);
  const questions=randomize([...initial,...remainder].slice(0,20),random);
  return {attemptId:`listen-${now}-${random().toString(36).slice(2,10)}`,mode:'listening-stress',active:true,phase:'questions',sessions:[...new Set(selectedSessions.map(Number))],questions,answers:Array(20).fill(''),timedOut:Array(20).fill(false),spoken:Array(20).fill(0),startedAt:now,index:-1,reviewEndsAt:now+20*15000+15000};
}
export function listeningClock(attempt,now=Date.now()){
  const elapsed=Math.max(0,now-attempt.startedAt),questionTotal=20*15000;
  if(elapsed<questionTotal){const index=Math.floor(elapsed/15000),within=elapsed-index*15000;return {phase:'questions',index,window:Math.floor(within/5000),seconds:Math.ceil((15000-within)/1000),deadline:attempt.startedAt+(index+1)*15000};}
  if(elapsed<questionTotal+15000)return {phase:'review',seconds:Math.ceil((questionTotal+15000-elapsed)/1000),deadline:attempt.reviewEndsAt};
  return {phase:'grading',seconds:12,deadline:attempt.reviewEndsAt+12000};
}
export function parseListeningAnswer(answer){
  const text=String(answer||'').normalize('NFC').trim();
  const match=text.match(/^(.+?)\s*(?:\+\s*)?\(\s*([1-9]\d?)\s*\)\s*:\s*(.+)$/u);
  if(!match)return null;
  const word=normalizeExamText(match[1]);
  if(/[()+:]/.test(word)||/[:()]/.test(match[3]))return null;
  return {word,stress:Number(match[2]),meaning:normalizeExamText(match[3]).replace(/[.!?]+$/,'')};
}
export function gradeListeningAnswer(question,answer){
  const parsed=parseListeningAnswer(answer);
  const syntax=!!parsed;
  const wordCorrect=syntax&&parsed.word===normalizeExamText(question.word);
  const stressCorrect=syntax&&parsed.stress===question.stress;
  const meaningCorrect=syntax&&question.meanings.includes(parsed.meaning);
  return {syntax,wordCorrect,stressCorrect,meaningCorrect,correct:!!(syntax&&wordCorrect&&stressCorrect&&meaningCorrect)};
}
export function gradeListeningAttempt(attempt){
  const answers=attempt.questions.map((q,i)=>({wordId:q.wordId,word:q.word,answer:attempt.answers[i]||'',expected:`${q.word} (${q.stress}): ${q.meaning}`,timedOut:attempt.timedOut[i],...gradeListeningAnswer(q,attempt.answers[i])}));
  const correct=answers.filter(a=>a.correct).length,score=correct*5;
  return {attemptId:attempt.attemptId,mode:'listening-stress',sessions:attempt.sessions,total:20,correct,score,passed:score>=75,answers};
}
