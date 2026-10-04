export function studyDay(date=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function studySummary(history={},date=new Date()){
 const today=studyDay(date),days=history.days||{},words=Array.isArray(days[today])?[...new Set(days[today])]:[];
 const cursor=new Date(today+'T12:00:00+07:00');let streak=0;
 if(!words.length)cursor.setUTCDate(cursor.getUTCDate()-1);
 for(let i=0;i<366;i++){
  if(!Array.isArray(days[studyDay(cursor)])||!days[studyDay(cursor)].length)break;
  streak++;cursor.setUTCDate(cursor.getUTCDate()-1);
 }
 return {today,count:words.length,goal:5,percent:Math.min(100,words.length*20),streak};
}
export function addStudyWord(history,wordId,date=new Date()){
 const days={...(history?.days||{})},today=studyDay(date),previous=Array.isArray(days[today])?days[today]:[];
 const added=!previous.includes(String(wordId));days[today]=[...new Set([...previous,String(wordId)])];
 const recent=Object.keys(days).sort().slice(-366);return {history:{days:Object.fromEntries(recent.map(d=>[d,days[d]]))},added};
}
