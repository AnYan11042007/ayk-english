// Original articulated 3D celestial mage. All surfaces are meshes, including the face,
// layered hair, embroidered gown, crystal wings, staff and dragon familiar.
export function createAuroraSS(T){
 const root=new T.Group();root.name='AuroraCelestialMageSS';
 const material=(color,metalness=.08,emissive=0)=>new T.MeshStandardMaterial({color,roughness:.34,metalness,emissive:color,emissiveIntensity:emissive,side:T.DoubleSide});
 const skin=material('#ffe1d3'),rose=material('#eaa0b6'),lip=material('#bb617f'),ivory=material('#f1ecff'),navy=material('#24224e'),indigo=material('#45417c'),gold=material('#e8c478',.72),hair=material('#ddd4f5',.16),hairShade=material('#a69bc8'),ink=material('#30263e'),iris=material('#9370dc'),white=material('#fffaff'),cyan=material('#91e5f5',.28,.2),violet=material('#b6a2ef',.28,.14);
 const mesh=(parent,geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;};
 const group=(parent,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const ell=(p,x,y,z,a,b,c,mat,segments=16)=>{const o=mesh(p,new T.SphereGeometry(1,segments,12),mat,x,y,z);o.scale.set(a,b,c);return o;};
 const curve=(p,points,r,mat)=>mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),12,r,5,false),mat);
 const rod=(p,a,b,r,mat)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const o=mesh(p,new T.CylinderGeometry(r,r,d.length(),8),mat);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const ring=(p,r,t,mat,x=0,y=0,z=0)=>mesh(p,new T.TorusGeometry(r,t,6,40),mat,x,y,z);
 const gem=(p,x,y,z,size,mat=cyan)=>mesh(p,new T.OctahedronGeometry(size),mat,x,y,z);
 const star=(p,x,y,z,size,mat=gold)=>{const s=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?size*.42:size;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?s.lineTo(px,py):s.moveTo(px,py);}s.closePath();return mesh(p,new T.ExtrudeGeometry(s,{depth:.018,bevelEnabled:false}),mat,x,y,z);};
 // Tapered, solid ribbon: sculpted locks and flowing fabric have width and thickness.
 function ribbon(p,points,widths,mat,thickness=.018){
  const path=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),pos=[],indices=[],steps=14;
  for(let i=0;i<=steps;i++){const u=i/steps,v=path.getPoint(u),t=path.getTangent(u),side=new T.Vector3(t.y,-t.x,0).normalize();const q=u*(widths.length-1),j=Math.min(widths.length-2,Math.floor(q)),w=(widths[j]+(widths[j+1]-widths[j])*(q-j));for(const [s,z]of [[-1,-1],[1,-1],[-1,1],[1,1]])pos.push(v.x+side.x*w*s,v.y+side.y*w*s,v.z+z*thickness);}
  for(let i=0;i<steps;i++){const a=i*4,b=a+4;for(const [j,k]of [[0,1],[2,3],[0,2],[1,3]])indices.push(a+j,b+j,a+k,a+k,b+j,b+k);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();return mesh(p,g,mat);
 }
 const body=group(root);body.name='MageBody';
 // Slim adult anime proportions: sculpted jaw, narrow neck, articulated shoulders.
 const torsoProfile=[[.13,2.23],[.18,2.32],[.22,2.43],[.21,2.58],[.26,2.78],[.23,2.9],[.11,2.97]];
 const bodice=mesh(body,new T.LatheGeometry(torsoProfile.map(v=>new T.Vector2(...v)),24),navy);bodice.scale.z=.75;
 ell(body,0,3.02,0,.087,.14,.084,skin);ell(body,0,2.86,0,.235,.11,.15,skin);
 const waist=ring(body,.17,.016,gold,0,2.36,0);waist.rotation.x=Math.PI/2;waist.scale.z=.8;
 for(const s of [-1,1]){
  curve(body,[[s*.2,2.91,.09],[s*.18,2.77,.19],[s*.11,2.63,.175],[s*.12,2.42,.145]],.009,gold);
  curve(body,[[0,2.38,.15],[s*.15,2.47,.17],[s*.2,2.61,.17]],.009,gold);
  curve(body,[[s*.14,2.83,.15],[s*.1,2.74,.19],[0,2.69,.2]],.01,gold);
 }
 gem(body,0,2.74,.205,.065,violet);star(body,0,2.39,.17,.09);
 const neckRing=ring(body,.094,.009,gold,0,3.055,0);neckRing.rotation.x=Math.PI/2;
 const head=group(body,0,3.38,0);head.name='SculptedAnimeFace';
 const faceGeometry=new T.SphereGeometry(1,32,24),p=faceGeometry.attributes.position;
 for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const jaw=y<-.1?1-(-y-.1)*.39:1;p.setXYZ(i,x*.32*jaw,y*.405,z*.27*(z>0?1:1.05));}faceGeometry.computeVertexNormals();mesh(head,faceGeometry,skin);
 for(const s of [-1,1])ell(head,s*.3,-.025,0,.043,.073,.03,skin);
 const eyes=[];
 for(const s of [-1,1]){
  const e=group(head,s*.13,.015,.244);e.rotation.y=s*.12;eyes.push(e);
  const shape=new T.Shape();shape.moveTo(-.103,.014);shape.bezierCurveTo(-.065,.09,.055,.089,.103,.025);shape.bezierCurveTo(.064,-.058,-.058,-.058,-.103,.014);
  mesh(e,new T.ShapeGeometry(shape,12),white);
  ell(e,0,.005,.008,.053,.066,.013,iris,20);ell(e,0,.005,.022,.024,.051,.008,ink);
  ell(e,-.018,.035,.029,.018,.021,.006,white,8);ell(e,.019,-.02,.027,.009,.01,.005,cyan,8);
  curve(e,[[-.103,.014,.012],[-.065,.072,.013],[.03,.078,.013],[.103,.025,.012]],.008,ink);
  for(let k=0;k<3;k++)rod(e,[s*(.072+k*.011),.05-k*.006,.014],[s*(.12+k*.014),.087-k*.013,.014],.004,ink);
  curve(head,[[s*.055,.14,.255],[s*.13,.155,.26],[s*.2,.139,.236]],.006,hairShade);
  ell(head,s*.212,-.115,.221,.055,.015,.004,rose,12);
 }
 // Separate nose bridge and subtle two-lip smile, rather than a dot face.
 ell(head,0,-.07,.273,.018,.048,.023,skin,12);ell(head,0,-.108,.29,.026,.018,.019,skin,12);
 curve(head,[[-.046,-.207,.23],[0,-.218,.25],[.046,-.202,.23]],.006,lip);
 ell(head,0,-.23,.235,.036,.009,.008,rose,12);
 // Hair cap covers the scalp only; back layers and curved bangs leave the eyes visible.
 const cap=mesh(head,new T.SphereGeometry(1,24,14,0,Math.PI*2,0,1.5),hair);cap.scale.set(.338,.427,.29);cap.position.y=.018;
 const hairBack=ell(head,0,.06,-.12,.335,.35,.21,hairShade,24);
 const locks=[];
 for(let i=0;i<12;i++){
  const a=.25+(i/11)*(Math.PI-.5),x=Math.cos(a)*.305,z=-Math.sin(a)*.22;
  const l=group(head,x,.2,z);ribbon(l,[[0,0,0],[x*.22,-.43,-.09],[x*.42,-.95,.015],[x*.75,-1.46,.13],[x*.35,-1.8,.22]],[.085,.105,.08,.07,.001],i%3?hair:hairShade);
  curve(l,[[.005,-.08,.022],[x*.22,-.5,-.065],[x*.43,-1.03,.045],[x*.63,-1.47,.165]],.005,ivory);locks.push(l);
 }
 for(const s of [-1,1]){
  for(let i=0;i<3;i++)ribbon(head,[[s*(.02+i*.07),.4,.12],[s*(.1+i*.06),.31,.26],[s*(.11+i*.065),.17,.294],[s*(.16+i*.061),.105,.27]],[.047,.053,.04,.001],i%2?hairShade:hair);
  ribbon(head,[[s*.285,.25,.14],[s*.33,-.13,.08],[s*.35,-.62,.05],[s*.47,-1.04,.16]],[.067,.085,.053,.001],hair);
  curve(head,[[s*.32,.09,.15],[s*.35,-.08,.08]],.012,gold);gem(head,s*.35,-.115,.08,.052,violet);
 }
 const tiara=ring(head,.275,.012,gold,0,.34,0);tiara.rotation.x=Math.PI/2;
 for(let i=-2;i<=2;i++){const x=i*.102,y=.36+(2-Math.abs(i))*.05;curve(head,[[x-.055,.33,.1],[x,y+.065,.14],[x+.055,.33,.1]],.009,gold);star(head,x,y+.066,.145,i===0?.075:.035);}
 // Two legs and fitted boots remain visible beneath a split, flowing layered gown.
 const legs=[];
 for(const s of [-1,1]){
  const leg=group(body,s*.115,2.29,0);legs.push(leg);
  ell(leg,0,-.41,0,.088,.43,.08,skin);ell(leg,0,-1.05,0,.073,.36,.077,skin);
  const boot=mesh(leg,new T.CylinderGeometry(.077,.066,.6,12),navy,0,-1.58,.02);
  ell(leg,0,-1.92,.095,.082,.057,.145,navy);curve(leg,[[-.058,-1.32,.06],[0,-1.42,.092],[.055,-1.32,.06]],.009,gold);curve(leg,[[0,-1.4,.098],[0,-1.86,.104],[0,-1.92,.21]],.008,gold);
 }
 const skirt=group(body,0,2.34,0);skirt.name='EmbroideredLayeredGown';const cloth=[];
 // Twelve individually curved panels. A front opening reveals the boots.
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,z=Math.cos(a),x=Math.sin(a),front=z>.65;
  const panel=group(skirt);const length=front?1.03:1.98;
  const points=[[x*.17,0,z*.13],[x*.29,-.52,z*.22],[x*.46,-length*.78,z*.34],[x*.56,-length,z*.43]];
  ribbon(panel,points,[.06,.13,.145,.06],i%3===0?indigo:ivory,.013);
  for(const side of [-1,1])curve(panel,points.map((v,j)=>[v[0]+side*[.057,.122,.136,.055][j],v[1],v[2]+.017]),.006,gold);
  if(!front){star(panel,x*.41,-1.22,z*.34+.02,.045,gold);gem(panel,x*.49,-1.64,z*.39,.032,violet);}
  cloth.push(panel);
 }
 for(const s of [-1,1]){
  ribbon(skirt,[[s*.16,-.05,.16],[s*.28,-.58,.31],[s*.34,-1.3,.25],[s*.56,-1.98,.34]],[.07,.13,.11,.025],navy);
  curve(skirt,[[s*.19,-.2,.19],[s*.35,-.62,.33],[s*.36,-1.3,.285],[s*.57,-1.98,.36]],.008,gold);
 }
 // Articulated arm + elbow + wrist + fingers. The staff follows the left hand.
 const arms=[];
 for(const s of [-1,1]){
  const shoulder=group(body,s*.236,2.88,0);shoulder.name=s<0?'StaffShoulder':'GreetingShoulder';
  ell(shoulder,s*.018,-.09,0,.069,.17,.067,skin);ell(shoulder,0,.008,0,.09,.06,.086,gold);
  const elbow=group(shoulder,0,-.34,0);ell(elbow,0,-.18,0,.052,.2,.05,skin);
  const cuff=ring(elbow,.058,.01,gold,0,-.3,0);cuff.rotation.x=Math.PI/2;
  ribbon(elbow,[[0,-.12,-.02],[s*.11,-.4,-.06],[s*.17,-.77,-.02]],[.07,.145,.045],ivory);
  const hand=group(elbow,0,-.39,.01);ell(hand,0,-.042,0,.054,.072,.022,skin,12);
  for(let f=0;f<4;f++)curve(hand,[[(f-1.5)*.023,-.073,.005],[(f-1.5)*.024,-.132,.01],[(f-1.5)*.025,-.152,.025]],.01,skin);
  curve(hand,[[s*.037,-.018,.005],[s*.068,-.061,.015],[s*.058,-.081,.034]],.012,skin);
  arms.push({shoulder,elbow,hand});
 }
 const staff=group(arms[0].hand,-.02,-.08,.055);staff.name='OrbitingCrystalStaff';
 rod(staff,[0,-1.32,0],[0,1.03,0],.015,gold);rod(staff,[0,-.82,0],[0,.72,0],.025,navy);
 const crystal=gem(staff,0,1.19,0,.16,violet);crystal.scale.y=1.5;
 const staffRings=[];for(let i=0;i<3;i++){const r=ring(staff,.23+i*.025,.009,gold,0,1.19,0);r.rotation.set(i*.8,.5+i*.7,.3);staffRings.push(r);}star(staff,0,1.55,0,.068);
 // Faceted crystal feathers with gold ribs; both wings are articulated at the back.
 const wings=[];
 for(const s of [-1,1]){
  const wing=group(body,s*.17,2.83,-.18);wing.name=s<0?'LeftCrystalWing':'RightCrystalWing';wings.push(wing);
  for(let i=0;i<7;i++){
   const a=.38+i*.23,end=[s*(.54+Math.sin(a)*.84),.7-i*.18,-.16-i*.045];
   const shard=mesh(wing,new T.OctahedronGeometry(1),i%2?violet:cyan);const start=new T.Vector3(s*.13,.02,-.025),tip=new T.Vector3(...end),d=tip.clone().sub(start);shard.position.copy(start.clone().add(tip).multiplyScalar(.5));shard.scale.set(.10+(i%2)*.018,d.length()*.64,.04);shard.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
   rod(wing,[s*.08,0,.012],end.map((v,k)=>k===2?v+.045:v),.008,gold);gem(wing,...end,.035,gold);
  }
  curve(wing,[[0,0,0],[s*.25,.39,-.06],[s*.6,.68,-.15],[s*1.03,.77,-.2]],.014,gold);
 }
 // The familiar is a separate miniature dragon, with snout, four paws and fluttering wings.
 const familiar=group(root,.83,3.24,.14);familiar.name='CelestialDragonFamiliar';
 ell(familiar,0,0,0,.13,.14,.23,ivory);ell(familiar,0,.12,.17,.16,.14,.16,ivory);ell(familiar,0,.065,.34,.11,.065,.13,ivory);
 for(const s of [-1,1]){
  ell(familiar,s*.105,.153,.285,.041,.052,.024,iris,12);ell(familiar,s*.108,.169,.305,.012,.016,.007,white,8);
  const horn=mesh(familiar,new T.ConeGeometry(.033,.13,8),gold,s*.085,.29,.13);horn.rotation.z=-s*.3;
  for(const z of [-.09,.15])ell(familiar,s*.11,-.13,z,.038,.083,.045,ivory,12);
 }
 curve(familiar,[[0,0,-.18],[.13,-.06,-.31],[.24,.05,-.43],[.27,.14,-.37]],.034,ivory);gem(familiar,.27,.14,-.37,.058,violet);
 const dragonWings=[];for(const s of [-1,1]){const w=group(familiar,s*.08,.06,-.06);dragonWings.push(w);const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(s*.21,.25);shape.lineTo(s*.45,.08);shape.lineTo(s*.33,-.11);shape.lineTo(s*.15,-.08);shape.closePath();mesh(w,new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false}),violet);rod(w,[0,0,.02],[s*.21,.25,.02],.009,gold);rod(w,[s*.21,.25,.02],[s*.45,.08,.02],.008,gold);}
 // Magic platform, orbiting stars, a hand-held spell and animated hearts are 3D too.
 const platform=group(root);platform.name='StarCirclePlatform';mesh(platform,new T.CylinderGeometry(.82,.89,.07,48),navy,0,.10,0);
 const orbits=[];for(const r of [.71,.82]){const o=ring(platform,r,.01,gold,0,.142,0);o.rotation.x=Math.PI/2;orbits.push(o);}for(let i=0;i<12;i++){const a=i*Math.PI/6;const st=star(platform,Math.cos(a)*.77,.145,Math.sin(a)*.77,.035);st.rotation.x=-Math.PI/2;}
 const sparkles=group(root);const stars=[];for(let i=0;i<12;i++)stars.push(star(sparkles,0,0,0,i%3?.028:.048,i%2?gold:cyan));
 const spell=group(arms[1].hand,0,-.2,.14);spell.name='StarSpell';spell.visible=false;gem(spell,0,0,0,.13,cyan);const spellRing=ring(spell,.24,.012,gold);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;star(spell,Math.cos(a)*.3,Math.sin(a)*.3,0,.05);}
 const hearts=group(root);hearts.visible=false;const hs=new T.Shape();hs.moveTo(0,.02);hs.bezierCurveTo(-.13,.15,-.18,-.015,0,-.15);hs.bezierCurveTo(.18,-.015,.13,.15,0,.02);for(let i=0;i<5;i++)mesh(hearts,new T.ExtrudeGeometry(hs,{depth:.028,bevelEnabled:false}),rose);
 function update(action,t,now,quiet){
  const clock=quiet?0:now/1000,w=Math.sin(clock*1.5),active=t<4;
  root.rotation.set(0,.12,0);body.position.y=quiet?0:w*.018;body.rotation.set(0,0,0);head.rotation.set(w*.016,w*.03,w*.018);
  eyes.forEach(e=>e.scale.y=quiet?1:Math.sin(clock*.75)>.997?.1:1);
  locks.forEach((l,i)=>{l.rotation.z=quiet?0:Math.sin(clock*1.9+i*.45)*.027;l.rotation.x=quiet?0:Math.sin(clock*1.5+i*.3)*.02;});cloth.forEach((l,i)=>l.rotation.x=quiet?0:Math.sin(clock*1.4+i*.4)*.015);
  arms[0].shoulder.rotation.set(0,0,-.22);arms[0].elbow.rotation.set(-.12,0,-.14);arms[1].shoulder.rotation.set(0,0,.22);arms[1].elbow.rotation.set(0,0,.10);
  arms.forEach(a=>a.hand.rotation.set(0,0,0));legs.forEach(l=>l.rotation.set(0,0,0));
  wings.forEach((l,i)=>l.rotation.set(0,(i?1:-1)*(.06+w*.05),0));
  familiar.position.set(.84+Math.sin(clock*.9)*.05,3.26+w*.075,.14);familiar.rotation.set(0,-.15+Math.sin(clock)*.08,w*.035);dragonWings.forEach((l,i)=>l.rotation.z=(i?1:-1)*(quiet?.2:Math.sin(clock*8)*.24));
  staffRings.forEach((r,i)=>{r.rotation.y=.5+i*.7+clock*(.35+i*.12);});crystal.rotation.y=clock*.5;
  spell.visible=active&&['magic','happy'].includes(action);hearts.visible=active&&action==='heart';spell.rotation.z=clock;spell.scale.setScalar(1+Math.sin(t*6)*.08);
  stars.forEach((s,i)=>{const a=i*Math.PI/6+clock*.25;s.position.set(Math.cos(a)*1.22,1.9+Math.sin(a*2)*1.55,Math.sin(a)*.4);s.rotation.set(0,clock*.4,a);});
  hearts.children.forEach((h,i)=>{h.position.set(Math.sin(i*2)*.62,1.6+(t*.6+i*.35)%1.8,.45);h.rotation.y=clock*.4;h.scale.setScalar(.55);});
  if(active){
   if(action==='wave'){arms[1].shoulder.rotation.z=1.9;arms[1].elbow.rotation.z=.45+(quiet?0:Math.sin(t*8)*.3);arms[1].hand.rotation.z=quiet?0:Math.sin(t*8)*.12;head.rotation.z=-.05;}
   if(action==='fly'){body.position.y=.28+(quiet?0:Math.sin(t*3)*.08);body.rotation.x=-.1;legs[0].rotation.x=.25;legs[1].rotation.x=-.18;wings.forEach((l,i)=>l.rotation.y=(i?1:-1)*(quiet?.3:.3+Math.sin(t*6)*.26));familiar.position.y+=.2;}
   if(action==='spin')root.rotation.y+=quiet?0:t*Math.PI/2;
   if(action==='happy'){body.position.y=quiet?0:Math.abs(Math.sin(t*4))*.13;arms[1].shoulder.rotation.z=1.5;familiar.rotation.z=quiet?0:Math.sin(t*5)*.15;}
   if(action==='magic'){arms[1].shoulder.rotation.z=1.08;arms[1].elbow.rotation.x=-.8;staffRings.forEach((r,i)=>r.rotation.z=t*(2+i));}
   if(action==='heart'){arms[1].shoulder.rotation.z=.65;arms[1].elbow.rotation.z=1.8;head.rotation.z=-.08;}
   if(action==='cheer'){arms[1].shoulder.rotation.z=.9;arms[1].elbow.rotation.z=1.1;head.rotation.z=-.09;}
   if(action==='dance'){body.rotation.z=quiet?0:Math.sin(t*4)*.06;arms[1].shoulder.rotation.z=.8+Math.sin(t*4)*.2;legs[1].rotation.x=quiet?0:Math.sin(t*4)*.12;}
   if(action==='dragon'){familiar.position.set(Math.cos(t*2)*1.05,3.05+Math.sin(t*2)*.35,Math.sin(t*2)*.8);familiar.rotation.y=-t*2;}
  }
 }
 return {root,update,focus:1.98,distance:8.5,height:4.05};
}
