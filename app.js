import * as THREE from './three.module.js';
import * as CANNON from './cannon-es.js';
import {CompatRenderer} from './compat-renderer.js';
import {woodClack,unlockWoodAudio,initVoice,announce,cancelSpeech,setEnabled} from './sound.js?v=hk-5';
import {startMusic,stopMusic,setMusicEnabled} from './music.js?v=hk-5';
import {classifyRoll,judgeGuesses} from './rules.js?v=hk-5';
const $ = id => document.getElementById(id);
let scene, camera, renderer, world, dice=[], cup, lid, plate, clock;
let phase='idle', player=0, scores=[null,null], rolls=[null,null], energy=0, held=false, started=false, sound=true, audio, lastSound=0, lastKick=0, lastMotion=0, revealAt=0, flatSince=0, orient=null, sensorSeen=false, simAccumulator=0, startTime=0, revealProgress=0, settleData=[];
let mode='duel', guesses=[null,null], guessPoints=[0,0], music=false;
const guessReady=()=>mode==='duel'||guesses.every(Boolean);
function syncGuesses(){
 const locked=!['idle','ready'].includes(phase);
 document.querySelectorAll('[data-guess]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(guesses[+b.dataset.player]===b.dataset.guess));});
 $('shakeBtn').disabled=['settling','revealing','revealed'].includes(phase)||!guessReady();$('startBtn').disabled=!guessReady();
 text('guessHint',locked?'本盅選擇已鎖定，揭盅後可再玩。':guessReady()?'兩位已選好，可以搖骰；開始搖動後鎖定。':'兩位玩家先選大或小，再搖同一盅。');
 if(mode==='guess'&&!locked)text('instruction',guessReady()?'已選好，按住「搖骰」再揭盅':!guesses[0]?'玩家 1，請選大或小':'玩家 2，請選大或小');
}
function changeMode(value){
 mode=value;document.body.dataset.mode=mode;guessPoints=[0,0];resetTurn(true);
 $('guessPanel').hidden=mode!=='guess';
 const rule=mode==='guess'?'小：4–10 點｜大：11–17 點。三粒相同為「骰」，不屬大或小，兩人不加分。兩人猜同一盅，猜中各加 1 分。':'兩人輪流搖三粒骰，總點數較大者勝，同分平局。';
 text('modeRules',rule);text('footerRules',mode==='guess'?'猜中 +1 分 · 猜錯或「骰」不加分 · 不涉及金錢':'三骰總點數較大者勝 · 同分平局 · 兩人輪流');
 document.querySelectorAll('.score-caption').forEach(el=>el.textContent=mode==='guess'?'累計猜中分數':'本輪點數');
 if(mode==='guess'){text('score1','0 分');text('score2','0 分');}
 syncGuesses();
}
let gravityEstimate={x:0,y:0,z:9.81};
const faces=[3,4,1,6,2,5];
const normals=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
const rand=(a,b)=>a+Math.random()*(b-a);
function text(id,value){$(id).textContent=value;}
function clink(strength=1){
 woodClack(strength);
}
function unlockAudio(){unlockWoodAudio();}
function texture(value){
 const c=document.createElement('canvas'); c.width=c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle='#f8eddb';ctx.fillRect(0,0,256,256);
 const grad=ctx.createRadialGradient(100,70,10,128,128,190);grad.addColorStop(0,'#fff9ee');grad.addColorStop(1,'#d5c5a9');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
 const map={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
 for(const [x,y] of map[value]){const px=128+x*57,py=128+y*57;const g=ctx.createRadialGradient(px-3,py-4,1,px,py,20);g.addColorStop(0,value===1||value===4?'#b63832':'#292f2c');g.addColorStop(.7,value===1||value===4?'#8e211e':'#161d1b');g.addColorStop(1,'#736956');ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,19,0,Math.PI*2);ctx.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function roundedBox(size,r){const g=new THREE.BoxGeometry(size,size,size,6,6,6),a=g.attributes.position,v=new THREE.Vector3(),core=size/2-r;
 for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);const q=new THREE.Vector3(Math.max(-core,Math.min(core,v.x)),Math.max(-core,Math.min(core,v.y)),Math.max(-core,Math.min(core,v.z)));v.sub(q).normalize().multiplyScalar(r).add(q);a.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;}
function ring(radius,tube,y,material,parent){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,12,96),material);m.rotation.x=-Math.PI/2;m.position.y=y;parent.add(m);return m;}
function init(){
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,60);camera.position.set(0,5.1,6.4);camera.lookAt(0,1,0);
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{renderer=new CompatRenderer(()=>({dice,cup}));}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.domElement.setAttribute('aria-label','半透視三維骰盅，內有三粒隨搖動碰撞的骰子');$('stage').prepend(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xfff7df,0x173c32,2.6));const key=new THREE.DirectionalLight(0xffe2ac,4);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;scene.add(key);const fill=new THREE.PointLight(0x93e8d3,35);fill.position.set(4,4,-4);scene.add(fill);
 const gold=new THREE.MeshStandardMaterial({color:0xd6b877,metalness:.7,roughness:.3});
 plate=new THREE.Group();scene.add(plate);const base=new THREE.Mesh(new THREE.CylinderGeometry(2.22,2.3,.18,96),new THREE.MeshStandardMaterial({color:0x112f29,metalness:.3,roughness:.5}));base.position.y=-.04;base.receiveShadow=true;plate.add(base);ring(2.22,.025,.06,gold,plate);ring(2.08,.008,.065,gold,plate);
 const felt=new THREE.Mesh(new THREE.CylinderGeometry(2.07,2.07,.02,96),new THREE.MeshStandardMaterial({color:0x1d5144,roughness:.96}));felt.position.y=.065;felt.receiveShadow=true;plate.add(felt);
 for(let i=0;i<48;i++){const tick=new THREE.Mesh(new THREE.BoxGeometry(.008,.006,i%4===0?.09:.035),gold);tick.position.set(Math.sin(i*Math.PI/24)*2.15,.065,Math.cos(i*Math.PI/24)*2.15);tick.rotation.y=i*Math.PI/24;plate.add(tick);}
 cup=new THREE.Group();scene.add(cup);const glass=new THREE.MeshPhysicalMaterial({color:0xc0b580,metalness:.15,roughness:.12,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false});const shell=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.82,2.32,64,1,true),glass);shell.position.y=1.3;shell.renderOrder=3;cup.add(shell);ring(1.82,.047,.14,gold,cup);ring(1.5,.05,2.46,gold,cup);ring(1.54,.012,2.18,gold,cup);
 lid=new THREE.Mesh(new THREE.CylinderGeometry(1.51,1.51,.08,64),new THREE.MeshStandardMaterial({color:0x23473d,metalness:.5,roughness:.34}));lid.position.y=2.5;cup.add(lid);ring(.34,.018,2.55,gold,cup);const logo=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,0),gold);logo.position.y=2.57;logo.rotation.z=.35;cup.add(logo);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-16,0),allowSleep:true});world.solver.iterations=16;const mat=new CANNON.Material('dice');world.defaultContactMaterial.friction=.28;world.defaultContactMaterial.restitution=.28;
 const floor=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material:mat});floor.quaternion.setFromEuler(-Math.PI/2,0,0);floor.position.y=.09;world.addBody(floor);
 const ceil=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material:mat});ceil.quaternion.setFromEuler(Math.PI/2,0,0);ceil.position.y=2.42;world.addBody(ceil);
 for(let i=0;i<20;i++){const angle=i*Math.PI*2/20;const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(.28,1.4,.1)),material:mat});b.position.set(Math.sin(angle)*1.69,1.3,Math.cos(angle)*1.69);b.quaternion.setFromEuler(0,angle,0);world.addBody(b);}
 const materials=faces.map(n=>new THREE.MeshStandardMaterial({map:texture(n),roughness:.28,metalness:.02}));
 for(let i=0;i<3;i++){const mesh=new THREE.Mesh(roundedBox(.94,.08),materials);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);const b=new CANNON.Body({mass:1,shape:new CANNON.Box(new CANNON.Vec3(.47,.47,.47)),material:mat,linearDamping:.28,angularDamping:.35,sleepSpeedLimit:.18,sleepTimeLimit:.45});b.position.set([-.64,.64,0][i],.82,[.52,.52,-.75][i]);b.quaternion.setFromEuler(0,[.1,-.1,.15][i],0);b.addEventListener('collide',e=>{const v=Math.abs(e.contact.getImpactVelocityAlongNormal());if(['shaking','settling'].includes(phase)&&v>1.3)clink(v);});world.addBody(b);dice.push({mesh,body:b});}
 const resize=()=>{const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('stage'));resize();clock=new THREE.Clock();renderer.setAnimationLoop(frame);
 bind();syncUI();initVoice();window.__diceReady=true;
}
function kick(x,y,z,power=1){
 if(!['ready','shaking'].includes(phase)||!guessReady())return;
 if(phase==='ready'){cancelSpeech();$('announcement').hidden=true;startMusic();}
 phase='shaking';if(mode==='guess')syncGuesses();const now=performance.now();lastKick=now;energy=Math.min(100,energy+power*5);$('energyFill').style.width=energy+'%';$('energy').setAttribute('aria-valuenow',String(Math.round(energy)));text('status',mode==='guess'?'兩人猜大／小 · 搖骰中':`玩家 ${player+1} · 搖骰中`);text('stageBadge','SHAKING / 搖動中');text('instruction',energy>15?'搖好後，把手機屏幕朝上放平':'繼續搖一搖，讓三粒骰子翻滾');
 for(const {body:b} of dice){b.wakeUp();b.velocity.x=Math.max(-12,Math.min(12,b.velocity.x+x*.23));b.velocity.z=Math.max(-12,Math.min(12,b.velocity.z+z*.23));b.velocity.y=Math.max(-8,Math.min(10,b.velocity.y+Math.abs(y)*.11+power*1.1));b.angularVelocity.set(b.angularVelocity.x+rand(-power*4,power*4),b.angularVelocity.y+rand(-power*4,power*4),b.angularVelocity.z+rand(-power*4,power*4));}
 if(energy>=12)$('revealBtn').disabled=false;
}
async function begin(){
 unlockAudio();if(!guessReady()||started)return;started=true;startTime=performance.now();phase='ready';
 $('startBtn').hidden=true;text('status',mode==='guess'?'兩人猜大／小':`輪到玩家 ${player+1}`);text('instruction','按住「搖骰」，或搖一搖手機');text('stageBadge','READY / 等待搖動');text('sensorStatus','正在檢測體感…');
 try{
 const requests=[];
 if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function')requests.push(DeviceMotionEvent.requestPermission());
 if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function')requests.push(DeviceOrientationEvent.requestPermission());
 const permissions=await Promise.all(requests);if(permissions.some(p=>p!=='granted'))text('sensorStatus','未獲體感權限 · 可按住按鈕搖骰');
 }catch{text('sensorStatus','體感未獲授權 · 可按住按鈕搖骰');}
 window.addEventListener('devicemotion',motion);window.addEventListener('deviceorientation',orientation);
}
function motion(e){
 let a=e.acceleration;const g=e.accelerationIncludingGravity;
 if(!a||a.x===null){if(!g||g.x===null)return;for(const k of ['x','y','z'])gravityEstimate[k]=gravityEstimate[k]*.86+(g[k]||0)*.14;a={x:g.x-gravityEstimate.x,y:g.y-gravityEstimate.y,z:g.z-gravityEstimate.z};}
 if(a.x===null)return;sensorSeen=true;lastMotion=performance.now();text('sensorStatus','體感已連接 · 放平自動揭盅');
 const strength=Math.hypot(a.x||0,a.y||0,a.z||0);
 if(strength>3.5&&performance.now()-lastKick>55){flatSince=0;kick(-(a.x||0),a.z||0,a.y||0,Math.min(2,strength/10));}
}
function orientation(e){if(e.beta===null||e.gamma===null)return;orient={beta:e.beta,gamma:e.gamma};if(['ready','shaking'].includes(phase)){world.gravity.set(Math.max(-9,Math.min(9,-e.gamma*.18)),-16,Math.max(-9,Math.min(9,e.beta*.13)));}}
function topFace(mesh){let max=-2,index=0;for(let i=0;i<6;i++){const y=normals[i].clone().applyQuaternion(mesh.quaternion).y;if(y>max){max=y;index=i;}}return {value:faces[index],index};}
function reveal(){
 if(phase!=='shaking'||energy<12)return;held=false;phase='settling';world.gravity.set(0,-22,0);text('status','骰子落定中…');text('instruction','稍等一下，正在揭盅');text('stageBadge','SETTLING / 落定');$('revealBtn').disabled=true;$('shakeBtn').disabled=true;revealAt=performance.now()+1200;for(const {body:b} of dice){b.wakeUp();b.angularDamping=.7;b.linearDamping=.65;}
}
function startReveal(){
 stopMusic();
 phase='revealing';revealProgress=0;const values=[];settleData=dice.map(({mesh,body:b},i)=>{mesh.position.copy(b.position);mesh.quaternion.copy(b.quaternion);const top=topFace(mesh);values.push(top.value);return {pos:mesh.position.clone(),q:mesh.quaternion.clone(),targetQ:new THREE.Quaternion().setFromUnitVectors(normals[top.index],new THREE.Vector3(0,1,0)),target:new THREE.Vector3([-.78,.78,0][i],.77,[.69,.69,-.82][i])};});rolls[player]=values;scores[player]=values.reduce((a,b)=>a+b,0);
}
function finishReveal(){
 phase='revealed';if(mode==='guess'){finishGuess();return;}const value=scores[player];text(`score${player+1}`,value+' 點');$('result').hidden=false;
 if(player===0){text('status',`玩家 1 搖出 ${value} 點`);text('result',rolls[0].join(' + ')+' = '+value+' 點');text('instruction','按下方按鈕，交給玩家 2');text('nextBtn','交給玩家 2');}
 else{const win=scores[0]===scores[1]?'平局！':`玩家 ${scores[0]>scores[1]?1:2} 獲勝！`;text('status',win);text('result',`${scores[0]} : ${scores[1]}　·　${win}`);text('instruction',`玩家 2：${rolls[1].join(' + ')} = ${value} 點`);text('nextBtn','再玩一局');if(scores[0]!==scores[1])$('player'+(scores[0]>scores[1]?1:2)).classList.add('winner');}
 $('nextBtn').hidden=false;text('stageBadge','REVEALED / 已揭盅');text('stageHint',rolls[player].join(' · ')+'　/　'+value+' 點');if(navigator.vibrate)navigator.vibrate([25,40,25]);
 text('voiceBtn','重播廣東話報點');announce(rolls[player]);
}
function finishGuess(){
 const values=rolls[0], verdict=judgeGuesses(values,guesses);guessPoints=guessPoints.map((n,i)=>n+verdict.points[i]);
 for(let i=0;i<2;i++){text(`score${i+1}`,guessPoints[i]+' 分');$('player'+(i+1)).classList.toggle('winner',verdict.points[i]===1);}
 text('status',`開${verdict.label}！${verdict.total} 點`);
 text('result',values.join(' + ')+' = '+verdict.total+' 點 · '+verdict.label+'。'+verdict.points.map((n,i)=>`玩家 ${i+1}：${n?'猜中 +1 分':verdict.kind==='triple'?'骰，不加分':'猜錯，不加分'}`).join('；'));
 $('result').hidden=false;text('instruction','再玩一盅會保留分數；重新開始會清零。');text('nextBtn','再玩一盅');$('nextBtn').hidden=false;
 text('stageBadge','已揭盅');text('stageHint',values.join(' · ')+' / '+verdict.label);text('voiceBtn','重播廣東話報點');announce(values);syncGuesses();
}
function resetTurn(newGame=false){
 stopMusic();cancelSpeech();$('announcement').hidden=true;text('voiceBtn','試聽廣東話報點');
 held=false;if(mode==='guess'){guesses=[null,null];if(newGame)guessPoints=[0,0];}if(newGame){player=0;scores=[null,null];rolls=[null,null];text('score1','—');text('score2','—');}else player=1;
 phase=started?'ready':'idle';energy=0;flatSince=0;revealProgress=0;settleData=[];world.gravity.set(0,-16,0);cup.position.set(0,0,0);cup.rotation.set(0,0,0);camera.position.set(0,5.1,6.4);camera.lookAt(0,1,0);
 dice.forEach(({body:b,mesh},i)=>{mesh.scale.setScalar(1);b.type=CANNON.Body.DYNAMIC;b.position.set([-.64,.64,0][i],.82,[.52,.52,-.75][i]);b.velocity.setZero();b.angularVelocity.setZero();b.quaternion.setFromEuler(0,rand(-.15,.15),0);b.angularDamping=.35;b.linearDamping=.28;b.wakeUp();});
 $('energyFill').style.width='0%';$('energy').setAttribute('aria-valuenow','0');$('result').hidden=true;$('nextBtn').hidden=true;$('revealBtn').disabled=true;$('shakeBtn').disabled=false;for(let i=1;i<=2;i++){$('player'+i).classList.toggle('is-active',i===player+1);$('player'+i).classList.remove('winner');}
 text('status',`輪到玩家 ${player+1}`);text('instruction','按住下方「搖骰」，再揭盅比點數');text('stageBadge','READY / 等待搖動');text('stageHint','大骰近景 · 三骰實時碰撞');
 if(mode==='guess'){player=0;for(let i=0;i<2;i++){text(`score${i+1}`,guessPoints[i]+' 分');$('player'+(i+1)).classList.add('is-active');}text('status','兩人猜大／小');}syncGuesses();
}
function bind(){
 const applyText=large=>{document.documentElement.classList.toggle('large-text',large);$('textBtn').setAttribute('aria-pressed',String(large));text('textBtn',large?'大字：開':'大字：關');};
 try{applyText(localStorage.getItem('dice-large-text')==='true');music=localStorage.getItem('dice-music')==='true';}catch{applyText(false);}
 const musicUI=()=>{setMusicEnabled(music);$('musicBtn').setAttribute('aria-pressed',String(music));text('musicBtn',music?'背景音樂：開':'背景音樂：關');};musicUI();
 $('textBtn').addEventListener('click',()=>{const large=!document.documentElement.classList.contains('large-text');applyText(large);try{localStorage.setItem('dice-large-text',String(large));}catch{}});
 $('musicBtn').addEventListener('click',()=>{music=!music;musicUI();if(music&&['shaking','settling'].includes(phase))startMusic();try{localStorage.setItem('dice-music',String(music));}catch{}});
 document.querySelectorAll('[name="mode"]').forEach(r=>r.addEventListener('change',()=>changeMode(r.value)));
 document.querySelectorAll('[data-guess]').forEach(b=>b.addEventListener('click',()=>{if(!['idle','ready'].includes(phase))return;guesses[+b.dataset.player]=b.dataset.guess;syncGuesses();}));

 $('startBtn').addEventListener('click',begin);$('revealBtn').addEventListener('click',reveal);$('nextBtn').addEventListener('click',()=>resetTurn(mode==='guess'?false:player===1));$('resetBtn').addEventListener('click',()=>{resetTurn(true);$('settingsPanel').open=false;});
 $('voiceBtn').addEventListener('click',()=>{unlockAudio();announce(phase==='revealed'?rolls[player]:[4,3,1]);});
 const b=$('shakeBtn');b.style.touchAction='none';b.addEventListener('pointerdown',e=>{if(['settling','revealing','revealed'].includes(phase)||!guessReady())return;e.preventDefault();unlockAudio();if(!started)begin();held=true;b.setPointerCapture(e.pointerId);kick(rand(-12,12),10,rand(-12,12),1);});
 const stop=()=>{held=false;if(phase==='shaking')text('instruction',energy>=12?'按「揭盅」，或將手機放平':'再按住「搖骰」一會兒');};b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
 b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&guessReady()&&['idle','ready','shaking'].includes(phase)){e.preventDefault();unlockAudio();if(!started)begin();held=true;}});b.addEventListener('keyup',stop);
 $('soundBtn').addEventListener('click',()=>{sound=!sound;setEnabled(sound);unlockAudio();text('soundBtn',sound?'骰聲及報點：開':'骰聲及報點：關');$('soundBtn').setAttribute('aria-label',sound?'骰聲及報點：開，點擊關閉':'骰聲及報點：關，點擊開啟');$('soundBtn').setAttribute('aria-pressed',String(sound));});document.addEventListener('visibilitychange',()=>{if(document.hidden){held=false;stopMusic(true);cancelSpeech();}});
}
let lastUI='';
function syncUI(){
 const signature=[phase,mode,energy>=12,guessReady()].join('|');if(signature===lastUI)return;lastUI=signature;
 const done=phase==='revealed',busy=['settling','revealing'].includes(phase),canReveal=phase==='shaking'&&energy>=12;
 $('shakeBtn').hidden=done||busy;$('revealBtn').hidden=!canReveal;
 $('busyNotice').hidden=!busy;document.querySelector('.controls').classList.toggle('has-reveal',canReveal);
 $('shakeBtn').textContent=canReveal?'繼續搖':'按住搖骰';
 document.body.dataset.mode=mode;
}
function frame(){
 syncUI();
 const dt=Math.min(clock.getDelta(),.04), now=performance.now();
 if(held&&now-lastKick>85)kick(Math.sin(now*.037)*18,rand(6,15),Math.cos(now*.029)*18,1.2);
 if(!['revealing','revealed'].includes(phase)){world.step(1/60,dt,4);for(const {body:b,mesh}of dice){if(b.position.y<-.5||Math.hypot(b.position.x,b.position.z)>2.1){b.position.set(rand(-.7,.7),1.1,rand(-.7,.7));b.velocity.setZero();}mesh.position.copy(b.position);mesh.quaternion.copy(b.quaternion);}}
 if(phase==='shaking'){const p=Math.max(0,1-(now-lastKick)/260);cup.rotation.z=Math.sin(now*.037)*.025*p;cup.rotation.x=Math.cos(now*.041)*.02*p;cup.position.x=Math.sin(now*.032)*.025*p;
 const flat=orient&&Math.abs(orient.beta)<18&&Math.abs(orient.gamma)<18;
 if(energy>=12&&!held&&sensorSeen&&flat&&now-lastKick>850){if(!flatSince)flatSince=now;if(now-flatSince>850)reveal();}else flatSince=0;
 }
 if(phase==='settling'&&now>=revealAt)startReveal();
 if(phase==='revealing'){
 revealProgress=Math.min(1,revealProgress+dt*.8);const t=1-Math.pow(1-revealProgress,3);cup.position.set(2.5*t,4.6*t,-t);cup.rotation.z=-.18*t;
 camera.position.lerpVectors(new THREE.Vector3(0,5.1,6.4),new THREE.Vector3(0,6.2,4.6),t);camera.lookAt(0,1-t*.35,0);
 dice.forEach(({mesh},i)=>{mesh.scale.setScalar(1+t*.46);mesh.position.lerpVectors(settleData[i].pos,settleData[i].target,t);mesh.quaternion.slerpQuaternions(settleData[i].q,settleData[i].targetQ,t);});
 if(revealProgress===1)finishReveal();
 }
 if(started&&!sensorSeen&&now-startTime>3500&&$('sensorStatus').textContent==='正在檢測體感…')text('sensorStatus','未收到體感 · 請用 Chrome，或按住按鈕');
 renderer.render(scene,camera);
}
try{init();}catch(e){console.error(e);text('status','3D 未能啟動');text('instruction','請用最新版 Chrome 打開此連結，並啟用硬件加速');$('startBtn').disabled=true;}
