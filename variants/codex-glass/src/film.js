import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Original choreography and code. Apple/OpenAI app artwork is identified in docs/assets.md.
// The animated Codex cloud is a fan-made character derived from the installed app icon.
const W=1920,H=1080,DUR=5;
const qs=new URLSearchParams(location.search),renderMode=qs.has('render');
if(renderMode)document.body.classList.add('render');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,u)=>a+(b-a)*u;
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const span=(t,a,b)=>smooth((t-a)/(b-a));
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const M=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.3,metalness:0,...extra});
function box(w,h,d,r,material){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,5,r),material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh}
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]}
function tex(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;return t}
function rect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r)}
function face(w,d,map,extra={}){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,...extra}));m.rotation.x=-Math.PI/2;return m}

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.04;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe7e4ef);
const pm=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pm.fromScene(room,.025).texture;room.dispose();pm.dispose();scene.environmentIntensity=.76;
scene.add(new THREE.HemisphereLight(0xf7f7ff,0xc3a4ac,1.2));
const key=new THREE.DirectionalLight(0xfff8f2,2.8);key.position.set(-3,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:.2,far:25});key.shadow.normalBias=.015;key.shadow.bias=-.00008;key.shadow.radius=6;
scene.add(key,key.target);
const blueFill=new THREE.DirectionalLight(0xd4e4ff,.85);blueFill.position.set(5,4,-6);scene.add(blueFill);
const camera=new THREE.PerspectiveCamera(37,W/H,.08,100);
const target=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,target);composer.setSize(W,H);composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W,H),.085,.38,.92));
const bokeh=new BokehPass(scene,camera,{focus:7,aperture:.00018,maxblur:.008});composer.addPass(bokeh);composer.addPass(new OutputPass());

// A continuous wallpaper fills the desktop rather than a wooden/paper toy board.
const [wall,wx]=cv(2048,1400);
const gradient=wx.createLinearGradient(0,0,1600,1400);gradient.addColorStop(0,'#c3cff4');gradient.addColorStop(.35,'#e5d5ea');gradient.addColorStop(.63,'#f7c5b3');gradient.addColorStop(1,'#f4a88e');wx.fillStyle=gradient;wx.fillRect(0,0,2048,1400);
wx.save();wx.filter='blur(65px)';
for(const [color,x,y,r] of [['#8db1ee',120,-120,650],['#fae4ce',1200,380,520],['#ee927d',2040,1050,730],['#d0cff8',350,1200,520]]){const g=wx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');wx.fillStyle=g;wx.fillRect(0,0,2048,1400)}
wx.restore();
wx.save();wx.filter='blur(13px)';
const ribbon=wx.createLinearGradient(100,650,1500,900);ribbon.addColorStop(0,'#e6e9fc00');ribbon.addColorStop(.45,'#fff2df99');ribbon.addColorStop(1,'#f7af9500');
wx.fillStyle=ribbon;wx.beginPath();wx.moveTo(-200,1200);wx.bezierCurveTo(150,400,900,1300,2400,200);wx.lineTo(2300,500);wx.bezierCurveTo(1000,1550,300,650,-200,1500);wx.closePath();wx.fill();wx.restore();
const wallpaperTexture=tex(wall);wallpaperTexture.repeat.set(200/19,140/13);wallpaperTexture.offset.set(-(200/19-1)/2,-(140/13-1)/2);
const desktop=new THREE.Mesh(new THREE.PlaneGeometry(200,140),new THREE.MeshBasicMaterial({map:wallpaperTexture}));desktop.rotation.x=-Math.PI/2;desktop.position.y=-.10;scene.add(desktop);
const shadows=new THREE.Mesh(new THREE.PlaneGeometry(200,140),new THREE.ShadowMaterial({color:0x735e79,opacity:.20}));shadows.rotation.x=-Math.PI/2;shadows.position.y=-.096;shadows.receiveShadow=true;scene.add(shadows);

const loader=new THREE.TextureLoader();
const names=['finder','codex','messages','photos','terminal','notes','safari','music','system-settings'];
const images=await Promise.all(names.map(n=>loader.loadAsync(`./assets/icons/${n}.png`)));
images.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16});
const shapePoints=await fetch('./assets/icons/codex-outline.json').then(r=>r.json());

// Dock: physical glass shell, milky inner lip, genuine native app artwork.
const dock=new THREE.Group();dock.position.set(0,.025,2);scene.add(dock);
const dockGlass=new THREE.MeshPhysicalMaterial({color:0xfff6f2,roughness:.075,metalness:0,transmission:.88,thickness:.26,ior:1.46,clearcoat:1,clearcoatRoughness:.06});
const dockShell=box(10.64,.22,1.45,.17,dockGlass);dockShell.castShadow=false;dock.add(dockShell);
const dockLip=box(10.48,.035,1.30,.14,new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.25,transparent:true,opacity:.25,depthWrite:false,clearcoat:1}));dockLip.position.y=.12;dock.add(dockLip);
const icons=images.map((image,i)=>{
  const g=new THREE.Group();
  const tile=box(.91,.15,.91,.115,new THREE.MeshPhysicalMaterial({color:i===1?0xffffff:0xf7f9ff,roughness:.16,metalness:.025,clearcoat:1,clearcoatRoughness:.08}));g.add(tile);
  const [tileCanvas,tc]=cv(512,512);tc.save();rect(tc,0,0,512,512,60);tc.clip();tc.fillStyle='#ffffff';tc.fillRect(0,0,512,512);tc.drawImage(image.image,0,0,512,512);tc.restore();
  const artwork=face(.885,.885,tex(tileCanvas));artwork.material.transparent=false;artwork.material.alphaTest=.5;artwork.material.alphaToCoverage=true;artwork.material.depthWrite=true;artwork.position.y=.079;g.add(artwork);scene.add(g);
  return g;
});
// Small running markers below Terminal and Codex, as in a desktop Dock.
const runMarkers=[1,4].map(i=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.023,16,8),M(0x414454));m.scale.y=.3;m.position.set((i-4)*1.1,.16,2.56);scene.add(m);return m});

// Real Codex cloud silhouette, with its native >_ face and a glossy extruded side.
const hero=new THREE.Group();scene.add(hero);
const cloudShape=new THREE.Shape(shapePoints.map(([x,y])=>new THREE.Vector2(x*1.47,y*1.47)));
const cloudGeo=new THREE.ExtrudeGeometry(cloudShape,{depth:.26,bevelEnabled:true,bevelThickness:.045,bevelSize:.025,bevelSegments:5,steps:1,curveSegments:4});cloudGeo.translate(0,0,-.13);
const hull=new THREE.Mesh(cloudGeo,new THREE.MeshPhysicalMaterial({color:0x536aff,roughness:.24,metalness:.12,clearcoat:1,clearcoatRoughness:.13}));hull.position.y=.62;hull.castShadow=true;hull.receiveShadow=true;hero.add(hull);
const frontGeo=new THREE.ShapeGeometry(cloudShape,32);
const pos=frontGeo.attributes.position,uv=frontGeo.attributes.uv;
for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/1.47+.5,pos.getY(i)/1.47+.5);
uv.needsUpdate=true;
const cloudFace=new THREE.Mesh(frontGeo,new THREE.MeshStandardMaterial({map:images[1],roughness:.23,metalness:.015,emissive:0x273cff,emissiveIntensity:.035}));cloudFace.position.set(0,.62,.178);hero.add(cloudFace);
const feet=[];for(const x of [-.26,.26]){const f=box(.19,.16,.27,.068,M(0x4147d8,{roughness:.3}));f.position.set(x,.08,.025);hero.add(f);feet.push(f)}
const arms=[];for(const side of [-1,1]){const a=new THREE.Group();a.position.set(side*.52,.58,.025);const hand=box(.13,.29,.16,.065,M(0x6577ff));hand.position.y=-.1;a.add(hand);hero.add(a);arms.push(a)}
// Avoid capturing the character into the glass's background buffer as a ghost.
hero.traverse(o=>{if(o.isMesh){o.material.transparent=true;o.material.opacity=1;o.material.depthWrite=true}});

const [sc,sx]=cv(256,256);const sg=sx.createRadialGradient(128,128,10,128,128,125);sg.addColorStop(0,'rgba(55,39,81,.44)');sg.addColorStop(1,'rgba(55,39,81,0)');sx.fillStyle=sg;sx.fillRect(0,0,256,256);const contactShadow=face(1.65,1.35,tex(sc));scene.add(contactShadow);

// Window body is transmissive; the UI texture deliberately keeps its background alpha.
const win=new THREE.Group();scene.add(win);
const glassMaterial=new THREE.MeshPhysicalMaterial({color:0xf8faff,transmission:.98,roughness:.055,thickness:.24,ior:1.44,clearcoat:1,clearcoatRoughness:.04,attenuationColor:0xf0f5ff,attenuationDistance:1.8});
const pane=box(6.8,.17,3.8,.145,glassMaterial);pane.castShadow=false;win.add(pane);
const rim=box(6.87,.045,3.87,.15,new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.12,metalness:.08,transmission:.72,thickness:.08,clearcoat:1}));rim.position.y=-.07;rim.castShadow=false;win.add(rim);
const [ui,ux]=cv(2040,1140);const uiTexture=tex(ui),windowFace=face(6.72,3.72,uiTexture);windowFace.position.y=.089;win.add(windowFace);
for(const [i,color] of [0xff5e57,0xfebc2e,0x28c840].entries()){const dot=new THREE.Mesh(new THREE.SphereGeometry(.066,24,16),M(color,{roughness:.27,transparent:true,opacity:1}));dot.scale.y=.34;dot.position.set(-3.03+i*.24,.105,-1.58);win.add(dot)}
const winShadow=face(8,5,tex(sc));winShadow.position.set(0,-.09,-.65);winShadow.material.opacity=.6;scene.add(winShadow);

const notice=new THREE.Group();scene.add(notice);
const noticePanel=box(3.0,.13,.72,.14,new THREE.MeshPhysicalMaterial({color:0xf7faff,roughness:.07,transmission:.92,thickness:.19,ior:1.44,clearcoat:1}));noticePanel.castShadow=false;notice.add(noticePanel);
const [nc,nx]=cv(1200,288);nx.fillStyle='rgba(255,255,255,.30)';rect(nx,0,0,1200,288,50);nx.fill();
nx.drawImage(images[1].image,32,49,185,185);nx.fillStyle='#333946';nx.font='600 49px -apple-system,BlinkMacSystemFont,Arial';nx.fillText('Codex',252,109);nx.font='45px -apple-system,BlinkMacSystemFont,Arial';nx.fillStyle='#596174';nx.fillText('Ready to build. ✓',252,188);
const nf=face(2.95,.70,tex(nc));nf.position.y=.071;notice.add(nf);

// Two subdued desktop folders give the broad camera rise a recognizable desktop context.
const [fc,fx]=cv(256,256);const fg=fx.createLinearGradient(0,60,0,210);fg.addColorStop(0,'#8cd0ff');fg.addColorStop(1,'#49a7ed');fx.fillStyle='#9cd9ff';rect(fx,34,48,87,43,10);fx.fill();fx.fillStyle=fg;rect(fx,24,77,208,133,16);fx.fill();fx.strokeStyle='#b3e6ff';fx.lineWidth=3;fx.stroke();
for(let i=0;i<2;i++){const folder=face(.51,.51,tex(fc));folder.position.set(5.3,-.087,-3.2+i*.80);scene.add(folder)}

const hits=[.25,.80,1.25,1.65,2.20,2.80,3.10,3.40,3.65];
function nominalX(t){
  if(t<.25)return -3.3;
  if(t<.8)return lerp(-3.3,-2.2,span(t,.36,.8));
  if(t<1.25)return lerp(-2.2,-1.1,span(t,.9,1.25));
  if(t<1.65)return lerp(-1.1,0,span(t,1.33,1.65));
  return 0;
}
function iconPose(i,t){
  const base=(i-4)*1.1,active=1-span(t,2.0,2.45),distance=base-nominalX(t);
  const mag=1+.29*Math.exp(-distance*distance/1.1)*active;
  const ripple=t>=.25?.055*Math.sin((t-.25)*17-Math.abs(i-1)*.6)*Math.exp(-(t-.25)*3.5):0;
  let bounce=0;
  if(i===4&&t>=1.65&&t<2.05){const d=t-1.65;bounce=.24*Math.abs(Math.sin(d*Math.PI/.165))*Math.exp(-d*3)}
  return {x:base+Math.sign(distance)*.10*Math.exp(-distance*distance/2)*active,y:.22+(mag-1)*.05+bounce+ripple,z:2,scale:mag,top:.22+(mag-1)*.05+bounce+ripple+.078*mag};
}
function windowPose(t){
  const u=clamp((t-2.05)/.55),e=u>=1?1:1-Math.exp(-6*u)*Math.cos(8.5*u);
  return {x:0,y:.25+.16*Math.sin(Math.PI*clamp(u)),z:lerp(1.8,-.65,smooth(u)),scale:lerp(.10,1,e),rx:.82*(1-e)};
}
function anchor(t,x,y,z){const p=windowPose(t);return v3(x,y-.03,z).multiplyScalar(p.scale).applyAxisAngle(v3(1,0,0),p.rx).add(v3(p.x,p.y,p.z))}
function jump(t,a,b,A,B,height){const u=clamp((t-a)/(b-a)),e=smooth(u);return {p:A.clone().lerp(B,e).add(v3(0,height*Math.sin(Math.PI*u),0)),air:Math.sin(Math.PI*u)}}
function onIcon(i,t){const p=iconPose(i,t);return v3(p.x,p.top+.003,p.z)}
function heroAt(t){
  if(t<.25){const u=clamp(t/.25),p=onIcon(1,t);p.y+=2.8*(1-u*u);return {p,air:1-u}}
  if(t<.36)return {p:onIcon(1,t),air:0};
  if(t<.8)return jump(t,.36,.8,onIcon(1,.36),onIcon(2,.8),.67);
  if(t<.9)return {p:onIcon(2,t),air:0};
  if(t<1.25)return jump(t,.9,1.25,onIcon(2,.9),onIcon(3,1.25),.62);
  if(t<1.33)return {p:onIcon(3,t),air:0};
  if(t<1.65)return jump(t,1.33,1.65,onIcon(3,1.33),onIcon(4,1.65),.66);
  if(t<2.05)return {p:onIcon(4,t),air:0};
  if(t<2.5)return {p:anchor(t,0,.12,1.23),air:.12*Math.sin((t-2.05)*8)};
  if(t<2.8)return jump(t,2.5,2.8,anchor(2.5,0,.12,1.23),anchor(2.8,-2.55,.12,-.55),.85);
  if(t<2.87)return {p:anchor(t,-2.55,.12,-.55),air:0};
  if(t<3.1)return jump(t,2.87,3.1,anchor(t,-2.55,.12,-.55),anchor(t,-1.25,.12,-.55),.42);
  if(t<3.17)return {p:anchor(t,-1.25,.12,-.55),air:0};
  if(t<3.4)return jump(t,3.17,3.4,anchor(t,-1.25,.12,-.55),anchor(t,.05,.12,-.55),.42);
  if(t<3.47)return {p:anchor(t,.05,.12,-.55),air:0};
  if(t<3.65)return jump(t,3.47,3.65,anchor(t,.05,.12,-.55),anchor(t,1.10,.12,-.55),.32);
  if(t<3.86)return {p:anchor(t,1.10,.12,-.55),air:0};
  if(t<4.2)return jump(t,3.86,4.2,anchor(t,1.10,.12,-.55),anchor(t,2.54,.12,-.36),.38);
  return {p:anchor(t,2.54,.12,-.36),air:0};
}

let uiKey='';
function drawUI(t){
  const typing=clamp((t-2.74)/.86),phrase='make something delightful';
  const count=Math.floor(phrase.length*typing),response=span(t,3.9,4.25);
  const busy=t>=3.65&&t<3.9;
  const k=`${count}/${response.toFixed(3)}/${busy?Math.floor(t*60):'still'}`;if(uiKey===k)return;uiKey=k;
  ux.clearRect(0,0,2040,1140);
  ux.fillStyle='rgba(255,255,255,.40)';rect(ux,0,0,2040,1140,45);ux.fill();
  ux.fillStyle='rgba(255,255,255,.22)';rect(ux,0,0,2040,172,45);ux.fill();
  ux.strokeStyle='rgba(255,255,255,.56)';ux.lineWidth=2;ux.beginPath();ux.moveTo(36,172);ux.lineTo(2004,172);ux.stroke();
  ux.fillStyle='#515568';ux.font='500 45px -apple-system,BlinkMacSystemFont,Arial';ux.textAlign='center';ux.fillText('Codex',1020,105);ux.textAlign='left';
  ux.fillStyle='#878594';ux.font='40px Menlo,monospace';ux.fillText('~/Desktop/codex-demo',100,267);
  ux.fillStyle='#5c73ec';ux.font='600 76px Menlo,monospace';ux.fillText('›',98,408);
  ux.fillStyle='#292a37';ux.font='66px Menlo,monospace';ux.fillText(phrase.slice(0,count),185,408);
  if(t<3.65){const cursor=185+ux.measureText(phrase.slice(0,count)).width;ux.fillStyle='#6378ee';ux.fillRect(cursor+8,346,28,76)}
  if(busy){ux.strokeStyle='#7285f1';ux.lineWidth=7;ux.beginPath();ux.arc(131,600,20,t*9,t*9+Math.PI*1.4);ux.stroke();ux.fillStyle='#817d91';ux.font='46px Menlo,monospace';ux.fillText('Working…',184,618)}
  if(response>0){ux.save();ux.globalAlpha=response;ux.fillStyle='#427e78';ux.font='500 68px Menlo,monospace';ux.fillText('✓ Ready to build.',100,616);ux.fillStyle='#858391';ux.font='42px Menlo,monospace';ux.fillText('A tiny canvas. A little magic.',104,720);ux.restore()}
  ux.fillStyle='#a29ba9';ux.font='31px Menlo,monospace';ux.fillText('Local workspace',100,1053);ux.textAlign='right';ux.fillText('⌘ K',1920,1053);ux.textAlign='left';uiTexture.needsUpdate=true;
}
function setCamera(t){
  const rise=span(t,1.9,3.05),x=lerp(nominalX(t),0,rise),z=lerp(2,-.36,rise);
  const look=v3(x,.25,z),eye=v3(x+lerp(2.75,2.95,rise),.25+lerp(2.85,5.5,rise),z+lerp(5.8,7.15,rise));
  let shake=0;for(const hit of hits){const d=t-hit;if(d>=0&&d<.27)shake+=.024*Math.exp(-d*15)*Math.sin(d*64)}
  eye.y+=shake+.016*Math.sin(t*2)*(1-span(t,4,4.4));camera.position.copy(eye);camera.up.set(.012*Math.sin(t*2)*(1-rise),1,0);camera.lookAt(look);camera.fov=lerp(37,35.5,rise);camera.updateProjectionMatrix();
  const focus=heroAt(t).p.clone().lerp(v3(0,.35,-.7),rise*.8);bokeh.uniforms.focus.value=camera.position.distanceTo(focus);bokeh.uniforms.aperture.value=lerp(.0011,.00030,rise);bokeh.uniforms.maxblur.value=lerp(.012,.005,rise);
}
function seek(t){
  t=clamp(t,0,DUR);
  for(let i=0;i<icons.length;i++){const p=iconPose(i,t);icons[i].position.set(p.x,p.y,p.z);icons[i].scale.setScalar(p.scale);icons[i].rotation.z=0}
  runMarkers.forEach((m,i)=>m.visible=i===0||t>=1.65);
  const wp=windowPose(t);win.visible=t>=2.05;win.position.set(wp.x,wp.y,wp.z);win.scale.setScalar(wp.scale);win.rotation.set(wp.rx,0,0);winShadow.visible=t>=2.05;winShadow.scale.setScalar(wp.scale);winShadow.material.opacity=.30*clamp(wp.scale);
  drawUI(t);
  const h=heroAt(t);hero.position.copy(h.p);
  let squish=0;for(const hit of hits){const d=t-hit;if(d>=0&&d<.3)squish+=.19*Math.exp(-d*20)}
  hero.scale.set(1+squish*.50,1-squish+.07*h.air,1+squish*.4);hero.rotation.set(0,lerp(-.05,.06,span(t,3.8,4.3)),-.10*h.air);
  arms[0].rotation.z=-.15-.65*h.air;arms[1].rotation.z=.15+.65*h.air;feet[0].rotation.x=.3*h.air;feet[1].rotation.x=-.25*h.air;
  let groundY=.15,tilt=0;
  if(t<2.05){const ni=clamp(Math.round(h.p.x/1.1)+4,0,8),ip=iconPose(ni,t);groundY=Math.abs(h.p.x-ip.x)<.48?ip.top+.003:.15}
  else {const localZ=((h.p.z-wp.z)/wp.scale-Math.sin(wp.rx)*.09)/Math.cos(wp.rx);groundY=wp.y+wp.scale*(Math.cos(wp.rx)*.09-Math.sin(wp.rx)*localZ)+.005;tilt=wp.rx}
  const above=Math.max(0,h.p.y-groundY);contactShadow.position.set(h.p.x,groundY,h.p.z);contactShadow.rotation.x=-Math.PI/2+tilt;contactShadow.scale.setScalar(1+above*.3);contactShadow.material.opacity=.80/(1+above*2.5);
  const n=span(t,4.02,4.4);notice.visible=t>=4.02;notice.position.set(lerp(5.1,2.55,n),.59,-2.88);notice.scale.setScalar(lerp(.9,1,n));
  setCamera(t);composer.render();return true;
}
function inspect(t){const h=heroAt(t).p,p=h.clone().add(v3(0,.6,0)).project(camera);return {time:t,pip:{world:h.toArray(),screen:[(p.x*.5+.5)*W,(-p.y*.5+.5)*H],visible:p.z<1},windowVisible:t>=2.05,replyVisible:t>=3.9}}
window.__meta={dur:5,fps:30,width:W,height:H,title:'Codex / Glass Desktop',bpm:126};window.__seek=async t=>seek(t);window.__inspect=inspect;
window.__ready=document.fonts.ready.then(()=>{seek(0);return true});
const audio=new Audio('./assets/audio/sample.wav');audio.preload='auto';let playing=false,started=0;
function tick(now){if(!playing)return;const t=(now-started)/1000;seek(Math.min(t,DUR));if(t<DUR)requestAnimationFrame(tick);else playing=false}
function play(sound){audio.pause();audio.currentTime=0;if(sound)audio.play().catch(()=>{});started=performance.now();playing=true;requestAnimationFrame(tick)}
document.querySelector('#play').addEventListener('click',()=>play(true));
if(!renderMode)window.__ready.then(()=>{if(qs.has('t'))seek(Number(qs.get('t')));else play(false)});
