const POS={Noun:'n',Verb:'v',Adjective:'adj',Adverb:'adv'};
export function cleanWikiText(value){
  let text=String(value||'').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/\s*>/g,'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/'{2,5}/g,'');
  text=text.replace(/\{\{(?:l|m|link|mention)\|en\|([^|}]+)(?:\|([^|}]+))?\}\}/g,(_,word,label)=>label||word);
  text=text.replace(/\{\{(?:gloss|non-gloss definition)\|([^{}]+)\}\}/g,'$1').replace(/\{\{[^{}]*\}\}/g,'').replace(/<[^>]+>/g,'');
  return text.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
}
export function readWiktionary(text){
  const english=String(text||'').split(/^==\s*English\s*==\s*$/m)[1]?.split(/^==[^=].*==\s*$/m)[0]||'';
  const ipa=english.match(/\{\{IPA\|en\|([^|}]+)/)?.[1]||'';
  const entries=[];let current=null,level=0,pending=null;
  for(const line of english.split('\n')){
    const heading=line.match(/^(={3,6})\s*([^=]+?)\s*\1\s*$/);
    if(heading){
      const pos=POS[heading[2].trim()];
      if(pos){current=pos;level=heading[1].length;pending=null;}
      else if(heading[1].length<=level){current=null;pending=null;}
      continue;
    }
    if(!current)continue;
    if(/^#\s+/.test(line)&&!/\{\{lb\|en\|[^}]*\b(?:obsolete|archaic|rare)\b/.test(line)){
      const definition=cleanWikiText(line.replace(/^#\s+/,''));
      if(definition&&!definition.includes('{{')){pending={pos:current,definition,example:'',meaning:''};entries.push(pending);}
      continue;
    }
    const usage=line.match(/^#:\s*\{\{(?:ux|usex|uxi)\|en\|([^{}]+)\}\}/);
    if(usage&&pending&&!pending.example){
      const example=cleanWikiText(usage[1].split('|')[0]);
      if(example.length<300)pending.example=example;
    }
    if(/^\*\s*Vietnamese\s*:/.test(line)){
      const terms=[...line.matchAll(/\{\{t\+?\|vi\|([^|}]+)/g)].map(m=>cleanWikiText(m[1])).filter(Boolean);
      const target=entries.find(s=>s.pos===current&&!s.meaning);
      if(target&&terms.length)target.meaning=[...new Set(terms)].slice(0,5).join(', ');
    }
  }
  const senses=Object.values(POS).map(pos=>entries.find(s=>s.pos===pos&&s.example)||entries.find(s=>s.pos===pos)).filter(Boolean);
  return {partsOfSpeech:senses.map(s=>s.pos),senses,ipa};
}
export function decodeTranslation(text){
  return String(text||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim();
}
export function validateTranslation(response){
  if(response?.quotaFinished||Number(response?.responseStatus)!==200)throw new Error(response?.quotaFinished?'Dịch vụ dịch đã hết hạn mức miễn phí hôm nay. Thử lại sau.':'Dịch vụ dịch đang bận. Thử lại sau.');
  const text=decodeTranslation(response?.responseData?.translatedText);
  if(!text||/MYMEMORY WARNING|USED ALL AVAILABLE|INVALID LANGUAGE PAIR|QUERY LENGTH LIMIT/i.test(text))throw new Error('Dịch vụ dịch chưa trả kết quả hợp lệ.');
  return text;
}
