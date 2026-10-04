const fs=require('fs'),vm=require('vm'),assert=require('assert');
const data={},memory=new Map();
const snap=r=>({val:()=>data[r.path]||null,exists:()=>Boolean(data[r.path])});
const fDb={ref:(_,path)=>({path}),get:async r=>snap(r),query:r=>r,orderByChild:()=>{},limitToLast:()=>{},runTransaction:async(r,fn)=>{
 // Exercise Firebase's first cache-miss callback followed by the server retry.
 if(fn(null)===undefined)return {committed:false};
 const next=fn(data[r.path]||null);if(next===undefined)return {committed:false};
 data[r.path]=JSON.parse(JSON.stringify(next));return {committed:true,snapshot:snap(r)};
}};
const dbContext=vm.createContext({console,fDb,db:{},firebaseReady:true,starterVocabulary:[],localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});
for(const f of ['gacha-core.js','store.js'])vm.runInContext(fs.readFileSync('assets/js/'+f,'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),dbContext);
const ui=vm.createContext({require,__dirname:process.cwd()+'/tests',process});
vm.runInContext(fs.readFileSync('tests/learning.test.cjs','utf8').split('(async()=>')[0],ui);
const app=s=>vm.runInContext(s,ui);
ui.realStore=Object.fromEntries(['saveTestResult','getTestResults','awardGachaTicket'].map(name=>[name,vm.runInContext(name,dbContext)]));
app('Object.assign(c.store,realStore)');
data['users/integration/gacha']={tickets:3,inventory:{nova:1},equipped:'nova'};
app(`c.bank=${JSON.stringify(Array.from({length:20},(_,i)=>({id:'w'+i,word:'word'+i,meaning:'nghĩa '+i,stress:1,session:1})))};run("state.user={uid:'integration'};state.view='tests';state.vocab=bank")`);
async function finish(correct,id){
 app(`run("state.listening=createListeningAttempt(bank,[1]);state.listening.attemptId='${id}';state.listening.active=true;state.listening.answers=state.listening.questions.map((q,i)=>i<${correct}?{english:q.word,stress:String(q.stress),meaning:q.meanings[0]}:'');completeListeningTest(state.listening)")`);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(app('run("state.listening.saveStatus")'),'saved');
 assert.equal(app('run("state.listening.result.score")'),correct*5);
}
(async()=>{
 await finish(15,'pass-75');assert.equal(data['users/integration/gacha'].tickets,4);assert(app('run("state.listening.gachaAwarded")'));
 app('run("state.listening.saveStatus=\'failed\'")');await app('run("persistListeningResult(state.listening)")');assert.equal(data['users/integration/gacha'].tickets,4);
 await finish(14,'fail-70');assert.equal(data['users/integration/gacha'].tickets,4);assert(!app('run("state.listening.gachaAwarded")'));
 await finish(20,'pass-100');assert.equal(data['users/integration/gacha'].tickets,5);assert.equal(data['users/integration/gacha'].inventory.nova,1);
 assert.equal(Object.keys(data['testResults/integration']).length,3);
 console.log('PASS: actual app grading -> saved result -> actual wallet transaction: 75% +1, retry +0, 70% +0, 100% +1, existing collection preserved, history capped at three.');
})().catch(e=>{console.error(e);process.exitCode=1});
