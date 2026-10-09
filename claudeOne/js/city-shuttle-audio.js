/* First-party procedural city foley. One private AudioContext, started only by a user gesture. */
(function(root,factory){var api=factory(root);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.CityShuttleAudio=api;})(typeof window!=="undefined"?window:globalThis,function(root){
  "use strict";
  var RATE=22050,TAU=Math.PI*2;
  var KINDS=Object.freeze(["car","truck","bus","rail","boat","plane","machinery","footsteps","cycle","voice","crowd","birds","water","fountain","wind","interior","horn","brake","door","ball","swing","siren"]);
  var RANGES=Object.freeze({car:170,truck:210,bus:180,rail:380,boat:340,plane:1400,machinery:200,footsteps:32,cycle:38,voice:35,crowd:150,birds:260,water:360,fountain:55,wind:1,interior:70,horn:240,brake:80,door:40,ball:75,swing:30,siren:380});
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function hash(value){var n=2166136261;for(var i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);return n>>>0;}
  function synthesize(kind,rate,seconds,variant){
    rate=rate||RATE;seconds=seconds||3.2;variant=variant||0;if(!KINDS.includes(kind))throw new Error("Unknown city sound: "+kind);
    var out=new Float32Array(Math.ceil(rate*seconds)),seed=hash(kind)+variant*991,low=0,brown=0,previous=0,fundamental=kind==="truck"?38:kind==="bus"?48:kind==="boat"?32:kind==="rail"?92:kind==="plane"?78:61,peak=0;
    for(var i=0;i<out.length;i++){
      var t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;var noise=seed/2147483648-1;low=low*.87+noise*.13;brown=clamp(brown*.996+noise*.035,-.8,.8);var high=noise-previous;previous=noise;
      var value=0;
      if(["car","truck","bus","boat","machinery"].includes(kind)){
        var wobble=1+.024*Math.sin(TAU*.63*t),phase=TAU*fundamental*t;
        value=(Math.sin(phase)*.19+Math.sin(phase*2)*.11+Math.sin(phase*3)*.055)*wobble+low*.13+noise*.013;
        if(kind==="bus")value+=Math.sin(TAU*128*t)*.021;if(kind==="machinery")value+=Math.sin(TAU*17*t)*.12;
      }else if(kind==="rail")value=low*.22+noise*.033+(Math.sin(TAU*148*t)+Math.sin(TAU*301*t))*.038+Math.exp(-((t%(.62))/.021))*high*.34;
      else if(kind==="plane")value=brown*.31+low*.37+noise*.10+Math.sin(TAU*fundamental*t)*.08+Math.sin(TAU*467*t)*.021;
      else if(kind==="footsteps"){var beat=t%.3927,envelope=Math.exp(-beat*43);value=envelope*(low*.66+Math.sin(TAU*(88+variant*7)*t)*.18)+Math.exp(-beat*17)*high*.032;}
      else if(kind==="cycle")value=low*.034+Math.exp(-(t%.28)*70)*high*.15;
      else if(kind==="voice"||kind==="crowd"){
        var voices=kind==="crowd"?5:1;for(var j=0;j<voices;j++){var v=t+j*.67,syllable=Math.max(0,Math.sin(v*5.1+j)*Math.sin(v*2.2+.8)),f0=102+j*21+variant*5+11*Math.sin(v*3.2),pulse=Math.sin(TAU*f0*t);
          value+=(pulse*.075+Math.sin(TAU*f0*2*t)*.038+Math.sin(TAU*(570+j*70)*t)*.015+Math.sin(TAU*(1160+j*125)*t)*.011)*syllable/Math.sqrt(voices);}
        value+=low*(kind==="crowd"?.022:.009);
      }else if(kind==="birds"){var phrase=(t+variant*.19)%2.2,note=phrase%.19,envelope=phrase<.72?Math.sin(Math.min(1,note/.035)*Math.PI/2)*Math.exp(-note*18):0;value=Math.sin(TAU*(1970+variant*160+690*Math.sin(note*19))*t)*envelope*.12;}
      else if(kind==="water")value=low*.23+brown*.13+noise*.022+(Math.sin(t*2.5)*.5+.5)*low*.04;
      else if(kind==="fountain")value=low*.27+noise*.085+Math.sin(TAU*413*t)*noise*.008;
      else if(kind==="wind")value=brown*.22+low*.08*(.7+.3*Math.sin(t*1.3));
      else if(kind==="interior")value=low*.024+Math.sin(TAU*50*t)*.014+Math.sin(TAU*150*t)*.006;
      else if(kind==="horn")value=(Math.sin(TAU*345*t)+Math.sin(TAU*430*t))*.17*Math.min(1,t/.035)*Math.max(0,Math.min(1,(seconds-t)/.07));
      else if(kind==="brake")value=high*.16*Math.exp(-t*6)+Math.sin(TAU*(1150-170*t)*t)*.026*Math.exp(-t*5);
      else if(kind==="door")value=low*.09*Math.exp(-t*4)+Math.sin(TAU*(580-160*t)*t)*.075*Math.exp(-t*8);
      else if(kind==="ball")value=(Math.sin(TAU*(100-48*t)*t)*.42+low*.22)*Math.exp(-t*22);
      else if(kind==="swing")value=Math.sin(TAU*(1090+120*Math.sin(t*4))*t)*.035*Math.max(0,Math.sin(t*4))+.018*high;
      else if(kind==="siren")value=Math.sin(TAU*700*t-(240/.7)*Math.cos(TAU*.7*t))*.24;
      out[i]=value;peak=Math.max(peak,Math.abs(value));
    }
    if(!["horn","brake","door","ball"].includes(kind)){var fade=Math.min(Math.floor(rate*.04),Math.floor(out.length/4));for(var j=0;j<fade;j++){var a=j/fade;out[j]*=a;out[out.length-1-j]*=a;}}
    if(peak>.88){var scale=.88/peak;for(var i=0;i<out.length;i++)out[i]*=scale;}
    return out;
  }
  function attenuation(kind,distance,radius){radius=radius||RANGES[kind]||100;if(distance>=radius)return 0;var reference=["crowd","water","birds","plane","rail","machinery"].includes(kind)?22:kind==="footsteps"||kind==="voice"?3:8;return clamp(1-distance/radius,0,1)**.6/(1+distance/reference);}
  function param(p,value,time,smooth){if(!p)return;if(p.setTargetAtTime)p.setTargetAtTime(value,time,smooth||.055);else p.value=value;}
  function position(node,x,y,z,time){if(node.positionX){param(node.positionX,x,time);param(node.positionY,y,time);param(node.positionZ,z,time);}else if(node.setPosition)node.setPosition(x,y,z);}
  function Sound(options){options=options||{};this.Context=options.Context||root.AudioContext||root.webkitAudioContext;this.available=!!this.Context;this.context=null;this.master=null;this.limiter=null;this.buffers=new Map();this.voices=new Map();this.effects=new Set();this.events=new Map();this.volume=options.volume==null?.55:clamp(options.volume,0,1);this.muted=!!options.muted;this.paused=true;this.disposed=false;this.lastTime=0;}
  Sound.prototype.start=function(){if(this.disposed||!this.available)return Promise.resolve(false);try{if(!this.context){var c=this.context=new this.Context({latencyHint:"interactive"});this.master=c.createGain();this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-13;this.limiter.knee.value=14;this.limiter.ratio.value=5;this.master.connect(this.limiter);this.limiter.connect(c.destination);}this.setPaused(false);return this.context.resume().then(function(){return !this.disposed;}.bind(this)).catch(function(){return false;});}catch(ignore){this.available=false;return Promise.resolve(false);}};
  Sound.prototype.buffer=function(kind,variant,oneShot){var key=kind+"-"+variant;if(this.buffers.has(key))return this.buffers.get(key);var duration=oneShot?kind==="horn"?.42:.38:kind==="birds"?6.6:kind==="voice"||kind==="crowd"?6.4:3.2,data=synthesize(kind,RATE,duration,variant),buffer=this.context.createBuffer(1,data.length,RATE);buffer.getChannelData(0).set(data);this.buffers.set(key,buffer);return buffer;};
  Sound.prototype.makeVoice=function(desc,oneShot){var c=this.context,source=c.createBufferSource(),gain=c.createGain(),panner=c.createPanner(),filter=c.createBiquadFilter(),variant=hash(desc.id)%3;
    source.buffer=this.buffer(desc.kind,variant,oneShot);source.loop=!oneShot;panner.panningModel="HRTF";panner.distanceModel="inverse";panner.refDistance=1;panner.rolloffFactor=0;panner.maxDistance=6000;filter.type="lowpass";filter.frequency.value=14000;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.master);
    var voice={source:source,gain:gain,panner:panner,filter:filter,kind:desc.kind,lastDistance:0,lastTime:0,desc:desc};source.onended=function(){this.cleanVoice(voice);}.bind(this);if(oneShot)this.effects.add(voice);source.start(0,oneShot?0:(hash(desc.id)%997)/997*source.buffer.duration);return voice;
  };
  Sound.prototype.cleanVoice=function(voice){voice.source.onended=null;try{voice.source.stop();}catch(ignore){}[voice.source,voice.filter,voice.gain,voice.panner].forEach(function(n){try{n.disconnect();}catch(ignore){}});this.effects.delete(voice);};
  Sound.prototype.stopVoices=function(){this.voices.forEach(this.cleanVoice,this);this.voices.clear();Array.from(this.effects).forEach(this.cleanVoice,this);this.events.clear();};
  Sound.prototype.setVolume=function(value){this.volume=clamp(Number(value)||0,0,1);if(this.master)param(this.master.gain,this.muted||this.paused?0:this.volume,this.context.currentTime,.025);};
  Sound.prototype.setMuted=function(value){this.muted=!!value;if(this.muted)this.stopVoices();this.setVolume(this.volume);};
  Sound.prototype.setPaused=function(value){this.paused=!!value;this.setVolume(this.volume);if(this.context){var result=this.paused?this.context.suspend():this.context.resume();if(result&&result.catch)result.catch(function(){});}};
  Sound.prototype.updateVoice=function(voice,desc,state,time){var dx=desc.x-state[0],dy=desc.y-state[1],dz=desc.z-state[2],distance=Math.hypot(dx,dy,dz),dt=time-voice.lastTime,radial=dt>.01&&dt<.25?(distance-voice.lastDistance)/dt:0,doppler=clamp(343/(343+clamp(radial,-100,100)),.74,1.28);position(voice.panner,desc.x,desc.y,desc.z,this.context.currentTime);
    var rate=clamp((desc.pitch||1)*(["car","truck","bus","rail","boat","plane"].includes(desc.kind)?doppler:1),.55,2.1);param(voice.source.playbackRate,rate,this.context.currentTime,.08);param(voice.gain.gain,(desc.gain==null?.4:desc.gain)*attenuation(desc.kind,distance,desc.radius),this.context.currentTime);param(voice.filter.frequency,Math.max(850,14000/(1+distance/90)),this.context.currentTime,.12);voice.lastDistance=distance;voice.lastTime=time;voice.desc=desc;};
  Sound.prototype.update=function(frame){if(!this.context||this.paused||this.muted||this.disposed)return;var state=frame.state,time=frame.time==null?0:frame.time,c=this.context,listener=c.listener;position(listener,state[0],state[1],state[2],c.currentTime);var yaw=state[3]||0,pitch=state[4]||0,fx=Math.sin(yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=-Math.cos(yaw)*Math.cos(pitch);
    if(listener.forwardX){param(listener.forwardX,fx,c.currentTime);param(listener.forwardY,fy,c.currentTime);param(listener.forwardZ,fz,c.currentTime);param(listener.upX,0,c.currentTime);param(listener.upY,1,c.currentTime);param(listener.upZ,0,c.currentTime);}else if(listener.setOrientation)listener.setOrientation(fx,fy,fz,0,1,0);
    var sounds=(frame.audio||[]).slice(0,23),wind={id:"flight-wind",kind:"wind",x:state[0],y:state[1],z:state[2],gain:.04+Math.min(.21,Math.abs(state[6]||0)*.001)+Math.min(.03,state[1]*.00007),radius:1};sounds.push(wind);var wanted=new Set();
    sounds.forEach(function(desc){if(!KINDS.includes(desc.kind))return;var key=desc.id+"/"+desc.kind;if(desc.oneShot){if(this.events.get(key+"/event")!==desc.event){var effect=this.makeVoice(desc,true);this.updateVoice(effect,desc,state,time);this.events.set(key+"/event",desc.event);}return;}wanted.add(key);var voice=this.voices.get(key);if(!voice){voice=this.makeVoice(desc,false);this.voices.set(key,voice);}this.updateVoice(voice,desc,state,time);
      if(desc.horn&&!this.events.get(key+"/horn")){var effect=this.makeVoice(Object.assign({},desc,{kind:"horn"}),true);this.updateVoice(effect,Object.assign({},desc,{kind:"horn",gain:.5,pitch:1}),state,time);}this.events.set(key+"/horn",!!desc.horn);
      if(desc.braking&&!this.events.get(key+"/brake")&&desc.speed>2){var brake=this.makeVoice(Object.assign({},desc,{kind:"brake"}),true);this.updateVoice(brake,Object.assign({},desc,{kind:"brake",gain:.32,pitch:1}),state,time);}this.events.set(key+"/brake",!!desc.braking);
      if(desc.doors&&!this.events.get(key+"/door")){var door=this.makeVoice(Object.assign({},desc,{kind:"door"}),true);this.updateVoice(door,Object.assign({},desc,{kind:"door",gain:.28,pitch:1}),state,time);}this.events.set(key+"/door",!!desc.doors);
    },this);
    this.voices.forEach(function(voice,key){if(!wanted.has(key)){this.cleanVoice(voice);this.voices.delete(key);this.events.delete(key+"/horn");this.events.delete(key+"/brake");this.events.delete(key+"/door");}},this);this.lastTime=time;
  };
  Sound.prototype.dispose=function(){if(this.disposed)return;this.disposed=true;this.stopVoices();this.buffers.clear();if(this.master)this.master.disconnect();if(this.limiter)this.limiter.disconnect();if(this.context){var result=this.context.close();if(result&&result.catch)result.catch(function(){});}this.context=null;this.master=null;this.limiter=null;};
  return Object.freeze({Sound:Sound,synthesize:synthesize,attenuation:attenuation,KINDS:KINDS,RATE:RATE});
});
