/* A fixed, authored Chinese metropolitan composition; landmarks retain their defining geometry. */
(function(root,factory){var node=typeof module==="object"&&module.exports;var api=factory(node?require("./city-shuttle-geometry.js"):root.CityShuttleGeometry,node?require("./city-shuttle-streets.js"):root.CityShuttleStreets,node?require("./city-shuttle-neighborhoods.js"):root.CityShuttleNeighborhoods,node?require("./city-shuttle-transit.js"):root.CityShuttleTransit);if(node)module.exports=api;if(root)root.CityShuttleCity=api;})(typeof window!=="undefined"?window:globalThis,function(G,Streets,Neighborhoods,Transit){
  "use strict";
  if(!G||!Streets||!Neighborhoods||!Transit)throw new Error("City authoring geometry, roads, neighborhoods or transit are missing");
  var SOURCES=Object.freeze({
    canton:"https://www.arup.com/globalassets/downloads/insights/a/arups-innovation-legacy/arup-innovation-legacy.pdf",
    shanghai:"https://www.gensler.com/projects/shanghai-tower",jinmao:"https://www.som.com/projects/jin-mao-tower/",
    swfc:"https://www.kpf.com/project/shanghai-world-financial-center",pingan:"https://www.kpf.com/project/ping-an-finance-centre",
    zun:"https://www.arup.com/projects/citic-tower-china-zun/",cctv:"https://www.oma.com/projects/cctv-headquarters",
    raffles:"https://www.safdiearchitects.com/projects/raffles-city-chongqing",
    opera:"https://www.zaha-hadid.com/wp-content/uploads/2019/12/guangzhouoperahouse.pdf",
    pearl:"https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html"
  });
  var DISTRICTS=Object.freeze([
    {id:"rail",name:"北城轨道与车站",bounds:[-2440,2440,-2305,-2070]},
    {id:"huacheng",name:"花城滨江文化轴",bounds:[500,1690,-450,2380]},
    {id:"pudong",name:"陆家嘴天际线",bounds:[-2125,-550,-1960,585]},
    {id:"oldtown",name:"骑楼老城",bounds:[-1500,500,1040,2480]},
    {id:"civic",name:"北城公共服务区",bounds:[-880,1400,-2500,-920]},
    {id:"harbor",name:"东港物流区",bounds:[1640,2940,-2460,650]},
    {id:"raffles",name:"朝天门水岸",bounds:[1640,2780,1030,2030]},
    {id:"airport",name:"西湾空港",bounds:[-2780,-1450,1120,2735]},
    {id:"park",name:"山海绿廊",bounds:[-2780,-1750,-2460,550]},
    {id:"wetland",name:"东南湿地",bounds:[1700,2780,2030,2735]}
  ]);
  var SPAWNS=Object.freeze([
    {id:"canton-boulevard",name:"广州塔 · 花城大道",x:1000,y:10,z:1950,yaw:0,pitch:.20},
    {id:"canton-sky",name:"小蛮腰 · 观景层",x:1170,y:510,z:1400,yaw:-.83,pitch:-.15},
    {id:"street-people",name:"街头行人 · 近景",x:999.45,y:1.95,z:1441.3,yaw:Math.PI,pitch:0},
    {id:"traffic-close",name:"城市车流 · 近景",x:1148.75,y:2.2,z:1760,yaw:Math.PI,pitch:-.04},
    {id:"driver-window",name:"车窗与司机 · 近景",x:3.3,y:1.59,z:112.9,yaw:Math.PI/2,pitch:0},
    {id:"shanghai-trio",name:"上海三件套 · 天际线",x:-1120,y:85,z:-410,yaw:-.16,pitch:.18},
    {id:"pearl-river",name:"东方明珠 · 滨江",x:-660,y:12,z:660,yaw:-.18,pitch:.28},
    {id:"pingan",name:"平安金融中心 · 商圈",x:1040,y:14,z:-365,yaw:.21,pitch:.26},
    {id:"china-zun",name:"中国尊 · 北城",x:610,y:20,z:-1180,yaw:.02,pitch:.30},
    {id:"cctv",name:"央视总部 · 环路下方",x:10,y:35,z:-1300,yaw:0,pitch:.10},
    {id:"raffles",name:"重庆来福士 · 水晶连廊",x:1890,y:255,z:1520,yaw:Math.PI/2,pitch:0},
    {id:"opera",name:"广州大剧院 · 河岸广场",x:1280,y:7,z:640,yaw:-.36,pitch:.05},
    {id:"birdnest",name:"北京鸟巢 · 球场上空",x:-664,y:72,z:-1370,yaw:0,pitch:-.22},
    {id:"park-lake",name:"山海绿廊 · 湖畔公园",x:-2222,y:8,z:-722,yaw:-.60,pitch:-.06},
    {id:"park-children",name:"亲子公园 · 秋千与人物",x:-2330,y:2.15,z:-309,yaw:-.29,pitch:-.055},
    {id:"rail-station",name:"北城轨道 · 列车与候车",x:-1480,y:16.75,z:-2218.5,yaw:-Math.PI/2,pitch:0},
    {id:"airport-terminal",name:"西湾空港 · 候机厅",x:-1828,y:2.1,z:1726,yaw:-Math.PI/4,pitch:0},
    {id:"airport-pilot",name:"空港客机 · 机组近景",x:-2153.2,y:3.25,z:1693.3,yaw:1.12,pitch:-.05},
    {id:"airport-runway",name:"西湾空港 · 跑道与客机",x:-2245,y:18,z:1760,yaw:-.31,pitch:-.10},
    {id:"port-cranes",name:"东港 · 岸吊与集装箱",x:2790,y:56,z:-1100,yaw:-.076,pitch:-.04},
    {id:"river-ferry",name:"滨江 · 水上巴士",x:1290,y:8,z:1000,yaw:-.62,pitch:-.15},
    {id:"green-tunnel",name:"北城绿顶隧道 · 可穿行",x:-1750,y:4.5,z:-1792,yaw:0,pitch:0},
    {id:"garden-cafe",name:"邻里花园 · 咖啡座与喷泉",x:1023,y:2.1,z:1652,yaw:Math.PI,pitch:-.06}
  ]);
  function landmark(b,id,name,x,z,description,draw,source){b.site("landmark-"+id,name,x,z,description,draw,{kind:"landmark",source:source});}
  function publicBase(b,label,w,d,tint){
    b.part(label+"-paving",0,.18,0,w,.36,d,tint||"stone",{material:2,wx:3.6,wy:3.1});
    b.part(label+"-west-lawn",-w*.40,.3,0,w*.10,.3,d*.7,"green",{material:7});
    b.part(label+"-east-seat",w*.40,.7,d*.26,w*.08,1.2,2.1,"ivory");
    b.light(label+"-west-lamp",-w*.38,5,d*.32,"warm",38);b.light(label+"-east-lamp",w*.38,5,-d*.31,"warm",35);
  }
  function authorLandmarks(b){
    landmark(b,"canton","广州塔 · 小蛮腰",1000,1270,"双端错转椭圆形成真正收腰的钢网格，塔冠与天线形成600米轮廓，塔下是滨江商业广场",function(b){
      publicBase(b,"tower-square",238,210,"ivory");
      b.cylinder("service-core",0,218,0,9.5,436,10.5,"silver",{material:1,wx:2.6,wy:4.2,mask:60319});
      var columns=24,twist=2.83,ringLevels=[0,12,25,39,55,73,91,111,132,154,177,201,225,250,275,301,327,351,375,396,415,430,440,448];
      function outline(f,i){var a=i*Math.PI*2/columns;return [Math.cos(a)*68*(1-f)+Math.cos(a+twist)*45*f,448*f,Math.sin(a)*48*(1-f)+Math.sin(a+twist)*52*f];}
      for(var i=0;i<columns;i++){
        b.beam("outer-column-"+i,outline(0,i),outline(1,i),1.5,i%3===0?"pink":i%3===1?"silver":"teal",{material:14,emission:.35,phase:i*.24});
      }
      ringLevels.forEach(function(y,index){var points=[];for(var j=0;j<columns;j++)points.push(outline(y/448,j));b.ring("waist-ring-"+index,points,.8,index<10?"teal":index<18?"pink":"gold",{material:14,emission:.24,phase:index*.17});});
      b.cylinder("lower-lobby",0,9,0,33,18,27,"glass",{material:1,wx:6,wy:5,mask:65535});
      b.cylinder("observation-floor",0,447,0,46,2.2,53,"silver");
      b.cylinder("observation-glazing",0,456,0,43,15,50,"glass",{material:1,wx:4.8,wy:5.0,mask:65535});
      b.cylinder("observation-roof",0,466,0,43,3,50,"ivory");
      b.cylinder("upper-crown",0,475,0,39,14,43,"gold",{parameter:.92,material:5,glyph:"|"});
      b.cylinder("antenna-lower",0,510,0,5,66,5,"silver",{parameter:.6});
      b.cylinder("antenna-upper",0,569,0,2.4,62,2.4,"ivory",{parameter:.25});
      b.light("red-beacon",0,600,0,"red",10,{emission:1.3});
      b.part("reflecting-pool",-82,.48,45,34,.25,72,"water",{material:3,solid:false});
      b.part("cafe-floor",89,1.5,36,46,3,56,"ivory");b.part("cafe-canopy",89,9,36,53,1.2,64,"gold",{pitch:.03});
      b.glass("cafe-north-front",89,5,8,44,6,.5,"warm",{material:10,wx:6,wy:5.5});
      b.part("south-ticket-office",-61,5,83,28,10,19,"glass",{material:1,wx:6,wy:4.4});
      b.text("square-title","CANTON TOWER",0,7,100,"warm",3.4);
      b.tree("square-palm",-89,-54,[[0,0,0,1,9,.6,.8]],[[1,10,.6,5,1.4,4.7],[-3,9.6,1,3,1.1,4],[4,9.4,-1,3.4,1.1,3]],"leaf");
      b.tree("cafe-camphor",92,-57,[[0,0,0,.2,7,0,.9],[.2,5,0,-3,9,1,.45]],[[0,10,0,5,3,5],[-3,9,1,3.5,3,3.6],[3,11,-2,3.7,2.4,3]],"green");
    },SOURCES.canton);
    landmark(b,"shanghai","上海中心",-1280,-1090,"连续扭转约120度并随高度收分的圆润三叶轮廓，九段空中社区与立面螺旋筋形成整体",function(b){
      publicBase(b,"financial-plaza",242,226,"silver");
      var heights=[0,24,68,126,190,258,330,408,486,556,606,628],levels=[];
      heights.forEach(function(y){var f=y/632,r=65*(1-.45*f);levels.push({y:y,points:G.polygon(r,r*.91,36,f*Math.PI*2/3,function(a){return 1-.14*Math.cos(a*3);})});});
      b.loft("twisting-skin",levels,"blue",{material:1,wx:3.1,wy:4.1,trim:"silver",emission:.2});
      [0,2.0944,4.1888].forEach(function(start,k){for(var i=0;i<heights.length-1;i++){
        var y0=heights[i],y1=heights[i+1],a0=start+y0/632*Math.PI*2/3,a1=start+y1/632*Math.PI*2/3,
          r0=65*(1-.45*y0/632)*(1-.14*Math.cos(start*3)),r1=65*(1-.45*y1/632)*(1-.14*Math.cos(start*3));
        b.beam("spiral-seam-"+k+"-"+i,[Math.cos(a0)*r0,y0,Math.sin(a0)*r0*.91],[Math.cos(a1)*r1,y1,Math.sin(a1)*r1*.91],1.2,"silver",{material:6,emission:.22,solid:false});
      }});
      b.cylinder("roof-crown",0,630,0,28,4,29,"silver");
      b.part("podium-west",-83,12,8,48,24,141,"glass",{material:1,wx:6.8,wy:5.4,trim:"stone"});
      b.part("podium-south",10,9,87,133,18,40,"stone");b.part("podium-roof-garden",10,18.4,87,119,.5,32,"leaf",{material:7});b.part("entry-public-paving",0,.18,124,242,.36,44,"ivory",{material:2,wx:3,wy:3});
      b.text("entry-title","SHANGHAI",0,13,109,"warm",3.1);b.light("lobby-light",-38,5,79,"warm",45);
      b.part("metro-stairs",94,-.2,55,14,3,24,"ink");b.part("metro-canopy",94,4.3,55,17,.6,28,"silver");
    },SOURCES.shanghai);
    landmark(b,"jinmao","金茂大厦",-1500,-890,"八角塔身与有节奏的宝塔式退台逐层上收，尖冠和低层酒店裙房形成独立轮廓",function(b){
      publicBase(b,"hotel-court",182,188,"ivory");
      var tiers=[[0,45,67],[45,36,62],[81,33,57],[114,31,52],[145,29,47],[174,27,42],[201,25,37],[226,23,32],[249,21,28],[270,19,24],[289,17,21],[306,15,18],[321,13,15]];
      tiers.forEach(function(t,i){var points=G.polygon(t[2],t[2],8,Math.PI/8);
        b.loft("pagoda-tier-"+i,[{y:t[0],points:points},{y:t[0]+t[1],points:points}],i<6?"silver":"gold",{material:1,wx:3.0,wy:4.0,trim:"ivory",emission:.16});
        b.ring("tier-cornice-"+i,points.map(function(p){return [p[0]*1.035,t[0]+t[1],p[1]*1.035];}),1.6,"ivory");
      });
      b.cylinder("crown-base",0,342,0,17,18,17,"silver",{parameter:.72,material:5,glyph:"|"});
      b.cylinder("crown-lantern",0,362,0,11,24,11,"gold",{parameter:.63,material:1,wx:2,wy:4,mask:65535});
      b.cylinder("crown-spire",0,398,0,6,46,6,"ivory",{parameter:.03});
      b.part("hotel-wing",79,14,-5,47,28,116,"glass",{material:1,wx:6,wy:4.2});b.part("hotel-dropoff",0,.4,89,119,.6,35,"stone",{material:11});
      b.part("hotel-awning",0,7.7,88,98,1.2,24,"gold");b.text("hotel-title","JIN MAO",0,10,97,"warm",3.4);
    },SOURCES.jinmao);
    landmark(b,"swfc","上海环球金融中心",-1050,-960,"从方形底部向扁窄塔冠收分，顶部保留可飞穿的梯形天窗，几何拱线塑造开瓶器轮廓",function(b){
      publicBase(b,"skywalk-plaza",169,195,"stone");
      var profiles=[[0,56,51],[110,51,48],[220,43,42],[330,32,36],[420,22,29]];
      b.loft("tapered-main",profiles.map(function(a){return {y:a[0],points:G.roundedRectangle(a[1],a[2],4)};}),"glass",{material:1,wx:3.4,wy:4.4,trim:"silver",emission:.2});
      b.loft("west-sky-port-pier",[{y:420,points:[[-22,-29],[-13,-29],[-13,29],[-22,29]]},{y:492,points:[[-24,-24],[-19,-24],[-19,24],[-24,24]]}],"silver",{material:1,wx:2.5,wy:4.2});
      b.loft("east-sky-port-pier",[{y:420,points:[[13,-29],[22,-29],[22,29],[13,29]]},{y:492,points:[[19,-24],[24,-24],[24,24],[19,24]]}],"silver",{material:1,wx:2.5,wy:4.2});
      b.part("sky-port-bottom",0,427,0,32,7,56,"silver");b.part("sky-port-top",0,489,0,48,7,49,"silver");
      b.part("sky-walk-glowing-edge",0,482,25,47,.6,.6,"white",{material:6,emission:.4,solid:false});
      b.part("entry-podium",0,8,76,109,16,45,"stone");b.text("entry-title","WORLD FINANCIAL",0,12,100,"warm",2.6);
      b.light("entry-light",-39,4,96,"warm",36);
    },SOURCES.swfc);
    landmark(b,"pearl","东方明珠",-760,340,"三根主柱、双主球和高处太空舱组成468米轮廓，球体有分层观景环与滨江商业基座",function(b){
      publicBase(b,"pearl-terrace",221,186,"ivory");
      [[-30,-17],[30,-17],[0,35]].forEach(function(p,i){b.cylinder("main-leg-"+i,p[0],105,p[1],5.6,210,5.6,"silver");
        b.beam("inclined-strut-"+i,[p[0]*2,0,p[1]*2],[p[0],78,p[1]],4.5,"ivory");});
      b.ball("lower-sphere",0,110,0,53,47,53,"pink",{material:1,wx:5.2,wy:4.5,mask:61373,trim:"silver"});
      b.cylinder("lower-view-ring",0,116,0,54,5,54,"ivory");
      b.cylinder("central-shaft",0,198,0,9,137,9,"silver",{material:1,wx:3,wy:4.6});
      b.ball("upper-sphere",0,263,0,39,35,39,"pink",{material:1,wx:4.3,wy:4.1,mask:65371,trim:"silver"});
      b.cylinder("upper-view-ring",0,270,0,40,4,40,"ivory");
      b.cylinder("upper-shaft",0,325,0,5.5,99,5.5,"silver");b.ball("space-capsule",0,352,0,14,13,14,"pink",{material:1,wx:3,wy:3.9,mask:65535});
      b.cylinder("antenna",0,418,0,3.2,100,3.2,"ivory",{parameter:.25});
      b.part("riverside-shopping",80,11,24,47,22,105,"glass",{material:1,wx:6.4,wy:5.5});
      b.part("ticket-pavilion",-86,5,32,34,10,57,"gold");b.part("ticket-canopy",-86,11,32,39,1.2,65,"ivory");
      b.text("pearl-title","ORIENTAL PEARL",0,7,86,"warm",3);
    },SOURCES.pearl);
    landmark(b,"pingan","深圳平安金融中心",1150,-865,"倒角石材巨柱沿立面上升并向尖冠收束，层层退开的商业裙房和公共中庭与城市道路相接",function(b){
      publicBase(b,"public-atrium",222,231,"stone");
      var levels=[[0,46],[85,45],[340,42],[495,35],[552,20],[580,11],[600,3]];
      b.loft("tapered-tower",levels.map(function(v){return {y:v[0],points:G.roundedRectangle(v[1],v[1],v[1]*.18)};}),"glass",{material:1,wx:3.1,wy:4.3,trim:"ivory",emission:.2});
      [-1,1].forEach(function(s){[-1,1].forEach(function(t){for(var i=0;i<levels.length-1;i++)b.beam("stone-mega-column-"+s+"-"+t+"-"+i,[s*levels[i][1]*.91,levels[i][0],t*levels[i][1]*.91],[s*levels[i+1][1]*.91,levels[i+1][0],t*levels[i+1][1]*.91],2.5,"ivory");});});
      b.part("podium-lower",0,10,72,175,20,60,"ivory");b.part("podium-mid",0,24,60,141,8,53,"stone");b.part("podium-upper",0,32,48,111,8,44,"silver");
      b.part("podium-public-garden",0,36.4,49,94,.4,35,"leaf",{material:7});
      b.part("west-retail-front",-66,8,96,36,13,.5,"warm",{material:10,wx:6,wy:5.8});
      b.part("east-retail-front",66,8,96,36,13,.5,"warm",{material:10,wx:5.2,wy:5.8});
      b.text("centre-title","PING AN",0,15,104,"warm",3.6);b.light("public-entry-light",0,6,88,"warm",44);
    },SOURCES.pingan);
    landmark(b,"china-zun","北京中国尊",620,-1690,"宽底、纤腰与外张塔冠组成尊形体量，连续圆角立面从街道一直延伸到528米观景顶部",function(b){
      publicBase(b,"zun-court",198,197,"ivory");
      var heights=[0,45,115,205,285,365,440,493,528],radii=[49,44,38,32,31,36,42,49,54];
      b.loft("zun-skin",heights.map(function(y,i){return {y:y,points:G.roundedRectangle(radii[i],radii[i],radii[i]*.22,.025)};}),"blue",{material:1,wx:3.2,wy:4.3,trim:"silver",emission:.22});
      b.ring("flared-crown-rim",G.roundedRectangle(54,54,12,.025).map(function(p){return [p[0],529,p[1]];}),1.5,"ivory");
      b.part("west-entry-canopy",-69,6,0,30,1.5,98,"silver");b.part("east-gallery",68,8,-15,32,16,86,"stone");
      b.part("entry-mirror",-65,.45,57,28,.2,24,"water",{material:3,solid:false});b.text("zun-title","CHINA ZUN",0,10,78,"warm",3.3);
    },SOURCES.zun);
    landmark(b,"cctv","北京央视总部",0,-1540,"两座倾斜塔腿与悬挑连梁形成三维环路，中部城市门洞有真实空隙和交错结构线",function(b){
      publicBase(b,"media-plaza",267,220,"stone");
      b.glass("west-inclined-tower",-69,116,-14,55,233,70,"glass",{roll:-.105,yaw:.07,wx:4.1,wy:4.5,trim:"silver"});
      b.glass("east-inclined-tower",70,94,19,53,190,69,"blue",{roll:.115,yaw:-.05,wx:3.8,wy:4.3,trim:"silver"});
      b.glass("overhanging-top-west",-5,223,-14,144,28,70,"glass",{roll:.025,wx:5.0,wy:4.8,trim:"silver"});
      b.glass("overhanging-top-east",61,205,-5,40,35,115,"glass",{pitch:.11,wx:4.5,wy:4.3,trim:"silver"});
      [[[-102,8,22],[-60,226,25]],[[-59,11,23],[-104,174,24]],[[42,8,54],[94,176,56]],[[94,17,55],[45,185,54]],
        [[-99,64,24],[-56,118,25]],[[-101,174,24],[-53,220,25]],[[44,58,54],[95,111,55]],[[44,150,54],[86,181,55]]].forEach(function(v,i){b.beam("diagrid-"+i,v[0],v[1],1.1,"silver");});
      b.part("low-broadcast-block",-74,11,-86,95,22,53,"stone");b.part("east-news-studio",76,15,88,93,30,49,"glass",{material:1,wx:8,wy:5.5});
      b.part("news-studio-awning",76,8,115,100,1.2,14,"silver");b.text("cctv-title","CCTV",0,9,108,"white",4.4);
    },SOURCES.cctv);
    landmark(b,"raffles","重庆来福士",1950,1450,"八座高低不同的弧面塔楼围合滨江台地，250米高的水晶连廊有开放入口、园林与可飞行的室内空间",function(b){
      publicBase(b,"river-terrace",396,211,"ivory");
      var towers=[[-145,-28,244,28],[-104,18,265,27],[-62,-24,350,28],[-21,20,279,27],[22,-20,271,26],[65,24,345,29],[108,-23,260,27],[151,19,239,26]];
      towers.forEach(function(v,i){var levels=[0,v[2]*.31,v[2]*.66,v[2]],profiles=levels.map(function(y){return {y:y,points:G.roundedRectangle(v[3],23,8).map(function(p){return [p[0]+v[0]+Math.sin(y/v[2]*1.3)*(i<4?-7:6),p[1]+v[1]];})};});
        b.loft("curved-tower-"+i,profiles,i%2?"silver":"glass",{material:1,wx:3.9+i*.1,wy:4.5,trim:"ivory",emission:.19});
        b.part("tower-crown-"+i,v[0]+(i<4?-6:5),v[2]+1,v[1],v[3]*1.85,2,42,"ivory");
      });
      b.part("crystal-floor",0,248,70,348,1.6,27,"ivory",{material:2,wx:2.6,wy:2.7});
      b.part("crystal-north-window",0,256,56,344,14,.7,"teal",{material:10,wx:5.5,wy:4.9,trim:"silver"});
      b.part("crystal-south-window",0,256,84,344,14,.7,"warm",{material:10,wx:5.0,wy:4.9,trim:"silver"});
      var arch=[];for(var i=0;i<13;i++){var a=i*Math.PI/12;arch.push([70+Math.cos(a)*15,262+Math.sin(a)*9]);}
      for(var j=0;j<arch.length-1;j++){var p=arch[j],q=arch[j+1];b.triangle("crystal-roof-"+j+"a",[[-174,p[1],p[0]],[174,p[1],p[0]],[174,q[1],q[0]]],"glass");b.triangle("crystal-roof-"+j+"b",[[-174,p[1],p[0]],[174,q[1],q[0]],[-174,q[1],q[0]]],"glass");}
      [-125,-78,-24,43,113].forEach(function(x,i){b.part("garden-planter-"+i,x,249.8,78,12,2.1,5,"stone");b.ball("garden-canopy-"+i,x,253,78,7,3,3.3,i%2?"green":"leaf",{material:4,solid:false});});
      b.part("crystal-cafe-table",48,249.69,62,3.4,.14,1.2,"warm");b.part("crystal-cafe-table-leg",48,249.20,62,.3,.8,.3,"silver");
      b.part("crystal-cafe-chair",45.7,249.28,62,.65,.16,.65,"pink");b.part("crystal-cafe-chair-back",45.4,249.64,62,.13,.7,.65,"pink");
      b.part("crystal-lounge-seat",-57,249.27,62,9,.74,1.1,"pink");
      b.part("podium-main",0,13,20,384,26,156,"stone");b.part("podium-step-one",0,29,17,359,6,139,"ivory");b.part("podium-step-two",0,35,13,313,6,116,"silver");
      b.text("raffles-title","RAFFLES CITY",0,17,102,"warm",4.1);b.light("podium-lamp",-114,6,104,"warm",44);
    },SOURCES.raffles);
    landmark(b,"opera","广州大剧院",1260,470,"两块不对称的切面巨石面向河岸，开裂峡谷是公共入口，折面玻璃、咖啡庭院和步行台阶连通广场",function(b){
      publicBase(b,"opera-square",255,212,"ivory");
      b.loft("large-pebble",[{y:0,points:[[-99,-44],[-44,-72],[28,-59],[54,-12],[31,42],[-40,54],[-91,21]]},
        {y:27,points:[[-90,-35],[-39,-64],[20,-48],[43,-5],[22,32],[-35,44],[-81,14]]},
        {y:51,points:[[-70,-23],[-33,-40],[10,-32],[28,-1],[7,18],[-33,21],[-66,8]]}],"silver",{material:5,glyph:"/",trim:"ivory"});
      b.loft("small-pebble",[{y:0,points:[[61,-41],[105,-36],[126,-4],[115,35],[72,47],[43,14]]},
        {y:31,points:[[68,-29],[100,-24],[113,-1],[103,23],[78,28],[54,10]]}],"ivory",{material:5,glyph:"/"});
      b.part("main-glazed-canyon",-9,11,52,80,21,.6,"warm",{material:10,wx:7,wy:4.9,trim:"glass"});
      b.part("small-hall-glass",83,10,42,39,19,.6,"glass",{material:10,wx:5.2,wy:4.9});
      b.part("public-stair-low",-11,.8,78,90,1.2,27,"stone");b.part("public-stair-middle",-11,1.6,68,90,.9,16,"silver");b.part("public-stair-high",-11,2.4,59,90,.8,9,"ivory");
      b.part("reflecting-basin",-101,.5,61,35,.2,48,"water",{material:3,solid:false});
      b.text("opera-title","GUANGZHOU OPERA",-9,7,90,"warm",2.8);b.light("canyon-wash",-12,4,63,"warm",40);
    },SOURCES.opera);
  }
  function authorGround(b){
    b.site("city-ground","都市地形",0,0,"五公里尺度的两岸城区、南岸街区与连续河湾，城区边界由山地、湿地和海湾收束",function(b){
      b.part("surrounding-water",0,-1.1,0,10000,.2,10000,"water",{material:3,solid:false});
      b.part("north-west-land",-1180,-1.1,-950,2940,2,3250,[.19,.25,.22],{material:7});
      b.part("north-east-land",1640,-1.1,-950,2340,2,3250,[.19,.25,.22],{material:7});
      b.part("south-land",-70,-1.1,1880,5620,2,1710,[.19,.25,.22],{material:7});
      b.part("main-river",0,-.65,850,6350,.15,350,"water",{material:3,solid:false});
      b.part("north-canal",365,-.65,-1600,150,.15,1120,"water",{material:3,solid:false});
      b.part("canal-mouth",365,-.65,640,150,.15,170,"water",{material:3,solid:false});
      b.part("west-park-earth",-2250,.02,-1000,720,.14,2210,"green",{material:7});
      b.part("south-east-marsh",2290,.03,2320,700,.14,490,"leaf",{material:7});
      b.part("flower-axis-lawn",1020,.04,254,95,.16,672,"green",{material:7});
    });
  }
  function build(){var b=new G.Builder("metro");authorGround(b);Streets.author(b);authorLandmarks(b);Neighborhoods.author(b);Transit.author(b);return b.finish();}
  function district(x,z){for(var i=0;i<DISTRICTS.length;i++){var d=DISTRICTS[i],v=d.bounds;if(x>=v[0]&&x<=v[1]&&z>=v[2]&&z<=v[3])return d.name;}return null;}
  return Object.freeze({build:build,SPAWNS:SPAWNS,DISTRICTS:DISTRICTS,SOURCES:SOURCES,district:district,ROADS:Streets.ROADS,JUNCTIONS:Streets.JUNCTIONS});
});
