import { createAuroraSS } from './aurora-ss.js?v=face-v30';
import { createDistinctModel } from './character-models.js?v=face-v30';
let engine;
// Project the same meshes on a 2D canvas when a browser disables WebGL.
function softwareRenderer(T,canvas){
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');let width=220,height=240,loop=0,active=false,last=0;const cache=new Map(),textureCache=new Map(),light=new T.Vector3(-.4,.8,.8).normalize();
 function triangles(geometry){if(cache.has(geometry))return cache.get(geometry);const pos=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index?.array,list=[];for(let i=0;i<(index?.length||pos.count);i+=3){const ids=[0,1,2].map(n=>index?index[i+n]:i+n);const vertices=ids.map(n=>new T.Vector3().fromBufferAttribute(pos,n));const norm=normal?ids.reduce((v,n)=>v.add(new T.Vector3().fromBufferAttribute(normal,n)),new T.Vector3()).normalize():vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();const attr=geometry.attributes.uv,uv=attr?ids.reduce((v,n)=>v.add(new T.Vector2().fromBufferAttribute(attr,n)),new T.Vector2()).multiplyScalar(1/3):null;const materialIndex=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0;const uvs=attr?ids.map(n=>new T.Vector2().fromBufferAttribute(attr,n)):null;list.push({vertices,norm,uv,uvs,materialIndex});}cache.set(geometry,list);return list;}
 function textureColor(texture,uv){
  if(!texture?.image||!uv)return null;let item=textureCache.get(texture);
  if(!item||item.version!==texture.version){const img=texture.image,context=img.getContext?.('2d');if(!context)return null;item={version:texture.version,width:img.width,height:img.height,pixels:context.getImageData(0,0,img.width,img.height).data};textureCache.set(texture,item);}
  const x=Math.max(0,Math.min(item.width-1,Math.round(uv.x*(item.width-1)))),y=Math.max(0,Math.min(item.height-1,Math.round((1-uv.y)*(item.height-1)))),at=(y*item.width+x)*4;
  return [0,1,2].map(i=>Math.pow(item.pixels[at+i]/255,2.2));
 }
 const api={setPixelRatio(){},setSize(w,h){width=w;height=h;canvas.width=w;canvas.height=h;},render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const faces=[];scene.traverse(o=>{if(!o.isMesh)return;let parent=o;while(parent){if(!parent.visible)return;parent=parent.parent;}const nm=new T.Matrix3().getNormalMatrix(o.matrixWorld);for(const tri of triangles(o.geometry)){const material=Array.isArray(o.material)?o.material[tri.materialIndex]:o.material;const tex=textureColor(material.map,tri.uv);const pts=tri.vertices.map(v=>v.clone().applyMatrix4(o.matrixWorld).project(camera));if(pts.some(p=>p.z>1||p.z<-1))continue;const normal=tri.norm.clone().applyMatrix3(nm).normalize(),shade=.65+Math.max(0,normal.dot(light))*.5,base=material.color,em=material.emissive;const color=[base.r,base.g,base.b].map((v,i)=>Math.round(Math.pow(Math.min(1,v*(tex?tex[i]:1)*shade+(em?[em.r,em.g,em.b][i]*(material.emissiveIntensity||0)*.22:0)),1/2.2)*255));faces.push({pts,z:pts.reduce((v,p)=>v+p.z,0)/3,color,texture:material.map?.image,uvs:tri.uvs,shade});}});faces.sort((a,b)=>b.z-a.z);ctx.clearRect(0,0,width,height);for(const f of faces){ctx.fillStyle=`rgb(${f.color.join(',')})`;ctx.beginPath();f.pts.forEach((p,i)=>{const x=(p.x+1)*width/2,y=(1-p.y)*height/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
 if(f.texture&&f.uvs){
  const target=f.pts.map(p=>[(p.x+1)*width/2,(1-p.y)*height/2]),src=f.uvs.map(v=>[v.x*f.texture.width,(1-v.y)*f.texture.height]);
  const [x0,y0]=src[0],[x1,y1]=src[1],[x2,y2]=src[2],det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
  if(Math.abs(det)>.00001){
   const dx1=target[1][0]-target[0][0],dx2=target[2][0]-target[0][0],dy1=target[1][1]-target[0][1],dy2=target[2][1]-target[0][1];
   const a=(dx1*(y2-y0)-dx2*(y1-y0))/det,c=((x1-x0)*dx2-(x2-x0)*dx1)/det,b=(dy1*(y2-y0)-dy2*(y1-y0))/det,d=((x1-x0)*dy2-(x2-x0)*dy1)/det;
   ctx.save();ctx.clip();ctx.transform(a,b,c,d,target[0][0]-a*x0-c*y0,target[0][1]-b*x0-d*y0);ctx.drawImage(f.texture,0,0);ctx.restore();
  }else ctx.fill();
 }else{ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.45;ctx.stroke();}}},setAnimationLoop(fn){active=!!fn;cancelAnimationFrame(loop);if(!fn)return;function tick(now){if(!active)return;if(now-last>80){last=now;fn(now);}loop=requestAnimationFrame(tick);}loop=requestAnimationFrame(tick);},dispose(){active=false;cancelAnimationFrame(loop);cache.clear();textureCache.clear();},forceContextLoss(){}};return api;
}
function loadEngine(){return engine||=new Promise((resolve,reject)=>{if(window.THREE)return resolve(window.THREE);const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';s.onload=()=>resolve(window.THREE);s.onerror=()=>{engine=null;s.remove();reject(new Error('Không tải được 3D. Kiểm tra mạng và thử lại.'));};document.head.append(s);});}
export async function mountCharacter(container,character){
 const T=await loadEngine();if(!container.isConnected)return {act(){},dispose(){}};
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',`Nhân vật 3D ${character.name}`);container.replaceChildren(canvas);
 let renderer;try{renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});}catch{try{renderer=softwareRenderer(T,canvas);}catch{container.textContent='Thiết bị chưa hỗ trợ 3D';return {act(){},dispose(){}};}}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputEncoding=T.sRGBEncoding;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,50);camera.position.set(0,1.95,8.4);camera.lookAt(0,1.45,0);
 scene.add(new T.HemisphereLight(0xeeefff,0x5f437f,1.3));const light=new T.DirectionalLight(0xfff0df,1.5);light.position.set(-3,5,4);scene.add(light);const rim=new T.DirectionalLight(0xaabaff,1.5);rim.position.set(3,3,-3);scene.add(rim);
 const material=color=>new T.MeshStandardMaterial({color,roughness:.3,metalness:.17});const main=material(character.color),white=material('#eee5fc'),dark=material('#26223c'),glow=new T.MeshStandardMaterial({color:character.color,emissive:character.color,emissiveIntensity:.7}),pink=material('#f3a5c8');
 const bot=new T.Group();scene.add(bot);const sphere=(parent,x,y,z,sx,sy,sz,mat)=>{const o=new T.Mesh(new T.SphereGeometry(1,Math.max(sx,sy,sz)<.1?8:24,Math.max(sx,sy,sz)<.1?6:16),mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;};
 if(['dragon','angel'].includes(character.kind)){
  scene.remove(bot);const model=character.kind==='angel'?createAuroraSS(T):createDistinctModel(T,character);
  const pivot=new T.Group();pivot.add(model.root);scene.add(pivot);let action='wave',started=performance.now(),disposed=false,angle=0,zoom=1,drag=null,portrait=false;
  const focus=model.focus||1.4,baseDistance=model.distance||6.8;
  const resize=()=>{const w=container.clientWidth||220,h=container.clientHeight||240;renderer.setSize(w,h,false);camera.aspect=w/h;const target=portrait?(model.portraitFocus||focus):focus,dist=portrait?(model.portraitDistance||baseDistance):baseDistance;camera.position.set(0,target+(portrait?.08:.35),(w/h<.95?dist*1.15:dist)/zoom);camera.lookAt(0,target,0);camera.updateProjectionMatrix();};
  canvas.tabIndex=0;canvas.setAttribute('aria-label',`Mô hình 3D ${character.name}. Kéo để xoay, phím trái phải để xem các góc.`);canvas.style.touchAction='pan-y';
  const down=e=>{drag={x:e.clientX,angle};canvas.setPointerCapture?.(e.pointerId);};
  const move=e=>{if(drag){angle=drag.angle+(e.clientX-drag.x)*.012;}};
  const up=()=>{drag=null;};const key=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();angle+=e.key==='ArrowLeft'?-.25:.25;}};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',key);
  const ro=new ResizeObserver(resize);ro.observe(container);resize();
  renderer.setAnimationLoop(now=>{if(disposed||document.hidden)return;const quiet=matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('low-motion');model.update(action,(now-started)/1000,now,quiet);pivot.rotation.y=angle;renderer.render(scene,camera);});
  return {act(value){action=value;started=performance.now();},zoom(delta){zoom=Math.max(.85,Math.min(1.55,zoom+delta));resize();},portrait(){portrait=!portrait;angle=0;zoom=1;resize();return portrait;},reset(){portrait=false;angle=0;zoom=1;resize();},dispose(){if(disposed)return;disposed=true;ro.disconnect();renderer.setAnimationLoop(null);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',key);scene.traverse(o=>{o.geometry?.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});model.textures?.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
 }
 sphere(bot,0,1,0,.5,.6,.35,main);sphere(bot,0,1,.3,.31,.32,.09,white);sphere(bot,0,1.07,.39,.11,.11,.035,glow);
 const head=new T.Group();head.position.y=1.92;bot.add(head);sphere(head,0,0,0,.65,.53,.45,main);if(character.kind==='robot')sphere(head,0,0,.38,.53,.32,.08,dark);
 const eyes=[-1,1].map(s=>sphere(head,s*.21,.02,.43,.065,.095,.04,character.kind==='robot'?glow:dark));[-1,1].forEach(s=>sphere(head,s*.38,-.13,.41,.07,.03,.02,pink));
 const smile=new T.Mesh(new T.TorusGeometry(.11,.016,8,20,Math.PI),character.kind==='robot'?glow:dark);smile.rotation.z=Math.PI;smile.position.set(0,-.12,.465);head.add(smile);
 const arms=[-1,1].map(s=>{const arm=new T.Group();arm.position.set(s*.48,1.35,0);bot.add(arm);sphere(arm,s*.09,-.23,0,.13,.28,.13,main);sphere(arm,s*.12,-.44,0,.16,.16,.16,white);sphere(bot,s*.24,.32,.05,.19,.22,.24,main);return arm;});
 const ears=[];if(['cat','fox','rabbit'].includes(character.kind))[-1,1].forEach(s=>{const ear=new T.Mesh(character.kind==='rabbit'?new T.SphereGeometry(1,16,12):new T.ConeGeometry(.2,.45,3),main);ear.position.set(s*.35,.52,0);if(character.kind==='rabbit')ear.scale.set(.14,.45,.13);ear.rotation.z=-s*.2;head.add(ear);ears.push(ear);});
 if(character.kind==='robot'){sphere(head,0,.68,0,.07,.13,.07,glow);[-1,1].forEach(s=>sphere(head,s*.66,0,0,.1,.16,.17,white));}
 const tail=['cat','fox','dragon'].includes(character.kind)?sphere(bot,.48,.85,-.3,.17,.53,.18,main):null;if(tail)tail.rotation.z=-.7;
 const wings=[];if(['dragon','angel'].includes(character.kind))[-1,1].forEach(s=>{const wing=new T.Group();wing.position.set(s*.35,1.3,-.25);bot.add(wing);for(let i=0;i<4;i++){const feather=sphere(wing,s*(.23+i*.16),.15+i*.08,0,.15,.42-i*.05,.065,character.kind==='angel'?white:main);feather.rotation.z=-s*.65;}wings.push(wing);});
 const level=['C','B','A','S','SS'].indexOf(character.rank);let halo;if(level>=2){halo=new T.Mesh(new T.TorusGeometry(.46,.025,8,48),glow);halo.position.set(0,2.65,0);halo.rotation.x=Math.PI/2;bot.add(halo);}
 if(level===4){[-1,0,1].forEach(s=>{const crown=new T.Mesh(new T.ConeGeometry(.095,.3,5),glow);crown.position.set(s*.2,2.46,.05);bot.add(crown);});}

 const luxury=new T.Group();bot.add(luxury);const ornaments=[],effectRings=[],hair=material('#d6c8ff'),gold=material('#ffde8b'),ice=material('#b7eeff');
 function crystal(parent,x,y,z,scale,mat=glow){const gem=new T.Mesh(new T.OctahedronGeometry(scale),mat);gem.position.set(x,y,z);parent.add(gem);ornaments.push(gem);return gem;}
 function arc(radius,y,tilt,mat){const ring=new T.Mesh(new T.TorusGeometry(radius,.016,6,64,Math.PI*1.6),mat);ring.position.y=y;ring.rotation.set(Math.PI/2,tilt,.3);luxury.add(ring);effectRings.push(ring);return ring;}
 if(character.kind==='fox'){
  // Moon fox: layered cape, ivory muzzle, oversized two-tone tail and crescent staff.
  sphere(head,0,-.14,.45,.29,.18,.1,white);sphere(head,0,-.09,.55,.06,.045,.045,dark);
  const cape=new T.Mesh(new T.ConeGeometry(.58,.75,24,1,true),material('#314e9b'));cape.position.set(0,.82,-.07);luxury.add(cape);
  sphere(bot,.64,.76,-.27,.25,.64,.28,main).rotation.z=-.65;sphere(bot,.9,1.1,-.25,.22,.28,.25,white).rotation.z=-.65;
  crystal(luxury,0,1.22,.43,.115,ice);arc(.95,.65,.25,ice);
  const staff=new T.Mesh(new T.CylinderGeometry(.022,.022,1.3,8),gold);staff.position.set(-.73,1.13,.12);luxury.add(staff);const moon=new T.Mesh(new T.TorusGeometry(.18,.04,8,24,Math.PI*1.65),ice);moon.position.set(-.73,1.92,.12);moon.rotation.z=.4;luxury.add(moon);
  [-1,1].forEach(k=>crystal(luxury,k*.85,2.1,.1,.075,ice));
 }
 if(character.kind==='dragon'){
  // Star dragon: muzzle, swept horns, wing membranes, scales and floating crystals.
  sphere(head,0,-.17,.42,.38,.22,.24,main);sphere(head,0,-.29,.55,.27,.08,.1,white);
  [-1,1].forEach(k=>{const horn=new T.Mesh(new T.ConeGeometry(.13,.46,12),gold);horn.position.set(k*.38,.49,-.03);horn.rotation.z=-k*.35;head.add(horn);sphere(head,k*.11,-.12,.66,.035,.035,.02,dark);});
  wings.forEach((w,i)=>{const sign=i?1:-1;const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(sign*.7,.85);shape.lineTo(sign*1.12,.22);shape.lineTo(sign*.7,-.02);shape.lineTo(sign*.43,-.3);shape.closePath();const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.05,bevelEnabled:false}),material('#6b49ba'));w.add(mesh);});
  for(let i=0;i<4;i++)crystal(luxury,0,.7+i*.22,.42,.06,gold);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;crystal(luxury,Math.cos(a)*1.14,1.5+Math.sin(a)*.65,.1,.09,ice);}
  arc(1.15,.4,.35,glow);arc(.9,1.45,-.3,ice);
 }
 if(character.kind==='angel'){
  // Royal aurora: flowing lilac hair, layered gown, feathered wings and a star sceptre.
  sphere(head,0,.17,-.07,.7,.5,.44,hair);sphere(head,0,.03,.1,.51,.42,.36,white);
  [-1,1].forEach(k=>{sphere(head,k*.52,-.23,-.05,.18,.6,.2,hair);sphere(head,k*.3,.37,.34,.27,.13,.12,hair);});
  eyes.forEach(e=>{e.material=material('#7858b1');e.position.z=.46;});
  const gown=new T.Mesh(new T.ConeGeometry(.6,.85,32),white);gown.position.set(0,.78,.02);luxury.add(gown);
  const hem=new T.Mesh(new T.TorusGeometry(.58,.035,8,40),gold);hem.rotation.x=Math.PI/2;hem.position.set(0,.37,.02);luxury.add(hem);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;sphere(luxury,Math.cos(a)*.4,.63,Math.sin(a)*.28,.17,.35,.08,i%2?hair:white);}
  crystal(luxury,0,1.23,.45,.14,gold);sphere(luxury,0,1.05,.43,.04,.08,.02,gold);
  wings.forEach((w,i)=>{for(let j=0;j<4;j++){const feather=sphere(w,(i?1:-1)*(.46+j*.18),.45+j*.11,-.06,.13,.48-j*.035,.08,j%2?white:ice);feather.rotation.z=(i?-1:1)*.7;}});
  const staff=new T.Mesh(new T.CylinderGeometry(.025,.025,1.5,12),gold);staff.position.set(-.88,1.04,.2);luxury.add(staff);crystal(luxury,-.88,1.88,.2,.18,gold);
  const crownBand=new T.Mesh(new T.TorusGeometry(.36,.036,8,40),gold);crownBand.rotation.x=Math.PI/2;crownBand.position.y=2.38;luxury.add(crownBand);
  arc(1.25,.36,.25,gold);arc(1.13,1.65,-.35,hair);arc(.84,2.18,.2,ice);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;crystal(luxury,Math.cos(a)*1.3,1.4+Math.sin(a)*.75,Math.sin(a)*.25,.055,i%2?gold:hair);}
 }
 const spellOrb=new T.Group();spellOrb.position.set(0,1.6,.9);bot.add(spellOrb);sphere(spellOrb,0,0,0,.2,.2,.2,glow);const spellRing=new T.Mesh(new T.TorusGeometry(.32,.022,8,40),ice);spellOrb.add(spellRing);spellOrb.visible=false;
 const hearts=new T.Group();bot.add(hearts);for(let i=0;i<5;i++){const h=new T.Group();sphere(h,-.05,.025,0,.07,.07,.035,pink);sphere(h,.05,.025,0,.07,.07,.035,pink);const tip=new T.Mesh(new T.ConeGeometry(.1,.13,3),pink);tip.rotation.z=Math.PI;tip.position.y=-.035;h.add(tip);hearts.add(h);}hearts.visible=false;
 const particles=new T.Group();scene.add(particles);for(let i=0;i<(level+1)*5;i++)sphere(particles,0,0,0,.025,.025,.025,i%2?glow:pink);
 const platform=new T.Mesh(new T.CylinderGeometry(.85,.95,.09,48),material('#76639c'));platform.position.y=.04;scene.add(platform);
 let action='wave',started=performance.now(),disposed=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const resize=()=>{const w=container.clientWidth||220,h=container.clientHeight||240;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(container);resize();
 function act(value){action=value;started=performance.now();}
 renderer.setAnimationLoop(now=>{if(disposed||document.hidden)return;const t=(now-started)/1000,quiet=reduced||document.body.classList.contains('low-motion'),idle=quiet?0:Math.sin(now/650);luxury.rotation.y=idle*.035;effectRings.forEach((r,i)=>{r.rotation.z=quiet?0:now/(1600+i*450)*(i%2?-1:1);});ornaments.forEach((o,i)=>{o.rotation.y=quiet?0:now/1200+i;});spellOrb.visible=t<3&&action==='magic';spellOrb.rotation.y=now/700;spellOrb.scale.setScalar(1+Math.sin(t*5)*.12);hearts.visible=t<3&&action==='heart';hearts.children.forEach((h,i)=>{h.position.set(Math.sin(i*2)*.8,.9+((t*.6+i*.25)%1.8),.55);});bot.position.y=idle*.04;bot.rotation.y=.14;bot.rotation.z=0;head.rotation.z=idle*.03;arms[0].rotation.z=.12;arms[1].rotation.z=-.12;eyes.forEach(e=>e.scale.y=.095);ears.forEach((e,i)=>e.rotation.z=(i?-.2:.2)+idle*.08);wings.forEach((w,i)=>w.rotation.y=(i?1:-1)*idle*.25);if(tail)tail.rotation.x=idle*.25;if(halo)halo.rotation.z=now/1800;
  if(t<3){if(action==='wave')arms[1].rotation.z=2.3+(reduced?0:Math.sin(t*10)*.3);if(['happy','dance'].includes(action)){bot.position.y=reduced?0:Math.abs(Math.sin(t*6))*.28;arms[0].rotation.z=-2;arms[1].rotation.z=2;bot.rotation.z=action==='dance'?Math.sin(t*7)*.18:0;}if(action==='spin')bot.rotation.y=t*Math.PI*2;if(action==='cheer'){head.rotation.z=-.12;arms[1].rotation.z=1.3;}if(action==='magic'||action==='heart'){arms[0].rotation.z=-1.3;arms[1].rotation.z=1.3;bot.position.y=.15;}}
  particles.visible=level>=2||(['magic','happy','heart'].includes(action)&&t<3);particles.children.forEach((p,i)=>{const a=i/particles.children.length*Math.PI*2+(quiet?0:now/1400);p.position.set(Math.cos(a)*(1+level*.09),1.3+Math.sin(a*2+now/900)*.7,Math.sin(a)*.5);});renderer.render(scene,camera);
 });
 return {act,dispose(){if(disposed)return;disposed=true;ro.disconnect();renderer.setAnimationLoop(null);scene.traverse(o=>{o.geometry?.dispose();if(o.material) o.material.dispose();});model.textures?.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
