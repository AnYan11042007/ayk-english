const POS_MAP={noun:'n',verb:'v',adjective:'adj',adverb:'adv'};
const POS_TYPES=['n','v','adj','adv'];
function parseRequest(data){
  const input=String(data?.word||'').trim().toLowerCase();
  const match=input.match(/^(.*?)\s*\(([a-z,/\s]+)\)\s*$/);
  const supplied=match?match[2].split(/[,/\s]+/):Array.isArray(data?.partsOfSpeech)?data.partsOfSpeech:[data?.pos];
  const parts=[...new Set(supplied.filter(p=>POS_TYPES.includes(p)))];
  const word=match?match[1].trim():input;
  if(!word||word.length>120||!/[a-z]/i.test(word)||/[<>\n\r]/.test(word))throw new Error('Từ tiếng Anh không hợp lệ.');
  return {word,partsOfSpeech:parts};
}
function dictionaryDetails(entries){
  const senses=[];
  for(const entry of Array.isArray(entries)?entries:[]){
    for(const m of entry.meanings||[]){
      const pos=POS_MAP[m.partOfSpeech];if(!pos)continue;
      const defs=(m.definitions||[]).filter(d=>typeof d.definition==='string');
      const found=senses.find(s=>s.pos===pos);
      const example=defs.find(d=>typeof d.example==='string'&&d.example.trim())?.example.slice(0,500)||'';
      if(found){if(!found.example)found.example=example;continue;}
      const chosen=defs.find(d=>d.example)||defs[0];senses.push({pos,definition:chosen?.definition.slice(0,300)||'',example});
    }
  }
  const ipa=(Array.isArray(entries)?entries:[]).flatMap(e=>[e.phonetic,...(e.phonetics||[]).map(p=>p.text)]).find(t=>typeof t==='string'&&t)||'';
  return {senses,ipa};
}
async function buildLookup(data,{fetchDictionary,translate}){
  const parsed=parseRequest(data);
  let entries=[];try{entries=await fetchDictionary(parsed.word)}catch{}
  const {senses,ipa}=dictionaryDetails(entries);
  const available=senses.map(s=>s.pos);
  const requested=parsed.partsOfSpeech;
  const selected=available.length?(requested.length?requested.filter(p=>available.includes(p)):available):requested;
  if(available.length&&requested.length&&!selected.length)throw new Error('Từ điển không có các loại từ đã chọn. Hãy bỏ chọn hoặc chọn loại từ khác.');
  const chosen=selected.map(pos=>senses.find(s=>s.pos===pos)).filter(Boolean);
  const inputs=[parsed.word,...chosen.map(s=>s.definition||parsed.word)];
  const translated=await translate(inputs,'en','vi');
  if(!Array.isArray(translated)||translated.length!==inputs.length||translated.some(t=>typeof t!=='string'||!t.trim()))throw new Error('Google chưa trả bản dịch đầy đủ.');
  const detailed=chosen.map((s,i)=>({...s,meaning:translated[i+1]}));
  const meaning=detailed.length?detailed.map(s=>`(${s.pos}) ${s.meaning}`).join('; '):translated[0];
  const example=detailed.find(s=>s.example)?.example||'';
  // Từ trừu tượng không nên tự gắn ảnh chỉ vì một kết quả tìm kiếm trùng tên.
  const imageMeaning=selected[0]==='n'?translated[0]:detailed[0]?.meaning||translated[0];
  let imageSearchKeyword='';
  if(selected.some(p=>p==='n'||p==='v')&&translated[0].toLowerCase()!==parsed.word){
    try{const english=await translate([imageMeaning],'vi','en');imageSearchKeyword=String(english[0]||'').split(/[;,]/)[0].trim().slice(0,80);}catch{}
  }
  return {word:parsed.word,pos:selected[0]||'n',partsOfSpeech:selected,availablePartsOfSpeech:available,meaning,shortMeaning:translated[0],ipa,example,senses:detailed,imageSearchKeyword,imageMeaning,source:'google-cloud-translation',dictionarySource:available.length?'https://dictionaryapi.dev/':'',note:example?'':'Từ điển chưa có ví dụ phù hợp. Bạn có thể bổ sung ví dụ trước khi lưu.'};
}
module.exports={parseRequest,dictionaryDetails,buildLookup};
