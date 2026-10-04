import { getWordStress } from './listening-test.js?v=listening-v16';
import { starterVocabulary } from './starter-data.js';

import { normalizeVocabularyInput, googleTranslateUrl, readDictionaryEntries } from './vocabulary.js?v=listening-v16';
import { readWiktionary, validateTranslation } from './lookup-sources.js?v=listening-v16';
export { normalizeVocabularyInput, googleTranslateUrl };
export function cambridgeDictionaryUrl(input){const word=normalizeVocabularyInput(input).word;return word?`https://dictionary.cambridge.org/vi/dictionary/english-vietnamese/${encodeURIComponent(word)}`:'https://dictionary.cambridge.org/vi/dictionary/english-vietnamese/'}

const dictionary=Object.fromEntries(starterVocabulary.map(item=>[item.word,item]));
Object.assign(dictionary,{
  basic:{meaning:'cơ bản, đơn giản',pos:'adj',ipa:'/ˈbeɪ.sɪk/',example:'We start with basic English.'},
  basics:{meaning:'những kiến thức cơ bản, nền tảng',pos:'n',ipa:'/ˈbeɪ.sɪks/',example:'Let’s learn the basics of English.'},
  adventure:{meaning:'cuộc phiêu lưu, cuộc mạo hiểm',pos:'n',ipa:'/ədˈven.tʃər/',example:'It was an unforgettable adventure.'},
  improve:{meaning:'cải thiện, tiến bộ',pos:'v',ipa:'/ɪmˈpruːv/',example:'I want to improve my English.'},
  confident:{meaning:'tự tin',pos:'adj',ipa:'/ˈkɒn.fɪ.dənt/',example:'She feels confident when speaking English.'},
  locate:{meaning:'xác định vị trí; tìm vị trí; đặt tại',pos:'v',ipa:'/ləʊˈkeɪt/',stress:2,stressVariants:[2,1],example:'Can you locate my bag?',dictionarySource:'https://dictionary.cambridge.org/vi/dictionary/english-vietnamese/locate',reviewedCambridge:true},
  airport:{meaning:'sân bay',pos:'n',ipa:'/ˈeə.pɔːt/',example:'We arrived at the airport early.'}
});
const multipleSenses={
  light:[{pos:'n',meaning:'ánh sáng',example:'Turn on the light.'},{pos:'v',meaning:'thắp sáng, chiếu sáng',example:'The lamps light the room.'},{pos:'adj',meaning:'nhẹ; sáng màu',example:'This bag is light.'}],
  book:[{pos:'n',meaning:'quyển sách',example:'This book is very interesting.'},{pos:'v',meaning:'đặt trước, đặt chỗ',example:'Please book a table for two.'}],
  water:[{pos:'n',meaning:'nước',example:'Please drink more water.'},{pos:'v',meaning:'tưới nước',example:'I water the plants every morning.'}],
  study:[{pos:'n',meaning:'việc học, việc nghiên cứu',example:'The study of English takes time.'},{pos:'v',meaning:'học, nghiên cứu',example:'I study English every day.'}]
};
dictionary.light={word:'light',pos:'n',meaning:'ánh sáng',ipa:'/laɪt/',example:'Turn on the light.'};
for(const [word,senses]of Object.entries(multipleSenses))dictionary[word].senses=senses;

const lookupCache=new Map();
function cacheRead(key){
  if(lookupCache.has(key))return lookupCache.get(key);
  try{const saved=JSON.parse(localStorage.getItem('ayk_lookup_cache')||'{}')[key];if(saved&&Date.now()-saved.at<7*86400000){lookupCache.set(key,saved.value);return saved.value}}catch{}
}
function cacheWrite(key,value){
  lookupCache.set(key,value);
  try{const saved=JSON.parse(localStorage.getItem('ayk_lookup_cache')||'{}');saved[key]={at:Date.now(),value};const entries=Object.entries(saved).sort((a,b)=>b[1].at-a[1].at).slice(0,200);localStorage.setItem('ayk_lookup_cache',JSON.stringify(Object.fromEntries(entries)))}catch{}
}
export async function translateText(text,source='en',target='vi'){
  const input=String(text||'').trim();
  if(!input||new TextEncoder().encode(input).length>500)throw new Error('Đoạn cần dịch quá dài. Hãy tra từ hoặc cụm từ ngắn.');
  const key=`translation:${source}:${target}:${input}`;const cached=cacheRead(key);if(cached)return cached;
  const params=new URLSearchParams({q:input,langpair:`${source}|${target}`});
  const res=await fetch(`https://api.mymemory.translated.net/get?${params}`,{signal:AbortSignal.timeout(18000)});
  if(!res.ok)throw new Error('Chưa kết nối được dịch vụ dịch. Thử lại sau.');
  const value=validateTranslation(await res.json());cacheWrite(key,value);return value;
}
export async function dictionaryLookup(word){
  const key=`dictionary:v2:${word}`;const cached=cacheRead(key);if(cached)return cached;
  try{
    const query=new URLSearchParams({action:'parse',page:word,prop:'wikitext',format:'json',origin:'*',redirects:'1'});
    const res=await fetch(`https://en.wiktionary.org/w/api.php?${query}`,{signal:AbortSignal.timeout(10000)});
    if(res.ok){const json=await res.json();const details=readWiktionary(json.parse?.wikitext?.['*']||'');if(details.partsOfSpeech.length){details.dictionarySource=`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;cacheWrite(key,details);return details;}}
  }catch(err){console.warn('Wiktionary unavailable:',err.message)}
  try{
    const res=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,{signal:AbortSignal.timeout(4000)});
    if(res.ok){const details=readDictionaryEntries(await res.json());if(details.partsOfSpeech.length){details.dictionarySource='https://dictionaryapi.dev/';cacheWrite(key,details);return details}}
  }catch(err){console.warn('Dictionary unavailable:',err.message)}
  return {partsOfSpeech:[],senses:[],ipa:''};
}
const imageContexts={comfortable:'bed',beautiful:'landscape',happy:'smiling person',friendly:'friends',basic:'',basics:'',important:'',useful:'',difficult:'',confident:'',improve:''};
async function imageQuery(word,meaning,parts,example){
  if(Object.hasOwn(imageContexts,word))return imageContexts[word]?`${word} ${imageContexts[word]}`:'';
  if(!parts.some(p=>p==='n'||p==='v'))return '';
  try{const translated=await translateText(meaning.split(/[;,]/)[0],'vi','en');return translated.replace(/[.!?]/g,'').trim().slice(0,80)}catch{return word;}
}
export async function aiLookup(input,parts){
  const parsed=normalizeVocabularyInput(input,parts);
  if(!parsed.word||parsed.word.length>120)throw new Error('Nhập từ tiếng Anh hợp lệ (tối đa 120 ký tự).');
  const local=dictionary[parsed.word];
  if(local){
    const available=(local.senses||[local]).map(s=>s.pos);
    const selected=parsed.partsOfSpeech.filter(p=>available.includes(p));
    const partsOfSpeech=selected.length?selected:available;
    const senses=(local.senses||[local]).filter(s=>partsOfSpeech.includes(s.pos));
    const meaning=senses.length===1?senses[0].meaning:senses.map(s=>`(${s.pos}) ${s.meaning}`).join('; ');
    return {...local,word:parsed.word,meaning,example:senses.find(s=>s.example)?.example||'',imageSearchKeyword:partsOfSpeech[0]==='n'?parsed.word:'',imageMeaning:senses[0]?.meaning||'',pos:partsOfSpeech[0],partsOfSpeech,availablePartsOfSpeech:available,source:'local-dictionary',senses,stress:getWordStress({...local,word:parsed.word}),note:local.reviewedCambridge?'Mục locate đã đối chiếu Cambridge: nhấn âm 2 hoặc 1 tùy giọng, không có âm 3. Ví dụ do AYK soạn.':'Từ điển có sẵn · đã gợi ý trọng âm từ IPA; kiểm tra trước khi lưu.'};
  }
  const [dictionaryResult,translationResult]=await Promise.allSettled([dictionaryLookup(parsed.word),translateText(parsed.word)]);
  const details=dictionaryResult.status==='fulfilled'?dictionaryResult.value:{partsOfSpeech:[],senses:[],ipa:''};
  const available=details.partsOfSpeech;
  const selected=parsed.partsOfSpeech.filter(p=>available.includes(p));
  const partsOfSpeech=available.length?(selected.length?selected:available):parsed.partsOfSpeech;
  const senses=partsOfSpeech.map(pos=>details.senses.find(s=>s.pos===pos)).filter(Boolean).map(s=>({...s}));
  let shortMeaning=translationResult.status==='fulfilled'?translationResult.value:senses.find(s=>s.meaning)?.meaning||'';
  if(!shortMeaning)throw new Error(translationResult.status==='rejected'?translationResult.reason.message:'Chưa tìm được bản dịch. Thử lại sau.');
  if(senses.length>1||partsOfSpeech[0]==='v'){
    await Promise.all(senses.map(async s=>{if(!s.meaning&&s.definition)try{s.meaning=await translateText(s.definition.slice(0,300))}catch{}}));
  }
  const detailed=senses.filter(s=>s.meaning);
  const meaning=senses.length>1&&detailed.length===senses.length?detailed.map(s=>`(${s.pos}) ${s.meaning}`).join('; '):partsOfSpeech[0]==='v'&&detailed[0]?detailed[0].meaning:shortMeaning;
  const example=senses.find(s=>s.example)?.example||'';
  const imageSearchKeyword=await imageQuery(parsed.word,partsOfSpeech[0]==='v'?meaning:shortMeaning,partsOfSpeech,example);
  const warnings=[!available.length?'Chưa xác định được loại từ; bạn tự chọn loại phù hợp.':'',!example?'Nguồn chưa có ví dụ; bạn có thể bổ sung.':'',senses.length>1&&detailed.length<senses.length?'Bản dịch chung; kiểm tra nghĩa cho từng loại từ.':''].filter(Boolean).join(' ');
  return {word:parsed.word,pos:partsOfSpeech[0]||'n',partsOfSpeech,availablePartsOfSpeech:available,meaning,shortMeaning,ipa:details.ipa||'',stress:getWordStress({word:parsed.word,ipa:details.ipa}),example,senses,imageSearchKeyword,imageMeaning:shortMeaning,source:translationResult.status==='fulfilled'?'mymemory':'wiktionary',dictionarySource:details.dictionarySource||'',translationSource:translationResult.status==='fulfilled'?'https://mymemory.translated.net/':details.dictionarySource||'',note:`${translationResult.status==='fulfilled'?'MyMemory':'Wiktionary'} · gợi ý Anh → Việt. ${warnings} Bạn có thể chỉnh trước khi lưu.`};
}

export async function searchCommonsImages(keyword){
  const q=encodeURIComponent(keyword||'English learning');
  const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`;
  try{
    const res=await fetch(url,{signal:AbortSignal.timeout(10000)}); if(!res.ok) throw new Error('Image search failed');
    const json=await res.json();
    return Object.values(json.query?.pages||{}).map(p=>({title:p.title,url:p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url,source:p.imageinfo?.[0]?.descriptionurl,license:p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value||''})).filter(x=>x.url).slice(0,8);
  }catch(err){console.warn(err);return[]}
}
