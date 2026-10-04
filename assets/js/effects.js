const reduced=()=>document.body.classList.contains('low-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function animateStudyView(root){
 if(reduced())return;
 const cards=root.querySelectorAll('.welcome-grid,.inspiration-grid,.page-title,.flash-card,.play-card,.journey-step,.vocab-card,.feature-card,.panel,.admin-banner,.session-card');
 [...cards].slice(0,30).forEach((el,i)=>el.animate?.([{opacity:0,transform:'translateY(24px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:600,delay:Math.min(i*35,280),easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
}
export function celebrateStudy(){
 if(reduced()||!document.createElement)return;
 document.querySelector('.study-confetti')?.remove();
 const layer=document.createElement('div');layer.className='study-confetti';layer.setAttribute('aria-hidden','true');
 for(let i=0;i<24;i++){
  const particle=document.createElement('i');particle.style.cssText=`--x:${Math.random()*100}vw;--drift:${Math.random()*160-80}px;--delay:${Math.random()*200}ms;--turn:${Math.random()*540}deg;background:${['#a78bfa','#f9bf55','#5ed7b2','#f59cac'][i%4]}`;layer.append(particle);
 }
 document.body.append(layer);setTimeout(()=>layer.remove(),1800);
}
export function setupStudyEffects(){
 if(!document.addEventListener)return;
 const view=document.querySelector('#viewRoot');
 if(view&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{if(records.some(r=>r.target===view))animateStudyView(view)}).observe(view,{childList:true});
 let pointerFrame=0;
 document.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||reduced()||pointerFrame)return;
  const card=event.target.closest?.('.play-card,.feature-card,.vocab-card,.discovery-card');if(!card)return;
  const x=event.clientX,y=event.clientY;
  pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(!card.isConnected||reduced())return;const rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',(x-rect.left)+'px');card.style.setProperty('--spot-y',(y-rect.top)+'px')});
 },{passive:true});
 document.addEventListener('click',event=>{ 
  const button=event.target.closest?.('button');if(!button||button.disabled||reduced())return;
  button.animate?.([{scale:'1'},{scale:'.96'},{scale:'1'}],{duration:220,easing:'ease-out'});
 });
}
