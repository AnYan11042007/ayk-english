const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('assets/js/listening-test.js','utf8').replace(/export /g,''),c);
const run=s=>vm.runInContext(s,c);
c.bank=Array.from({length:24},(_,i)=>({id:'w'+i,word:'word'+i,meaning:'nghĩa '+i+'; nghĩa khác '+i,stress:1,session:i<12?1:2}));
assert.equal(run("getWordStress({word:'basic',ipa:'/ˈbeɪ.sɪk/'})"),1);
assert.equal(run("getWordStress({word:'improve',ipa:'/ɪmˈpruːv/'})"),2);
assert.equal(run("getWordStress({word:'cat',ipa:'/kæt/'})"),1);
assert.equal(run("getWordStress({word:'unknown',ipa:'/əbaʊt/'})"),null);
assert.equal(run("getWordStress({word:'basic',stress:2,ipa:'/ˈbeɪsɪk/'})"),2);
assert.throws(()=>run('createListeningAttempt(bank,[1])'),/12\/20/);
assert.throws(()=>run('createListeningAttempt(bank,[])'),/ít nhất/);
run('var attempt=createListeningAttempt(bank,[1,2],1000,()=>.37)');
assert.equal(run('attempt.questions.length'),20);assert.equal(run('new Set(attempt.questions.map(q=>q.word)).size'),20);
assert.equal(run('new Set(attempt.questions.map(q=>q.session)).size'),2);
for(const [ms,phase,index,window,seconds] of [[0,'questions',0,0,15],[4999,'questions',0,0,11],[5000,'questions',0,1,10],[10000,'questions',0,2,5],[15000,'questions',1,0,15],[299999,'questions',19,2,1],[300000,'review',undefined,undefined,15],[314999,'review',undefined,undefined,1],[315000,'grading',undefined,undefined,12]]){
 c.ms=ms;const r=run('listeningClock(attempt,1000+ms)');assert.equal(r.phase,phase);assert.equal(r.index,index);assert.equal(r.window,window);assert.equal(r.seconds,seconds);
}
assert(run("parseListeningAnswer('BASIC + (1): CƠ BẢN')"));
for(const bad of ['basic (adj): cơ bản','basic 1: cơ bản','basic (01): cơ bản','basic (1) cơ bản','basic (1):','basic (1.5): cơ bản']){c.bad=bad;assert.equal(run('parseListeningAnswer(bad)'),null,bad)}
run("var q={word:'basic',stress:1,meanings:['cơ bản','đơn giản']}");
assert(run("gradeListeningAnswer(q,' BASIC (1) : ĐƠN GIẢN ').correct"));
assert(!run("gradeListeningAnswer(q,'basic (1): co ban').correct"));
assert(!run("gradeListeningAnswer(q,'basic (2): cơ bản').correct"));
run("attempt.answers=attempt.questions.map((q,i)=>i<15?`${q.word.toUpperCase()} (${q.stress}): ${q.meanings[0].toUpperCase()}`:'')");assert.equal(run('gradeListeningAttempt(attempt).score'),75);assert(run('gradeListeningAttempt(attempt).passed'));
run("attempt.answers[14]='wrong (1): sai'");assert.equal(run('gradeListeningAttempt(attempt).score'),70);assert(!run('gradeListeningAttempt(attempt).passed'));
// Exercise real app transitions against an injected clock and speech engine.
const harness=fs.readFileSync('tests/learning.test.cjs','utf8').split('(async()=>')[0];
const ui=vm.createContext({require,__dirname:process.cwd()+'/tests',process});vm.runInContext(harness,ui);const app=s=>vm.runInContext(s,ui);
(async()=>{
app(`c.clockNow=1000;c.Date=class extends Date{static now(){return c.clockNow}};vm.runInContext('Date=globalThis.Date',c)`);
// The application context needs the clock class assigned directly.
app(`vm.runInContext('Date=Date',c);c.spoken=[];c.window.speechSynthesis={cancel(){},getVoices(){return [{lang:'en-US'}]},speak(u){c.spoken.push(u.text)}};c.SpeechSynthesisUtterance=function(text){this.text=text};c.speechSynthesis=c.window.speechSynthesis;c.store.saveTestResult=async()=>{c.saved=(c.saved||0)+1};c.store.getTestResults=async()=>{throw Error('read offline')};c.store.getProgress=async()=>({})`);
// Access c through harness scope, seed data and execute actual UI functions.
app(`c.bank=${JSON.stringify(c.bank)};run("state.user={uid:'test-student'};state.view='tests';state.vocab=bank;state.lessons=[{number:1,name:'Buổi A'},{number:2,name:'Buổi B'}];startListeningTest([1,2])")`);
assert.equal(app('c.spoken.length'),1);app('c.clockNow=6000;run("tickListeningTest();tickListeningTest()")');assert.equal(app('c.spoken.length'),2);
app('c.clockNow=11000;run("tickListeningTest()")');assert.equal(app('c.spoken.length'),3);
app('c.clockNow=16000;run("tickListeningTest()")');assert.equal(app('run("state.listening.index")'),1);assert.equal(app('c.spoken.length'),4);assert(app('run("state.listening.timedOut[0]")'));
app('c.clockNow=301000;run("tickListeningTest()")');assert.equal(app('run("state.listening.phase")'),'review');assert(app("el('#viewRoot').innerHTML.includes('Rà soát')"));
app('run("state.listening.answers=state.listening.questions.map((q,i)=>i<15?`${q.word} (${q.stress}): ${q.meanings[0]}`:\'\')")');
app('c.clockNow=316000;run("tickListeningTest();tickListeningTest()")');assert.equal(app('run("state.listening.phase")'),'result');assert.equal(app('run("state.listening.result.score")'),75);assert.equal(app('c.saved'),1);
await new Promise(resolve=>setImmediate(resolve));await app('run("persistListeningResult(state.listening)")');assert.equal(app('c.saved'),1);assert.equal(app('recorded.length'),20);assert.equal(app('run("state.listening.saveStatus")'),'saved');
console.log('PASS: 20 unique words, selected lessons, stress extraction/override, strict syntax, case/Unicode, accents, 75% boundary, exact 0/5/10/15s transitions, timeout, review, immediate grading and save retry guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
