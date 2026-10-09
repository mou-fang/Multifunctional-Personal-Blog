/* First-party authoring tools. No scattered buildings, downloaded meshes or random layouts. */
(function(root,factory){var api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.CityShuttleGeometry=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  var STRIDE=26;
  var COLORS=Object.freeze({
    stone:[.36,.40,.41],ivory:[.63,.61,.52],silver:[.49,.58,.62],glass:[.16,.35,.43],blue:[.21,.45,.61],
    teal:[.18,.43,.40],gold:[.65,.53,.28],warm:[.89,.65,.34],white:[.82,.87,.83],red:[.62,.22,.17],
    brick:[.39,.23,.18],roof:[.16,.24,.26],ink:[.07,.105,.12],asphalt:[.12,.155,.17],
    green:[.22,.40,.19],leaf:[.19,.37,.23],pink:[.64,.29,.46],violet:[.39,.34,.54],water:[.08,.27,.33]
  });
  function color(value){var result=typeof value==="string"?COLORS[value]:value;if(!result)throw new Error("Unknown city colour: "+value);return result;}
  function Builder(prefix){this.prefix=prefix||"metro";this.objects=[];this.sites=[];this.current=null;this.ids=new Set();}
  Builder.prototype.site=function(id,name,x,z,description,draw,metadata){
    if(this.current)throw new Error("Nested site authoring");
    var site=Object.assign({id:this.prefix+"/"+id,name:name,x:x,z:z,description:description,start:this.objects.length,count:0},metadata||{});
    this.current=site;draw(this);site.count=this.objects.length-site.start;this.sites.push(site);this.current=null;return site;
  };
  Builder.prototype.record=function(label,values){
    if(!this.current)throw new Error("Geometry must belong to a named site");
    var id=this.current.id+"/"+label;if(this.ids.has(id))throw new Error("Duplicate city object: "+id);
    if(values.length!==STRIDE||values.some(function(v){return !Number.isFinite(v);}))throw new Error("Invalid city geometry: "+id);
    this.ids.add(id);this.objects.push({id:id,owner:this.current.id,values:values});
  };
  Builder.prototype.part=function(label,x,y,z,w,h,d,tint,options){
    options=options||{};if(!(w>0&&h>0&&d>0))throw new Error("Nonpositive object: "+label);
    var c=color(tint||"stone"),trim=options.trim?color(options.trim):c.map(function(v){return v*.64;});
    this.record(label,[this.current.x+x,y,this.current.z+z,w/2,h/2,d/2,options.yaw||0,c[0],c[1],c[2],
      options.material||0,(options.glyph||"#").charCodeAt(0),options.emission||0,options.wx||3.2,options.wy||4.1,
      options.mask==null?54891:options.mask,options.shape||0,options.solid===false?0:1,options.detail||0,
      trim[0],trim[1],trim[2],options.phase||0,options.parameter||0,options.pitch||0,options.roll||0]);
  };
  Builder.prototype.glass=function(label,x,y,z,w,h,d,tint,options){this.part(label,x,y,z,w,h,d,tint||"glass",Object.assign({material:1,emission:.18},options));};
  Builder.prototype.cylinder=function(label,x,y,z,rx,height,rz,tint,options){this.part(label,x,y,z,rx*2,height,rz*2,tint,Object.assign({shape:2,parameter:1},options));};
  Builder.prototype.ball=function(label,x,y,z,rx,ry,rz,tint,options){this.part(label,x,y,z,rx*2,ry*2,rz*2,tint,Object.assign({shape:1},options));};
  Builder.prototype.beam=function(label,a,b,width,tint,options){
    var delta=b.map(function(v,i){return v-a[i];}),length=Math.hypot.apply(Math,delta);
    if(length<.001)throw new Error("Zero beam: "+label);
    var centre=a.map(function(v,i){return (v+b[i])/2;});
    this.cylinder(label,centre[0],centre[1],centre[2],width/2,length,width/2,tint,Object.assign({yaw:Math.atan2(delta[0],delta[2]),pitch:Math.acos(delta[1]/length)},options));
  };
  Builder.prototype.triangle=function(label,vertices,tint,options){
    options=options||{};var c=color(tint),trim=options.trim?color(options.trim):c.map(function(v){return v*.66;});
    var v=vertices.map(function(p){return [p[0]+this.current.x,p[1],p[2]+this.current.z];},this);
    var a=v[1].map(function(n,i){return n-v[0][i];}),b=v[2].map(function(n,i){return n-v[0][i];});
    if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<.001)throw new Error("Degenerate face: "+label);
    this.record(label,[...v[0],...v[1],...v[2],...c,options.material||0,(options.glyph||"#").charCodeAt(0),options.emission||0,
      options.wx||3.2,3,options.solid===false?0:1,options.wy||4.1,options.phase||0,...trim,0,options.mask==null?54891:options.mask,options.detail||0]);
  };
  Builder.prototype.loft=function(label,levels,tint,options){
    options=options||{};var count=levels[0].points.length;
    for(var l=0;l<levels.length-1;l++){
      if(levels[l].points.length!==count||levels[l+1].points.length!==count)throw new Error("Loft vertex count mismatch");
      for(var i=0;i<count;i++){
        var j=(i+1)%count,a=[levels[l].points[i][0],levels[l].y,levels[l].points[i][1]],b=[levels[l].points[j][0],levels[l].y,levels[l].points[j][1]],
          c=[levels[l+1].points[j][0],levels[l+1].y,levels[l+1].points[j][1]],d=[levels[l+1].points[i][0],levels[l+1].y,levels[l+1].points[i][1]];
        this.triangle(label+"-"+l+"-"+i+"a",[a,b,c],tint,options);this.triangle(label+"-"+l+"-"+i+"b",[a,c,d],tint,options);
      }
    }
    if(options.caps!==false){[0,levels.length-1].forEach(function(index){var level=levels[index],centre=[0,level.y,0];
      level.points.forEach(function(p){centre[0]+=p[0]/count;centre[2]+=p[1]/count;});
      for(var i=0;i<count;i++){var j=(i+1)%count;this.triangle(label+"-cap-"+index+"-"+i,[centre,[level.points[i][0],level.y,level.points[i][1]],[level.points[j][0],level.y,level.points[j][1]]],tint,Object.assign({},options,{material:0}));}
    },this);}
  };
  Builder.prototype.ring=function(label,points,width,tint,options){for(var i=0;i<points.length;i++)this.beam(label+"-"+i,points[i],points[(i+1)%points.length],width,tint,options);};
  Builder.prototype.text=function(label,word,x,y,z,tint,size){size=size||2;for(var i=0;i<word.length;i++)if(word[i]!==" ")this.part(label+"-"+i,x+(i-(word.length-1)/2)*size,y,z,size*.85,size*1.6,.22,tint,{material:8,glyph:word[i],emission:.2,solid:false});};
  Builder.prototype.light=function(label,x,y,z,tint,radius,options){this.part(label,x,y,z,.5,.5,.5,tint||"warm",Object.assign({material:6,emission:2.2,parameter:radius||32,solid:false,glyph:"*"},options));};
  Builder.prototype.tree=function(label,x,z,stem,crowns,tint,base){
    base=base||0;stem.forEach(function(s,i){this.beam(label+"-branch-"+i,[x+s[0],base+s[1],z+s[2]],[x+s[3],base+s[4],z+s[5]],s[6],"brick");},this);
    crowns.forEach(function(c,i){this.ball(label+"-leaves-"+i,x+c[0],base+c[1],z+c[2],c[3],c[4],c[5],c[6]||tint||"leaf",{material:4,phase:c[1]+c[0],solid:false});},this);
  };
  Builder.prototype.finish=function(){var packed=new Float32Array(this.objects.length*STRIDE);this.objects.forEach(function(o,i){packed.set(o.values,i*STRIDE);});return {objects:this.objects,sites:this.sites,packed:packed,stride:STRIDE};};
  function polygon(rx,rz,count,yaw,shape){var points=[];for(var i=0;i<count;i++){var angle=i*Math.PI*2/count,f=shape?shape(angle):1;var x=Math.cos(angle)*rx*f,z=Math.sin(angle)*rz*f;points.push([x*Math.cos(yaw||0)+z*Math.sin(yaw||0),-x*Math.sin(yaw||0)+z*Math.cos(yaw||0)]);}return points;}
  function roundedRectangle(rx,rz,corner,yaw){var points=[];[[rx-corner,rz-corner,0],[-rx+corner,rz-corner,Math.PI/2],[-rx+corner,-rz+corner,Math.PI],[rx-corner,-rz+corner,Math.PI*1.5]].forEach(function(c){for(var i=0;i<4;i++){var a=c[2]+i*Math.PI/6,x=c[0]+Math.cos(a)*corner,z=c[1]+Math.sin(a)*corner;points.push([x*Math.cos(yaw||0)+z*Math.sin(yaw||0),-x*Math.sin(yaw||0)+z*Math.cos(yaw||0)]);}});return points;}
  return Object.freeze({Builder:Builder,COLORS:COLORS,polygon:polygon,roundedRectangle:roundedRectangle,STRIDE:STRIDE});
});
