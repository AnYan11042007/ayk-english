const fs=require('fs'),vm=require('vm'),assert=require('assert');
// Run with Three.js 0.128: AYK_THREE_PATH=/path/to/three.cjs node tests/aurora-3d.test.cjs
const T=require(process.env.AYK_THREE_PATH||'three');
const c=vm.createContext({T});vm.runInContext(fs.readFileSync('assets/js/aurora-ss.js','utf8').replace(/export /g,''),c);
const model=vm.runInContext('createAuroraSS(T)',c);let meshes=0,triangles=0;
model.root.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)assert(Number.isFinite(p.array[i]),o.name+' vertex');triangles+=(o.geometry.index?.count||p.count)/3;});
assert(meshes>150);for(const name of ['SculptedAnimeFace','EmbroideredLayeredGown','LeftCrystalWing','RightCrystalWing','OrbitingCrystalStaff','CelestialDragonFamiliar'])assert(model.root.getObjectByName(name),name);
for(const action of ['wave','happy','spin','cheer','magic','dance','heart','fly','dragon'])for(const quiet of [true,false])for(const t of [0,1,3,5]){model.update(action,t,12345,quiet);model.root.updateMatrixWorld(true);model.root.traverse(o=>o.matrixWorld.elements.forEach(v=>assert(Number.isFinite(v),action)));}
model.update('magic',1,12345,false);assert(model.root.getObjectByName('StarSpell').visible);model.update('magic',5,12345,false);assert(!model.root.getObjectByName('StarSpell').visible);
console.log(`PASS: real Three.js SS rig, ${meshes} mesh surfaces, ${Math.round(triangles)} triangles, articulated mage/wings/dragon, finite geometry and all nine animation states.`);
