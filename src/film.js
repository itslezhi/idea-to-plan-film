import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Independent original film. Every authored state below depends on absolute time.
// No onetake source, model, UI, logo, music or animation has been copied.
const W = 1920, H = 1080, DUR = 5;
const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
if (renderMode) document.body.classList.add('render');
const clamp = (x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const mix = (a,b,t)=>a+(b-a)*t;
const smooth = x=>{x=clamp(x);return x*x*(3-2*x)};
const at = (t,a,b)=>smooth((t-a)/(b-a));
const expo = x=>x>=1?1:1-Math.pow(2,-9*clamp(x));
const vec = (x,y,z)=>new THREE.Vector3(x,y,z);
const C = {paper:0xf4f2e9,ink:0x293d36,sage:0x387f72,mint:0xd8e4ce,amber:0xe5b36c,lilac:0xc7b9dd};

const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);
renderer.setSize(W,H,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.83;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background=new THREE.Color(0xe3e7de);
scene.fog=new THREE.Fog(0xe3e7de,30,75);
const pmrem=new THREE.PMREMGenerator(renderer);
const room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture;
room.dispose();pmrem.dispose();
scene.environmentIntensity=.48;
const camera=new THREE.PerspectiveCamera(38,W/H,.08,100);
const composer=new EffectComposer(renderer);
composer.setSize(W,H);
composer.addPass(new RenderPass(scene,camera));
const bokeh=new BokehPass(scene,camera,{focus:13,aperture:.000075,maxblur:.0045});
composer.addPass(bokeh);
composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0xfffcf2,0x809d82,1.05));
const key=new THREE.DirectionalLight(0xfff8e8,2.65);
key.position.set(-3.5,10,6); key.castShadow=true;
key.shadow.mapSize.set(4096,4096);
Object.assign(key.shadow.camera,{left:-8,right:8,top:6,bottom:-6,near:.2,far:25});
key.shadow.normalBias=.015;key.shadow.bias=-.00006;key.shadow.radius=4;
key.target.position.set(0,0,0);scene.add(key,key.target);
const fill=new THREE.DirectionalLight(0xe2e9ff,.75);fill.position.set(4,6,-5);scene.add(fill);

function material(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.42,metalness:0,...opts})}
function box(w,h,d,r,mat){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,r),mat);m.castShadow=true;m.receiveShadow=true;return m}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function texture(canvas){const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return tex}
function face(w,d,tex){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.rotation.x=-Math.PI/2;return mesh}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]}

// A broad warm glass desk with a floating edge; all graphics are our own.
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material(0xdce3d5,{roughness:.88}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.48;floor.receiveShadow=true;scene.add(floor);
const glass=new THREE.MeshPhysicalMaterial({color:0xf3edda,roughness:.19,metalness:0,transmission:.32,thickness:.45,ior:1.43,clearcoat:1,clearcoatRoughness:.18});
const desk=box(11.8,.30,5.7,.18,glass);desk.position.set(0,-.22,0);scene.add(desk);
const deskLiner=box(11.55,.026,5.46,.14,material(0xe2d5bd,{roughness:.5}));deskLiner.position.set(0,-.063,0);scene.add(deskLiner);

const [shadowCanvas,shadowCtx]=canvas(256,256);
const radial=shadowCtx.createRadialGradient(128,128,8,128,128,124);radial.addColorStop(0,'rgba(40,51,39,.23)');radial.addColorStop(.45,'rgba(40,51,39,.10)');radial.addColorStop(1,'rgba(40,51,39,0)');
shadowCtx.fillStyle=radial;shadowCtx.fillRect(0,0,256,256);
const shadowTex=texture(shadowCanvas);
function contact(w,d){const m=face(w,d,shadowTex);m.material.opacity=.48;return m}
const pipShadow=contact(1.35,1.1);pipShadow.position.y=-.033;scene.add(pipShadow);

// A tiny launch key, not an operating-system app icon.
const start=new THREE.Group();start.position.set(-4.2,.015,.35);scene.add(start);
start.add(box(.95,.14,.90,.14,material(0xbfcfb7)));
const [startC,startCtx]=canvas(256,256);
startCtx.clearRect(0,0,256,256);startCtx.strokeStyle='#f9fbef';startCtx.lineWidth=12;startCtx.lineCap='round';
startCtx.beginPath();startCtx.moveTo(80,145);startCtx.lineTo(128,96);startCtx.lineTo(175,145);startCtx.stroke();
const startFace=face(.79,.75,texture(startC));startFace.position.y=.076;start.add(startFace);

// The original Pip model is authored procedurally; it has a face plate, soft feet,
// flexible arms and an amber courier badge, distinct from the reference mascot.
const pip=new THREE.Group();scene.add(pip);
const body=box(.72,.65,.50,.12,material(C.sage,{roughness:.32}));body.position.y=.49;pip.add(body);
const facePlate=box(.57,.37,.025,.09,material(0xf4efda,{roughness:.64}));facePlate.position.set(0,.51,.254);pip.add(facePlate);
const eyes=[];
for(const x of [-.12,.12]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.041,20,12),material(0x233d35,{roughness:.2}));eye.scale.set(.76,1,.4);eye.position.set(x,.55,.278);pip.add(eye);eyes.push(eye)}
const smile=new THREE.Mesh(new THREE.TorusGeometry(.047,.009,8,20,Math.PI),material(0x345548));smile.rotation.z=Math.PI;smile.position.set(0,.465,.279);pip.add(smile);
const feet=[];for(const x of [-.21,.21]){const foot=box(.21,.14,.30,.07,material(0x346d63));foot.position.set(x,.075,.035);pip.add(foot);feet.push(foot)}
const arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.365,.55,0);const hand=box(.14,.34,.16,.07,material(0x4b9181));hand.position.y=-.13;arm.add(hand);pip.add(arm);arms.push(arm)}
const badge=new THREE.Mesh(new THREE.SphereGeometry(.075,20,12),material(C.amber,{metalness:.1,roughness:.29}));badge.scale.z=.30;badge.position.set(.23,.32,.265);pip.add(badge);
const topPin=new THREE.Mesh(new THREE.SphereGeometry(.055,20,12),material(C.amber));topPin.position.set(-.20,.842,-.035);pip.add(topPin);

// Idea chips. A landing releases each chip toward the inbox.
const noteSpecs=[
  {x:-3,z:.35,color:'#ddcfeb',label:'WHAT IF?',sub:'a small spark',time:.75},
  {x:-1.8,z:.35,color:'#dae5ca',label:'TRY THIS',sub:'one possibility',time:1.25},
  {x:-.6,z:.35,color:'#f2d7b3',label:'MAYBE…',sub:'worth a look',time:1.75}
];
const notes=noteSpecs.map((s,i)=>{
  const g=new THREE.Group();
  g.add(box(.99,.105,.83,.09,material(0xfcfaf1,{roughness:.55})));
  const [c,ctx]=canvas(512,432);ctx.fillStyle=s.color;rounded(ctx,19,17,474,398,34);ctx.fill();
  ctx.fillStyle='#41564b';ctx.font='600 43px Arial';ctx.fillText(s.label,48,161);
  ctx.fillStyle='#657467';ctx.font='27px Arial';ctx.fillText(s.sub,48,213);
  ctx.strokeStyle='#788776';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(50,304);ctx.lineTo(271,304);ctx.stroke();
  ctx.beginPath();ctx.moveTo(50,330);ctx.lineTo(196,330);ctx.stroke();
  const print=face(.96,.80,texture(c));print.position.y=.055;g.add(print);
  scene.add(g);return g;
});

// Inbox tile, with translucent amber sides and a milky printed face.
const inbox=new THREE.Group();inbox.position.set(1.45,.035,-.12);scene.add(inbox);
const inboxMaterial=new THREE.MeshPhysicalMaterial({color:0xe8bf85,roughness:.22,transmission:.22,thickness:.22,ior:1.42,clearcoat:.8});
inbox.add(box(2.2,.23,1.66,.14,inboxMaterial));
const [ic,ix]=canvas(880,664);ix.fillStyle='#f3e6cd';rounded(ix,30,30,820,604,58);ix.fill();
ix.strokeStyle='#be955c';ix.lineWidth=4;rounded(ix,59,60,762,544,40);ix.stroke();
ix.fillStyle='#94713f';ix.font='500 30px Arial';ix.fillText('A PLACE FOR POSSIBILITY',85,112);
ix.fillStyle='#594f39';ix.font='400 89px Georgia';ix.fillText('Inbox',84,290);
ix.fillStyle='#9a845d';ix.font='31px Arial';ix.fillText('IDEAS WELCOME',88,363);
ix.beginPath();ix.arc(712,462,48,0,Math.PI*2);ix.fillStyle='#d3ae72';ix.fill();
ix.strokeStyle='#fff9e9';ix.lineWidth=6;ix.beginPath();ix.moveTo(690,462);ix.lineTo(733,462);ix.moveTo(713,440);ix.lineTo(713,484);ix.stroke();
const inboxFace=face(2.14,1.60,texture(ic));inboxFace.position.y=.120;inbox.add(inboxFace);
const inboxShadow=contact(3.4,2.6);inboxShadow.position.set(1.45,-.035,-.12);scene.add(inboxShadow);

// The plan grows from the same inbox; it never swaps to a new scene.
const plan=new THREE.Group();scene.add(plan);
const planBase=box(4.1,.15,2.84,.14,material(0xfcfaf2,{roughness:.38}));plan.add(planBase);
const planEdge=box(4.04,.018,2.78,.11,material(0xfffff8,{roughness:.65}));planEdge.position.y=.077;plan.add(planEdge);
const [pc,px]=canvas(1640,1136);const planTexture=texture(pc);
const planFace=face(4.03,2.77,planTexture);planFace.position.y=.089;plan.add(planFace);
let lastPlanKey='';
function drawPlan(t){
  const rows=[at(t,3,3.17),at(t,3.25,3.42),at(t,3.5,3.67)];
  const stamp=at(t,4.13,4.25);
  const k=[...rows,stamp].map(x=>x.toFixed(3)).join(',');if(k===lastPlanKey)return;lastPlanKey=k;
  px.clearRect(0,0,1640,1136);
  px.fillStyle='#879681';px.font='600 29px Arial';px.fillText('YOUR NEXT MOVE',101,105);
  px.fillStyle='#294639';px.font='400 97px Georgia';px.fillText('One clear plan.',92,232);
  px.fillStyle='#82917e';px.font='33px Arial';px.fillText('A little structure. A lot more space.',101,302);
  const labels=['Gather ideas','Choose a direction','Make the first move'];
  for(let i=0;i<3;i++){
    const y=391+i*167;const p=rows[i];
    px.fillStyle=['#edf0e3','#f0eaf4','#f6ebd9'][i];rounded(px,86,y,1468,135,27);px.fill();
    px.strokeStyle='#bdc7b3';px.lineWidth=4;rounded(px,128,y+37,59,59,15);px.stroke();
    if(p>0){px.save();px.globalAlpha=p;px.fillStyle='#477c62';rounded(px,128,y+37,59,59,15);px.fill();px.strokeStyle='#fffef3';px.lineWidth=6;px.lineCap='round';px.lineJoin='round';px.beginPath();px.moveTo(143,y+66);px.lineTo(154,y+77);px.lineTo(175,y+54);px.stroke();px.restore()}
    px.fillStyle=p>.1?'#2c493b':'#a0a897';px.font='400 53px Arial';px.fillText(labels[i],222,y+86);
    px.fillStyle='#91a087';px.font='28px Arial';px.fillText('0'+(i+1),1440,y+81);
  }
  px.fillStyle='#98a28f';px.font='28px Arial';px.fillText('PIP / SMALL STEPS, CLEAR HEAD.',99,1044);
  if(stamp>0){
    px.save();px.globalAlpha=stamp;px.translate(1438,1000);px.rotate(-.10);
    px.strokeStyle='#418570';px.lineWidth=7;px.beginPath();px.arc(0,0,73,0,Math.PI*2);px.stroke();
    px.lineWidth=10;px.lineCap='round';px.lineJoin='round';px.beginPath();px.moveTo(-32,1);px.lineTo(-6,25);px.lineTo(37,-29);px.stroke();px.restore();
  }
  planTexture.needsUpdate=true;
}

// Rings make the causality of each contact readable without particles.
const hitTimes=[.25,.75,1.25,1.75,2,4.15];
const rings=hitTimes.map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.28,.305,80),new THREE.MeshBasicMaterial({color:0x97ad89,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;scene.add(m);return m});
const impactPoints=[[-4.2,.09,.35],[-3,.075,.35],[-1.8,.075,.35],[-.6,.075,.35],[1.45,.17,-.12],[2.86,.30,.97]];

function hop(t,a,b,from,to,height){
  const u=clamp((t-a)/(b-a)),e=smooth(u);
  return {x:mix(from[0],to[0],e),y:mix(from[1],to[1],e)+height*Math.sin(Math.PI*u),z:mix(from[2],to[2],e),air:Math.sin(Math.PI*u),u};
}
function pipAt(t){
  if(t<.25){const u=clamp(t/.25);return {x:-4.2,y:mix(3.5,.09,u*u),z:.35,air:1-u,u}}
  if(t<.42)return {x:-4.2,y:.09,z:.35,air:0};
  if(t<.75)return hop(t,.42,.75,[-4.2,.09,.35],[-3,.075,.35],.84);
  if(t<.91)return {x:-3,y:.075,z:.35,air:0};
  if(t<1.25)return hop(t,.91,1.25,[-3,.075,.35],[-1.8,.075,.35],.72);
  if(t<1.41)return {x:-1.8,y:.075,z:.35,air:0};
  if(t<1.75)return hop(t,1.41,1.75,[-1.8,.075,.35],[-.6,.075,.35],.72);
  if(t<1.80)return {x:-.6,y:.075,z:.35,air:0};
  if(t<2.0)return hop(t,1.80,2.0,[-.6,.075,.35],[1.45,.17,-.12],.85);
  if(t<2.75){const u=at(t,2,2.75);return {x:mix(1.45,2.83,u),y:mix(.17,.30,u)+.34*Math.sin(Math.PI*u),z:mix(-.12,-.70,u),air:.35*Math.sin(Math.PI*u)}}
  if(t<3.75)return {x:2.83,y:.30,z:-.70,air:0};
  if(t<4.15)return hop(t,3.75,4.15,[2.83,.30,-.70],[2.86,.30,.97],1.1);
  if(t<4.30)return {x:2.86,y:.30,z:.97,air:0};
  if(t<4.50)return hop(t,4.30,4.50,[2.86,.30,.97],[3.75,0,.77],.35);
  return {x:3.75,y:0,z:.77,air:0};
}

const look=vec(0,0,0),eye=vec(0,0,0);
function setCamera(t){
  // Continuous ride, then a rise to make the plan readable.
  const follow=at(t,.35,2),rise=at(t,1.9,3.05),settle=at(t,3.65,4.5);
  const focusX=mix(-2.65,1.2,follow);
  look.set(focusX,mix(.65,.38,rise),mix(.15,-.10,rise));
  eye.set(focusX+mix(2.75,3.25,rise),look.y+mix(3.65,6.15,rise),look.z+mix(6.55,5.9,rise));
  eye.x+=.035*Math.sin(t*2.1)*(1-settle);eye.y+=.025*Math.sin(t*2.8)*(1-settle);
  let shake=0;for(const hit of hitTimes){const d=t-hit;if(d>=0&&d<.32)shake+=.027*Math.exp(-d*13)*Math.sin(d*59)}
  eye.y+=shake;camera.position.copy(eye);camera.up.set(0,1,0);camera.lookAt(look);
  camera.fov=mix(35,33,rise);camera.updateProjectionMatrix();
  const actor=pipAt(t);
  bokeh.uniforms.focus.value=camera.position.distanceTo(vec(mix(actor.x,1.25,rise),.40,.1));
  bokeh.uniforms.aperture.value=mix(.00008,.000023,rise);
  bokeh.uniforms.maxblur.value=mix(.0045,.0023,rise);
}

const title=document.querySelector('h1'),subline=document.querySelector('#subline'),endline=document.querySelector('#endline');
function seek(t){
  t=clamp(t,0,DUR);
  const unfold=at(t,2,2.5);
  start.scale.y=1-.16*Math.exp(-Math.max(0,t-.25)*16)*(t>=.25?1:0);
  for(let i=0;i<3;i++){
    const s=noteSpecs[i],u=clamp((t-s.time)/.25),e=smooth(u);
    notes[i].visible=t<s.time+.25;
    notes[i].position.set(mix(s.x,1.45+(i-1)*.12,e),.025+.095*i*e+.85*Math.sin(Math.PI*u),mix(s.z,-.12,e));
    notes[i].rotation.set(.20*Math.sin(Math.PI*u),mix(0,(i-1)*.17,e),.07*Math.sin(Math.PI*u)*(i-1));
    const pressed=t>=s.time?Math.exp(-(t-s.time)*28):0;
    notes[i].scale.set(1-.25*e,1-.25*e-.20*pressed,1-.25*e);
  }
  inbox.visible=t<2.72;inbox.scale.set(1-.24*unfold,1-.38*unfold,1-.2*unfold);
  inbox.rotation.y=.025*Math.sin(t*2)*(1-unfold);
  inboxShadow.scale.setScalar(1+.50*unfold);inboxShadow.material.opacity=mix(.45,.30,unfold);
  plan.visible=t>=2;
  const pop=unfold+.045*Math.sin(unfold*Math.PI*2)*Math.sin(unfold*Math.PI);
  plan.scale.setScalar(mix(.40,1,pop));
  plan.position.set(mix(1.45,1.25,unfold),mix(.16,.205,unfold)+.17*Math.sin(Math.PI*unfold),mix(-.12,-.10,unfold));
  plan.rotation.set(-.65*(1-unfold),-.035*(1-unfold),.04*(1-unfold));
  if(t>=4.15){const d=t-4.15;plan.position.y-=.025*Math.exp(-d*18);plan.rotation.z+=.012*Math.exp(-d*13)*Math.sin(d*35)}
  drawPlan(t);
  const p=pipAt(t);pip.position.set(p.x,p.y,p.z);
  let squash=0;for(const hit of hitTimes){const d=t-hit;if(d>=0&&d<.32)squash+=.22*Math.exp(-d*18)}
  pip.scale.set(1+squash*.46,1-squash+.08*p.air,1+squash*.36);
  pip.rotation.z=-.10*p.air+(.05*Math.sin((t-2.75)*7))*(t>=2.75&&t<3.75?1:0);
  pip.rotation.y=mix(-.08,.14,at(t,2.7,3.4))-.12*at(t,4.15,4.4);
  arms[0].rotation.z=-.20-.50*p.air;arms[1].rotation.z=.20+.50*p.air;
  feet[0].rotation.x=.28*p.air;feet[1].rotation.x=-.20*p.air;
  let blink=1;for(const bt of [.10,2.95,4.65]){const d=Math.abs(t-bt);blink=Math.min(blink,1-.92*Math.exp(-Math.pow(d/.045,2)))}
  eyes.forEach(e=>e.scale.y=blink);
  pipShadow.position.x=p.x;pipShadow.position.z=p.z;
  const airborne=Math.max(0,p.y-.1);pipShadow.scale.setScalar(1+airborne*.34);pipShadow.material.opacity=.48/(1+airborne*1.6);
  for(let i=0;i<rings.length;i++){
    const d=t-hitTimes[i],u=clamp(d/.36);rings[i].visible=d>=0&&d<.36;
    rings[i].position.set(...impactPoints[i]);rings[i].scale.setScalar(1+u*2.2);rings[i].material.opacity=.40*(1-u)*(1-u);
  }
  setCamera(t);
  const titleIn=at(t,.08,.48),end=at(t,4.28,4.72);
  title.style.opacity=String(titleIn);title.style.transform=`translateY(${12*(1-titleIn)}px)`;
  subline.style.opacity=String(.85*titleIn*(1-.65*unfold));
  endline.style.opacity=String(end);endline.style.transform=`translateY(${8*(1-end)}px)`;
  composer.render();
  return true;
}

function inspect(t){
  const p=pipAt(t);const screen=vec(p.x,p.y+.5,p.z).project(camera);
  return {time:t,pip:{world:[p.x,p.y,p.z],screen:[(screen.x*.5+.5)*W,(-screen.y*.5+.5)*H],visible:screen.z<1},planVisible:t>=2,checkVisible:t>=4.15,renderer:renderer.info.render};
}
window.__meta={dur:DUR,fps:30,width:W,height:H,title:'A Little Order',bpm:120};
window.__seek=async t=>seek(t);
window.__inspect=inspect;
window.__ready=document.fonts.ready.then(()=>{seek(0);return true});
window.addEventListener('resize',()=>{document.querySelector('#titles').style.transform=`scale(${innerWidth/W},${innerHeight/H})`});
window.dispatchEvent(new Event('resize'));
const audio=new Audio('./assets/audio/sample.wav');audio.preload='auto';
let startAt=null,playing=false;
function tick(now){if(!playing)return;const t=(now-startAt)/1000;seek(Math.min(t,DUR));if(t<DUR)requestAnimationFrame(tick);else playing=false}
function play(sound=false){startAt=performance.now();playing=true;if(sound){audio.currentTime=0;audio.play().catch(()=>{})}requestAnimationFrame(tick)}
document.querySelector('#play').addEventListener('click',()=>play(true));
if(!renderMode){window.__ready.then(()=>{const pin=params.get('t');if(pin!==null)seek(Number(pin));else play(false)})}
