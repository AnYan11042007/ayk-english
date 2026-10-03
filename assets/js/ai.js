import { firebaseReady, functions, fFunctions } from './firebase.js';
import { isLocalMode } from './store.js?v=lookup-v11';
import { starterVocabulary } from './starter-data.js';

import { normalizeVocabularyInput, googleTranslateUrl, readDictionaryEntries } from './vocabulary.js?v=lookup-v11';
export { normalizeVocabularyInput, googleTranslateUrl };

const dictionary=Object.fromEntries(starterVocabulary.map(item=>[item.word,item]));
Object.assign(dictionary,{
  basic:{meaning:'cơ bản, đơn giản',pos:'adj',ipa:'/ˈbeɪ.sɪk/',example:'We start with basic English.'},
  basics:{meaning:'những kiến thức cơ bản, nền tảng',pos:'n',ipa:'/ˈbeɪ.sɪks/',example:'Let’s learn the basics of English.'},
  adventure:{meaning:'cuộc phiêu lưu, cuộc mạo hiểm',pos:'n',ipa:'/ədˈven.tʃər/',example:'It was an unforgettable adventure.'},
  improve:{meaning:'cải thiện, tiến bộ',pos:'v',ipa:'/ɪmˈpruːv/',example:'I want to improve my English.'},
  confident:{meaning:'tự tin',pos:'adj',ipa:'/ˈkɒn.fɪ.dənt/',example:'She feels confident when speaking English.'},
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

export async function dictionaryLookup(word){
  try{
    const res=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,{signal:AbortSignal.timeout(8000)});
    if(!res.ok)return {partsOfSpeech:[],senses:[],ipa:''};
    return readDictionaryEntries(await res.json());
  }catch{return {partsOfSpeech:[],senses:[],ipa:''};}
}
export async function aiLookup(input,parts){
  const parsed=normalizeVocabularyInput(input,parts);
  if(!parsed.word)throw new Error('Nhập từ tiếng Anh trước.');
  if(firebaseReady&&!isLocalMode()){
    try{
      const res=await fFunctions.httpsCallable(functions,'lookupVocabulary',{timeout:60000})(parsed);
      const data=res.data;
      if(!data?.meaning||data.source!=='google-cloud-translation'||/\[demo\]|nghĩa tiếng việt của/i.test(data.meaning))throw new Error('Chưa có bản dịch Google.');
      return {...data,word:parsed.word,note:'Google Dịch · loại từ và ví dụ từ Free Dictionary. Kiểm tra nghĩa theo ngữ cảnh. '+(data.note||'')};
    }catch(err){console.warn('Google translation service unavailable',err);}
  }
  const local=dictionary[parsed.word];
  const details=local?{partsOfSpeech:(local.senses||[local]).map(s=>s.pos),senses:local.senses||[local],ipa:local.ipa}:await dictionaryLookup(parsed.word);
  if(local){
    const available=details.partsOfSpeech.length?details.partsOfSpeech:[local.pos];
    const selected=parsed.partsOfSpeech.filter(p=>available.includes(p));
    const partsOfSpeech=selected.length?selected:(parsed.partsOfSpeech.length?[local.pos]:available);
    const chosen=details.senses.filter(s=>partsOfSpeech.includes(s.pos)&&s.meaning);
    const meaning=chosen.length===1?chosen[0].meaning:chosen.map(s=>`(${s.pos}) ${s.meaning}`).join('; ');
    return {...local,word:parsed.word,meaning,example:chosen.find(s=>s.example)?.example||'',imageSearchKeyword:partsOfSpeech[0]==='n'?parsed.word:'',imageMeaning:chosen[0]?.meaning||'',pos:partsOfSpeech[0],partsOfSpeech,availablePartsOfSpeech:available,suggestedPos:local.pos,source:'local-dictionary',senses:chosen,note:'Từ điển có sẵn · Google Dịch tự động chưa được kích hoạt.'};
  }
  if(details.partsOfSpeech.length){
    const selected=parsed.partsOfSpeech.filter(p=>details.partsOfSpeech.includes(p));
    const partsOfSpeech=selected.length?selected:details.partsOfSpeech;
    return {word:parsed.word,pos:partsOfSpeech[0],partsOfSpeech,availablePartsOfSpeech:details.partsOfSpeech,ipa:details.ipa,example:details.senses.find(s=>partsOfSpeech.includes(s.pos)&&s.example)?.example||'',senses:details.senses,meaning:'',source:'free-dictionary',note:'Đã tìm loại từ và ví dụ. Google Dịch tự động chưa được kích hoạt; bấm Google Dịch để xem nghĩa.'};
  }
  throw new Error('Google Dịch tự động chưa được kích hoạt và chưa lấy được kết quả từ từ điển. Bạn có thể mở Google Dịch hoặc tự điền nghĩa.');
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
