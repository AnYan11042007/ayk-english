export const defaultCategories=[{id:'foundations',name:'Tiếng Anh nền tảng',description:'Từ vựng cơ bản và thói quen học mỗi ngày.'}];
const titles={1:'Đồ vật & cuộc sống',2:'Hoạt động mỗi ngày',3:'Miêu tả con người & sự vật',4:'Tần suất & cách thức'};
export function buildLessons(vocab,stored=[]){
  const map=new Map(stored.map(x=>[Number(x.number||x.id),{...x,number:Number(x.number||x.id)}]));
  for(const v of vocab){const n=Number(v.session)||1;if(!map.has(n))map.set(n,{number:n,name:titles[n]||v.topic||`Buổi ${n}`,categoryId:'foundations',description:''})}
  return [...map.values()].sort((a,b)=>a.number-b.number);
}
export function categoryForWord(word,lessons){return lessons.find(x=>x.number===Number(word.session))?.categoryId||'foundations'}
