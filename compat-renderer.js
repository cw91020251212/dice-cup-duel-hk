import * as THREE from './three.module.js';
import {CSS3DRenderer,CSS3DObject} from './CSS3DRenderer.js';
export class CompatRenderer {
 constructor(parts){this.parts=parts;this.css=new CSS3DRenderer();this.domElement=this.css.domElement;this.domElement.className='dice-css-view';this.domElement.style.pointerEvents='none';this.shadowMap={};this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera();this.objects=[];this.built=false;}
 setPixelRatio(){}
 setSize(w,h){this.css.setSize(w,h);}
 setAnimationLoop(fn){const loop=()=>{fn();this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);}
 build(dice){
  const board=document.createElement('div');board.className='compat-board';board.style.cssText='width:225px;height:225px;border:2px solid #ba9b5e;border-radius:50%;background:radial-gradient(circle,#245b4b,#173b30 68%,#0c251f 70%);box-shadow:0 5px 0 #071b15,0 8px 20px #0008,inset 0 0 0 7px #122c24,inset 0 0 0 8px #aa8a4d;';const boardObj=new CSS3DObject(board);boardObj.rotation.x=-Math.PI/2;boardObj.position.y=3;this.scene.add(boardObj);
  const transforms=['rotateY(90deg)','rotateY(-90deg)','rotateX(90deg)','rotateX(-90deg)','','rotateY(180deg)'];
  dice.forEach(({mesh})=>{const el=document.createElement('div');el.className='compat-die';el.style.cssText='width:47px;height:47px;transform-style:preserve-3d;';mesh.material.forEach((mat,i)=>{const face=document.createElement('div');face.style.cssText=`position:absolute;inset:0;border-radius:5px;background:#f8eddb url('${mat.map.image.toDataURL()}') center/cover;backface-visibility:hidden;box-shadow:inset 0 0 3px #735e3b66;transform:${transforms[i]} translateZ(23.5px);`;el.append(face);});const obj=new CSS3DObject(el);this.objects.push(obj);this.scene.add(obj);});
  const cup=document.createElement('div');cup.style.cssText='width:0;height:0;transform-style:preserve-3d;';
  for(let i=0;i<32;i++){const panel=document.createElement('div');panel.style.cssText=`position:absolute;width:17px;height:116px;left:-8.5px;top:-123px;background:linear-gradient(90deg,#d4c18a03,#dfc8940d,#e8d6a60a);border-top:2px solid #bda16c;border-bottom:2px solid #bda16c;transform:rotateY(${i*360/32}deg) translateZ(82px);backface-visibility:visible;`;cup.append(panel);}
  for(const [size,y,color] of [[152,-125,'#24473c'],[180,-7,'transparent']]){const circle=document.createElement('div');circle.style.cssText=`position:absolute;left:${-size/2}px;top:${-size/2}px;width:${size}px;height:${size}px;border:2px solid #d2b477;border-radius:50%;background:${color};transform:translateY(${y}px) rotateX(90deg);box-shadow:inset 0 0 0 5px #d2b47711,inset 0 0 0 6px #d2b47744;`;if(y===-125){circle.innerHTML='<span style="position:absolute;inset:52px;border:1px solid #c6a970;border-radius:50%;display:grid;place-items:center;color:#d2b477;font:22px serif">◇</span>';}cup.append(circle);}
  this.cupObject=new CSS3DObject(cup);this.scene.add(this.cupObject);this.built=true;
 }
 render(_scene,camera){const {dice,cup}=this.parts();if(!dice.length||!cup)return;if(!this.built)this.build(dice);this.camera.copy(camera);this.camera.position.multiplyScalar(50);this.camera.near=.1;this.camera.far=5000;this.camera.updateMatrixWorld();dice.forEach(({mesh},i)=>{this.objects[i].position.copy(mesh.position).multiplyScalar(50);this.objects[i].quaternion.copy(mesh.quaternion);this.objects[i].scale.copy(mesh.scale);});this.cupObject.position.copy(cup.position).multiplyScalar(50);this.cupObject.quaternion.copy(cup.quaternion);this.css.render(this.scene,this.camera);}
}
