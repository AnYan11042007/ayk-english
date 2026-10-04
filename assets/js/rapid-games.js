export const RAPID_MODES = [
 ['rapid-meaning','⚡','Chớp nghĩa','Nhìn tiếng Anh, chọn nghĩa trong 5 giây','yellow'],
 ['rapid-word','🚀','Bật ra từ','Nhìn nghĩa, chọn từ tiếng Anh thật nhanh','blue'],
 ['rapid-bool','✓✕','Đúng hay sai?','Bắt cặp từ và nghĩa bị đánh tráo','mint'],
 ['rapid-stress','🎯','Săn trọng âm','Chọn âm tiết được nhấn: 1, 2, 3…','purple'],
 ['rapid-type','⌨','Gõ siêu tốc','Viết từ tiếng Anh trước khi hết giờ','peach'],
 ['rapid-lives','♥','Giữ 3 trái tim','Mỗi câu sai mất một mạng. Giữ chuỗi đúng!','purple']
];
const rapidNormalized = s => String(s ?? '').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const rapidShuffle = list => {const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function createRapidGame(type, pool, seconds=5, stressOf=()=>null){
 if(!RAPID_MODES.some(m=>m[0]===type))throw new Error('Trò chơi không hợp lệ.');
 const bank=pool.filter(w=>w.word?.trim()&&w.meaning?.trim()&&(type!=='rapid-stress'||Number(stressOf(w))>0));
 if(!bank.length)throw new Error(type==='rapid-stress'?'Buổi này chưa có từ được xác nhận trọng âm.':'Buổi này chưa có từ để chơi.');
 if(['rapid-meaning','rapid-word','rapid-bool','rapid-lives'].includes(type)&&new Set(bank.map(w=>rapidNormalized(w[type==='rapid-word'?'word':'meaning']))).size<2)throw new Error('Cần ít nhất 2 đáp án khác nhau. Hãy chọn buổi khác.');
 return {rapid:true,type,bank,words:rapidShuffle(bank).slice(0,20),seconds:[5,10,15].includes(Number(seconds))?Number(seconds):5,index:0,correct:0,attempts:0,combo:0,bestCombo:0,lives:3,results:[],answered:false,started:false,done:false,stressOf};
}
export function rapidQuestion(g){
 const word=g.words[g.index];if(!word)return null;
 let prompt,answer,options;
 if(g.type==='rapid-type'){prompt=word.meaning;answer=word.word;options=[]}
 else if(g.type==='rapid-stress'){prompt=word.word;answer=String(g.stressOf(word));options=Array.from({length:Math.max(4,Number(answer))},(_,i)=>String(i+1))}
 else if(g.type==='rapid-bool'){
  const truth=Math.random()<.5;const other=rapidShuffle(g.bank.filter(w=>rapidNormalized(w.meaning)!==rapidNormalized(word.meaning)))[0];
  prompt=word.word+' → '+(truth?word.meaning:other.meaning);answer=truth?'Đúng':'Sai';options=['Đúng','Sai'];
 }else{
  const field=g.type==='rapid-word'?'word':'meaning';prompt=word[field==='word'?'meaning':'word'];answer=word[field];
  const alternatives=[...new Set(g.bank.map(w=>w[field]).filter(v=>rapidNormalized(v)!==rapidNormalized(answer)))];
  options=rapidShuffle([answer,...rapidShuffle(alternatives).slice(0,3)]);
 }
 return {word,prompt,answer,options};
}
export function beginRapidQuestion(g,now=Date.now()){
 g.question=rapidQuestion(g);g.answered=false;g.started=true;g.deadline=now+g.seconds*1000;
}
export function submitRapidAnswer(g,value,now=Date.now()){
 if(g.done||g.answered||!g.started)return null;
 const timedOut=now>=g.deadline;const correct=!timedOut&&rapidNormalized(value)===rapidNormalized(g.question.answer);
 g.answered=true;g.attempts++;g.correct+=Number(correct);g.combo=correct?g.combo+1:0;g.bestCombo=Math.max(g.bestCombo,g.combo);
 if(!correct&&g.type==='rapid-lives')g.lives--;
 const result={word:g.question.word,answer:String(value??''),expected:g.question.answer,correct,timedOut};g.results.push(result);return result;
}
export function advanceRapidGame(g,now=Date.now()){
 if(!g.answered||g.done)return false;
 g.index++;g.done=g.index>=g.words.length||(g.type==='rapid-lives'&&g.lives<=0);
 if(!g.done)beginRapidQuestion(g,now);return !g.done;
}
