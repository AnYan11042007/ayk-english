const cache=new Map();
export function safePronunciationUrl(value){
  try{const u=new URL(String(value).startsWith('//')?'https:'+value:value);return u.protocol==='https:'&&['api.dictionaryapi.dev','upload.wikimedia.org','ssl.gstatic.com'].includes(u.hostname)?u.href:''}catch{return ''}
}
export function englishAudioFiles(text){
  const english=String(text||'').split(/^==\s*English\s*==\s*$/m)[1]?.split(/^==[^=].*==\s*$/m)[0]||'';
  const files=[...english.matchAll(/\{\{audio\|en\|([^|}]+)/g)].map(m=>m[1].trim());
  return [...new Set(files)].sort((a,b)=>Number(/(?:en-us|us|american)/i.test(b))-Number(/(?:en-us|us|american)/i.test(a)));
}
export async function lookupPronunciationAudio(word){
  const key=String(word).toLowerCase();if(cache.has(key))return cache.get(key);
  try{
    const res=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(7000)});
    if(res.ok){const data=await res.json();const phonetics=(Array.isArray(data)?data:[]).flatMap(e=>e.phonetics||[]).filter(p=>safePronunciationUrl(p.audio)).sort((a,b)=>Number(/[-_]us[-_.]/i.test(b.audio))-Number(/[-_]us[-_.]/i.test(a.audio)));
      if(phonetics.length){const p=phonetics[0],entry=data.find(e=>(e.phonetics||[]).includes(p));const result={url:safePronunciationUrl(p.audio),source:p.sourceUrl||`https://dictionaryapi.dev/`,license:p.license?.name||entry?.license?.name||''};cache.set(key,result);return result;}}
  }catch{}
  const query=new URLSearchParams({action:'parse',page:key,prop:'wikitext',format:'json',origin:'*',redirects:'1'});
  const res=await fetch(`https://en.wiktionary.org/w/api.php?${query}`,{signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error('Không tải được phát âm từ từ điển.');
  const data=await res.json(),files=englishAudioFiles(data.parse?.wikitext?.['*']||'');
  if(!files.length)throw new Error('Từ điển chưa có bản ghi âm cho một từ trong bài.');
  const fileQuery=new URLSearchParams({action:'query',titles:files.slice(0,3).map(f=>'File:'+f).join('|'),prop:'imageinfo',iiprop:'url|extmetadata',format:'json',origin:'*'});
  const fileRes=await fetch(`https://en.wiktionary.org/w/api.php?${fileQuery}`,{signal:AbortSignal.timeout(10000)});
  if(!fileRes.ok)throw new Error('Không tải được tệp phát âm.');
  const fileData=await fileRes.json();
  const pages=Object.values(fileData.query?.pages||{});let info;
  for(const name of files){info=pages.find(p=>p.title==='File:'+name)?.imageinfo?.[0];if(safePronunciationUrl(info?.url))break;info=null;}
  if(!info)throw new Error('Không có tệp phát âm phù hợp.');
  const result={url:safePronunciationUrl(info.url),source:info.descriptionurl||`https://en.wiktionary.org/wiki/${encodeURIComponent(key)}`,license:String(info.extmetadata?.LicenseShortName?.value||'').replace(/<[^>]*>/g,'')};cache.set(key,result);return result;
}
export function loadPronunciationElement(url){
  return new Promise((resolve,reject)=>{const audio=new Audio(url);audio.preload='auto';const timeout=setTimeout(()=>finish(new Error('Tải âm thanh quá lâu.')),12000);
    function finish(error){clearTimeout(timeout);audio.removeEventListener('canplaythrough',ready);audio.removeEventListener('error',failed);if(error){audio.src='';reject(error)}else resolve(audio)}
    function ready(){finish()}function failed(){finish(new Error('Không đọc được tệp âm thanh.'))}
    audio.addEventListener('canplaythrough',ready,{once:true});audio.addEventListener('error',failed,{once:true});audio.load();
  });
}
