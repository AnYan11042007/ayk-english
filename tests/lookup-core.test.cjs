const assert=require('assert');const {parseRequest,buildLookup}=require('../functions/lookup-core');
const dictionary=[{phonetic:'/bʊk/',meanings:[{partOfSpeech:'noun',definitions:[{definition:'A written work.',example:'I read a book.'}]},{partOfSpeech:'verb',definitions:[{definition:'To reserve.',example:'Please book a table.'}]}]}];
(async()=>{
 assert.deepEqual(parseRequest({word:'Book(n,v,n)'}),{word:'book',partsOfSpeech:['n','v']});
 assert.throws(()=>parseRequest({word:'<img>'}),/không hợp lệ/);
 const calls=[];const translate=async(q,source,target)=>{calls.push({q,source,target});return source==='vi'?['book']:q.map(x=>({'book':'sách','A written work.':'một tác phẩm viết','To reserve.':'đặt trước'})[x]||'bản dịch')};
 const result=await buildLookup({word:'book',partsOfSpeech:['n','v']},{fetchDictionary:async()=>dictionary,translate});
 assert.equal(result.source,'google-cloud-translation');assert.deepEqual(result.partsOfSpeech,['n','v']);assert(result.meaning.includes('(n) một tác phẩm viết'));assert(result.meaning.includes('(v) đặt trước'));assert.equal(result.example,'I read a book.');assert.equal(result.imageMeaning,'sách');assert.equal(result.imageSearchKeyword,'book');assert.equal(calls[1].source,'vi');assert.deepEqual(calls[1].q,['sách']);
 await assert.rejects(buildLookup({word:'book',partsOfSpeech:['adj']},{fetchDictionary:async()=>dictionary,translate}),/loại từ đã chọn/);
 const adj=await buildLookup({word:'basic',partsOfSpeech:['adj']},{fetchDictionary:async()=>[{meanings:[{partOfSpeech:'adjective',definitions:[{definition:'Fundamental.'}]}]}],translate});assert.equal(adj.example,'');assert(adj.note.includes('chưa có ví dụ'));assert.equal(adj.imageSearchKeyword,'');
 await assert.rejects(buildLookup({word:'book'},{fetchDictionary:async()=>dictionary,translate:async()=>[]}),/bản dịch đầy đủ/);
 console.log('PASS: per-POS translation, dictionary examples, reverse translation of Vietnamese image meaning, abstract-word images skipped, no fabricated examples and incomplete API rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
