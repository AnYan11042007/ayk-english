import { firebaseReady, functions, fFunctions } from './firebase.js';

export async function aiLookup(word,pos){
  if(!firebaseReady) return demoLookup(word,pos);
  try{
    const callable=fFunctions.httpsCallable(functions,'lookupVocabulary');
    const res=await callable({word,pos});
    return res.data;
  }catch(err){
    console.warn('AI Function unavailable, using local fallback',err);
    return demoLookup(word,pos,true);
  }
}

function demoLookup(word,pos,fromError=false){
  const simple={
    adventure:{meaning:'cuộc phiêu lưu, cuộc mạo hiểm',ipa:'/ədˈven.tʃər/',example:'It was an unforgettable adventure.',imageSearchKeyword:'adventure travel mountains'},
    improve:{meaning:'cải thiện, tiến bộ',ipa:'/ɪmˈpruːv/',example:'I want to improve my English.',imageSearchKeyword:'learning improvement study'},
    confident:{meaning:'tự tin',ipa:'/ˈkɒn.fɪ.dənt/',example:'She feels confident when speaking English.',imageSearchKeyword:'confident student speaking'},
    airport:{meaning:'sân bay',ipa:'/ˈeə.pɔːt/',example:'We arrived at the airport early.',imageSearchKeyword:'airport terminal airplane'}
  };
  const found=simple[word.toLowerCase()]||{meaning:`[Demo] Nghĩa tiếng Việt của “${word}”`,ipa:'',example:`Example sentence with ${word}.`,imageSearchKeyword:`${word} concept`};
  return {...found,word,pos,note:fromError?'Cloud Function chưa hoạt động nên đang dùng dữ liệu dự phòng.':'Bản demo AI. Deploy Cloud Function để dùng Gemini thật.'};
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
