export const RARITIES=[{rank:'C',chance:50,color:'#a7bccb'},{rank:'B',chance:30,color:'#53cda8'},{rank:'A',chance:14,color:'#689aff'},{rank:'S',chance:5,color:'#bf7aff'},{rank:'SS',chance:1,color:'#ffcd57'}];
export const CHARACTERS=[
 {id:'mochi',name:'Mochi',rank:'C',kind:'blob',color:'#94baca',emoji:'☁️',description:'Mây nhỏ mềm mại · chào, nhún nhảy',actions:['wave','happy']},
 {id:'pico',name:'Pico',rank:'C',kind:'robot',color:'#a6afc5',emoji:'🤖',description:'Robot tập sự · chào, nhún nhảy',actions:['wave','happy']},
 {id:'minto',name:'Minto',rank:'B',kind:'cat',color:'#68d9b1',emoji:'🐱',description:'Mèo bạc hà · chào, nhảy, xoay',actions:['wave','happy','spin']},
 {id:'bunny',name:'Bun Bun',rank:'B',kind:'rabbit',color:'#e5a5d3',emoji:'🐰',description:'Thỏ hồng · tai đung đưa, nhảy, xoay',actions:['wave','happy','spin']},
 {id:'luna',name:'Luna',rank:'A',kind:'fox',color:'#76a5ff',emoji:'🦊',description:'Cáo ánh trăng · đuôi, hào quang, động viên',actions:['wave','happy','spin','cheer']},
 {id:'nova',name:'Nova',rank:'S',kind:'dragon',color:'#b587fa',emoji:'🐉',description:'Rồng tinh tú · cánh, phép thuật, nhảy múa',actions:['wave','happy','spin','cheer','magic','dance']},
 {id:'aurora',name:'Aurora',rank:'SS',kind:'angel',color:'#ffd16d',emoji:'👑',description:'Thiên thần AYK · vương miện, cánh, cực quang',actions:['wave','happy','spin','cheer','magic','dance','heart']}
];
export const emptyGacha=()=>({tickets:0,inventory:{},rewards:{},draws:{},equipped:'',drawCount:0});
export function chooseCharacter(unit,variantUnit=.5){let n=Math.max(0,Math.min(.999999999,unit))*100;const rarity=RARITIES.find(r=>(n-=r.chance)<0)||RARITIES[4];const pool=CHARACTERS.filter(c=>c.rank===rarity.rank);const offset=Math.max(0,Math.min(.999999999,variantUnit));return pool[Math.floor(offset*pool.length)];}
export function awardTicket(current,result){const g={...emptyGacha(),...current};if(result?.mode!=='listening-stress'||result.score<75||result.total!==20||!result.attemptId)return g;if(g.rewards?.[result.attemptId])return g;return {...g,tickets:g.tickets+1,rewards:{...g.rewards,[result.attemptId]:true}};}
export function applyDraw(current,drawId,characterId){const g={...emptyGacha(),...current};if(g.draws?.[drawId])return g;if(g.tickets<1||!CHARACTERS.some(c=>c.id===characterId))return;const draws={...g.draws,[drawId]:characterId};const recent=Object.keys(draws).slice(-10);return {...g,tickets:g.tickets-1,inventory:{...g.inventory,[characterId]:(g.inventory?.[characterId]||0)+1},equipped:g.equipped||characterId,drawCount:g.drawCount+1,draws:Object.fromEntries(recent.map(k=>[k,draws[k]]))};}
