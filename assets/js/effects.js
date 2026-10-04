const reduced=()=>document.body.classList.contains('low-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function animateStudyView(root){
 if(reduced())return;
 const cards=root.querySelectorAll('.welcome-grid,.inspiration-grid,.page-title,.flash-card,.play-card,.journey-step,.vocab-card,.feature-card');
 [...cards].slice(0,30).forEach((el,i)=>el.animate?.([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:Math.min(i*25,220),easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));
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
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');if(!button||button.disabled||reduced())return;
  button.animate?.([{scale:'1'},{scale:'.96'},{scale:'1'}],{duration:220,easing:'ease-out'});
 });
}
