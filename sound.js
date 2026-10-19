let context, sampleBuffer, loading, lastHit=0, offsets=[], enabled=true, utterance;
const status = text => {const el=document.getElementById('voiceStatus');if(el)el.textContent=text;};
export function cantoneseVoice(voices){
 const lang=v=>v.lang.replaceAll('_','-').toLowerCase();
 const named=v=>/cantonese|廣東話|\u5e7f\u4e1c\u8bdd|粵語|\u7ca4\u8bed/i.test(v.name);
 const notMandarin=v=>!/mandarin|普通話|\u666e\u901a\u8bdd|國語|\u56fd\u8bed/i.test(v.name);
 return voices.find(v=>lang(v)==='yue-hk')||voices.find(v=>/^yue(?:-|$)/.test(lang(v)))||voices.find(v=>named(v)&&notMandarin(v))||voices.find(v=>/^zh-(?:hant-)?hk$/.test(lang(v))&&notMandarin(v))||null;
}
const numberWords=['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八'];
export function spokenResult(values){const total=values.reduce((a,b)=>a+b,0);return values.map(v=>numberWords[v]).join('，')+'，'+numberWords[total]+'點。';}
export function initVoice(){
 const update=()=>{const voice='speechSynthesis' in window?cantoneseVoice(window.speechSynthesis.getVoices()):null;status(voice?'廣東話報點已就緒':'未找到廣東話語音 · 揭盅仍有字幕');};
 update();if('speechSynthesis'in window)window.speechSynthesis.addEventListener('voiceschanged',update);
}
export function announce(values){
 const caption=values.join('、')+'，'+values.reduce((a,b)=>a+b,0)+'點';const el=document.getElementById('announcement');if(el){el.hidden=false;el.textContent=caption;}
 if(!enabled){status('聲音已關閉 · 保留報點字幕');return false;}
 if(!('speechSynthesis'in window)){status('此瀏覽器不支援語音 · 已顯示報點字幕');return false;}
 const voice=cantoneseVoice(window.speechSynthesis.getVoices());if(!voice){status('此瀏覽器未提供廣東話語音 · 已顯示字幕');return false;}
 window.speechSynthesis.cancel();utterance=new SpeechSynthesisUtterance(spokenResult(values));utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.86;utterance.pitch=1;utterance.volume=.95;
 const diagnostic=document.getElementById('voiceStatus');if(diagnostic){diagnostic.dataset.voiceName=voice.name;diagnostic.dataset.voiceLang=utterance.lang;diagnostic.dataset.spokenText=utterance.text;}
 utterance.onstart=()=>status('廣東話報點中…');utterance.onend=()=>status('廣東話報點已完成 · 可點按鈕重播');utterance.onerror=()=>status('語音暫未能播放 · 點「重播廣東話報點」再試');
 window.speechSynthesis.resume();window.speechSynthesis.speak(utterance);status('正在準備廣東話報點…');return true;
}
export function cancelSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel();utterance=null;}
export function setEnabled(value){enabled=value;if(!value)cancelSpeech();}
export function unlockWoodAudio(){
 try{context??=new (window.AudioContext||window.webkitAudioContext)();context.resume();if(!loading)loading=fetch('./wood-dice-cup.mp3').then(r=>{if(!r.ok)throw Error('音效不可用');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>{sampleBuffer=b;analyseOffsets();document.documentElement.dataset.woodAudio='recording';}).catch(()=>{document.documentElement.dataset.woodAudio='wood-model-fallback';});}catch{}
 if('speechSynthesis'in window)window.speechSynthesis.resume();
}
function analyseOffsets(){
 const data=sampleBuffer.getChannelData(0),size=Math.floor(sampleBuffer.sampleRate*.018);let peaks=[];
 for(let i=size;i<data.length-size*12;i+=size){let sum=0;for(let j=0;j<size;j++)sum+=data[i+j]*data[i+j];peaks.push({offset:i/sampleBuffer.sampleRate,rms:Math.sqrt(sum/size)});}
 const max=Math.max(...peaks.map(p=>p.rms),.001);for(let i=1;i<peaks.length-1;i++){const p=peaks[i];if(p.rms>max*.27&&p.rms>=peaks[i-1].rms&&p.rms>=peaks[i+1].rms&&(!offsets.length||p.offset-offsets[offsets.length-1]>.13))offsets.push(Math.max(0,p.offset-.012));}if(!offsets.length)offsets=[0];
}
export function woodClack(strength=1){
 if(!enabled||!context||context.state!=='running'||performance.now()-lastHit<70)return;lastHit=performance.now();const now=context.currentTime;
 if(sampleBuffer){const src=context.createBufferSource(),gain=context.createGain();src.buffer=sampleBuffer;src.playbackRate.value=.91+Math.random()*.18;const offset=offsets[Math.floor(Math.random()*offsets.length)],duration=Math.min(.24,sampleBuffer.duration-offset);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(Math.min(.85,.24+strength*.035),now+.003);gain.gain.setValueAtTime(Math.min(.85,.24+strength*.035),now+duration*.64);gain.gain.linearRampToValueAtTime(0,now+duration);src.connect(gain);gain.connect(context.destination);src.start(now,offset,duration);return;}
 // A short low, damped wood-like impact is only a network/loading fallback.
 const n=Math.floor(context.sampleRate*.15),buffer=context.createBuffer(1,n,context.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<n;i++){const t=i/context.sampleRate;d[i]=(Math.random()*2-1)*Math.exp(-t*55);}
 for(const [frequency,q,volume]of [[230,3,.35],[510,4,.25],[1030,2,.1]]){const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();src.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency*(.9+Math.random()*.2);filter.Q.value=q;gain.gain.value=volume*Math.min(1,strength/4+.4);src.connect(filter);filter.connect(gain);gain.connect(context.destination);src.start();}
}
