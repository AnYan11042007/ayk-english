export const POS_TYPES=['n','v','adj','adv'];
export function vocabularyParts(item){
  const source=Array.isArray(item)?item:(item?.partsOfSpeech||String(item?.pos||item||'').split(/[,/\s]+/));
  return [...new Set(source.map(p=>String(p).trim().toLowerCase()).filter(p=>POS_TYPES.includes(p)))];
}
export function vocabularyPosLabel(item){return vocabularyParts(item).join(' / ')}
export function normalizeVocabularyInput(input,pos='n'){
  const text=String(input||'').trim();
  const match=text.match(/^(.*?)\s*\(([a-z,\/\s]+)\)\s*$/i);
  const suffix=match?vocabularyParts(match[2]):[];
  const partsOfSpeech=suffix.length?suffix:vocabularyParts(pos);
  return {word:(suffix.length?match[1]:text).trim().toLowerCase(),pos:partsOfSpeech[0]||'n',partsOfSpeech};
}
export function googleTranslateUrl(input){
  return `https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(normalizeVocabularyInput(input).word)}&op=translate`;
}
export const DICTIONARY_POS={noun:'n',verb:'v',adjective:'adj',adverb:'adv'};
export function readDictionaryEntries(entries){
  const senses=[];
  for(const entry of Array.isArray(entries)?entries:[]){
    for(const meaning of entry.meanings||[]){
      const pos=DICTIONARY_POS[meaning.partOfSpeech];if(!pos)continue;
      const definitions=(meaning.definitions||[]).filter(d=>typeof d.definition==='string');
      const existing=senses.find(s=>s.pos===pos);
      if(existing){if(!existing.example)existing.example=definitions.find(d=>d.example)?.example||'';continue;}
      const chosen=definitions.find(d=>d.example)||definitions[0];senses.push({pos,definition:chosen?.definition||'',example:chosen?.example||''});
    }
  }
  const ipa=(entries||[]).flatMap(e=>[e.phonetic,...(e.phonetics||[]).map(p=>p.text)]).find(Boolean)||'';
  return {partsOfSpeech:senses.map(s=>s.pos),senses,ipa};
}
