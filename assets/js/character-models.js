// Independently built rigs: a four-legged dragon and an anime-style humanoid.
export function createDistinctModel(T,character){
 const root=new T.Group(),dragon=character.kind==='dragon';root.name=dragon?'NovaDragonRig':'AuroraAnimeRig';
 const mat=(color,emission=0)=>new T.MeshStandardMaterial({color,roughness:.38,metalness:.08,emissive:color,emissiveIntensity:emission});
 const purple=mat('#8562cf'),membrane=mat('#614498'),gold=mat('#ffe3a0'),white=mat('#fff1ff'),skin=mat('#ffe1d7'),hairMat=mat('#bda2eb'),hairShadow=mat('#8f79c3'),ink=mat('#38304c'),iris=mat('#8669c6'),pink=mat('#f5a4c4'),shine=mat('#adf6ff',.7);
 const mesh=(geometry,material,parent,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;};
 const sphere=(parent,x,y,z,a,b,c,material)=>{const m=mesh(new T.SphereGeometry(1,20,14),material,parent,x,y,z);m.scale.set(a,b,c);return m;};
 const group=(parent,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const tube=(parent,points,radius,material)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,radius,8,false),material,parent);
 const rod=(parent,a,b,r,material)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new T.CylinderGeometry(r,r,d.length(),8),material,parent);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 const cone=(parent,x,y,z,r,h,material)=>mesh(new T.ConeGeometry(r,h,12),material,parent,x,y,z);
 const wingGroups=[],limbs=[],eyeGroups=[],locks=[];let head,tail,jaw;
 if(dragon){
  sphere(root,0,1.02,-.18,.52,.46,.9,purple);sphere(root,0,.84,.3,.39,.29,.6,gold);
  // The dragon has an elongated neck and snout, four paws, a curved tail, and bat wings.
  sphere(root,0,1.35,.58,.27,.44,.32,purple);head=group(root,0,1.72,.82);
  sphere(head,0,0,0,.4,.34,.5,purple);sphere(head,0,-.08,.64,.31,.2,.5,purple);
  jaw=group(head,0,-.22,.55);sphere(jaw,0,0,.1,.29,.095,.42,gold);
  [-1,1].forEach(s=>{sphere(head,s*.21,.05,1.03,.038,.028,.025,ink);const eye=group(head,s*.29,.12,.38);sphere(eye,0,0,0,.12,.15,.065,white);sphere(eye,0,0,.064,.075,.11,.018,iris);sphere(eye,0,0,.083,.025,.08,.012,ink);sphere(eye,-.025,.04,.095,.018,.024,.01,white);eyeGroups.push(eye);const horn=cone(head,s*.25,.46,-.16,.11,.45,gold);horn.rotation.z=-s*.25;const tooth=cone(head,s*.22,-.23,.72,.045,.12,white);tooth.rotation.z=Math.PI;});
  for(const s of [-1,1])for(const z of [-.72,.52]){const leg=group(root,s*.4,.82,z);sphere(leg,0,-.15,0,.14,.28,.16,purple);sphere(leg,0,-.51,.13,.2,.13,.29,purple);[-1,0,1].forEach(k=>{const claw=cone(leg,k*.085,-.51,.38,.035,.12,gold);claw.rotation.x=Math.PI/2;});limbs.push(leg);}
  tail=group(root,0,1,-.94);tube(tail,[[0,0,0],[.2,-.08,-.45],[.65,-.18,-.75],[1.1,.08,-.78],[1.15,.4,-.6]],.13,purple);const tip=cone(tail,1.15,.49,-.6,.2,.25,gold);tip.rotation.z=-.5;
  for(let i=0;i<5;i++)cone(root,0,1.45-i*.018,-.12-i*.18,.09,.23,gold);
  [-1,1].forEach(s=>{const wing=group(root,s*.38,1.34,-.3);wingGroups.push(wing);const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(s*.52,.92);shape.lineTo(s*1.45,.4);shape.quadraticCurveTo(s*1.0,.25,s*1.14,-.25);shape.quadraticCurveTo(s*.69,.1,s*.63,-.39);shape.quadraticCurveTo(s*.3,-.11,0,-.23);shape.closePath();mesh(new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}),membrane,wing);const points=[[s*.52,.92,.05],[s*1.45,.4,.05],[s*1.14,-.25,.05],[s*.63,-.39,.05]];points.forEach(p=>rod(wing,[0,0,.05],p,.025,gold));rod(wing,points[0],points[1],.035,purple);});
 }else{
  // Skin face and large layered anime eyes; the dress and long hair are separate meshes.
  const torso=mesh(new T.CylinderGeometry(.22,.18,.48,24),white,root,0,1.38,0);sphere(root,0,1.74,0,.08,.12,.09,skin);
  head=group(root,0,2.2,0);sphere(head,0,0,0,.45,.5,.37,skin);
  sphere(head,0,.2,-.08,.48,.43,.38,hairShadow);
  [-1,1].forEach(s=>{const eye=group(head,s*.165,-.015,.34);sphere(eye,0,0,0,.105,.14,.04,white);sphere(eye,0,-.008,.042,.064,.112,.023,iris);sphere(eye,0,-.012,.063,.033,.07,.012,ink);sphere(eye,-.023,.044,.076,.022,.029,.009,white);sphere(eye,.02,-.03,.078,.012,.014,.007,white);rod(eye,[-.095,.09,.035],[.095,.105,.035],.012,ink);rod(eye,[s*.08,.09,.04],[s*.13,.12,.04],.011,ink);eyeGroups.push(eye);sphere(head,s*.29,-.15,.29,.07,.028,.028,pink);sphere(head,s*.435,-.09,-.03,.065,.11,.09,skin);});
  sphere(head,0,-.15,.38,.022,.035,.025,skin);sphere(head,0,-.25,.32,.057,.016,.015,pink);
  const bangs=[[-.3,.31,.28],[-.1,.38,.31],[.1,.38,.31],[.3,.31,.28]];bangs.forEach((p,i)=>tube(head,[p,[p[0]*.8,.23,.4],[p[0]+(i<2?.05:-.05),.11,.39]],.07,hairMat));
  [-1,1].forEach(s=>{const lock=group(root,s*.43,2.25,-.15);tube(lock,[[0,0,0],[s*.075,-.38,-.06],[s*.09,-.85,.02],[s*.02,-1.3,.1]],.115,hairMat);tube(lock,[[s*.03,-.08,.075],[s*.12,-.48,.06],[s*.11,-.95,.16]],.035,hairShadow);locks.push(lock);sphere(head,s*.36,.25,.23,.075,.065,.04,gold);});
  const skirt=group(root,0,1.1,0);mesh(new T.CylinderGeometry(.18,.46,.61,32),white,skirt,0,-.28,0);const hem=mesh(new T.TorusGeometry(.45,.032,8,48),gold,skirt,0,-.59,0);hem.rotation.x=Math.PI/2;
  for(let i=0;i<10;i++){const a=i*Math.PI/5;const fold=mesh(new T.ConeGeometry(.07,.47,8),i%2?hairMat:white,skirt,Math.cos(a)*.27,-.29,Math.sin(a)*.27);fold.rotation.z=Math.cos(a)*.25;fold.rotation.x=-Math.sin(a)*.25;}
  const belt=mesh(new T.TorusGeometry(.19,.025,8,40),gold,root,0,1.14,0);belt.rotation.x=Math.PI/2;mesh(new T.OctahedronGeometry(.07),iris,root,0,1.49,.205);
  [-1,1].forEach(s=>{sphere(root,s*.15,.44,0,.08,.21,.085,skin);sphere(root,s*.15,.19,.04,.09,.17,.1,white);sphere(root,s*.15,.095,.14,.12,.07,.18,white);const arm=group(root,s*.23,1.61,0);sphere(arm,s*.01,-.13,0,.08,.19,.08,white);sphere(arm,s*.04,-.38,.015,.055,.16,.06,skin);sphere(arm,s*.04,-.54,.04,.068,.085,.048,skin);const cuff=mesh(new T.TorusGeometry(.068,.013,6,20),gold,arm,s*.04,-.24,0);cuff.rotation.x=Math.PI/2;limbs.push(arm);});
  const tiara=mesh(new T.TorusGeometry(.29,.022,8,40),gold,head,0,.43,0);tiara.rotation.x=Math.PI/2;[-1,0,1].forEach(s=>cone(head,s*.17,.54,.04,.047,.17,gold));
  [-1,1].forEach(s=>{const wing=group(root,s*.2,1.65,-.23);wingGroups.push(wing);for(let i=0;i<6;i++){const feather=sphere(wing,s*(.15+i*.125),.1+i*.10,-.03,.075,.35-i*.015,.045,i%2?white:shine);feather.rotation.z=-s*.6;}});
  rod(root,[-.78,.33,.12],[-.78,1.64,.12],.018,gold);mesh(new T.OctahedronGeometry(.13),shine,root,-.78,1.8,.12);
 }
 const orbit=group(root);const ring=mesh(new T.TorusGeometry(dragon?1.5:1.12,.015,6,64),shine,orbit,0,.22,0);ring.rotation.x=Math.PI/2;
 const spell=group(root,0,dragon?1.45:1.7,dragon?1.95:.6);spell.visible=false;
 if(dragon){const flame=cone(spell,0,0,.35,.22,.8,mat('#ffbe72',.8));flame.rotation.x=Math.PI/2;sphere(spell,0,0,.08,.18,.16,.3,mat('#ffdd8d',.8));}else{sphere(spell,0,0,0,.16,.16,.16,shine);const r=mesh(new T.TorusGeometry(.28,.015,6,40),gold,spell);r.rotation.x=.5;}
 const hearts=group(root);hearts.visible=false;const heartShape=new T.Shape();heartShape.moveTo(0,.04);heartShape.bezierCurveTo(-.14,.16,-.2,-.02,0,-.16);heartShape.bezierCurveTo(.2,-.02,.14,.16,0,.04);for(let i=0;i<4;i++){const h=mesh(new T.ExtrudeGeometry(heartShape,{depth:.025,bevelEnabled:false}),pink,hearts);h.scale.setScalar(.5);}
 const sparkles=group(root);for(let i=0;i<8;i++){const m=mesh(new T.OctahedronGeometry(.035),i%2?shine:gold,sparkles);m.userData.index=i;}
 mesh(new T.CylinderGeometry(dragon?1.25:.8,dragon?1.35:.9,.07,40),mat('#706098'),root,0,.035,0);
 const baseEyeScale=eyeGroups.map(e=>e.scale.y);
 function update(action,t,now,quiet){const wave=quiet?0:Math.sin(now/700),active=t<3;root.rotation.set(0,dragon?-.5:.12,0);root.position.y=wave*.025;head.rotation.set(0,wave*.035,wave*.02);orbit.rotation.y=quiet?0:now/2000;tail&&(tail.rotation.y=wave*.16);locks.forEach((l,i)=>l.rotation.z=(i?1:-1)*wave*.025);eyeGroups.forEach((e,i)=>e.scale.y=baseEyeScale[i]*(quiet?1:Math.sin(now/1400)>.995?.08:1));limbs.forEach((l,i)=>{l.rotation.set(0,0,dragon?0:(i?-.12:.12));});wingGroups.forEach((w,i)=>{w.rotation.set(0,0,(i?1:-1)*wave*.06);});jaw&&(jaw.rotation.x=0);spell.visible=active&&(['magic','roar'].includes(action));hearts.visible=active&&action==='heart';
  if(active){if(action==='wave'){if(dragon){limbs[3].rotation.x=-.75+(quiet?0:Math.sin(t*8)*.15);}else{limbs[1].rotation.z=2.1+(quiet?0:Math.sin(t*9)*.2);}}if(action==='happy'){root.position.y=quiet?0:Math.abs(Math.sin(t*5))*.18;}if(action==='spin')root.rotation.y+=quiet?0:t*Math.PI*2;if(action==='dance'){root.rotation.z=quiet?0:Math.sin(t*5)*.1;head.rotation.z=quiet?0:Math.sin(t*5+.5)*.08;}if(action==='fly'){root.position.y=.35+(quiet?0:Math.sin(t*4)*.08);wingGroups.forEach((w,i)=>w.rotation.z=(i?1:-1)*(quiet?.3:Math.sin(t*8)*.3));if(dragon)limbs.forEach(l=>l.rotation.x=.5);}if(action==='magic'||action==='roar'){if(dragon){jaw.rotation.x=.25;head.rotation.x=-.06;}else{limbs[0].rotation.z=-.9;limbs[1].rotation.z=.9;}}if(action==='heart'&&!dragon){limbs[0].rotation.z=-.75;limbs[1].rotation.z=.75;}if(action==='cheer'){head.rotation.z=-.1;if(!dragon)limbs[1].rotation.z=1.1;}}
  spell.scale.setScalar(quiet?1:1+Math.sin(t*8)*.1);hearts.children.forEach((h,i)=>{h.position.set(Math.sin(i*2)*.65,1+((t*.6+i*.4)%1.5),.5);h.rotation.y=quiet?0:now/1400;});sparkles.children.forEach((s,i)=>{const a=i*Math.PI/4+(quiet?0:now/1800);s.position.set(Math.cos(a)*(dragon?1.4:1.05),1.4+Math.sin(a*2)*.65,Math.sin(a)*.6);s.rotation.y=a;});
 }
 return {root,update};
}
