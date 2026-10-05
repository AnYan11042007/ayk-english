// Painted anime facial details on the UV surface of a sculpted 3D head.
// These are material textures, not billboards: silhouette, nose, cheeks and jaw
// remain actual geometry when the model turns. Four expressions share one UV layout.
export function createAnimeFaceTextures(T){
 if(typeof document==='undefined')return [];
 const textures=[];
 for(const expression of ['gentle','smile','blink','encourage']){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
  const ctx=canvas.getContext('2d');if(!ctx)return [];
  ctx.scale(768,1024);
  ctx.fillStyle='#ffe5dc';ctx.fillRect(0,0,1,1);
  const shade=ctx.createLinearGradient(0,0,1,0);shade.addColorStop(0,'#eec1bd');shade.addColorStop(.18,'#f9d9d0');shade.addColorStop(.5,'#ffede3');shade.addColorStop(.82,'#f9d9d0');shade.addColorStop(1,'#eec1bd');ctx.fillStyle=shade;ctx.fillRect(0,0,1,1);
  function blush(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(247,152,172,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  blush(.205,.625,.13,'rgba(246,144,164,.34)');blush(.795,.625,.13,'rgba(246,144,164,.34)');
  function eye(center,sign){
   ctx.save();ctx.translate(center,.51);ctx.scale(sign,1);
   const closed=expression==='blink';
   // Slightly lifted outer corner, narrow upper lid and a softer lower lid.
   if(!closed){
    ctx.beginPath();ctx.moveTo(-.139,.012);ctx.bezierCurveTo(-.09,-.059,.058,-.068,.138,-.018);ctx.bezierCurveTo(.07,.057,-.083,.06,-.139,.012);ctx.closePath();ctx.save();ctx.clip();
    const sclera=ctx.createLinearGradient(0,-.06,0,.055);sclera.addColorStop(0,'#e4d9eb');sclera.addColorStop(.4,'#fffaff');sclera.addColorStop(1,'#fff0f0');ctx.fillStyle=sclera;ctx.fillRect(-.15,-.07,.3,.14);
    // Dark violet limbal ring, luminous lavender lower iris, fine radial strokes.
    const iris=ctx.createLinearGradient(0,-.061,0,.057);iris.addColorStop(0,'#38214f');iris.addColorStop(.3,'#654087');iris.addColorStop(.67,'#a878c7');iris.addColorStop(1,'#e1a9e5');ctx.fillStyle=iris;ctx.beginPath();ctx.ellipse(.008,-.002,.062,.075,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#634174';ctx.lineWidth=.004;ctx.stroke();
    ctx.globalAlpha=.35;for(let i=0;i<28;i++){const a=i*Math.PI*2/28;ctx.strokeStyle=i%2?'#e9c0ef':'#654078';ctx.lineWidth=.0015;ctx.beginPath();ctx.moveTo(.008+Math.cos(a)*.027,-.002+Math.sin(a)*.033);ctx.lineTo(.008+Math.cos(a)*.055,-.002+Math.sin(a)*.067);ctx.stroke();}ctx.globalAlpha=1;
    ctx.fillStyle='#34223f';ctx.beginPath();ctx.ellipse(.008,-.012,.024,.043,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fffbff';ctx.beginPath();ctx.ellipse(-.014,-.039,.018,.019,-.35,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(.035,.017,.007,.008,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ecd4ff';ctx.beginPath();ctx.ellipse(.006,.045,.019,.006,0,0,Math.PI*2);ctx.fill();ctx.restore();
   }
   // Tapered eyeliner, three short outer lashes instead of round heavy rings.
   ctx.fillStyle='#493141';ctx.beginPath();ctx.moveTo(-.139,.012);ctx.bezierCurveTo(-.081,closed?.043:-.063,.062,closed?.04:-.071,.138,-.018);ctx.lineTo(.16,-.028);ctx.lineTo(.137,-.033);ctx.bezierCurveTo(.058,closed?.035:-.081,-.079,closed?.037:-.073,-.139,.012);ctx.fill();
   for(let i=0;i<3;i++){const x=.105+i*.016,y=-.039+i*.004;ctx.beginPath();ctx.moveTo(x-.007,y+.009);ctx.quadraticCurveTo(x+.015,y-.001,x+.017,y-.025+i*.004);ctx.quadraticCurveTo(x+.013,y+.009,x,y+.012);ctx.fill();}
   if(!closed){ctx.strokeStyle='#c18e9c';ctx.lineWidth=.0025;ctx.beginPath();ctx.moveTo(-.115,.026);ctx.bezierCurveTo(-.045,.067,.072,.048,.115,.008);ctx.stroke();ctx.strokeStyle='#d5b1b6';ctx.lineWidth=.002;ctx.beginPath();ctx.moveTo(-.11,-.065);ctx.bezierCurveTo(-.034,-.093,.071,-.086,.12,-.044);ctx.stroke();}
   // Slim silver-lilac brow, softly arched and higher for encouragement.
   ctx.fillStyle='#a78eac';ctx.beginPath();const by=expression==='encourage'?-.114:-.109;ctx.moveTo(-.112,by+.004);ctx.quadraticCurveTo(.005,by-.032,.115,by-.004);ctx.quadraticCurveTo(.005,by-.044,-.1,by-.006);ctx.closePath();ctx.fill();ctx.restore();
  }
  eye(.295,-1);eye(.705,1);
  // Small nose tip and a softly shaded bridge; the matching mesh supplies depth.
  const nose=ctx.createRadialGradient(.515,.631,0,.515,.631,.055);nose.addColorStop(0,'rgba(198,121,131,.18)');nose.addColorStop(1,'rgba(198,121,131,0)');ctx.fillStyle=nose;ctx.fillRect(.455,.57,.12,.12);
  ctx.strokeStyle='#d69ca0';ctx.lineWidth=.0022;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(.493,.643);ctx.quadraticCurveTo(.507,.653,.521,.64);ctx.stroke();
  ctx.fillStyle='rgba(255,251,239,.65)';ctx.beginPath();ctx.ellipse(.489,.625,.007,.012,0,0,Math.PI*2);ctx.fill();
  const mouthY=.749,smiling=expression==='smile',half=smiling?.066:.052;
  const lips=ctx.createRadialGradient(.5,mouthY,0,.5,mouthY,.072);lips.addColorStop(0,'rgba(221,133,153,.26)');lips.addColorStop(1,'rgba(221,133,153,0)');ctx.fillStyle=lips;ctx.fillRect(.425,mouthY-.045,.15,.09);
  ctx.fillStyle='#d88f9c';ctx.beginPath();ctx.moveTo(.5-half,mouthY);ctx.quadraticCurveTo(.482,mouthY-.012,.5,mouthY-.006);ctx.quadraticCurveTo(.52,mouthY-.015,.5+half,mouthY-.006);ctx.quadraticCurveTo(.505,mouthY+(smiling?.027:.009),.5-half,mouthY);ctx.fill();
  ctx.strokeStyle='#b16d81';ctx.lineWidth=.0025;ctx.beginPath();ctx.moveTo(.5-half,mouthY);ctx.quadraticCurveTo(.5,mouthY+(smiling?.022:.005),.5+half,mouthY-.006);ctx.stroke();
  ctx.strokeStyle='rgba(255,229,223,.85)';ctx.lineWidth=.003;ctx.beginPath();ctx.moveTo(.48,mouthY+.014);ctx.quadraticCurveTo(.5,mouthY+.02,.524,mouthY+.011);ctx.stroke();
  const tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;tex.userData.expression=expression;textures.push(tex);
 }
 return textures;
}
