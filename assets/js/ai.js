import { firebaseReady, functions, fFunctions } from './firebase.js';
import { isLocalMode } from './store.js?v=translate-v9';
import { starterVocabulary } from './starter-data.js';

export function normalizeVocabularyInput(input,pos='n'){
  const match=String(input||'').trim().match(/^(.*?)\s*\((n|v|adj|adv)\)\s*$/i);
  return {word:(match?match[1]:String(input||'')).trim().toLowerCase(),pos:match?match[2].toLowerCase():pos};
}
export function googleTranslateUrl(input){
  const {word}=normalizeVocabularyInput(input);
  return `https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(word)}&op=translate`;
}
const dictionary=Object.fromEntries(starterVocabulary.map(item=>[item.word,item]));
Object.assign(dictionary,{
  basic:{meaning:'cơ bản, đơn giản',pos:'adj',ipa:'/ˈbeɪ.sɪk/',example:'We start with basic English.'},
  basics:{meaning:'những kiến thức cơ bản, nền tảng',pos:'n',ipa:'/ˈbeɪ.sɪks/',example:'Let’s learn the basics of English.'},
  adventure:{meaning:'cuộc phiêu lưu, cuộc mạo hiểm',pos:'n',ipa:'/ədˈven.tʃər/',example:'It was an unforgettable adventure.'},
  improve:{meaning:'cải thiện, tiến bộ',pos:'v',ipa:'/ɪmˈpruːv/',example:'I want to improve my English.'},
  confident:{meaning:'tự tin',pos:'adj',ipa:'/ˈkɒn.fɪ.dənt/',example:'She feels confident when speaking English.'},
  airport:{meaning:'sân bay',pos:'n',ipa:'/ˈeə.pɔːt/',example:'We arrived at the airport early.'}
});
export async function aiLookup(input,pos){
  const parsed=normalizeVocabularyInput(input,pos);
  if(!parsed.word)throw new Error('Nhập từ tiếng Anh trước.');
  const local=dictionary[parsed.word];
  if(local)return {...local,word:parsed.word,pos:parsed.pos,suggestedPos:local.pos,note:`Từ điển có sẵn.${local.pos!==parsed.pos?' Gợi ý loại từ: '+local.pos+'. Bạn có thể chỉnh lại theo ngữ cảnh.':''}`};
  if(firebaseReady&&!isLocalMode()){
    try{
      const res=await fFunctions.httpsCallable(functions,'lookupVocabulary')(parsed);
      const data=res.data;
      if(!data?.meaning||/\[demo\]|nghĩa tiếng việt của/i.test(data.meaning)||data.meaning.trim().toLowerCase()===parsed.word)throw new Error('Kết quả chưa có nghĩa tiếng Việt.');
      return {...data,...parsed,note:'Gợi ý AI — kiểm tra nghĩa và loại từ theo ngữ cảnh.'};
    }catch(err){console.warn('Vocabulary lookup unavailable',err);}
  }
  throw new Error('Chưa tra được từ này. Bấm Google Dịch để xem nghĩa tiếng Việt rồi điền vào ô nghĩa.');
}

export async function searchCommonsImages(keyword){
  const q=encodeURIComponent(keyword||'English learning');
  const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=480&format=json&origin=*`;
  try{
    const res=await fetch(url); if(!res.ok) throw new Error('Image search failed');
    const json=await res.json();
    return Object.values(json.query?.pages||{}).map(p=>({title:p.title,url:p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url,source:p.imageinfo?.[0]?.descriptionurl})).filter(x=>x.url).slice(0,8);
  }catch(err){console.warn(err);return[]}
}
