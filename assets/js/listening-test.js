export const LISTENING_RULES=Object.freeze({count:20,questionMs:30000,replayMs:10000,reviewMs:15000,gradingMs:12000,passPercent:75});
export function normalizeExamText(value){return String(value||'').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/[’‘]/g,"'").replace(/\s+/g,' ')}
export function pronunciationStress(ipa){
  // Remove language labels and use one transcription, never count letters in “British”.
  const clean=String(ipa||'').replace(/\([^)]*\)/g,'').replace(/\b(?:UK|US|British|American|English)\s*:?/gi,'').trim();
  const first=clean.match(/[/\[]([^/\]]+)[/\]]/)?.[1]||clean.split(/[,;|]/)[0].trim();
  if(!first)return {stress:null,syllables:null};
  const nuclei=value=>(value.match(/[aeiouyɑɐɒæəɛɜɝɞɪʊʌɔœøɯɨɤɶɚɘɵ]+[ːˑ̃]*/giu)||[]).length+(value.match(/[nlm]̩/gu)||[]).length;
  const syllables=nuclei(first),marker=first.indexOf('ˈ');
  return {stress:marker>=0?nuclei(first.slice(0,marker))+1:syllables===1?1:null,syllables:syllables||null};
}
export function getWordStress(word){
  const inferred=pronunciationStress(word.ipa),explicit=Number(word.stress);
  if(Number.isInteger(explicit)&&explicit>=1&&explicit<=20&&(!inferred.syllables||explicit<=inferred.syllables))return explicit;
  if(/\s/.test(String(word.word||'')))return null;
  return inferred.stress;
}
export function acceptedWordStresses(word){
  const primary=getWordStress(word);if(!primary)return [];
  const variants=Array.isArray(word.stressVariants)?word.stressVariants:[];
  const syllables=pronunciationStress(word.ipa).syllables;
  return [...new Set([primary,...variants.map(Number)].filter(n=>Number.isInteger(n)&&n>=1&&n<=20&&(!syllables||n<=syllables)))];
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
      if(existing.stress===stress){existing.stresses=[...new Set([...existing.stresses,...acceptedWordStresses(word)])];existing.meanings=[...new Set([...existing.meanings,...meanings])];}
      continue;
    }
    unique.set(key,{wordId:word.id,word:word.word,stress,stresses:acceptedWordStresses(word),meanings,meaning:word.meaning,session:Number(word.session),ipa:word.ipa||''});
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
  return {attemptId:`listen-${now}-${random().toString(36).slice(2,10)}`,mode:'listening-stress',active:true,phase:'questions',sessions:[...new Set(selectedSessions.map(Number))],questions,answers:Array.from({length:20},()=>({english:'',stress:'',meaning:''})),timedOut:Array(20).fill(false),spoken:Array(20).fill(0),startedAt:now,index:-1,reviewEndsAt:now+LISTENING_RULES.count*LISTENING_RULES.questionMs+LISTENING_RULES.reviewMs};
}
export function listeningClock(attempt,now=Date.now()){
  const elapsed=Math.max(0,now-attempt.startedAt),questionTotal=LISTENING_RULES.count*LISTENING_RULES.questionMs;
  if(elapsed<questionTotal){const index=Math.floor(elapsed/LISTENING_RULES.questionMs),within=elapsed-index*LISTENING_RULES.questionMs;return {phase:'questions',index,window:Math.floor(within/LISTENING_RULES.replayMs),seconds:Math.ceil((LISTENING_RULES.questionMs-within)/1000),deadline:attempt.startedAt+(index+1)*LISTENING_RULES.questionMs};}
  if(elapsed<questionTotal+LISTENING_RULES.reviewMs)return {phase:'review',seconds:Math.ceil((questionTotal+LISTENING_RULES.reviewMs-elapsed)/1000),deadline:attempt.reviewEndsAt};
  return {phase:'grading',seconds:LISTENING_RULES.gradingMs/1000,deadline:attempt.reviewEndsAt+LISTENING_RULES.gradingMs};
}
export function listeningAnswerFields(answer){
  if(answer&&typeof answer==='object')return {english:String(answer.english||''),stress:String(answer.stress||''),meaning:String(answer.meaning||'')};
  const match=String(answer||'').normalize('NFC').trim().match(/^(.+?)\s*(?:\+\s*)?\(\s*([1-9]\d?)\s*\)\s*:\s*(.+)$/u);
  return match?{english:match[1].trim(),stress:match[2],meaning:match[3].trim()}:{english:'',stress:'',meaning:''};
}
export function parseListeningAnswer(answer){
  const fields=listeningAnswerFields(answer),word=normalizeExamText(fields.english),stress=fields.stress.trim(),meaning=normalizeExamText(fields.meaning).replace(/[.!?]+$/,'');
  if(!word||/[()+:]/.test(word)||!/^([1-9]\d?)$/.test(stress)||!meaning)return null;
  return {word,stress:Number(stress),meaning};
}
export function gradeListeningAnswer(question,answer){
  const fields=listeningAnswerFields(answer),parsed=parseListeningAnswer(fields),syntax=!!parsed;
  const wordCorrect=normalizeExamText(fields.english)===normalizeExamText(question.word);
  const stressCorrect=/^[1-9]\d?$/.test(fields.stress.trim())&&(question.stresses||[question.stress]).includes(Number(fields.stress));
  const meaningCorrect=question.meanings.includes(normalizeExamText(fields.meaning).replace(/[.!?]+$/,''));
  const feedback=[];
  if(!wordCorrect)feedback.push(fields.english.trim()?`Từ tiếng Anh chưa đúng: “${fields.english}” → “${question.word}”.`:`Chưa điền từ tiếng Anh. Đáp án: ${question.word}.`);
  if(!stressCorrect)feedback.push(fields.stress.trim()?`Trọng âm chưa đúng: “${fields.stress}” → ${(question.stresses||[question.stress]).join(' hoặc ')}.`:`Chưa điền trọng âm. Điền ${(question.stresses||[question.stress]).join(' hoặc ')}.`);
  if(!meaningCorrect)feedback.push(fields.meaning.trim()?`Nghĩa “${fields.meaning}” chưa khớp nghĩa đã học. Chấp nhận: ${question.meanings.join('; ')}. Giữ đúng dấu tiếng Việt.`:`Chưa điền nghĩa tiếng Việt. Chấp nhận: ${question.meanings.join('; ')}.`);
  if(!syntax&&wordCorrect&&stressCorrect&&meaningCorrect)feedback.push('Kiểm tra lại định dạng các ô.');
  return {syntax,wordCorrect,stressCorrect,meaningCorrect,feedback,correct:!!(syntax&&wordCorrect&&stressCorrect&&meaningCorrect)};
}
export function gradeListeningAttempt(attempt){
  const answers=attempt.questions.map((q,i)=>({wordId:q.wordId,word:q.word,answer:listeningAnswerFields(attempt.answers[i]),stresses:q.stresses||[q.stress],meanings:q.meanings,expectedFields:{english:q.word,stress:String(q.stress),meaning:q.meaning},expected:`${q.word} (${q.stress}): ${q.meaning}`,timedOut:attempt.timedOut[i],...gradeListeningAnswer(q,attempt.answers[i])}));
  const correct=answers.filter(a=>a.correct).length,score=correct*5;
  return {attemptId:attempt.attemptId,mode:'listening-stress',sessions:attempt.sessions,total:20,correct,score,passed:score>=LISTENING_RULES.passPercent,endedEarly:!!attempt.endedEarly,gradingMethod:'answer-key',answers};
}
