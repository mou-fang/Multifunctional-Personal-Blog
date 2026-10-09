/* Articulated first-party people and hollow vehicles. All parts are real 3D geometry. */
(function(root,factory){var api=factory(typeof module==="object"&&module.exports?require("./city-shuttle-geometry.js"):root.CityShuttleGeometry);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.CityShuttleActors=api;})(typeof window!=="undefined"?window:globalThis,function(G){
  "use strict";
  var PROFILES=Object.freeze([
    {id:"linen-coat",skin:[.72,.51,.36],hair:[.10,.07,.06],top:[.65,.54,.38],bottom:[.19,.24,.29],height:1.77,bag:true},
    {id:"blue-runner",skin:[.64,.43,.29],hair:[.09,.06,.04],top:[.24,.48,.66],bottom:[.13,.19,.25],height:1.81},
    {id:"red-cardigan",skin:[.81,.61,.43],hair:[.16,.09,.05],top:[.62,.24,.20],bottom:[.26,.29,.32],height:1.66,longHair:true},
    {id:"student-green",skin:[.76,.54,.37],hair:[.08,.055,.04],top:[.28,.48,.39],bottom:[.22,.26,.35],height:1.70,bag:true},
    {id:"white-shirt",skin:[.68,.47,.32],hair:[.10,.07,.055],top:[.75,.77,.71],bottom:[.18,.24,.30],height:1.74},
    {id:"rose-skirt",skin:[.82,.63,.46],hair:[.11,.08,.06],top:[.60,.36,.43],bottom:[.44,.33,.42],height:1.63,longHair:true,skirt:true},
    {id:"orange-worker",skin:[.65,.43,.27],hair:[.09,.06,.035],top:[.80,.48,.15],bottom:[.21,.24,.29],height:1.79,hat:"white",reflective:true},
    {id:"grandparent",skin:[.68,.48,.35],hair:[.60,.61,.57],top:[.38,.40,.31],bottom:[.24,.26,.27],height:1.64,elder:true},
    {id:"school-child",skin:[.80,.60,.42],hair:[.11,.07,.05],top:[.31,.50,.61],bottom:[.23,.28,.39],height:1.20,bag:true,child:true},
    {id:"yellow-child",skin:[.76,.54,.37],hair:[.15,.09,.045],top:[.77,.62,.25],bottom:[.34,.38,.33],height:1.10,child:true},
    {id:"violet-jacket",skin:[.77,.55,.38],hair:[.10,.07,.05],top:[.41,.35,.59],bottom:[.19,.24,.31],height:1.73,bag:true},
    {id:"cafe-apron",skin:[.73,.51,.34],hair:[.16,.095,.05],top:[.69,.67,.56],bottom:[.31,.37,.29],height:1.69,apron:true},
    {id:"navy-driver",skin:[.67,.45,.29],hair:[.085,.055,.035],top:[.21,.31,.43],bottom:[.15,.21,.28],height:1.76},
    {id:"grey-suit",skin:[.74,.52,.37],hair:[.085,.058,.044],top:[.35,.39,.42],bottom:[.27,.30,.33],height:1.82},
    {id:"teal-cyclist",skin:[.72,.48,.32],hair:[.10,.065,.04],top:[.23,.53,.50],bottom:[.17,.25,.29],height:1.71,hat:"silver"},
    {id:"hospital-coat",skin:[.81,.60,.43],hair:[.13,.09,.06],top:[.75,.83,.81],bottom:[.24,.35,.40],height:1.68},
    {id:"burgundy-bag",skin:[.74,.52,.37],hair:[.22,.12,.065],top:[.49,.21,.29],bottom:[.26,.29,.34],height:1.72,longHair:true,bag:true},
    {id:"park-tai-chi",skin:[.73,.53,.39],hair:[.55,.56,.53],top:[.64,.67,.60],bottom:[.48,.51,.46],height:1.66,elder:true},
    {id:"cream-cap",skin:[.64,.43,.30],hair:[.08,.06,.04],top:[.60,.59,.48],bottom:[.25,.31,.36],height:1.80,hat:"ivory"},
    {id:"pink-phone",skin:[.80,.61,.44],hair:[.14,.08,.04],top:[.68,.40,.52],bottom:[.30,.32,.40],height:1.65,longHair:true},
    {id:"delivery-green",skin:[.66,.44,.28],hair:[.09,.065,.04],top:[.24,.59,.37],bottom:[.22,.28,.31],height:1.75,hat:"green",bag:true},
    {id:"market-blue",skin:[.76,.55,.39],hair:[.20,.125,.065],top:[.28,.44,.58],bottom:[.30,.30,.28],height:1.70,apron:true},
    {id:"black-hood",skin:[.72,.49,.33],hair:[.10,.065,.04],top:[.23,.27,.32],bottom:[.29,.33,.38],height:1.78},
    {id:"gold-knit",skin:[.81,.63,.46],hair:[.18,.10,.055],top:[.67,.56,.33],bottom:[.31,.36,.34],height:1.64,longHair:true}
  ]);
  function Emitter(b,pose,prefix){this.b=b;this.pose=pose;this.prefix=prefix||"";}
  Emitter.prototype.point=function(p){var s=Math.sin(this.pose.yaw||0),c=Math.cos(this.pose.yaw||0),sx=Math.sin(this.pose.pitch||0),cx=Math.cos(this.pose.pitch||0),y=p[1]*cx-p[2]*sx,z=p[1]*sx+p[2]*cx;
    return [p[0]*c+z*s,(this.pose.y||0)+y,-p[0]*s+z*c];};
  Emitter.prototype.part=function(id,p,size,tint,options){var q=this.point(p);options=Object.assign({solid:false},options||{});options.yaw=(options.yaw||0)+(this.pose.yaw||0);options.pitch=(options.pitch||0)+(this.pose.pitch||0);this.b.part(this.prefix+id,q[0],q[1],q[2],size[0],size[1],size[2],tint,options);};
  Emitter.prototype.ball=function(id,p,r,tint,options){this.part(id,p,r.map(function(v){return v*2;}),tint,Object.assign({shape:1},options));};
  Emitter.prototype.beam=function(id,a,b,width,tint,options){this.b.beam(this.prefix+id,this.point(a),this.point(b),width,tint,Object.assign({solid:false},options));};
  Emitter.prototype.light=function(id,p,tint,radius,options){this.part(id,p,[.28,.18,.12],tint,Object.assign({material:12,emission:2.2,parameter:radius||54,glyph:"*"},options));};
  function head(e,id,centre,profile,scale,time,detail,gaze){
    if(gaze){var parent=e,angle=gaze;e=Object.create(parent);e.pose=Object.assign({},parent.pose,{yaw:(parent.pose.yaw||0)+angle});e.point=function(p){var x=p[0]-centre[0],z=p[2]-centre[2];return parent.point([centre[0]+x*Math.cos(angle)+z*Math.sin(angle),p[1],centre[2]-x*Math.sin(angle)+z*Math.cos(angle)]);};}
    var skin=profile.skin,headSize=profile.child?1.11:1,rx=.122*scale*headSize,ry=.15*scale*headSize,rz=.116*scale*headSize;
    e.ball(id+"head",centre,[rx,ry,rz],skin,{glyph:"o"});
    e.ball(id+"hair",[centre[0],centre[1]+ry*.72,centre[2]-.015*scale],[rx*1.03,ry*.43,rz*1.02],profile.hair);
    if(profile.longHair)e.ball(id+"hair-back",[centre[0],centre[1]-.08*scale,centre[2]-.105*scale],[rx*.91,.17*scale,.053*scale],profile.hair);
    if(profile.hat){e.ball(id+"cap",[centre[0],centre[1]+ry*.87,centre[2]],[rx*1.14,.055*scale,rz*1.22],profile.hat);e.part(id+"cap-brim",[centre[0],centre[1]+ry*.73,centre[2]+rz*.81],[rx*2.2,.024*scale,.12*scale],profile.hat);}
    if(detail){var look=Math.max(-.35,Math.min(.35,gaze||0))*.018*scale;e.ball(id+"eye-left",[centre[0]-.045*scale+look,centre[1]+.035*scale,centre[2]+rz*.95],[.022*scale,.023*scale,.017*scale],[.10,.075,.055]);
      e.ball(id+"eye-right",[centre[0]+.045*scale+look,centre[1]+.035*scale,centre[2]+rz*.95],[.022*scale,.023*scale,.017*scale],[.10,.075,.055]);
      e.ball(id+"nose",[centre[0]+look*.55,centre[1]-.008*scale,centre[2]+rz*1.1],[.021*scale,.033*scale,.028*scale],skin);
      e.part(id+"mouth",[centre[0],centre[1]-.065*scale,centre[2]+rz*.91],[.046*scale,.011*scale,.017*scale],[.30,.15,.105]);
    }
  }
  function person(e,id,profile,mode,time,speed,detail,seatOffset){
    profile=profile||PROFILES[0];mode=mode||"walk";var s=profile.height/1.77,offset=seatOffset||[0,0,0],seated=["sit","eat","drive","ride","cycle"].includes(mode),gait=time*(mode==="run"?12:8)+(profile.height*7.1),moving=Math.min(1,Math.abs(speed||0)/1.0),swing=Math.sin(gait)*moving;
    var base=0,bob=seated?0:Math.abs(Math.sin(gait))*moving*.025,lean=profile.elder?.05:mode==="run"?.045:mode==="cycle"?.12:0;
    function p(x,y,z){return [offset[0]+x*s,offset[1]+(y+base+bob)*s,offset[2]+z*s];}
    e.ball(id+"torso",p(0,1.16-(seated?.33:0),lean),[.215*s,.31*s,.14*s],profile.top,{material:13,detail:profile.reflective?3:profile.apron?2:0});
    e.ball(id+"pelvis",p(0,.89-(seated?.32:0),0),[.18*s,.13*s,.135*s],profile.bottom);
    if(profile.skirt)e.part(id+"skirt",p(0,.68,.015),[.40*s,.38*s,.30*s],profile.bottom,{shape:2,parameter:1.2,material:13});
    if(profile.apron)e.part(id+"apron",p(0,.99-(seated?.32:0),.155),[.31*s,.53*s,.025*s],[.31,.35,.30]);
    head(e,id,p(0,1.64-(seated?.32:0),lean+.01),profile,s,time,detail,mode==="talk"?Math.sin(time*.8)*.24:mode==="wait"?Math.sin(time*.37)*.32:0);
    [-1,1].forEach(function(side){var phase=side*swing,hip=p(side*.105,.86-(seated?.32:0),0),knee=seated?p(side*.105,.64,.33):p(side*.105,.47-Math.abs(phase)*.035,phase*.11),
        foot=seated?p(side*.105,.25,.42):p(side*.105,.085+Math.max(0,phase)*.12,phase*.23);
      if(mode==="cycle"){knee=p(side*.105,.64+phase*.08,.30);foot=p(side*.105,.25+phase*.13,.42+Math.cos(gait+(side>0?0:Math.PI))*.13);}
      if(mode==="sit"||mode==="eat"){knee=p(side*.105,.52,.36);foot=p(side*.105,.08,.42);}
      if(mode==="taichi"){knee=p(side*.17,.46,.05);foot=p(side*.22,.085,.08);}
      if(!seated)foot[1]-=bob*s;
      if(!profile.skirt||seated)e.beam(id+"thigh-"+side,hip,knee,.115*s,profile.bottom);e.beam(id+"shin-"+side,knee,foot,.085*s,profile.bottom);
      e.part(id+"shoe-"+side,[foot[0],foot[1]-.026*s,foot[2]+.055*s],[.12*s,.09*s,.23*s],[.17,.18,.185]);
      var shoulder=p(side*.23,1.39-(seated?.32:0),lean),elbow,wrist;
      if(mode==="drive"){elbow=p(side*.22,1.00,.20);wrist=p(side*.17,1.02,.58);}
      else if(mode==="cycle"){elbow=p(side*.28,.97,.44);wrist=p(side*.20,.81,.69);}
      else if(mode==="phone"&&side===1){elbow=p(.30,1.14,.08);wrist=p(.17,1.49,.15);e.part(id+"phone",p(.17,1.49,.18),[.058*s,.14*s,.022*s],"ink");}
      else if(mode==="talk"||mode==="buy"){var gesture=Math.sin(time*2.1+side)*.06;elbow=p(side*.32,1.09,.07);wrist=p(side*.28,1.08+gesture,.29);}
      else if(mode==="taichi"){var flow=Math.sin(time*.65+side*.8);elbow=p(side*.39,1.10+flow*.16,.13);wrist=p(side*.35,1.34+flow*.18,.29+flow*.08);}
      else if(mode==="basketball"){elbow=p(side*.3,1.09,.17);wrist=p(side*.28,side>0?.34+Math.abs(Math.sin(time*5))*.55:.96,.32);}
      else if(mode==="eat"){var sip=side>0?(Math.sin(time*1.2)*.5+.5):0;elbow=p(side*.26,.88,.17);wrist=p(side*.15,.76+sip*.47,.48-sip*.23);if(side>0)e.part(id+"cup",[wrist[0],wrist[1]+.03*s,wrist[2]+.04*s],[.10*s,.12*s,.10*s],"ivory",{shape:2});}
      else if(mode==="stretch"){elbow=p(side*.43,1.60,.02);wrist=p(side*.29,1.89,.0);}
      else if(seated){elbow=p(side*.29,.83,.08);wrist=p(side*.19,.74,.25);}
      else{elbow=p(side*.30,1.04,-phase*.11);wrist=p(side*.27,.86,-phase*.23);}
      e.beam(id+"upper-arm-"+side,shoulder,elbow,.085*s,profile.top);e.beam(id+"forearm-"+side,elbow,wrist,.067*s,profile.skin);
      if(detail)e.ball(id+"hand-"+side,wrist,[.044*s,.061*s,.035*s],profile.skin);
    });
    if(profile.bag&&!seated)e.part(id+"shoulder-bag",p(-.25,.86,-.10),[.17*s,.25*s,.19*s],"brick",{material:13});
    if(profile.elder&&mode==="walk"){e.beam(id+"cane",p(.35,.85,.13),p(.37,.02,.24),.024*s,"brick");}
  }
  function tyre(e,id,x,y,z,r,time,speed,detail){
    e.part(id+"-rubber",[x,y,z],[r*2,.19,r*2],[.075,.085,.10],{shape:2,roll:Math.PI/2,parameter:1,glyph:"@"});
    e.part(id+"-hub",[x+(x>0?.1:-.1),y,z],[r*1.25,.035,r*1.25],"silver",{shape:2,roll:Math.PI/2,parameter:1});
    if(detail){var theta=time*(speed||0)/r;for(var i=0;i<4;i++){var a=theta+i*Math.PI/2;e.beam(id+"-spoke-"+i,[x+(x>0?.13:-.13),y,z],[x+(x>0?.13:-.13),y+Math.cos(a)*r*.60,z+Math.sin(a)*r*.60],.024,"ivory");}}
  }
  function wheel(e,id,centre,r,tint){var points=[];for(var i=0;i<10;i++){var a=i*Math.PI*2/10;points.push(e.point([centre[0]+Math.cos(a)*r,centre[1]+Math.sin(a)*r*.83,centre[2]+Math.sin(a)*r*.3]));}e.b.ring(e.prefix+id,points,.035,tint,{solid:false});}
  function car(e,id,spec,time,speed,detail){
    var paint=spec.paint||[.64,.65,.57],length=spec.type==="van"?5.2:4.6,width=spec.type==="van"?2.12:1.94,cabinHeight=spec.type==="van"?2.28:1.80,front=length/2,rear=-front;
    e.part(id+"chassis",[0,.18,0],[width,.08,length],"ink");e.part(id+"cabin-floor",[0,.20,-.15],[width*.91,.08,3.1],"stone");
    e.part(id+"front-body",[0,.72,front-.45],[width,.55,.98],paint,{material:5,glyph:"#"});e.part(id+"rear-body",[0,.72,rear+.49],[width,.55,1.08],paint,{material:5,glyph:"#"});
    e.part(id+"hood",[0,.93,front-.63],[width*.96,.25,1.21],paint,{pitch:-.08});
    e.part(id+"boot",[0,.97,rear+.55],[width*.96,.31,1.1],paint,{pitch:.05});
    e.part(id+"cabin-roof",[0,cabinHeight,-.14],[width*.93,.12,spec.type==="van"?3.35:2.35],paint);
    [-1,1].forEach(function(side){
      e.part(id+"lower-sill-"+side,[side*width*.47,.52,-.15],[.10,.43,length-.2],paint);
      e.part(id+"door-"+side,[side*width*.48,.91,-.17],[.095,.61,2.25],paint);
      e.part(id+"side-glass-"+side,[side*width*.468,1.40+(spec.type==="van"?.2:0),-.18],[.025,spec.type==="van"?.94:.59,2.03],"glass",{material:16});
      e.beam(id+"front-pillar-"+side,[side*width*.47,1.07,.87],[side*width*.43,cabinHeight,.66],.06,paint);
      e.beam(id+"rear-pillar-"+side,[side*width*.47,1.05,-1.17],[side*width*.43,cabinHeight,-1.27],.065,paint);
      e.part(id+"door-handle-"+side,[side*width*.506,1.06,-.20],[.026,.045,.17],"silver");
      e.part(id+"mirror-"+side,[side*(width*.53),1.25,.82],[.18,.11,.23],paint);
      tyre(e,id+"front-wheel-"+side,side*width*.49,.36,1.46,.35,time,speed,detail);tyre(e,id+"rear-wheel-"+side,side*width*.49,.36,-1.45,.35,time,speed,detail);
      e.light(id+"headlight-"+side,[side*width*.36,.91,front+.03],"white",56,{material:spec.parked?0:12,emission:spec.parked?0:2.2});
      e.part(id+"tail-lamp-"+side,[side*width*.35,.92,rear-.035],[.31,.16,.11],"red",{material:6,emission:spec.braking?1.5:.65});
      e.part(id+"indicator-"+side,[side*width*.43,.92,front+.035],[.11,.10,.10],"gold",{material:6,emission:spec.turning&&Math.floor(time*3)%2?1.0:.0});
    });
    e.part(id+"windscreen",[0,1.40,.78],[width*.85,.61,.025],"glass",{material:16,pitch:.18});
    e.part(id+"rear-window",[0,1.38,-1.25],[width*.84,.54,.025],"glass",{material:16,pitch:-.12});
    e.part(id+"dashboard",[0,.99,.92],[width*.86,.14,.38],"ink");
    if(detail){
      [[-.44,.1],[.44,.1],[-.42,-.83],[.42,-.83]].forEach(function(p,i){e.part(id+"seat-base-"+i,[p[0],.48,p[1]],[.57,.13,.56],[.29,.30,.31]);e.part(id+"seat-back-"+i,[p[0],.81,p[1]-.27],[.56,.72,.13],[.27,.29,.31]);});
      if(spec.driver!==false)person(e,id+"driver-",PROFILES[spec.driver==null?12:spec.driver],"drive",time,0,true,[-.44,.06,.10]);wheel(e,id+"steering-wheel",[-.44,1.08,.68],.18,"ink");
      (spec.passengers||[]).forEach(function(profile,i){var seats=[[.44,.10],[-.42,-.83],[.42,-.83]],p=seats[i%3],child=PROFILES[profile].child;if(child)e.part(id+"booster-"+i,[p[0],.62,p[1]],[.42,.22,.43],"silver");person(e,id+"passenger-"+i+"-",PROFILES[profile],"ride",time,0,true,[p[0],child?.47:.06,p[1]]);});
    }
    else{if(spec.driver!==false)head(e,id+"driver-",[-.44,1.33,.12],PROFILES[spec.driver==null?12:spec.driver],1,time,false);if(spec.passengers&&spec.passengers.length)head(e,id+"passenger-",[.44,1.31,.12],PROFILES[spec.passengers[0]],1,time,false);}
    if(spec.taxi){e.part(id+"taxi-roof-light",[0,cabinHeight+.13,-.06],[.62,.21,.25],"warm",{material:6,emission:.38});}
    if(spec.emergency){[-1,1].forEach(function(s){e.part(id+"medical-cross-v-"+s,[s*width*.51,.91,-.35],[.03,.46,.12],"red");e.part(id+"medical-cross-h-"+s,[s*width*.51,.91,-.35],[.03,.12,.47],"red");e.part(id+"emergency-light-"+s,[s*.33,cabinHeight+.2,-.11],[.52,.20,.22],s<0?"red":"blue",{material:6,emission:spec.alert&&!spec.parked&&Math.floor(time*4)%2===(s<0?0:1)?1.6:.06});});}
    e.part(id+"front-number",[0,.55,front+.05],[.59,.18,.05],"blue",{material:6,emission:.15,glyph:"="});
  }
  function bus(e,id,spec,time,speed,detail){
    var paint=spec.paint||[.21,.48,.43],half=5.4;
    e.part(id+"chassis",[0,.24,0],[2.55,.14,10.7],"ink");e.part(id+"front-body",[0,.94,5.25],[2.60,.67,.30],paint);e.part(id+"rear-body",[0,.94,-5.25],[2.60,.67,.30],paint);
    e.part(id+"roof",[0,3.08,0],[2.59,.17,10.7],paint);e.part(id+"floor",[0,.32,0],[2.45,.14,10.5],"stone");
    [-1,1].forEach(function(side){e.part(id+"window-side-"+side,[side*1.28,2.15,0],[.035,1.66,10.05],"glass",{material:16});
      e.part(id+"lower-side-"+side,[side*1.28,.94,0],[.09,.67,10.5],paint);
      for(var i=-4;i<=4;i++)e.part(id+"window-mullion-"+side+"-"+i,[side*1.30,2.12,i*1.15],[.09,1.91,.075],paint);
      tyre(e,id+"wheel-front-"+side,side*1.27,.45,3.32,.45,time,speed,detail);tyre(e,id+"wheel-rear-"+side,side*1.27,.45,-3.38,.45,time,speed,detail);
      e.light(id+"headlight-"+side,[side*.89,1.0,half+.03],"white",65);e.part(id+"tail-light-"+side,[side*.91,1.13,-half-.02],[.27,.53,.08],"red",{material:6,emission:spec.braking?1.4:.55});
    });
    e.part(id+"front-glass",[0,2.14,half-.09],[2.45,1.64,.035],"glass",{material:16});e.part(id+"rear-glass",[0,2.18,-half+.08],[2.43,1.56,.035],"glass",{material:16});
    e.part(id+"route-display",[0,2.85,half+.035],[1.69,.23,.025],"gold",{material:6,emission:.6,glyph:"8"});
    e.part(id+"driver-dashboard",[0,1.40,4.70],[2.14,.19,.45],"ink");
    if(detail){e.part(id+"driver-seat",[-.61,.99,4.05],[.67,.23,.65],"blue");e.part(id+"driver-platform",[0,.63,4.10],[2.35,.27,1.6],"stone");person(e,id+"driver-",PROFILES[12],"drive",time,0,true,[-.61,.59,4.05]);wheel(e,id+"steering-wheel",[-.61,1.61,4.67],.22,"ink");
      for(var row=0;row<6;row++)[-1,1].forEach(function(side){var z=2.3-row*1.14,x=side*.73;e.part(id+"seat-"+row+"-"+side,[x,.97,z],[.62,.25,.57],"blue");e.part(id+"seat-back-"+row+"-"+side,[x,1.42,z-.26],[.61,.73,.11],"blue");
        e.part(id+"foot-platform-"+row+"-"+side,[x,.60,z+.28],[.68,.2,.64],"stone");
        var personId=row*2+(side>0?1:0);if(personId<(spec.passengers||[]).length){var profile=PROFILES[spec.passengers[personId]];if(profile.child)e.part(id+"child-cushion-"+personId,[x,1.15,z],[.43,.18,.44],"silver");person(e,id+"passenger-"+personId+"-",profile,"ride",time,0,true,[x,profile.child?.82:.52,z]);}
      });
      e.beam(id+"aisle-rail",[-.05,.98,-4.3],[-.05,2.91,-4.3],.042,"silver");
    }else{head(e,id+"driver-",[-.61,1.84,4.06],PROFILES[12],1,time,false);(spec.passengers||[]).slice(0,5).forEach(function(p,i){head(e,id+"passenger-"+i+"-",[i%2?.73:-.73,1.85,2.2-Math.floor(i/2)*1.2],PROFILES[p],1,time,false);});}
    var opening=spec.atStop?.66:0;e.part(id+"door-front",[1.31,1.73,3.68+opening],[.032,1.81,.74],"glass",{material:16});e.part(id+"door-rear",[1.31,1.73,-.40-opening],[.032,1.81,.84],"glass",{material:16});
  }
  function truck(e,id,spec,time,speed,detail){
    var paint=spec.paint||[.53,.36,.24];e.part(id+"frame",[0,.52,0],[2.50,.25,8.3],"ink");
    e.part(id+"cab-floor",[0,.72,2.67],[2.43,.14,2.88],"stone");e.part(id+"cab-front",[0,1.18,4.02],[2.43,1.00,.18],paint);e.part(id+"cab-rear",[0,1.18,1.28],[2.43,1.00,.18],paint);e.part(id+"cab-roof",[0,2.94,2.62],[2.44,.13,2.73],paint);
    e.part(id+"windscreen",[0,2.24,4.05],[2.23,1.24,.038],"glass",{material:16});
    [-1,1].forEach(function(side){e.part(id+"cab-side-window-"+side,[side*1.2,2.28,2.6],[.035,1.14,2.35],"glass",{material:16});
      e.part(id+"cab-side-panel-"+side,[side*1.2,1.18,2.67],[.09,1,2.8],paint);
      tyre(e,id+"front-wheel-"+side,side*1.26,.47,2.55,.47,time,speed,detail);tyre(e,id+"back-wheel-a-"+side,side*1.27,.47,-2.57,.47,time,speed,detail);tyre(e,id+"back-wheel-b-"+side,side*1.27,.47,-3.68,.47,time,speed,detail);
      e.light(id+"headlight-"+side,[side*.88,1.21,4.12],"white",62);
    });
    e.part(id+"cargo-box",[0,2.30,-1.38],[2.47,2.98,5.95],spec.emergency==="fire"?"red":spec.cargo||"silver",{material:5,glyph:"H"});
    if(spec.emergency==="fire"){e.beam(id+"ladder-left",[-.65,3.86,-4.1],[-.65,3.86,1.2],.07,"silver");e.beam(id+"ladder-right",[.65,3.86,-4.1],[.65,3.86,1.2],.07,"silver");for(var rung=0;rung<8;rung++)e.beam(id+"ladder-rung-"+rung,[-.65,3.86,-3.7+rung*.63],[.65,3.86,-3.7+rung*.63],.06,"ivory");}
    e.part(id+"cargo-rear-doors",[0,2.27,-4.37],[2.35,2.83,.12],"stone",{material:5,glyph:"|"});
    if(detail){e.part(id+"driver-seat",[-.65,1.19,2.65],[.65,.27,.69],"ink");person(e,id+"driver-",PROFILES[spec.driver==null?6:spec.driver],"drive",time,0,true,[-.62,.65,2.85]);wheel(e,id+"steering-wheel",[-.61,1.74,3.50],.24,"ink");}
    else head(e,id+"driver-",[-.62,1.99,2.88],PROFILES[spec.driver==null?6:spec.driver],1,time,false);
    e.part(id+"rear-markers",[0,.99,-4.40],[2.24,.24,.05],"red",{material:6,emission:spec.braking?1.5:.55});
  }
  function bicycle(e,id,profile,time,speed,detail){
    var spin=time*(speed||1)/.34;
    [-.69,.69].forEach(function(z,i){e.part(id+"wheel-"+i,[0,.35,z],[.68,.06,.68],"ink",{shape:2,parameter:1,roll:Math.PI/2});
      if(detail)for(var j=0;j<6;j++){var a=spin+j*Math.PI/3;e.beam(id+"spoke-"+i+"-"+j,[0,.35,z],[0,.35+Math.cos(a)*.29,z+Math.sin(a)*.29],.015,"silver");}
    });
    e.beam(id+"frame-diagonal",[0,.35,-.69],[0,.79,.10],.043,"red");e.beam(id+"frame-top",[0,.79,.10],[0,.88,-.33],.043,"red");e.beam(id+"frame-bottom",[0,.35,-.69],[0,.44,.05],.043,"red");
    e.beam(id+"front-fork",[0,.79,.10],[0,.35,.69],.042,"silver");e.part(id+"seat",[0,.93,-.31],[.25,.08,.34],"ink");e.part(id+"handlebar",[0,1.13,.46],[.53,.045,.055],"silver");
    person(e,id+"rider-",profile||PROFILES[14],"cycle",time,speed,detail,[0,.32,-.23]);
  }
  function coarseVehicle(e,id,spec){var busType=spec.type==="bus",truckType=spec.type==="truck",w=busType?2.6:truckType?2.5:1.94,h=busType?3.1:truckType?3.0:1.8,l=busType?10.8:truckType?8.6:4.6;
    e.part(id+"distant-body",[0,h*.47,0],[w,h*.77,l],spec.paint||"silver");
    [-1,1].forEach(function(s){e.part(id+"distant-headlight-"+s,[s*w*.34,h*.48,l/2],[.25,.15,.12],"white",{material:6,emission:1.4});e.part(id+"distant-tail-"+s,[s*w*.34,h*.45,-l/2],[.22,.16,.12],"red",{material:6,emission:.75});});
  }
  function drawVehicle(b,id,pose,spec,time,distance){b.site("vehicle-"+id,"车辆 "+id,pose.x,pose.z,"有车灯、司机和真实车内空间的城市交通",function(b){var e=new Emitter(b,pose,"");if(distance>650){coarseVehicle(e,id,spec);return;}
    var detail=distance<85;if(spec.type==="bus")bus(e,id,spec,time,spec.speed,detail);else if(spec.type==="truck")truck(e,id,spec,time,spec.speed,detail);else car(e,id,spec,time,spec.speed,detail);
  });}
  function drawPerson(b,id,pose,profile,mode,time,speed,distance){b.site("person-"+id,"行人 "+id,pose.x,pose.z,"有三维头部、四肢、服装和动作的城市居民",function(b){var e=new Emitter(b,pose,"");if(distance>280){var s=profile.height/1.77;e.ball("distant-torso",[0,1.10*s,0],[.22*s,.39*s,.16*s],profile.top);e.ball("distant-head",[0,1.64*s,0],[.13*s,.15*s,.12*s],profile.skin);e.part("distant-legs",[0,.46*s,0],[.27*s,.76*s,.18*s],profile.bottom);return;}
    if(mode==="cycle")bicycle(e,id,profile,time,speed,distance<50);else person(e,id,profile,mode,time,speed,distance<45);
  });}
  return Object.freeze({Emitter:Emitter,PROFILES:PROFILES,person:person,drawPerson:drawPerson,drawVehicle:drawVehicle});
});
