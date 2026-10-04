const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('assets/js/rapid-games.js','utf8').replace(/export /g,''),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`const bank=[{id:'1',word:'hello',meaning:'xin chào',stress:1},{id:'2',word:'bye',meaning:'tạm biệt',stress:1},{id:'3',word:'HI',meaning:'xin chào',stress:1}];`);
for(const mode of ['rapid-meaning','rapid-word','rapid-bool','rapid-stress','rapid-type','rapid-lives']){
 run(`var game=createRapidGame('${mode}',bank,5,w=>w.stress);beginRapidQuestion(game,1000)`);
 assert.equal(run('game.deadline'),6000);assert(run('game.question.options.length===new Set(game.question.options.map(x=>x.trim().toLowerCase())).size'));
 assert(run("submitRapidAnswer(game,game.question.answer,5999).correct"));assert.equal(run('game.correct'),1);
 assert.equal(run("submitRapidAnswer(game,'wrong',6000)"),null);assert.equal(run('game.attempts'),1);
 run('advanceRapidGame(game,7000)');assert.equal(run('game.deadline'),12000);assert(run('submitRapidAnswer(game,game.question.answer,12000).timedOut'));assert.equal(run('game.correct'),1);
}
run(`game=createRapidGame('rapid-lives',bank,5);beginRapidQuestion(game,0);for(let i=0;i<3;i++){submitRapidAnswer(game,'wrong',1);advanceRapidGame(game,0)}`);assert(run('game.done'));assert.equal(run('game.lives'),0);assert.equal(run('game.results.length'),3);
run(`game=createRapidGame('rapid-type',bank,15);beginRapidQuestion(game,0)`);assert(run("submitRapidAnswer(game,'  '+game.question.answer.toUpperCase()+'  ',1).correct"));
assert.throws(()=>run(`createRapidGame('rapid-stress',bank,5,()=>null)`));
assert.throws(()=>run(`createRapidGame('rapid-meaning',[bank[0],bank[2]])`));
console.log('PASS: all six rapid modes, unique choices, strict 5s deadline, answer locking, case-insensitive typing, 3 lives, missing stress and insufficient options.');
