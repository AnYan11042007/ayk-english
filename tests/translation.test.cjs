const fs=require('fs'),vm=require('vm'),assert=require('assert');
const memory=new Map();let requests=[];let quota=false;
const wiki=`==English==
===Pronunciation===
{{IPA|en|/ˈkʌmf.tə.bəl/}}
===Adjective===
# Providing physical [[comfort]].
#: {{ux|en|This bed is '''comfortable'''.}}
==French==
===Noun===
# A non-English entry.
`;
const c={console:{warn(){}},AbortSignal,TextEncoder,URLSearchParams,localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},fetch:async(url)=>{requests.push(url);if(url.includes('wiktionary.org'))return {ok:true,json:async()=>({parse:{wikitext:{'*':wiki}}})};if(url.includes('dictionaryapi.dev'))return {ok:false};return {ok:true,json:async()=>({responseStatus:200,quotaFinished:quota,responseData:{translatedText:quota?'MYMEMORY WARNING':'thoải mái'}})}}};vm.createContext(c);
for(const f of ['starter-data.js','vocabulary.js','lookup-sources.js','listening-test.js'])vm.runInContext(fs.readFileSync('assets/js/'+f,'utf8').replace(/export /g,''),c);
vm.runInContext(fs.readFileSync('assets/js/ai.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export \{.*\};\n/gm,'').replace(/export /g,''),c);
const run=s=>vm.runInContext(s,c);
(async()=>{
 assert.equal(run("normalizeVocabularyInput('light(n,v,adj)').partsOfSpeech.length"),3);
 const local=await run("aiLookup('basic(n)',['n'])");assert.equal(local.meaning,'cơ bản, đơn giản');assert.equal(local.partsOfSpeech[0],'adj');assert.equal(requests.length,0);
 const locate=await run("aiLookup('locate',['v'])");assert.equal(locate.stress,2);assert.deepEqual(JSON.parse(JSON.stringify(locate.stressVariants)),[2,1]);assert(locate.dictionarySource.includes('dictionary.cambridge.org'));assert.equal(requests.length,0);
 assert.equal(run("cambridgeDictionaryUrl('locate(v)')"),'https://dictionary.cambridge.org/vi/dictionary/english-vietnamese/locate');
 const result=await run("aiLookup('comfortable',[])");assert.equal(result.meaning,'thoải mái');assert.equal(result.partsOfSpeech[0],'adj');assert.equal(result.example,'This bed is comfortable.');assert.equal(result.imageSearchKeyword,'comfortable bed');assert.equal(result.source,'mymemory');assert(result.dictionarySource.includes('wiktionary.org'));
 const count=requests.length;await run("aiLookup('comfortable',[])");assert.equal(requests.length,count);
 assert.throws(()=>run("validateTranslation({quotaFinished:true,responseStatus:200,responseData:{translatedText:'MYMEMORY WARNING'}})"),/hết hạn mức/);
 assert.throws(()=>run("validateTranslation({responseStatus:429,responseData:{translatedText:'limit'}})"),/đang bận/);
 assert.equal(run("decodeTranslation('It&#39;s &amp; fine')"),"It's & fine");
 await assert.rejects(run("translateText('a'.repeat(501))"),/quá dài/);
 quota=true;await assert.rejects(run("translateText('uncached')"),/hết hạn mức/);
 assert(!requests.some(url=>/[?&](de|key)=/.test(url)));
 const parsed=run("readWiktionary('==English==\\n===Noun===\\n# A [[boat]].\\n#: {{ux|en|A boat floats.}}\\n===Verb===\\n# To travel.\\n#: {{ux|en|We travel by boat.}}\\n==German==\\n===Adjective===\\n# Excluded.')");assert.deepEqual(JSON.parse(JSON.stringify(parsed.partsOfSpeech)),['n','v']);assert.equal(parsed.senses[0].definition,'A boat.');
 const app=fs.readFileSync('assets/js/app.js','utf8');assert(!app.includes('Google Dịch tự động cần máy chủ'));assert(app.includes('lookupForm.isConnected'));assert(app.includes('saveButton.disabled=true'));
 console.log('PASS: MyMemory translation, Wiktionary English-only POS/examples, IPA, cache reuse, quota and invalid responses rejected, no keys/email, reviewed local fallback and async form guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
