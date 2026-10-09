/* Original, fixed city composition. Every site has an explicit authored design.
 * Helpers describe geometry; they never select, scatter, or clone building variants.
 */
(function (root, factory) {
  var city=typeof module==="object"&&module.exports?require("./city-shuttle-city.js"):root.CityShuttleCity;
  var scene = factory(city);
  if (typeof module === "object" && module.exports) module.exports = scene;
  if (root) root.CityShuttleScene = scene;
})(typeof window !== "undefined" ? window : globalThis, function (City) {
  "use strict";
  var STRIDE = 26;
  var PALETTE = {
    ink: [0.075, 0.12, 0.14], concrete: [0.27, 0.32, 0.34], steel: [0.18, 0.29, 0.34],
    blue: [0.21, 0.45, 0.61], cyan: [0.24, 0.49, 0.48], teal: [0.18, 0.43, 0.40],
    green: [0.22, 0.40, 0.19], leaf: [0.19, 0.37, 0.23], amber: [0.65, 0.53, 0.28],
    gold: [0.65, 0.53, 0.28], coral: [0.59, 0.28, 0.22], violet: [0.39, 0.34, 0.54],
    rose: [0.64, 0.29, 0.46], white: [0.67, 0.72, 0.68], water: [0.08, 0.27, 0.33]
  };
  var SPAWNS = Object.freeze([
    { id: "avenue", name: "雨巷大道", x: 0, y: 10, z: 335, yaw: 0, pitch: 0.025 },
    { id: "skyline", name: "冠塔上空", x: 160, y: 205, z: 240, yaw: -0.24, pitch: -0.32 },
    { id: "canal", name: "镜河桥畔", x: 300, y: 10, z: 185, yaw: -0.44, pitch: 0.06 },
    { id: "underbridge", name: "弦桥下方", x: 365, y: 3, z: 225, yaw: 0, pitch: 0.02 },
    { id: "garden", name: "月台花园", x: -352, y: 13, z: 220, yaw: 0.1, pitch: 0.03 },
    { id: "arcade", name: "通光廊内部", x: -99, y: 7, z: -220, yaw: 0, pitch: 0 },
    { id: "oculus", name: "光环楼中庭", x: 180, y: 95, z: -882, yaw: Math.PI, pitch: 0 },
    { id: "loop", name: "折环总部", x: -160, y: 74, z: -7, yaw: 0, pitch: 0.03 },
    { id: "court", name: "抬起的庭院", x: -377, y: 68, z: 207, yaw: 0, pitch: 0 },
    { id: "window", name: "通风大窗", x: 145, y: 35, z: 341, yaw: 0, pitch: 0 },
    { id: "bridge", name: "云桥内部", x: -527, y: 70, z: -385, yaw: Math.PI/2, pitch: 0.07 },
    { id: "shaft", name: "垂直光井", x: 222, y: 28, z: 26, yaw: 0, pitch: 0 }
  ]);
  var PASSAGES=Object.freeze([
    {id:"oculus",site:"oculus-ring",points:[[180,95,-882],[180,95,-695]]},
    {id:"loop",site:"folded-loop",points:[[-160,74,-7],[-160,74,-128],[-160,121,-128]]},
    {id:"court",site:"raised-court",points:[[-377,68,207],[-377,68,114],[-377,122,114]]},
    {id:"window",site:"wind-window",points:[[145,35,341],[145,35,220]]},
    {id:"bridge",site:"cloud-hybrid",points:[[-527,70,-385],[-386,79.87,-385]]},
    {id:"shaft",site:"vertical-lightwell",points:[[222,28,26],[222,28,-38],[222,64,-38],[176,64,-38]]},
    {id:"gold-window",site:"gold-lattice",points:[[60,100,-405],[60,100,-515]]},
    {id:"underbridge",site:"canal-bridge",points:[[365,3,225],[365,4.6,145]]}
  ]);
  if(!City)throw new Error("City definition was not loaded");
  SPAWNS=Object.freeze(City.SPAWNS.concat(SPAWNS));
  function build() {
    var objects = [], sites = [], current = null;
    function site(id, name, description, x, z, draw) {
      current = { id: id, name: name, description: description, x: x, z: z, start: objects.length, count: 0 };
      draw(); current.count = objects.length - current.start; sites.push(current); current = null;
    }
    function part(label, x, y, z, w, h, d, color, options) {
      options = options || {};
      var p = typeof color === "string" ? PALETTE[color] : color;
      var trim = options.trim ? (typeof options.trim === "string" ? PALETTE[options.trim] : options.trim) : p.map(function (v) { return v * 0.66; });
      objects.push({ id: current.id + "/" + label, owner: current.id, values: [
        current.x + x, y, current.z + z, w / 2, h / 2, d / 2, options.yaw || 0,
        p[0], p[1], p[2], options.material || 0, (options.glyph || "#").charCodeAt(0), options.emission || 0,
        options.wx || 3.4, options.wy || 4.2, options.mask == null ? 46291 : options.mask,
        options.shape || 0, options.solid === false ? 0 : 1, options.detail || 0,
        trim[0], trim[1], trim[2], options.phase || 0, 0, options.pitch || 0, options.roll || 0
      ] });
    }
    function glass(label, x, y, z, w, h, d, color, wx, wy, mask, options) {
      part(label,x,y,z,w,h,d,color,Object.assign({material:1,wx:wx,wy:wy,mask:mask,emission:0.13},options));
    }
    function light(label,x,y,z,w,h,d,color,glyph) {part(label,x,y,z,w,h,d,color,{material:6,glyph:glyph||"=",emission:0.2,solid:false});}
    function rail(label,x,y,z,w,d,color) {part(label,x,y,z,w,0.35,d,color||"steel",{material:5,glyph:"-"});}
    function text(label,word,x,y,z,color,size) {
      size=size||1.25;
      for (var i=0;i<word.length;i+=1) if(word[i]!==" ") part(label+"-"+i,x+(i-(word.length-1)/2)*size,y,z,size*.83,size*1.5,.3,color,{material:8,glyph:word[i],emission:.13,solid:false});
    }
    function tree(label,x,z,stems,crowns,color,base) {
      // Each stem and crown is placed by its caller; there is no shared tree silhouette.
      base=base||0;
      stems.forEach(function(s,i){part(label+"-stem-"+i,x+s[0],base+s[1],z+s[2],s[3],s[4],s[5],[.29,.22,.13],{material:5,glyph:"|"});});
      crowns.forEach(function(c,i){part(label+"-crown-"+i,x+c[0],base+c[1],z+c[2],c[3],c[4],c[5],c[6]||color,{shape:1,material:4,solid:false,phase:c[1]+c[0]});});
    }
    // Infrastructure is drawn from measured, named segments rather than a tile grid.
    site("ground", "城市基底", "海湾中的深色地台、镜河水面与三片有边界的绿地，飞出街区后仍有连续的水面", 0,0,function(){
      part("outer-bay",0,-1,-100,3000,.2,3000,[.045,.16,.19],{material:3,solid:false});
      part("west-land",-290,-1.1,-170,1140,2,1500,"ink",{material:2,wx:11,wy:13});
      part("east-quay",635,-1.1,-235,430,2,1270,"ink",{material:2,wx:8,wy:11});
      part("mirror-river",365,-.8,-260,150,.3,1640,"water",{material:3,solid:false});
      part("garden-earth",-373,.05,134,191,.2,266,"leaf",{material:7});
      part("north-courtyard",-328,.08,-539,126,.2,102,[.17,.35,.18],{material:7});
      part("quay-green",568,.04,207,154,.2,127,[.18,.31,.15],{material:7});
    });
    site("streets", "街道骨架", "雨巷大道、三道横街、旧城区窄巷、滨水慢行路",0,0,function(){
      part("rain-avenue",0,.04,-230,29,.38,1280,[.13,.17,.20],{material:11});
      part("south-cross",-74,.05,183,510,.38,26,[.12,.16,.17],{material:11});
      part("market-cross",-105,.05,-73,651,.38,24,[.13,.17,.20],{material:11});
      part("station-cross",-44,.05,-359,557,.38,32,[.14,.17,.19],{material:11});
      part("west-lane-north",-215,.04,-367.75,18,.38,455.5,[.11,.14,.16],{material:11});
      part("west-lane-south",-215,.04,163.75,18,.38,351.5,[.11,.14,.16],{material:11});
      part("quay-walk",273,.05,-217,25,.15,1260,[.25,.31,.30],{material:2,wx:2.5,wy:4});
      rail("avenue-west-curb",-15.4,.2,-240,.8,1260,"white");rail("avenue-east-curb",15.4,.2,-240,.8,1260,"steel");
      rail("west-bank-wall",290,1.2,-210,1.8,1250,"concrete");rail("east-bank-wall",440,1.3,-240,2,1310,"steel");
      // Crosswalks have three independently placed groups and different crossing widths.
      [["south",183,12,6],["market",-73,11,5],["station",-359,14,7]].forEach(function(c){for(var i=0;i<c[3];i++)part(c[0]+"-crosswalk-"+i,-c[2]+i*4,.15,c[1],1.6,.12,10,"white",{solid:false});});
      [["south-line",251,52],["mid-line",59,86],["north-line",-212,104],["terminal-line",-541,171]].forEach(function(c){rail(c[0],0,.14,c[1],.35,c[2],"amber");});
      part("lantern-sidewalk",-29,.18,267,23,.3,91,"concrete",{material:2,wx:2.3,wy:3.8});
      part("hotel-sidewalk",30,.18,267,22,.3,94,"steel",{material:2,wx:3.0,wy:2.8});
      part("origami-pavement",-28,.19,117,23,.3,133,"concrete",{material:2,wx:2.4,wy:3.2});
      part("exchange-pavement",32,.2,98,27,.3,148,"white",{material:2,wx:3.0,wy:3.8});
      part("crown-pavement",-28,.2,-151,24,.3,88,"steel",{material:2,wx:3.4,wy:4.2});
      part("tide-pavement",31,.2,-154,27,.3,88,"concrete",{material:2,wx:2.2,wy:4});
    });
    site("lantern-house","灯笼公寓","赤铜基座、偏置青色窄窗塔、独立灯笼冠与入口雨棚",-51,265,function(){
      glass("copper-base",0,14,0,51,28,62,"coral",3.7,4.7,39723,{trim:"ink",detail:2});
      glass("slender-shaft",-7,59,-9,29,90,37,"teal",2.8,4.1,56251,{trim:"cyan"});
      part("east-stair",20,27,-19,9,54,19,"steel",{material:5,glyph:"|"});
      part("crown-plinth",-7,106,-9,34,4,41,"ink");light("lantern-crown",-7,113,-9,21,12,23,"amber","H");
      part("crown-hat",-7,122,-9,28,3,30,"coral");part("entry-canopy",8,5,34,25,1.2,9,"cyan");
      text("entry-sign","LANTERN",2,7,31.5,"amber",1.4);
      part("roof-tank",14,32,-13,9,7,10,"steel",{shape:1});
    });
    site("blue-note","蓝调旅馆","夜蓝横窗、三重露台与面向大道的竖向 BLUE 招牌",54,269,function(){
      glass("lower-hotel",0,27,0,53,54,57,"blue",6.8,3.8,60877,{trim:"steel",detail:2});
      glass("penthouse",8,66,-7,31,25,37,"violet",5.2,5.1,47075,{trim:"blue"});
      part("south-terrace",-6,56,22,43,1.2,13,"white");rail("terrace-lip",-6,58,28,43,.4,"blue");
      part("upper-terrace",8,80,-7,36,2,42,"steel");
      light("west-spine",-27,31,3,1.2,48,1,"blue","|");
      ["B","L","U","E"].forEach(function(c,i){text("blade-"+i,c,-29,50-i*5,18,"cyan",2.5);});
      part("door-recess",-23,4,13,1,8,12,"ink");light("door-outline",-24,8.5,13,.6,.5,13,"cyan");
      part("roof-machine",5,84,-8,8,5,10,"concrete",{material:5,glyph:"%"});
    });
    site("jade-post","翠邮局","带拱廊的矮楼，塔楼立于右后角，琥珀时钟与绿色檐口",-111,223,function(){
      glass("mail-hall",0,10,0,44,20,39,"gold",5.6,6.4,52429,{trim:"teal"});
      glass("corner-tower",13,29,-9,16,44,18,"green",2.7,4.8,46515,{trim:"steel"});
      part("deep-roof",0,21,1,49,2,44,"teal");part("clock-face",13,48,1,9,9,.8,"ink");text("clock","+",13,48,1.5,"amber",4);
      part("tower-cap",13,53,-9,19,3,21,"teal");
      [[-16,1.2],[-5,1.1],[7,1.3],[19,1]].forEach(function(c,i){part("arcade-pier-"+i,c[0],4,23,c[1],8,2,"steel");});
      part("arcade-canopy",1,8.5,23,42,1,10,"teal");text("post-sign","POST",-4,10,25,"amber",1.5);
      part("post-box",-14,1.5,29,1.2,3,1.2,"coral",{glyph:"P"});
    });
    site("coral-stack","珊瑚叠楼","左侧退台与外置设备笼，立面灯带不规则断开",57,173,function(){
      glass("lower-stack",0,38,0,54,76,55,"coral",4.6,4.3,55979,{trim:"ink"});
      glass("middle-stack",6,87,-4,42,22,41,[.63,.36,.20],3.4,4.2,45779,{trim:"coral"});
      glass("top-stack",12,111,-8,29,26,27,"amber",3.9,4.8,58689,{trim:"ink"});
      part("service-cage",-26,41,-7,5,70,23,"steel",{material:5,glyph:"%"});
      light("floor-band-a",0,20,28,49,.8,.6,"coral");light("floor-band-b",5,65,28,35,.6,.6,"amber");
      part("roof-shed",8,128,-6,11,6,8,"steel");part("chimney",19,135,-13,2,15,2,"white");
      text("ground-sign","LOOM",-5,7,29,"rose",2);
    });
    site("origami","折纸事务所","四个错位薄板组成轮廓，青紫交错立面与悬挑入口",-57,146,function(){
      glass("front-blade",-12,65,8,18,130,48,"cyan",3.0,4.4,45989,{trim:"steel"});
      glass("back-blade",9,77,-12,21,154,33,"violet",3.2,5.0,54833,{trim:"blue"});
      glass("cross-blade",5,48,14,38,96,17,"blue",6.2,4.6,38179,{trim:"cyan"});
      part("sky-link",-1,116,0,25,5,16,"white");part("entry-wing",0,9,40,58,1.2,17,"violet",{yaw:-.12});
      light("blade-edge",-21,71,32,.5,116,.5,"cyan","|");
      text("studio-sign","ORI / 07",0,11,46,"cyan",1.55);
      part("roof-aerial",9,161,-12,1.1,16,1.1,"steel");
    });
    site("amber-archive","琥珀档案馆","阶梯式实体裙房、六根宽间距竖肋和中央透光书架",-133,104,function(){
      part("foundation",0,6,0,51,12,63,"concrete");glass("reading-block",4,39,-5,41,58,47,"amber",7.9,5.6,61111,{trim:"ink",detail:2});
      part("low-wing",-17,17,10,18,24,38,"coral");part("roof-book",4,70,-5,47,3,51,"ink");
      [-16,-8,0,8,16,24].forEach(function(x,i){part("buttress-"+i,x,41,20,1.2,60,2,"gold");});
      part("front-stair",0,1,37,20,2,9,"white");part("front-stair-upper",0,2.5,32,17,1,5,"concrete");
      text("archive-sign","ARCHIVE",0,10,32.2,"amber",1.3);
      part("roof-vent",-8,75,-19,8,7,5,"steel",{material:5,glyph:"#"});
    });
    site("ribbon-exchange","丝带交易所","两座不同高度的宽窄塔，由三层横向廊桥连接",60,58,function(){
      glass("wide-tower",8,84,-10,39,168,47,"gold",4.8,4.2,55221,{trim:"green"});
      glass("thin-tower",-23,62,10,16,124,29,"teal",3.1,4.3,39377,{trim:"cyan"});
      glass("bridge-lower",-6,36,4,28,8,15,"amber",3.8,4.2,65535,{trim:"gold"});
      glass("bridge-middle",-6,75,4,28,7,15,"cyan",4.0,3.5,65535,{trim:"steel"});
      glass("bridge-top",-6,113,4,28,6,15,"gold",4.3,3.0,65535,{trim:"green"});
      part("roof-screen",8,173,-10,43,6,51,"green",{material:5,glyph:"|"});
      light("crown-line",8,178,-10,34,.7,41,"gold");text("exchange-sign","RX",10,18,15,"gold",4);
    });
    site("violet-spire","紫电通信塔","三段收束塔身、错位环形机房与四枚独立天线",-56,29,function(){
      glass("broad-shaft",0,58,0,42,116,44,"violet",3.6,4.6,47019,{trim:"blue"});
      glass("narrow-shaft",4,144,-4,26,56,28,"blue",2.9,5.2,58793,{trim:"violet"});
      part("equipment-ring",4,172,-4,37,8,39,"ink");light("ring-edge",4,177,15,37,.7,.6,"rose");
      part("mast",4,199,-4,2,43,2,"steel");light("beacon",4,221,-4,1.5,2,1.5,"coral","*");
      [[-9,183,5,12],[15,190,-7,21],[8,181,9,9],[-3,193,-15,27]].forEach(function(a,i){part("antenna-"+i,a[0],a[1],a[2],.6,a[3],.6,"white");});
      text("radio-sign","WAVE",0,8,24,"rose",1.7);
    });
    site("market-fan","扇市商场","三片不对称扇形翼，低矮前庭、细柱门廊和灯牌",128,5,function(){
      glass("front-wing",0,17,12,69,34,26,"rose",5.3,4.0,60521,{trim:"coral"});
      glass("north-wing",7,29,-14,52,58,25,"coral",4.1,4.9,52437,{trim:"violet"});
      glass("east-wing",34,22,0,22,44,52,"violet",3.0,3.8,43927,{trim:"rose"});
      part("entrance-roof",-14,7,37,43,1.3,18,"amber");
      [[-32,1],[-19,.8],[-5,1.4],[9,1]].forEach(function(a,i){part("column-"+i,a[0],3.5,44,a[1],7,a[1],"rose");});
      text("market-sign","FAN MARKET",-1,9,46,"rose",1.5);
      part("water-tower",22,66,-20,12,13,12,"steel",{shape:1});part("water-base",22,58,-20,15,3,15,"ink");
    });
    site("red-gate","朱门旅社","红色旧砖墙配偏心石门楼、青绿玻璃添建和屋顶花槽",-129,-34,function(){
      glass("old-hostel",0,24,0,51,48,41,"coral",4.1,4.0,45675,{trim:"ink",detail:2});
      part("gate-left",-14,5,26,8,10,9,"amber");part("gate-right",10,5,26,8,10,9,"amber");part("gate-top",-2,12,26,32,4,10,"coral");
      glass("new-glass",14,58,-9,25,22,23,"teal",3.8,5.2,62891,{trim:"cyan"});
      part("roof-bed",-10,50,6,24,2,12,"concrete");part("roof-plant",-9,53,5,21,4,10,"leaf",{material:4,shape:1,solid:false});
      text("hostel-sign","RED GATE",-2,14,31.5,"amber",1.2);
    });
    site("crown-observatory","冠塔观测站","两级宽基座、三段削窄塔身、开放观景层与针状顶冠",-49,-154,function(){
      glass("plinth",0,18,0,65,36,69,"steel",6.2,4.4,54971,{trim:"cyan"});
      glass("tower-lower",0,81,-3,44,128,45,"cyan",3.5,4.5,60331,{trim:"blue"});
      glass("tower-middle",5,177,-6,29,66,30,"teal",2.7,4.4,44509,{trim:"cyan"});
      part("observation-floor",5,211,-6,44,2.2,44,"white");part("observation-roof",5,224,-6,41,2,41,"blue");
      [[-15,-25],[25,-25],[-15,13],[25,13]].forEach(function(p,i){part("lookout-column-"+i,p[0],218,p[1],1.5,12,1.5,"steel");});
      rail("lookout-front",5,213.5,15,44,.5,"cyan");rail("lookout-back",5,213.5,-27,44,.5,"cyan");
      glass("crown-core",5,240,-6,17,31,18,"gold",2.7,4.0,63159,{trim:"cyan"});
      part("spire",5,274,-6,2,39,2,"steel");light("tip",5,294,-6,1.4,2,1.4,"cyan","+");
      text("observatory-sign","CROWN",0,12,36,"cyan",2.2);
    });
    site("tide-fin","潮汐金融塔","四根高低不同的蓝色鳍片，窄缝天井与横跨屋顶的红铜横梁",68,-160,function(){
      glass("fin-west",-21,90,0,12,180,42,"blue",2.5,4.6,46757,{trim:"cyan"});
      glass("fin-middle",-3,103,-6,16,206,47,"cyan",3.3,4.1,56843,{trim:"steel"});
      glass("fin-east",19,82,4,17,164,37,"teal",3.5,4.9,52453,{trim:"blue"});
      glass("fin-back",5,70,-35,44,140,14,"blue",5.6,4.7,37691,{trim:"violet"});
      part("crown-beam",-2,186,1,66,5,10,"coral");light("crown-mark",-2,189,7,45,.7,.8,"coral");
      part("ground-vestibule",-3,5,25,30,10,19,"ink");text("vestibule-sign","TIDE",-3,9,35,"cyan",2.5);
    });
    site("light-arcade","通光廊","可真正穿越的六层中庭：四边墙、独立楼板、开放大道门洞、两层玻璃连廊",-99,-234,function(){
      glass("west-wall",-24,22,0,1.6,44,81,"gold",3.0,4.4,48083,{trim:"steel",material:10});
      glass("east-wall",24,28,-4,1.6,56,73,"teal",3.2,5.0,59717,{trim:"cyan",material:10});
      glass("north-wall",0,22,-38,44,44,1.5,"cyan",4.4,4.1,53553,{trim:"blue",material:10});
      part("front-left",-17,16,39,12,32,5,"coral");part("front-right",17,16,39,12,32,5,"coral");
      part("entry-lintel",0,19,39,25,3,5,"amber");
      part("atrium-floor",0,0.35,0,44,.5,76,"white",{material:2,wx:3,wy:3});
      [12,23,34].forEach(function(y,i){part("west-gallery-"+i,-15,y,-3,15,1,72,"steel");part("east-gallery-"+i,15,y,-3,15,1,72,"white");rail("west-gallery-rail-"+i,-8,y+1.3,-3,.4,71,"amber");rail("east-gallery-rail-"+i,8,y+1.3,-3,.4,71,"cyan");});
      glass("upper-link",0,26,17,30,5,8,"cyan",4.0,5.0,65535,{trim:"blue"});glass("rear-link",0,37,-20,30,5,7,"gold",3.8,5.0,65535,{trim:"teal"});
      part("roof-west",-16,45,-2,16,2,75,"teal");part("roof-east",17,57,-5,16,2,75,"blue");
      text("entry-sign","LUX / ARCADE",0,23,42,"gold",1.1);
      part("interior-bench",-14,1,-20,8,2,2,"coral");part("interior-counter",15,1.8,10,9,3.6,4,"amber");
      light("atrium-pendant",0,17,0,2,1,2,"amber","*");
      part("tea-counter-top",15,3.8,10,10,.5,4.8,"white");part("tea-shelf",21,6,5,1,8,17,"teal",{material:5,glyph:"="});
      part("tea-bench",16,1.3,20,10,2.1,1.5,"coral");part("tea-bench-back",16,2.7,20.4,10,1.7,.4,"amber");
      part("tea-table-stem",14,1.2,23,.7,2.4,.7,"steel");part("tea-table-top",14,2.5,23,4.6,.3,3.5,"teal");
      part("tea-cup-a",13,2.9,23,.45,.55,.45,"white",{shape:1});part("tea-cup-b",15,3,23.6,.4,.7,.4,"amber",{shape:1});
      light("tea-suspended-panel",16,9,11,8,.8,1,"amber");text("tea-title","MOSS TEA",15,7,13,"amber",.85);
      part("atelier-desk",-16,1.6,4,6,3.2,7,"blue");part("atelier-monitor",-16,4,3,3,1.8,.6,"cyan",{material:6,glyph:"+",solid:false});
      part("atelier-shelf",-21,4,-3,1.8,8,17,"violet",{material:5,glyph:"#"});
      part("atelier-seat",-15,1.5,10,2.5,.7,2.6,"coral");part("atelier-seat-back",-15,2.7,11,2.5,2,.4,"steel");
      part("atelier-exhibit-base",-15,.7,-9,3,1.4,3,"white");part("atelier-exhibit",-15,3,-9,2.5,4,2.5,"rose",{yaw:.5});
      text("atelier-title","FORM",-16,8,-2,"rose",1.1);
      part("rear-reading-table",0,2,-29,11,3.8,5,"steel");part("rear-table-top",0,4,-29,12,.4,5.6,"white");
      part("rear-chair-coral",-4,1.8,-24,2.6,.5,2.7,"coral");part("rear-chair-coral-back",-4,3,-22.8,2.6,2.1,.5,"coral");
      part("rear-chair-teal",3,1.6,-24,2.3,.5,2.3,"teal");part("rear-chair-teal-back",3,2.8,-22.9,2.3,2,.5,"teal");
      part("gallery-frame",-17,17,-7,5,6,.7,"amber");part("gallery-art",-17,17,-6.5,4.3,5,.2,"violet",{material:6,glyph:"/",solid:false});
      part("gallery-planter",14,13,-15,7,1.8,5,"concrete");part("gallery-leaves",14,15,-15,8,3,6,"green",{material:4,shape:1,solid:false});
      part("hanging-column",-1,26,-4,.35,17,.35,"steel");light("hanging-moon",-1,17,-4,3,3,.8,"gold","+");
    });
    site("weaver-house","织影楼","横向密窗、两座外置电梯、拱廊底层和一侧悬空露台",-173,-171,function(){
      glass("woven-block",0,51,0,37,102,65,"violet",5.6,3.0,56765,{trim:"steel",detail:2});
      glass("lift-a",-22,47,-17,6,94,9,"cyan",2.2,6.4,65535,{trim:"blue"});
      glass("lift-b",-22,36,15,6,72,8,"rose",2.0,6.0,64957,{trim:"violet"});
      part("hanging-deck",12,67,29,24,2,23,"steel");rail("deck-edge",12,69,40,24,.4,"rose");
      part("entrance-slab",0,5,39,42,1,16,"violet");text("woven-sign","WEFT",0,7,45,"rose",1.6);
      part("roof-power",6,108,-15,13,10,11,"steel",{material:5,glyph:"%"});
    });
    site("sunken-cinema","沉光影院","锯齿阶梯影厅、独立楔形招牌、暖色入口和投影室",132,-264,function(){
      part("auditorium-low",0,10,0,64,20,52,"violet");part("auditorium-step",2,19,-8,54,18,34,"rose");part("auditorium-high",5,28,-19,40,17,15,"coral");
      glass("foyer",-4,7,29,52,14,15,"amber",7.2,7.0,65535,{trim:"coral"});
      part("marquee",-7,15,39,61,2,13,"coral");light("marquee-edge",-7,16,46,60,.7,.5,"rose");text("cinema-sign","LUMEN / CINEMA",-7,19,42,"amber",1.5);
      part("projection-room",18,39,-20,17,8,11,"steel");part("vertical-sign",-32,25,19,3,31,3,"ink");
      ["F","I","L","M"].forEach(function(c,i){text("vertical-"+i,c,-34,35-i*5,21,"rose",2);});
    });
    site("terminal-zero","零号车站","三条不同跨距的长屋顶、独立玻璃候车室、桥下通路与高架轨道",-75,-370,function(){
      part("platform",0,6,0,241,3,34,"concrete");glass("waiting-room",-42,14,0,43,13,27,"cyan",4.6,6.5,65535,{trim:"steel"});
      part("west-roof",-68,24,0,92,2,40,"blue");part("middle-roof",5,28,0,57,2,39,"cyan");part("east-roof",68,21,0,65,2,35,"teal");
      [[-102,23],[-63,23],[-28,23],[-15,27],[24,27],[47,20],[90,20]].forEach(function(a,i){part("platform-column-"+i,a[0],12,10,1.3,a[1],1.3,"steel");});
      rail("rail-north",0,8,-6,245,.5,"white");rail("rail-south",0,8,6,245,.5,"white");
      part("line-west",-274,8,-1,290,2,17,"steel");part("line-east",244,8,-1,290,2,17,"steel");
      [[-300,0],[-225,0],[-155,0],[151,0],[245,0],[329,0]].forEach(function(a,i){part("viaduct-pier-"+i,a[0],3.8,a[1],4,7.6,9,"concrete");});
      text("station-name","TERMINAL / 00",-48,20,15,"cyan",1.4);
      part("train-nose",62,12,-3,16,6,8,"white",{shape:1});glass("train-car",38,12,-3,33,6,8,"teal",4.5,4,65535,{trim:"steel"});
      part("station-stair",-88,2,25,19,4,17,"steel");
    });
    site("north-signal","北讯总部","偏置阶梯冠、独立设备舱、纵向竖缝和红色航空标志",-54,-462,function(){
      glass("lower-tower",0,68,0,55,136,50,"blue",4.9,4.7,46317,{trim:"steel"});
      glass("top-tower",-8,158,-3,33,45,35,"cyan",3.0,4.5,58165,{trim:"teal"});
      part("roof-cap",-8,184,-3,39,5,41,"white");part("offset-cabin",18,148,-14,12,18,18,"steel",{material:5,glyph:"%"});
      light("signal-edge",-26,77,26,.7,123,.6,"blue","|");part("antenna",-8,201,-3,1,32,1,"steel");light("nav-light",-8,218,-3,1.5,2,1.5,"coral","+");
      text("signal-logo","N / SIGNAL",0,11,27,"cyan",1.8);
    });
    site("gold-lattice","金格塔","金色格窗与巨大中层开口，两片塔体在顶部重新连合",59,-462,function(){
      glass("west-pier",-16,93,0,19,186,43,"gold",3.2,4.1,56743,{trim:"green"});glass("east-pier",17,83,-4,24,166,39,"amber",3.7,4.7,53213,{trim:"gold"});
      glass("bottom-link",0,34,0,26,53,42,"gold",4.0,4.0,44781,{trim:"steel"});glass("top-link",0,151,0,36,19,41,"gold",4.3,4.7,65117,{trim:"amber"});
      part("sky-deck",0,143,2,28,2,45,"white");rail("sky-deck-rail",0,145,25,29,.4,"amber");
      part("crown-west",-16,190,0,22,7,46,"teal");text("gold-logo","AU",2,14,23,"gold",4.5);
    });
    site("horizon-step","地平线大厦","五道逐级退台、独立蓝色顶层花园与狭长屋顶设备线",-125,-577,function(){
      glass("base",0,37,0,66,74,66,"teal",5.0,4.3,54571,{trim:"green"});
      glass("terrace-two",3,91,-4,52,36,52,"cyan",4.5,4.2,47657,{trim:"teal"});
      glass("terrace-three",6,124,-7,40,31,40,"blue",3.8,4.4,60475,{trim:"cyan"});
      glass("terrace-four",8,152,-9,28,26,28,"teal",3.2,4.5,53435,{trim:"blue"});
      glass("penthouse",8,174,-9,17,18,17,"cyan",3.0,4.8,62859,{trim:"steel"});
      part("garden-bed",-17,75,19,22,1.4,13,"steel");part("garden-shrub",-18,78,19,20,5,11,"leaf",{shape:1,material:4,solid:false});
      part("roof-duct",8,186,-9,3,5,15,"concrete",{material:5,glyph:"%"});
    });
    site("rose-meridian","玫瑰子午塔","窄窗双层外壳、三道断开的粉色灯带与悬挑水平顶冠",77,-585,function(){
      glass("core",0,104,0,39,208,43,"rose",2.7,4.8,47861,{trim:"violet"});
      glass("rear-shaft",14,88,-23,20,176,25,"violet",3.3,4.4,59685,{trim:"blue"});
      part("cap-wing",-3,211,0,59,5,33,"coral");
      light("neon-a",-15,54,23,8,.6,.6,"rose");light("neon-b",2,98,23,25,.6,.6,"rose");light("neon-c",10,159,23,13,.6,.6,"rose");
      part("mast-left",-22,221,0,.7,17,.7,"white");text("meridian-logo","M / 12",0,19,23,"rose",2.1);
    });
    site("water-memory","水忆研究院","滨河长窗矮楼、开放柱底、狭窄露台与竖向水幕框架",212,-140,function(){
      glass("upper-lab",0,29,0,51,32,66,"cyan",7.9,3.4,57965,{trim:"teal",detail:2});
      [[-20,-26],[20,-26],[-20,26],[20,26]].forEach(function(p,i){part("pilotis-"+i,p[0],7,p[1],2,14,2,"white");});
      part("lower-canopy",0,13,0,59,1.8,73,"steel");part("river-balcony",33,28,5,17,1.2,51,"blue");rail("river-rail",41,30,5,.4,51,"cyan");
      part("waterframe-a",-18,30,36,1.3,43,1.3,"cyan");part("waterframe-b",18,30,36,1.3,43,1.3,"cyan");light("waterframe-top",0,51,36,37,1.2,1,"cyan");
      text("lab-sign","MEMORY / LAB",0,15,38,"cyan",1.25);
    });
    site("canal-bridge","弦桥","三跨桥面、双高低桥塔、细密悬索与单独设计的两端观景台",365,182,function(){
      part("deck",0,7,0,190,2,18,"steel");rail("north-lip",0,9,-9,190,.5,"white");rail("south-lip",0,9,9,190,.5,"cyan");
      part("west-tower",-47,26,0,5,52,5,"blue");part("east-tower",45,21,0,4,42,4,"teal");
      // Suspension chords are individually measured segments, not decorative screen lines.
      [[-88,14],[-73,23],[-60,36],[-31,39],[-14,30],[3,24],[22,30],[36,34],[57,27],[74,18],[87,11]].forEach(function(a,i){part("hanger-"+i,a[0],(a[1]+8)/2,8,.35,a[1]-8,.35,"white");light("hanger-tip-"+i,a[0],a[1],8,1,.6,1,"cyan","-");});
      part("west-lookout",-90,7,17,23,2,18,"teal");part("east-lookout",90,7,-15,18,2,13,"coral");
    });
    site("moon-garden","月台花园","三条不同路径、下沉池、偏心月亭、六棵不同冠形树与座椅",-367,140,function(){
      part("main-path",4,.18,0,10,.2,260,"white",{material:2,wx:2,wy:3});part("cross-path",0,.2,-44,176,.2,8,"steel",{material:2,wx:2.3,wy:2.9});
      part("pool-rim",-40,.6,35,41,1.2,58,"concrete");part("pool",-40,1.25,35,36,.15,53,"water",{material:3,solid:false});
      part("pavilion-roof",39,8,-31,35,1,29,"teal");part("pavilion-back",39,4,-44,35,8,1,"steel");
      [[24,-19],[55,-19]].forEach(function(a,i){part("pavilion-column-"+i,a[0],4,a[1],.8,8,.8,"white");});
      tree("willow",-68,84,[[0,4,0,.7,8,.7],[-2,6,1,.4,5,.4]],[[0,9,0,9,5,8],[-4,6,1,5,8,4],[4,5,2,5,7,4],[-1,5,-4,7,8,4],[1,10,-1,6,4,7]],"teal");
      tree("gingko",34,72,[[0,5,0,.6,10,.6],[1,9,0,.3,6,.3]],[[0,12,0,11,5,7],[4,10,1,6,4,5],[-4,11,-1,6,5,5],[1,15,0,8,4,6]],"gold");
      tree("cedar",-68,-21,[[0,9,0,.8,18,.8]],[[0,18,0,3,6,3],[0,14,-.5,5,6,5],[1,10,0,7,6,6],[-1,7,1,10,5,9],[1,5,-1,8,3,7]],"leaf");
      tree("elm",57,-78,[[0,4,0,.9,8,.8],[-2,7,0,.5,7,.4],[2,8,1,.4,8,.4]],[[0,12,0,8,6,8],[-5,10,1,7,6,7],[5,11,-1,8,7,6],[-2,15,-2,8,4,6],[3,14,3,6,5,7]],"green");
      tree("maple",-44,-98,[[0,3.5,0,.7,7,.7],[1,6,-1,.4,5,.4]],[[0,9,0,11,5,8],[-4,7,2,6,4,5],[4,8,-2,6,4,5],[1,11,-1,6,3,7]], [.46,.32,.19]);
      tree("pine",71,103,[[0,8,0,.6,16,.6]],[[0,17,0,2,6,2],[.3,13,-.3,4,5,4],[-.7,10,.5,7,4,6],[.5,7,-1,6,3,7]],"leaf");
      part("bench-pool",-14,1,53,8,1.6,1.7,"amber");part("bench-pavilion",39,1,-30,9,1.7,2,"coral");
      text("garden-marker","MOON",16,3,111,"cyan",1.4);
    });
    site("garden-house","庭居","一座面向花园的两层住宅：抬起的露台、内院、偏置厨房与斜置屋檐",-516,161,function(){
      glass("living-wing",0,8,0,33,16,37,"amber",7.3,5.4,64251,{trim:"teal"});
      glass("bedroom",-10,21,-8,20,10,23,"green",5.4,5.0,45869,{trim:"steel"});part("kitchen",20,5,-13,13,10,19,"coral");
      part("roof",0,17,0,39,1.7,42,"teal",{yaw:.04});part("bedroom-roof",-10,27,-8,24,1.3,27,"steel");
      part("deck",5,2,29,36,1.5,19,"amber");rail("deck-edge",5,3.5,38,37,.5,"white");
      part("courtyard-wall",28,2.2,11,1,4.4,19,"teal");tree("courtyard-plum",21,12,[[0,2,0,.35,4,.35]],[[0,5,0,5,4,5],[2,4,1,3,3,3],[-2,6,-1,3,2.5,3]], [.36,.47,.23]);
    });
    site("old-print","旧印刷厂","错位红砖工房、三道齿形屋顶与独立的大型通风槽",-284,-44,function(){
      glass("print-floor",0,15,0,70,30,58,"coral",6.0,5.3,57339,{trim:"ink"});
      part("roof-low",-23,33,0,22,6,61,"steel");part("roof-mid",0,37,0,21,13,61,"teal");part("roof-high",23,40,-1,21,19,58,"blue");
      part("vent",-40,16,-18,11,31,15,"concrete",{material:5,glyph:"%"});part("brick-chimney",29,56,-17,6,35,6,"coral");
      part("loading-bay",0,5,31,22,10,1,"ink");light("loading-lamp",0,11,32,12,.6,.6,"amber");text("print-sign","TYPE / WORKS",0,21,30,"amber",1.6);
    });
    site("fern-residence","蕨庭住宅","三层各有不同深度的露台、绿色遮阳板与开放的屋顶花房",-288,-211,function(){
      glass("base",0,14,0,58,28,55,"green",4.8,4.4,49661,{trim:"teal"});glass("upper",5,39,-8,47,23,38,"teal",4.2,3.8,54827,{trim:"green"});
      part("terrace-one",0,12,30,61,1.3,14,"white");part("terrace-two",4,29,24,51,1.2,19,"concrete");part("terrace-three",7,52,0,41,1.2,37,"steel");
      [-22,-8,7,23].forEach(function(x,i){part("shade-"+i,x,22,34,8,.6,17,"leaf");});
      glass("roof-greenhouse",5,58,-7,25,11,21,"cyan",3.1,5.0,38995,{trim:"white"});tree("roof-fern",-12,-7,[[0,1.5,0,.3,3,.3]],[[1,4,0,7,3,5],[-2,3,2,4,3,4],[0,6,-1,4,3,3]],"green",52);
    });
    site("harbor-crane","港口吊机","独立双脚门架、向河面偏出的起重臂与悬吊货斗",544,-71,function(){
      part("left-leg",-13,17,0,4,34,6,"amber");part("right-leg",14,17,0,4,34,6,"coral");part("crossbeam",0,35,0,35,4,10,"amber");
      part("boom",-21,47,0,69,3,5,"coral");part("counterweight",23,46,-1,15,9,11,"steel");
      part("cable",-48,31,0,.45,30,.45,"white");part("hook",-48,16,0,3,2,3,"amber");part("bucket",-48,11,0,9,7,8,"steel");
      part("operator",-5,40,4,9,8,9,"cyan",{material:1,wx:4,wy:4,mask:65535});
    });
    site("harbor-house","潮仓","蓝色仓库、厚重门框、北侧玻璃办公室与独立堆货布局",636,-32,function(){
      part("warehouse",0,13,0,87,26,71,"blue",{material:5,glyph:"|"});part("roof",0,28,0,93,4,77,"steel");
      glass("office",-23,34,-22,29,15,27,"teal",4.2,5.0,56291,{trim:"cyan"});
      part("door",0,8,37,29,16,1,"ink");part("door-frame",0,17,37,34,2,3,"amber");text("warehouse-sign","TIDE / STORAGE",0,23,37.5,"cyan",1.9);
      part("cargo-coral",-46,4,47,19,8,8,"coral",{material:5,glyph:"|"});part("cargo-teal",-32,5,65,12,10,17,"teal",{material:5,glyph:"="});
      part("cargo-gold",18,3.5,54,15,7,11,"amber",{material:5,glyph:"#"});
    });
    site("quay-lighthouse","镜河灯台","六边感的四重错转底座、玻璃光室与偏置检修阳台",531,254,function(){
      part("plinth",0,3,0,19,6,19,"white",{yaw:.15});part("shaft-low",0,16,0,12,23,12,"coral",{yaw:.27});
      part("shaft-high",0,32,0,9,12,9,"white",{yaw:.38});glass("lantern-room",0,42,0,13,9,13,"gold",3.1,4.0,65535,{trim:"steel"});
      part("cap",0,48,0,17,2,17,"teal",{yaw:.27});part("balcony",3,38,0,23,1,20,"steel");rail("balcony-edge",14,39,0,.4,20,"white");
      light("lamp",0,43,0,4,5,4,"amber","*");
    });
    site("tide-glass","汐光公馆","向河面展开的三层裙房、贯穿塔身的偏心窄槽与双层蓝绿顶冠",489,-269,function(){
      glass("river-plinth",0,16,0,62,32,68,"teal",6.1,4.6,56397,{trim:"steel"});
      glass("west-shaft",-10,76,-4,24,119,40,"cyan",3.1,4.3,44179,{trim:"blue"});
      glass("east-shaft",17,64,2,21,95,38,"blue",4.1,3.7,59939,{trim:"cyan"});
      glass("high-link",4,116,-3,22,14,35,"teal",3.8,4.7,65123,{trim:"white"});
      part("crown-lower",-10,137,-4,31,4,47,"blue");part("crown-upper",-10,142,-4,21,5,34,"teal");
      part("river-deck",-42,14,6,25,2,44,"steel");rail("river-deck-edge",-54,16,6,.4,45,"cyan");
      light("waterline",-31,25,14,.6,17,49,"cyan","|");text("plinth-title","TIDEGLASS",0,9,36,"cyan",1.5);
    });
    site("mariner","航海会馆","转角红色厚壁、蓝色侧翼、独立海图大厅与不对称天线桅杆",581,-394,function(){
      glass("coral-tower",0,52,0,38,104,49,"coral",4.3,5.0,48179,{trim:"amber"});
      glass("blue-wing",-26,31,5,23,62,41,"blue",6.7,3.9,58943,{trim:"steel"});
      part("chart-hall",4,8,32,54,16,23,"steel");glass("chart-front",4,8,45,48,12,1,"cyan",7.4,6,65535,{trim:"white"});
      part("roof-deck",0,106,0,46,2,54,"white");part("mast-a",-8,122,-14,1.3,31,1.3,"steel");part("mast-b",10,119,13,.8,24,.8,"amber");
      part("antenna-boom",-8,133,-14,19,.7,1,"coral");light("mast-beacon",-8,138,-14,1.4,2,1.4,"coral","+");
      text("chart-sign","MARINER",4,18,46,"amber",1.3);
    });
    site("canopy-institute","冠叶学院","纵向裂开的两片教学楼、三道不同宽度露台、屋顶种植架",667,-272,function(){
      glass("long-school",-16,38,0,31,76,74,"green",4.7,4.3,54943,{trim:"teal"});
      glass("short-school",22,29,11,29,58,47,"teal",5.1,4.6,44207,{trim:"green"});
      part("terrace-one",-13,27,37,38,1.5,17,"white");part("terrace-two",-15,53,27,36,1.3,16,"steel");
      part("cross-deck",2,19,1,24,2,14,"teal");part("roof-arbor-left",-28,80,-9,1,8,1,"steel");part("roof-arbor-right",-5,80,-9,1,8,1,"steel");
      part("roof-arbor-canopy",-16,84,-9,27,1,18,"leaf",{material:4,solid:false});
      tree("academy-roof-tree",-15,-24,[[0,2.5,0,.4,5,.4]],[[0,6,0,8,4,7],[-3,5,1,5,3,4],[2,8,-2,4,3,4]],"green",77);
      text("academy-sign","CANOPY",0,8,38,"green",1.8);
    });
    site("east-pylon","东桁大厦","金色核心包在四道不同宽度外肋中，顶部从宽厅收束到青色机械舱",750,-448,function(){
      glass("core",0,74,0,44,148,46,"gold",4.3,4.1,58027,{trim:"green"});
      part("rib-west",-25,69,2,4,138,8,"steel");part("rib-east",25,77,-8,3,154,11,"teal");
      part("rib-south",9,73,26,9,146,3,"steel");part("rib-north",-10,66,-26,6,132,4,"green");
      glass("top-hall",1,156,-1,54,14,51,"amber",6.0,7,65535,{trim:"gold"});
      part("top-equipment",8,169,-9,19,13,22,"cyan",{material:5,glyph:"%"});
      part("roof-vent",-15,166,8,9,7,7,"steel",{material:5,glyph:"="});text("pylon-logo","E / P",0,15,26,"gold",3);
    });
    site("salt-works","盐雾工厂","下沉装卸庭、横向长工房、不同高度的三根排气管和透光设备楼",639,-621,function(){
      part("workshop",0,12,0,88,24,76,"coral",{material:5,glyph:"|"});glass("machine-house",18,37,-19,39,27,37,"cyan",5.9,4.2,55719,{trim:"steel"});
      part("loading-side",-27,5,43,26,10,16,"steel");part("cargo-door",-27,5,52,15,9,.5,"ink");
      part("exhaust-low",-29,37,-19,4,51,4,"white");part("exhaust-middle",-12,45,-21,5,67,5,"coral");part("exhaust-tall",-21,55,-34,3,87,3,"steel");
      part("top-pipe",0,54,-19,43,2,2,"teal");part("warehouse-slit",0,14,39,44,2,.8,"amber",{material:6,glyph:"-"});
      text("salt-title","SALT WORKS",0,23,40,"coral",1.8);
    });
    site("air-dock","空港修造棚","高架码头留出整条穿行空隙，三段悬挑屋顶、侧边维修舱与吊杆",512,-553,function(){
      part("dock-west",-34,11,0,17,2,85,"steel");part("dock-east",30,11,0,24,2,85,"concrete");
      part("roof-main",0,48,-10,89,2,43,"blue");part("roof-front",-4,41,28,78,1.6,32,"cyan");part("roof-back",8,54,-41,63,1.7,25,"teal");
      part("support-west",-37,25,-11,2,50,2,"white");part("support-east",39,22,-8,2,44,2,"steel");
      glass("repair-control",29,20,8,20,16,32,"cyan",4.2,5,62391,{trim:"teal"});
      part("hoist-beam",0,45,-8,69,1.2,1.4,"coral");part("hanging-cable",-11,34,-8,.4,22,.4,"white");part("hook",-11,22,-8,3,2,3,"amber");
      part("spare-wing",-33,15,11,11,6,23,"coral",{yaw:.18});text("dock-title","AIR DOCK",-2,43,45,"cyan",2);
    });
    site("vault-market","穹市","长方形市场厅上覆扁椭球穹顶，东侧高窗、面向河道的开放前廊",737,-135,function(){
      glass("market-hall",0,13,0,78,26,68,"rose",6.2,6,49181,{trim:"coral"});
      part("vault-dome",0,26,-5,77,33,64,"violet",{shape:1});part("east-window",41,24,-8,7,38,41,"cyan",{material:1,wx:5,wy:6.2,mask:62701});
      part("front-canopy",-4,14,43,75,1.4,22,"coral");part("front-column-a",-37,6.8,48,1.1,13.6,1.1,"rose");part("front-column-b",31,6.8,48,1.3,13.6,1.3,"amber");
      text("vault-sign","VAULT MARKET",-4,18,46,"rose",1.6);part("delivery-cage",-47,3,19,10,6,13,"steel",{material:5,glyph:"#"});
    });
    site("ink-library","墨流图书馆","河畔两层阅览室、转向城市的窄高窗塔、顶部开放书廊与室外长台阶",479,51,function(){
      glass("river-reading",0,10,0,53,20,59,"amber",6.6,5.2,58349,{trim:"ink"});glass("book-spine",21,37,-8,19,54,23,"teal",2.8,4.9,44617,{trim:"green"});
      part("gallery-floor",-3,23,0,52,1.5,61,"white");part("gallery-roof",-3,36,-4,51,1.4,54,"blue");
      part("gallery-column-a",-25,29,23,1.1,12,1.1,"steel");part("gallery-column-b",15,29,23,.9,12,.9,"amber");
      part("steps-low",-31,1,23,12,2,24,"steel");part("steps-mid",-29,2.5,11,8,3,16,"concrete");part("steps-high",-29,4,0,8,4,9,"white");
      text("library-sign","INK / READING",-1,12,31,"amber",1.2);
    });
    site("quartz-atrium","石英中庭楼","四片错角翼围绕空心内庭，北侧较低，南侧尖窄，屋顶留出飞行通道",227,-539,function(){
      glass("west-wall",-20,63,0,15,126,59,"white",4.0,4.8,48047,{trim:"blue"});
      glass("east-wall",22,72,-2,16,144,54,"cyan",3.4,4.1,59911,{trim:"steel"});
      glass("north-link",0,59,-24,29,19,12,"blue",4.3,4.7,65535,{trim:"cyan"});
      glass("south-blade",4,36,22,9,72,21,"teal",2.6,4.0,55293,{trim:"white"});
      part("atrium-deck",0,50,0,24,1,19,"steel");rail("deck-edge",0,52,10,24,.4,"white");
      part("east-crown",22,146,-2,20,4,60,"white");text("quartz-title","Q / ATRIUM",0,10,32,"cyan",1.6);
    });
    site("echo-apartments","回声住宅","短翼向南伸出，四段独立外阳台错开排列，粉色屋顶房与绿色生活层",219,-423,function(){
      glass("residential-core",0,42,0,47,84,45,"teal",4.1,3.8,55619,{trim:"steel"});glass("south-wing",9,20,30,31,40,27,"green",5.2,4.0,43919,{trim:"teal"});
      part("balcony-a",-13,18,26,16,1.1,12,"white");part("balcony-b",12,36,26,19,1.1,10,"steel");part("balcony-c",-11,53,25,18,1.1,9,"amber");part("balcony-d",9,71,25,16,1.1,13,"white");
      glass("roof-home",-8,92,-7,21,15,24,"rose",4.2,5,61349,{trim:"violet"});part("roof-home-hat",-8,101,-7,27,2,28,"coral");
      text("echo-sign","ECHO",-3,9,24,"green",1.8);
    });
    site("twin-compass","双罗盘楼","两座高度不同的窄塔朝相反方向错转，低层宽连座和屋顶独立平台",183,-648,function(){
      glass("western-needle",-17,91,0,23,182,28,"blue",3.1,4.6,47911,{trim:"violet",yaw:.13});
      glass("eastern-needle",19,77,-9,25,154,27,"violet",3.8,4.2,59611,{trim:"blue",yaw:-.17});
      glass("joining-base",0,15,0,65,30,57,"cyan",6.9,5.3,56249,{trim:"steel"});
      part("western-platform",-17,183,0,31,2,36,"white",{yaw:.13});part("eastern-platform",19,155,-9,33,2,35,"teal",{yaw:-.17});
      part("compass-mast",-17,191,0,.7,15,.7,"steel");text("compass-title","N / S",0,11,30,"cyan",2.4);
    });
    site("silver-mill","银铣工坊","旧工业裙房上的双层蓝色添建，车间长窗、厚门梁与偏心检修塔",-305,-434,function(){
      glass("brick-workshop",0,16,0,76,32,57,"coral",6.2,5.5,54909,{trim:"steel"});
      glass("new-upper",9,42,-8,47,21,35,"blue",4.8,3.5,60817,{trim:"cyan"});
      part("service-tower",-29,29,-16,12,58,17,"steel",{material:5,glyph:"%"});part("service-cap",-29,59,-16,15,2,19,"white");
      part("gate-left",-11,6,30,3,12,7,"amber");part("gate-right",15,6,30,3,12,7,"coral");part("gate-beam",2,13,30,30,3,9,"steel");
      part("upper-deck",10,54,-8,52,1.2,40,"white");text("mill-sign","SILVER MILL",0,22,31,"cyan",1.6);
    });
    site("moss-clinic","苔青诊所","凹进的入口小庭、独立青色诊疗塔、暖色候诊室与屋顶遮阳百叶",-252,-569,function(){
      glass("care-tower",9,49,-4,32,98,39,"teal",4.0,4.6,46539,{trim:"cyan"});
      glass("waiting-room",-19,12,12,25,24,33,"amber",5.1,5.6,64195,{trim:"green"});part("garden-wall",-4,3,32,49,6,1,"steel");
      part("entrance-awning",5,8,31,20,1.1,13,"green");part("roof-sunscreen",9,100,-4,38,1.2,45,"leaf",{material:5,glyph:"="});
      light("clinic-mark",9,81,17,5,5,.5,"cyan","+");text("clinic-title","MOSS / CARE",-3,8,36,"green",1.15);
      tree("clinic-courtyard-tree",-28,34,[[0,2,0,.35,4,.35]],[[0,5,0,5,4,5],[2,4,-1,3,3,3],[-2,6,1,4,3,3]],"teal");
    });
    site("cobalt-loft","钴蓝仓寓","一座转角仓库保留红砖底层，蓝色屋顶阁楼悬在西侧柱上",-389,-256,function(){
      glass("warehouse-shell",0,21,0,69,42,69,"coral",6.0,5.5,58129,{trim:"ink"});
      glass("cantilever-loft",-11,50,-9,50,17,42,"blue",7.3,4.2,47621,{trim:"cyan"});
      part("west-column",-39,24,-9,2,48,2,"steel");part("loft-hat",-11,60,-9,55,2,46,"white");
      part("loading-ramp",16,2,40,23,4,14,"concrete");part("roof-skylight",13,46,18,16,5,19,"teal",{material:1,wx:4,wy:5,mask:65535});
      text("loft-sign","COBALT",0,14,36,"blue",2.1);
    });
    site("copper-baths","铜泉浴场","层叠深檐、独立温室水池、转角铜色烟囱与两根不同截面的入口柱",-412,-81,function(){
      part("bath-base",0,9,0,64,18,72,"coral");glass("upper-baths",7,25,-11,45,15,39,"amber",4.8,5,63519,{trim:"teal"});
      part("lower-eave",-3,19,7,73,1.8,71,"teal");part("upper-eave",7,34,-11,53,1.6,46,"green");
      glass("pool-house",-18,7,15,29,13,33,"cyan",5.6,6,65535,{trim:"steel"});
      part("copper-chimney",22,33,-24,5,45,5,"coral");part("entry-column-one",-21,4.4,43,1.5,8.8,1.5,"amber");part("entry-column-two",20,4.4,43,1.1,8.8,2,"teal");
      text("baths-title","COPPER BATHS",-2,12,42,"amber",1.2);
    });
    site("hush-tower","静默住宅塔","三组不同高度的竖向庭院壁、蓝绿色短桥与面向花园的宽阳台",-512,-29,function(){
      glass("rear-home",0,61,-16,47,122,33,"teal",4.2,4.1,53917,{trim:"green"});glass("west-home",-21,43,12,19,86,38,"blue",3.6,4.6,47339,{trim:"teal"});
      glass("east-home",22,35,16,18,70,29,"green",3.4,4.0,61273,{trim:"steel"});
      glass("courtyard-bridge",0,38,8,27,7,12,"cyan",4.1,3.5,65535,{trim:"blue"});
      part("garden-balcony",1,17,35,57,1.5,17,"steel");rail("garden-balcony-railing",1,19,43,57,.4,"white");
      part("roof-cabin",9,127,-16,14,9,17,"white");text("hush-title","HUSH",-2,11,26,"green",2.2);
    });
    site("north-umbra","北影事务所","边界处一栋宽而矮的横窗塔，立面凹口、半圆顶舱与琥珀色高位灯带",-37,-711,function(){
      glass("office-bar",0,54,0,86,108,49,"violet",8.8,3.7,60539,{trim:"blue",detail:2});
      part("facade-slot",-18,53,26,13,89,1,"ink");light("slot-edge",-25,55,27,.6,81,.5,"blue","|");
      part("roof-pod",17,112,-7,29,19,25,"steel",{shape:1});part("roof-plinth",17,108,-7,35,2,31,"blue");
      light("high-band",8,88,26,51,.8,.6,"amber");text("umbra-logo","UMBRA",15,17,27,"violet",2.2);
    });
    site("oculus-ring","光环楼","北城尽头的椭圆环楼：环心取景对准城市，侧脚有小型候景厅，顶部保留观景层",180,-790,function(){
      // A single authored structural ring; the sector poses describe its curve, not city variants.
      var masks=[56371,44091,59931,48151,62413,52991,44757,58231,47309,60917,53691,45539];
      for(var i=0;i<36;i++){
        var a=i*Math.PI*2/36;var x=Math.cos(a)*73,y=95+Math.sin(a)*68;
        var dx=-Math.sin(a)*73,dy=Math.cos(a)*68;var angle=Math.atan2(dy,dx);
        var length=Math.hypot(dx,dy)*Math.PI*2/36+1.6;
        glass("ring-sector-"+i,x,y,0,length,13.5,34,i>=3&&i<=14?"gold":i>=15&&i<=25?"teal":"cyan",3.6,4.1,masks[i%12],{roll:angle,trim:i>=3&&i<=14?"amber":"blue"});
      }
      part("west-foot",-42,10,0,20,20,47,"steel");part("east-foot",42,11,-2,19,22,43,"concrete");
      glass("west-lobby",-42,22,20,27,10,24,"amber",5.5,5,65535,{trim:"teal"});
      part("west-lobby-cap",-42,28,20,31,1.6,28,"teal");
      part("top-lookout-floor",-3,166,-1,41,1.5,45,"white");part("top-lookout-roof",-3,180,-1,38,1.4,39,"teal");
      part("lookout-column-west",-20,173,17,1,13,1,"steel");part("lookout-column-east",14,173,17,1.2,13,1.2,"amber");
      rail("lookout-lip",-3,168,21,41,.4,"gold");text("ring-title","OCULUS",0,25,25,"gold",2.5);
      light("west-inside-guide",-58,95,18,.6,11,.6,"cyan","|");light("east-inside-guide",58,95,18,.6,9,.6,"gold","|");
    });
    site("folded-loop","折环总部","两座相向倾斜的塔腿与偏置高空回梁围出旧城门洞，出口在织影楼前留出向上的空间",-160,-88,function(){
      glass("west-leaning-leg",-36,80,0,25,160,35,"blue",4.2,4.6,54589,{roll:-.2,yaw:.1,trim:"cyan"});
      glass("east-leaning-leg",43,96,-31,24,192,33,"teal",3.7,4.3,48073,{roll:.16,yaw:-.11,trim:"steel"});
      glass("upper-return",0,180,-14,94,22,41,"cyan",6.4,5.5,59989,{roll:.05,trim:"blue"});
      glass("east-return",38,178,-16,26,25,70,"blue",4.3,5.0,56459,{pitch:.06,trim:"cyan"});
      part("base-west",-29,8,10,54,16,55,"steel");part("base-east",35,10,-20,47,20,54,"concrete");
      part("base-link",4,15,-4,47,2,28,"teal");rail("base-roof-lip",-29,18,37,54,.5,"cyan");
      part("roof-cabin",-11,195,-16,22,9,21,"steel",{material:5,glyph:"%"});
      text("loop-title","FOLD / LOOP",-20,20,40,"cyan",1.8);
      part("public-seat",-36,18,25,8,2,2,"coral");part("public-planter",-15,18,19,11,2,7,"white");part("public-plant",-15,21,19,12,4,8,"leaf",{shape:1,material:4,solid:false});
    });
    site("raised-court","抬起的庭院","花园上方的开放中庭，三边有生活空间，正面是大门洞，中央可以垂直飞向天空",-377,118,function(){
      part("leg-west-front",-57,22,44,3,44,3,"steel");part("leg-west-back",-57,22,-44,3.5,44,3.5,"teal");
      part("leg-east-front",57,22,44,3.2,44,3.2,"white");part("leg-east-back",57,22,-44,4,44,4,"steel");
      part("west-public-deck",-48,45,0,30,2,110,"white");part("east-public-deck",48,45,-3,30,2,103,"steel");part("north-public-deck",0,45,-42,72,2,25,"teal");
      glass("west-home",-47,73,-7,23,53,78,"green",5.1,4.1,48139,{trim:"teal"});glass("east-home",46,65,-10,26,37,67,"cyan",6.2,4.6,59463,{trim:"blue"});
      glass("north-home",0,79,-43,69,55,21,"teal",5.7,4.5,55749,{trim:"green"});
      part("front-lintel",0,98,42,121,5,8,"cyan");
      part("west-roof",-47,101,-7,31,2,85,"teal");part("east-roof",46,85,-10,34,2,77,"blue");
      rail("west-inner-rail",-33,48,0,.4,98,"amber");rail("east-inner-rail",33,48,-3,.4,90,"cyan");
      part("tea-table",-49,47,38,7,3.8,4,"amber");part("tea-chair",-44,47,43,2.6,2.1,3,"coral");
      part("east-window-garden",46,47,31,14,2,8,"white");part("east-window-leaves",46,50,31,15,4,9,"leaf",{shape:1,material:4,solid:false});
      text("court-title","OPEN COURT",0,99,46,"cyan",2.1);
      light("courtyard-pendant",-26,78,28,2,1,2,"amber","*");
    });
    site("wind-window","通风大窗","悬起的双面大窗把前后街道连通；室内布置长桌、两种座椅、书架和靠窗植物",145,275,function(){
      part("floor",0,23,0,84,2,52,"white",{material:2,wx:3.4,wy:3.1});part("roof",0,45,0,89,2,58,"teal");
      glass("front-west-pier",-28,34,25,26,22,2,"amber",4.7,4.4,56927,{trim:"steel"});glass("front-east-pier",28,34,25,26,22,2,"cyan",4.2,4.5,44653,{trim:"blue"});
      glass("rear-west-pier",-28,34,-25,26,22,2,"teal",5.1,4.3,54831,{trim:"green"});glass("rear-east-pier",28,34,-25,26,22,2,"blue",3.7,4.6,59957,{trim:"cyan"});
      part("front-window-bottom",0,27,25,30,4,2,"steel");part("front-window-top",0,43,25,30,4,2,"teal");part("rear-window-bottom",0,27,-25,30,4,2,"steel");part("rear-window-top",0,43,-25,30,4,2,"teal");
      glass("west-side",-41,34,0,2,22,48,"amber",6.1,4.4,58369,{trim:"steel",material:10});glass("east-side",41,34,0,2,22,48,"cyan",5.3,4.4,47749,{trim:"blue",material:10});
      part("support-west",-33,11,0,4,22,5,"steel");part("support-east",33,11,-9,3,22,4,"concrete");
      part("long-table-top",-29,28,1,8,.6,17,"white");part("long-table-base",-29,26,1,3,4,10,"steel");
      part("red-chair",-22,26,5,2.5,2.2,2.8,"coral");part("red-chair-back",-21,27.4,5,.5,2.8,2.8,"coral");
      part("blue-chair",-22,26,-5,2.7,2.1,2.6,"blue");part("blue-chair-back",-21,27.3,-5,.4,2.6,2.6,"blue");
      part("bookshelf",35,28,-11,3,8,19,"violet",{material:5,glyph:"="});part("window-planter",31,25.3,17,10,2.6,7,"steel");part("window-plant",31,29,17,11,5,8,"leaf",{material:4,shape:1,solid:false});
      part("ceiling-strip",-26,43.6,0,1,.4,22,"amber",{material:6,solid:false});text("window-title","WIND / ROOM",0,47,29,"cyan",1.9);
    });
    site("cloud-hybrid","云桥群楼","两座不同高度的分翼塔之间是一条缓坡空中室内街，可从塔外飞入另一侧，侧窗能看到下方城市",-456,-385,function(){
      glass("west-north-wing",-90,65,-18,32,130,22,"blue",4.7,4.6,57419,{trim:"cyan"});glass("west-south-wing",-90,56,18,36,112,22,"teal",5.2,4.0,44843,{trim:"green"});
      glass("east-north-wing",88,84,-16,29,168,18,"violet",3.8,4.4,59531,{trim:"blue"});glass("east-south-wing",88,64,16,33,128,18,"cyan",4.2,4.0,55067,{trim:"teal"});
      part("west-top",-90,134,0,46,4,65,"white");part("east-top",88,171,-16,35,4,24,"blue");
      part("bridge-floor",0,68.5,0,143,1.5,15,"white",{roll:.07,material:2,wx:2.4,wy:2.1});part("bridge-roof",0,82.5,0,148,1.5,18,"teal",{roll:.07});
      glass("bridge-north-side",0,75.5,-8,143,14,.8,"cyan",5.2,4.4,58381,{roll:.07,material:10,trim:"steel"});glass("bridge-south-side",0,75.5,8,143,14,.8,"amber",6.1,4.6,47561,{roll:.07,material:10,trim:"teal"});
      part("bridge-west-seat",-27,68.6,4.8,8,2,1.6,"coral");part("bridge-east-table",29,72.7,-4.2,6,2.8,2.7,"steel");
      part("bridge-east-planter",44,73.8,4.6,7,2,3,"white");part("bridge-east-fern",44,76.4,4.6,8,3.2,4,"green",{shape:1,material:4,solid:false});
      light("roof-line",0,81.5,0,130,.3,.5,"cyan");text("hybrid-title","CLOUD / WALK",-15,62,9,"cyan",1.6);
    });
    site("vertical-lightwell","垂直光井","从街道进入的竖向空井，左右各留一扇大窗，三片错位平台让飞行可以转向或向上离开",222,-38,function(){
      glass("west-low",-22,29,0,8,58,51,"teal",3.7,4.4,48199,{trim:"cyan"});glass("west-high",-22,105,0,8,70,51,"blue",3.4,4.6,60107,{trim:"cyan"});
      glass("east-low",22,20,-4,8,40,41,"gold",3.9,4.0,54613,{trim:"green"});glass("east-high",22,90,-4,8,50,41,"green",3.2,4.3,46573,{trim:"teal"});
      glass("rear-spine",0,40,-24,30,80,8,"cyan",4.6,4.0,55723,{trim:"blue"});
      part("west-gallery",-13,38,0,14,1.5,36,"white");part("east-gallery",13,69,-4,14,1.5,30,"steel");part("north-gallery",0,100,-14,34,1.5,12,"teal");
      part("west-roof",-22,141,0,12,2,55,"blue");part("east-roof",22,116,-4,12,2,45,"green");
      part("entry-canopy",0,16,28,39,1.2,13,"cyan");text("well-title","LIGHT / WELL",0,18,33,"cyan",1.4);
      light("west-window-frame",-27,64,0,.5,.5,48,"cyan");light("east-window-frame",27,52,-4,.5,.5,38,"gold");
      part("gallery-seat",-14,40,9,6,2,2,"coral");part("gallery-fern-bed",13,71,-11,6,2,5,"white");part("gallery-fern",13,74,-11,7,4,6,"leaf",{material:4,shape:1,solid:false});
    });
    site("east-streets","港区街道","沿学院延伸的窄路、吊机作业街与三段独立铺装庭院",0,0,function(){
      part("academy-side-lane",601,.1,-281,14,.18,130,"steel",{material:2,wx:3.1,wy:6.8});
      part("salt-approach",580,.1,-496,14,.18,124,"steel",{material:2,wx:3.3,wy:5.6});
      part("academy-cross",661,.1,-197,305,.18,18,"concrete",{material:2,wx:4.2,wy:3});
      part("salt-cross",687,.1,-558,219,.18,17,"steel",{material:2,wx:3.7,wy:3.4});
      part("library-court",482,.18,100,74,.3,22,"white",{material:2,wx:3,wy:3.8});
      part("mariner-court",580,.18,-332,71,.3,25,"concrete",{material:2,wx:3.6,wy:4.1});
      part("west-mill-yard",-305,.14,-381,89,.22,39,"steel",{material:2,wx:4.3,wy:5});
    });
    site("street-life","街边陈设","逐个定位的路灯、树木、路牌、亭子、车辆和货物",0,0,function(){
      part("copper-lantern-post",-19,3.6,290,.5,7.2,.5,"coral");part("copper-lantern-arm",-17.5,7.2,290,3.5,.3,.4,"amber");part("copper-lantern-cowl",-16.5,6.8,290,1.8,.4,1.8,"coral");light("copper-lantern",-16.5,6,290,1.2,1.5,1.2,"amber","H");
      part("blue-fork-stem",19,4,226,.4,8,.4,"blue");part("blue-fork-bar",19,8,226,5,.3,.35,"steel");light("blue-fork-west",16.8,7.7,226,.7,.7,.7,"cyan","*");light("blue-fork-east",21.2,7.7,226,.5,.9,.5,"blue","+");
      part("post-lamp-pillar",-20,3,193,.7,6,.7,"teal");part("post-lamp-square",-20,6.3,193,2.5,.5,2.5,"green");light("post-lamp-pane",-20,5.8,193,1.5,.5,1.5,"gold");
      part("ribbon-light-a",19,4,95,.3,8,.3,"white");part("ribbon-light-b",24,4,95,.3,8,.3,"white");light("ribbon-light-strip",21.5,8,95,5.8,.25,.6,"cyan");
      part("radio-light-mast",-19,4.5,3,.35,9,.35,"violet");part("radio-light-circle",-19,9,3,2.8,2.8,.6,"rose",{shape:1,material:6,solid:false});light("radio-light-center",-19,9,3.4,1.1,1.1,.2,"cyan","+");
      part("arcade-lamp-base",-20,1,-118,.9,2,.9,"steel");part("arcade-lamp-fin",-20,3.8,-118,.35,5,.8,"amber");light("arcade-lamp-line",-20,4.4,-117.5,.5,3.1,.3,"gold","|");
      part("lab-lamp-stem",20,4,-211,.28,8,.28,"cyan");part("lab-lamp-offset",21.4,7.8,-211,3.3,.2,.4,"teal");light("lab-lamp-disc",22.8,7.6,-211,2.1,.4,1.4,"cyan");
      part("cinema-light-blade",20,3.8,-301,.6,7.6,.8,"violet");light("cinema-light-front",20,4.6,-300.5,.7,4.8,.2,"rose","=");part("cinema-light-cap",20,8,-301,1.8,.7,1.8,"coral");
      part("terminal-light-frame-a",-19,4.7,-334,.35,9.4,.35,"steel");part("terminal-light-frame-b",-15,4.7,-334,.35,9.4,.35,"steel");part("terminal-light-top",-17,9.4,-334,4.6,.35,.4,"blue");light("terminal-pendant",-17,8.7,-334,1.4,1.2,1.2,"cyan","*");
      part("north-light-base",19,1,-430,1,2,1,"green");part("north-light-column",19,5,-430,.5,8,.5,"amber");light("north-light-crown",19,9,-430,1.6,.5,1.6,"gold","+");light("north-light-blade",19,6,-429.65,.4,3,.2,"gold","|");
      tree("boulevard-south",-25,312,[[0,3,0,.5,6,.5]],[[0,8,0,7,5,6],[3,6,1,5,3,4],[-2,9,-1,4,3,5]],"leaf");
      tree("blue-hotel-tree",27,308,[[0,4,0,.6,8,.6],[1,6,1,.3,5,.3]],[[0,10,0,6,5,5],[2,8,2,5,4,4],[-2,7,-2,4,4,5],[0,12,-1,4,3,4]],"teal");
      tree("post-elm",-91,189,[[0,4,0,.8,8,.8],[-2,6,0,.4,6,.4]],[[0,10,0,10,5,7],[-4,9,-1,5,5,6],[4,11,1,5,4,5],[1,13,0,6,3,6]],"green");
      tree("archive-maple",-103,65,[[0,2.5,0,.4,5,.4]],[[0,6,0,8,4,6],[-3,5,2,4,3,4],[2,7,-2,5,3,3]], [.45,.32,.16]);
      tree("market-cedar",91,-34,[[0,6,0,.7,12,.7]],[[0,13,0,3,6,3],[0,10,1,5,5,4],[-1,7,0,7,5,6],[1,5,-1,6,3,7]],"leaf");
      tree("canal-willow",266,244,[[0,3.5,0,.7,7,.7],[2,5,0,.3,5,.3]],[[0,8,0,10,4,8],[-5,5,0,4,7,5],[4,4,2,4,6,4],[-1,4,-4,6,7,4],[2,9,1,5,3,5]],"teal");
      tree("cinema-tree",169,-222,[[0,3,0,.45,6,.45]],[[0,7,0,7,4,7],[3,6,-2,5,3,4],[-3,7,1,4,3,5],[1,9,1,4,2,4]], [.25,.48,.25]);
      tree("north-tree",-97,-526,[[0,5,0,.65,10,.65],[-1,8,-1,.3,5,.3]],[[0,12,0,8,5,7],[-4,10,1,5,4,6],[3,11,-2,6,5,5],[-1,14,-1,5,3,6],[4,8,3,4,3,4]],"green");
      part("news-kiosk",-83,2.9,202,5.8,5.8,4.4,"teal",{material:1,wx:2.5,wy:2.2,mask:65535});part("kiosk-roof",-83,6,202,7.2,.7,5.5,"coral");text("kiosk-sign","NEWS",-83,4.6,205,"amber",1);
      part("phone-booth",-25,2.7,116,2.3,5.4,2.3,"cyan",{material:1,wx:2,wy:4.5,mask:65535,trim:"steel"});
      part("market-planter",23,1.1,-48,2.7,2.2,5,"concrete");part("market-fern",23,3,-48,3.5,2.7,5.7,"leaf",{shape:1,material:4,solid:false});
      text("avenue-wayfinding","RAIN AVE",-20,3.8,191,"white",.85);text("canal-wayfinding","MIRROR",264,4.4,173,"cyan",.9);
    });
    var extension=City.build(),offset=objects.length;
    extension.sites.forEach(function(site){sites.push(Object.assign({},site,{start:site.start+offset}));});
    objects=objects.concat(extension.objects);
    var ids = new Set();
    objects.forEach(function(object) {
      if (ids.has(object.id)) throw new Error("Duplicate authored object: " + object.id);
      ids.add(object.id);
      if (object.values.length !== STRIDE || object.values.some(function(v){return !Number.isFinite(v);})) throw new Error("Invalid geometry: " + object.id);
    });
    var packed = new Float32Array(objects.length * STRIDE);
    objects.forEach(function(o,i){packed.set(o.values,i*STRIDE);});
    return { objects: objects, sites: sites, packed: packed, spawns: SPAWNS, passages: PASSAGES, stride: STRIDE };
  }
  return Object.freeze({ build: build, SPAWNS: SPAWNS, PASSAGES:PASSAGES, STRIDE: STRIDE });
});
