const fs=require('fs'),vm=require('vm'),assert=require('assert');const c=vm.createContext({Intl,Date});vm.runInContext(fs.readFileSync('assets/js/motivation.js','utf8').replace(/export /g,''),c);const run=s=>vm.runInContext(s,c);
assert.equal(run("studyDay(new Date('2026-10-04T18:00:00Z'))"),'2026-10-05');
run("var h={days:{'2026-10-02':['a'],'2026-10-03':['b']}};var d=new Date('2026-10-04T12:00:00Z')");assert.equal(run('studySummary(h,d).streak'),2);
run("var r=addStudyWord(h,'c',d);h=r.history");assert(run('r.added'));assert.equal(run('studySummary(h,d).streak'),3);assert.equal(run('studySummary(h,d).count'),1);
assert(!run("addStudyWord(h,'c',d).added"));assert.equal(run("studySummary(h,new Date('2026-10-06T12:00:00Z')).streak"),0);
run("for(let i=0;i<6;i++)h=addStudyWord(h,String(i),d).history");assert.equal(run('studySummary(h,d).percent'),100);
assert.equal(run('studySummary({},d).streak'),0);console.log('PASS: Vietnam date rollover, actual daily words, no duplicate credit, consecutive days, gap resets and capped progress.');
