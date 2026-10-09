/* Individually composed blocks. Helpers describe components, never choose or clone a building. */
(function(root,factory){var node=typeof module==="object"&&module.exports,api=factory(node?require("./city-shuttle-geometry.js"):root.CityShuttleGeometry);if(node)module.exports=api;if(root)root.CityShuttleNeighborhoods=api;})(typeof window!=="undefined"?window:globalThis,function(G){
  "use strict";
  function site(b,id,name,x,z,description,draw,kind,source){return b.site("block-"+id,name,x,z,description,draw,{kind:kind||"neighborhood",source:source});}
  function paving(b,id,x,z,w,d,tint){b.part(id,x,.18,z,w,.36,d,tint||"stone",{material:2,wx:2.8,wy:3.1});}
  function volume(b,id,x,z,w,d,base,height,tint,options){b.glass(id,x,base+height/2,z,w,height,d,tint,Object.assign({wx:3.7,wy:3.3,trim:"ivory",emission:.12},options));}
  function cornice(b,id,x,z,w,d,y,tint){b.part(id,x,y,z,w,.55,d,tint||"ivory");}
  function plant(b,id,x,z,h,rx,rz,lean,tint,base){b.tree(id,x,z,[[0,0,0,lean,h*.68,.2,.30],[lean,h*.48,.2,-rx*.4,h*.85,rz*.2,.16],[lean,h*.53,.2,rx*.38,h*.88,-rz*.25,.15]],[[lean,h,0,rx,h*.23,rz],[-rx*.4,h*.9,rz*.2,rx*.7,h*.19,rz*.68],[rx*.38,h*.94,-rz*.25,rx*.62,h*.21,rz*.7]],tint||"leaf",base||.36);}
  function bench(b,id,x,z,yaw,tint,base){base=base==null?.36:base;b.part(id+"-seat",x,base+.47,z,2.1,.16,.65,tint||"warm",{yaw:yaw});b.part(id+"-back",x-Math.sin(yaw)*.29,base+.79,z-Math.cos(yaw)*.29,2.1,.65,.13,tint||"warm",{yaw:yaw});[-.78,.78].forEach(function(v,i){b.part(id+"-leg-"+i,x+Math.cos(yaw)*v,base+.22,z-Math.sin(yaw)*v,.12,.44,.5,"silver",{yaw:yaw});});}
  function bin(b,id,x,z){b.part(id+"-body",x,.91,z,.64,1.05,.55,"teal");b.part(id+"-lid",x,1.45,z,.73,.14,.64,"silver");b.part(id+"-opening",x,1.15,z+.283,.4,.20,.04,"ink",{solid:false});}
  function ac(b,id,x,y,z,yaw){b.part(id+"-box",x,y,z,1.0,.7,.47,"silver",{yaw:yaw});b.cylinder(id+"-fan",x+Math.sin(yaw)*.255,y,z+Math.cos(yaw)*.255,.24,.06,.24,"ink",{pitch:Math.PI/2,yaw:yaw,material:5,glyph:"@",solid:false});}
  function balconies(b,id,x,z,width,floors,ys,face){ys.forEach(function(y,i){floors.forEach(function(dx,j){var px=x+dx,pz=z+face*2.1;b.part(id+"-slab-"+i+"-"+j,px,y,pz,width,.22,4.2,"ivory");b.part(id+"-rail-"+i+"-"+j,px,y+.61,pz+face*2.05,width,1.05,.13,"teal",{material:10,wx:1.2,wy:1.4,solid:true});b.part(id+"-divider-"+i+"-"+j,px-width/2,y+.63,pz,.16,1.05,3.8,"stone");});});}
  function storefront(b,id,x,z,w,word,tint){b.part(id+"-front",x,2.55,z,w,4.2,.24,"warm",{material:10,wx:w/3,wy:3.9,trim:"glass",emission:.19});b.part(id+"-awning",x,4.65,z+.9,w+1,.28,2.2,tint||"teal");b.text(id+"-sign",word,x,5.65,z+.2,"warm",Math.min(1.2,w/(word.length+1)));}
  function roofPlant(b,id,x,z,y,w,d){b.part(id+"-bed",x,y+.35,z,w,.7,d,"stone");b.part(id+"-soil",x,y+.73,z,w-.6,.12,d-.6,"leaf",{material:7});}
  function roofService(b,id,x,z,y,shape){b.part(id+"-lift",x,y+2,z,shape[0],4,shape[1],"stone");b.cylinder(id+"-tank",x+shape[0]/2+2.2,y+2.7,z,1.8,5.4,1.8,"silver");ac(b,id+"-cooler",x-shape[0]/2-1.4,y+1,z,0);}
  function busStop(b,id,x,z,yaw,name){var sin=Math.sin(yaw),cos=Math.cos(yaw);paving(b,id+"-pad",x,z,5.8,13);b.part(id+"-roof",x,3.35,z,2.8,.22,9.5,"silver",{yaw:yaw});[-3.8,3.8].forEach(function(t,i){b.cylinder(id+"-post-"+i,x+sin*t,1.84,z+cos*t,.10,3.0,.10,"silver");});b.part(id+"-glass",x-cos*1.15,1.85,z+sin*1.15,.14,2.8,8.8,"blue",{material:16,yaw:yaw,solid:false});bench(b,id+"-bench",x-cos*.55,z+sin*.55,yaw+Math.PI/2,"silver");b.part(id+"-timetable",x-cos*1.37,1.9,z+sin*1.37,.18,2.8,1.2,"white",{yaw:yaw,material:5,glyph:"="});b.text(id+"-name",name,x,3.72,z,"warm",.48);}
  function shell(b,id,x,z,w,d,h,door){paving(b,id+"-floor",x,z,w,d,"ivory");b.part(id+"-roof",x,h+.36,z,w,.6,d,"silver");b.part(id+"-rear",x,h/2+.36,z-d/2,w,h,.55,"stone");b.part(id+"-west",x-w/2,h/2+.36,z,.55,h,d,"stone");b.part(id+"-east",x+w/2,h/2+.36,z,.55,h,d,"stone");[-1,1].forEach(function(s){b.part(id+"-front-"+s,x+s*(w+door)/4,h/2+.36,z+d/2,(w-door)/2,h,.5,"glass",{material:10,wx:3.2,wy:3.1});});b.part(id+"-lintel",x,h-.54,z+d/2,door,1.8,.5,"stone");}
  function pitchedRoof(b,id,x,z,w,d,eave,ridge,tint){var a=[x-w/2,eave,z-d/2],c=[x+w/2,eave,z-d/2],e=[x,eave+ridge,z-d/2],f=[x-w/2,eave,z+d/2],g=[x+w/2,eave,z+d/2],h=[x,eave+ridge,z+d/2];b.triangle(id+"-west-a",[a,e,h],tint);b.triangle(id+"-west-b",[a,h,f],tint);b.triangle(id+"-east-a",[e,c,g],tint);b.triangle(id+"-east-b",[e,g,h],tint);b.triangle(id+"-gable-n",[a,c,e],"ivory");b.triangle(id+"-gable-s",[f,h,g],"ivory");}
  function flower(b){
    site(b,"flower-west-terraces","花城西街 · 退台住居",893,1487,"贴近西街的三栋错层住居，以阳台、屋顶庭院和临街茶馆围合步行轴",function(b){
      paving(b,"court",0,0,115,208);volume(b,"north-long-wing",-3,-53,72,38,.36,42,"ivory");volume(b,"north-setback",-3,-62,58,22,42.36,15,"stone");
      volume(b,"south-stepped-wing",4,41,86,42,.36,34,"silver");volume(b,"south-recessed-storeys",-15,48,42,28,34.36,18,"teal");volume(b,"garden-studio",38,-2,24,40,.36,18,"brick");
      balconies(b,"north-home",-3,-34,6.3,[-24,-8,9,25],[7,13.6,20.2,26.8,33.4,40],1);balconies(b,"south-home",4,62,7.1,[-30,-10,12,30],[7,13.7,20.4,27.1],1);
      storefront(b,"tea",-17,-32,31,"TEA HOUSE","teal");storefront(b,"grocer",34,63,34,"FRESH","gold");cornice(b,"north-coping",-3,-62,60,24,57.8);roofPlant(b,"north-roof-garden",-5,-65,57.9,47,14);roofService(b,"south-roof",-21,48,52.4,[8,6]);
      plant(b,"court-elm",8,-8,8.7,4.3,4.7,.7);plant(b,"corner-camphor",-46,91,10.1,5,4.1,-.5,"green");bench(b,"court-seat",17,4,Math.PI);bin(b,"court-bin",27,5);b.light("entry-lamp",-48,5,-5,"warm",28);
    });
    site(b,"flower-east-arcade","花城东街 · 商住骑廊",1071,1501,"六层短街墙和通透底层骑廊，东西门连通居民庭院，楼上有阳台和晾晒架",function(b){
      paving(b,"arcade-court",0,0,93,195);volume(b,"east-street-wall",30,0,30,153,5.36,26,"ivory");volume(b,"north-turning-wing",-3,-68,40,27,.36,24,"brick");
      b.part("covered-arcade",30,5.2,0,39,.45,159,"silver");[-65,-43,-21,1,23,45,67].forEach(function(z,i){b.cylinder("arcade-pillar-"+i,49,2.8,z,.42,5,.42,"ivory");});
      balconies(b,"south-balconies",30,76.5,5.4,[-9,9],[9,15.6,22.2,28.8],1);b.part("courtyard-shade",-13,4.7,28,35,.3,25,"gold",{pitch:.04});
      storefront(b,"bakery",-2,-54,28,"BAKERY","gold");storefront(b,"books",31,73,27,"BOOKS","teal");roofService(b,"service",30,-50,31.6,[9,7]);ac(b,"north-ac",-5,19,-53,0);
      b.part("drying-rack",31,34.1,36,14,.14,.14,"silver");b.part("white-linen",27,32.8,36,3.1,2.4,.06,"white",{solid:false});b.part("blue-linen",33,33.3,36,2.5,1.5,.06,"blue",{solid:false});
      plant(b,"courtyard-plane",-10,-3,9.3,4.6,4.1,-.3);bench(b,"garden-seat",-10,8,0);bin(b,"south-bin",-19,81);
    });
    site(b,"flower-west-gateway","花城西路 · 双翼公寓",719,1494,"两翼高低不同的公寓与斜面塔冠沿社区路布置，入口有雨棚和便利店",function(b){
      paving(b,"base",0,0,154,202);volume(b,"west-apartment",-38,-31,43,95,.36,76,"stone");volume(b,"east-apartment",30,38,49,92,.36,91,"ivory");
      b.loft("east-angled-crown",[{y:91.36,points:[[5,-8],[55,-8],[55,84],[5,84]]},{y:108,points:[[5,6],[55,6],[45,66],[14,66]]}],"silver",{material:1,wx:3.8,wy:4.2});
      balconies(b,"west-balconies",-38,16.5,6.6,[-12,12],[10,20,30,40,50,60,70],1);balconies(b,"east-balconies",30,84,7.4,[-14,14],[11,24,37,50,63,76,89],1);
      volume(b,"grocery-podium",11,-67,119,26,.36,7,"glass",{wx:7,wy:5});storefront(b,"convenience",16,-53,42,"MART","teal");b.part("arrival-canopy",21,5.3,-20,47,.45,22,"gold");
      roofService(b,"west-services",-38,-52,76.7,[8,10]);plant(b,"street-tree",69,-60,11.1,5.1,4.4,.6,"green");plant(b,"entry-tree",-5,19,8.2,4.4,3.9,-.2);bin(b,"arrival-bin",39,-16);
    });
    site(b,"flower-south-market","南岸邻里菜市场",910,1980,"开放门洞连通的菜市场、分散摊位、沿街药房和屋顶花园，靠近公交与住宅",function(b){
      shell(b,"market-hall",-24,0,78,99,8.4,13);b.part("market-roof-slope",-24,10,0,84,.6,104,"roof",{pitch:-.04});
      [[-49,-30,"green"],[-22,-27,"warm"],[1,-24,"red"],[-46,8,"gold"],[-15,12,"leaf"],[7,17,"pink"]].forEach(function(v,i){b.part("stall-counter-"+i,v[0],1.35,v[1],11,2,5,"ivory");b.part("stall-produce-"+i,v[0],2.44,v[1],9,.22,3.5,v[2],{material:4,solid:false});b.part("stall-canopy-"+i,v[0],4.8,v[1],12,.22,6.4,v[2]);});
      volume(b,"pharmacy-house",41,7,29,72,.36,21,"ivory");storefront(b,"pharmacy",41,43,27,"PHARMACY","teal");pitchedRoof(b,"pharmacy-roof",41,7,33,76,21.7,4,"roof");
      paving(b,"market-arrival",-21,66,82,32);b.text("market-title","NEIGHBOUR MARKET",-24,8.1,50,"warm",2.5);b.light("hall-light-west",-48,6,-8,"warm",26);b.light("hall-light-east",3,6,2,"warm",26);
      plant(b,"market-fig",-59,80,8.8,4.8,4.3,.3);bench(b,"market-seat",-10,76,0);bin(b,"sorting-bin",14,71);
    },"market");
    site(b,"flower-east-housing","花城东路 · 空中花园住区",1258,1859,"三个不同轮廓的住宅、屋顶共享花园和穿行的架空院落构成完整东侧街墙",function(b){
      paving(b,"court",0,0,176,362);volume(b,"north-slim-house",-36,-118,48,87,.36,112,"silver");volume(b,"centre-L-west",-35,-2,50,100,6.6,68,"ivory");volume(b,"centre-L-east",23,29,66,38,6.6,68,"ivory");volume(b,"south-round-house",31,128,65,62,.36,82,"teal");
      [-54,-6,50].forEach(function(x,i){b.cylinder("raised-court-pillar-"+i,x,3.4,12,.65,6,.65,"stone");});b.part("court-covered-floor",-13,6.3,0,100,.5,100,"silver");
      balconies(b,"north-terraces",-36,-74.5,6.8,[-14,14],[12,24,36,48,60,72,84,96,108],1);balconies(b,"south-terraces",31,159,7.4,[-20,0,20],[9,19,29,39,49,59,69,79],1);
      cornice(b,"north-roof",-36,-118,50,90,113);roofService(b,"north-services",-39,-137,113,[9,11]);roofPlant(b,"L-garden",-18,25,75.3,67,22);b.part("garden-pergola",17,79.8,27,19,.35,18,"gold");
      storefront(b,"east-cafe",-27,52,40,"GARDEN CAFE","gold");paving(b,"entry",-76,36,20,70);plant(b,"courtyard-oak",15,-70,12,5.8,5.3,.6,"green");plant(b,"south-camphor",-49,158,10.4,5,4.5,-.7);bench(b,"under-house-seat",-5,18,1.2);bin(b,"under-house-bin",-13,13);
    });
    site(b,"flower-east-hotel","花城东街 · 退台酒店",1280,1480,"低层餐饮面向东街，高层酒店向广州塔逐段退开并以弧冠收束",function(b){
      paving(b,"arrival",0,0,179,231);volume(b,"street-restaurants",-53,32,34,142,.36,14,"brick");volume(b,"hotel-low",13,-22,92,121,.36,73,"silver");volume(b,"hotel-mid",23,-31,68,100,73.36,36,"blue");volume(b,"hotel-high",32,-41,44,70,109.36,29,"glass");
      b.cylinder("oval-crown",32,143,-41,23,9,36,"gold",{parameter:.88});cornice(b,"hotel-low-terrace",13,-22,95,124,74);cornice(b,"hotel-mid-terrace",23,-31,71,103,110);roofPlant(b,"hotel-low-planter",-23,23,74.4,13,68);roofPlant(b,"hotel-mid-planter",1,-14,110.4,10,58);
      storefront(b,"restaurant",-53,103,32,"RIVER DINING","gold");b.part("hotel-dropoff-canopy",8,6.4,59,74,.6,31,"gold");b.text("hotel-name","FLOWER HOTEL",9,11,62,"warm",2.8);plant(b,"dropoff-tree",63,89,9.8,4.6,4.9,-.4);bin(b,"hotel-bin",-5,94);
    });
    site(b,"flower-west-living","南岸西街 · 城市院落",702,1892,"三栋不同高度的院落住居、幼儿园和花园串接西街与社区路",function(b){
      paving(b,"courtyard",0,0,182,343);volume(b,"north-angled-house",-12,-121,119,43,.36,58,"ivory",{yaw:.03});volume(b,"west-long-house",-62,9,31,181,.36,41,"stone");volume(b,"south-terrace-house",-5,133,125,45,.36,68,"silver");volume(b,"nursery",46,-24,39,78,.36,12,"gold");
      balconies(b,"north-south-face",-12,-99.5,7,[-41,-20,2,23,44],[8,18,28,38,48,56],1);balconies(b,"south-front",-5,155.5,7.3,[-42,-21,0,21,42],[8,19,30,41,52,63],1);cornice(b,"south-green-roof",-5,133,128,48,69);roofPlant(b,"south-roof-bed",-18,133,69.3,72,29);roofService(b,"north-roof",-47,-121,58.7,[9,7]);
      plant(b,"central-elm",-3,22,12.2,6.4,5.7,.7);plant(b,"nursery-tree",42,73,8.1,4.2,4.7,-.3,"green");b.part("sandpit",43,28/100,57,22,.3,16,"warm",{material:7});b.part("nursery-slide",50,1.8,54,1.8,.25,5,"red",{pitch:.55});bench(b,"parent-seat",29,45,0);bin(b,"courtyard-bin",10,54);b.text("nursery-title","KIDS",46,9,15,"white",1.3);
    });
    site(b,"flower-south-crescent","南岸社区 · 弧形住宅",1377,2290,"椭圆住宅与低层阶梯住居之间保留口袋公园，轮廓衔接高速而不挡住匝道",function(b){
      paving(b,"community-court",0,0,317,205);b.cylinder("elliptic-apartment",72,48,16,39,95,61,"ivory",{material:1,wx:4.1,wy:3.5,parameter:.92});b.cylinder("elliptic-coping",72,96,16,37,1.3,58,"silver");
      volume(b,"terrace-base",-87,-12,120,84,.36,24,"brick");volume(b,"terrace-second",-99,-30,96,48,24.36,18,"ivory");volume(b,"terrace-top",-116,-34,61,36,42.36,18,"silver");
      balconies(b,"brick-apartment-front",-87,30,7.3,[-42,-21,0,21,42],[7,14,21],1);roofPlant(b,"stepped-garden",-51,-8,42.8,19,31);roofService(b,"terrace-services",-126,-36,60.7,[9,6]);
      plant(b,"garden-tree",-16,31,10.6,5.3,5.1,.2);plant(b,"garden-flowering-tree",13,-56,7.5,4.1,3.9,-.5,"pink");bench(b,"garden-seat",-2,54,0);storefront(b,"laundry",-91,31,31,"LAUNDRY","teal");
    });
    site(b,"flower-north-river-homes","塔西滨江住居",645,1320,"沿河逐渐降低的住宅和临水餐馆，在滨江绿道与生活横街之间形成有厚度的街区",function(b){
      paving(b,"river-court",0,0,237,273);volume(b,"river-west-home",-75,-13,47,134,.36,57,"stone");volume(b,"river-east-home",46,38,65,127,.36,82,"silver");volume(b,"river-north-villa",9,-100,84,31,.36,19,"ivory");
      volume(b,"villa-upper-wing",29,-106,39,20,19.36,9,"roof");balconies(b,"east-home",46,101.5,7.2,[-22,0,22],[9,22,35,48,61,74],1);balconies(b,"west-home",-75,54,6.5,[-13,13],[8,18,28,38,48],1);
      storefront(b,"fish-restaurant",9,-84,38,"RIVER TABLE","gold");roofService(b,"west-service",-75,-45,57.7,[8,9]);roofPlant(b,"villa-garden",-9,-102,19.9,42,16);plant(b,"river-willow",-9,79,10.3,6.4,4.8,1.1);bench(b,"river-court-seat",-7,95,0);
    });
    site(b,"flower-street-life","花城街边设施",0,0,"等车亭、步行轴咖啡桌、垃圾分类、井盖与无障碍入口对应实际人物活动的位置",function(b){
      busStop(b,"flower-stop",1128,1742,0,"TOWER / 12");paving(b,"bus-wait-paving",1124,1742,8,22);bin(b,"bus-bin",1123.8,1748);
      [[977,1468,0],[1023,1543,1.4],[978,1789,Math.PI],[1022,1988,-1.4]].forEach(function(v,i){paving(b,"rest-pad-"+i,v[0],v[1],11,13);bench(b,"axis-seat-"+i,v[0],v[1],v[2]);plant(b,"axis-tree-"+i,v[0]+3.5,v[1]-3,8.8+i*.6,4+i*.23,3.8+i*.19,i%2?.5:-.4);});
      [[1024,1673],[978,1855],[1128,1550],[837,1935]].forEach(function(v,i){bin(b,"street-bin-"+i,v[0],v[1]);});
      [[1148,1804],[824,1880],[1208,1628]].forEach(function(v,i){b.cylinder("manhole-"+i,v[0],.29,v[1],.58,.04,.58,"silver",{material:5,glyph:"+",solid:false});});
      b.part("vending-machine",1025,1.6,1676,1.3,2.5,.9,"red");b.part("vending-glass",1025,1.7,1676.46,1,1.7,.06,"blue",{material:10,wx:.24,wy:.32,solid:false});b.part("drinking-water",1025,.98,1680,.6,1.2,.5,"silver");
    },"street-furniture");
  }
  function financial(b){
    site(b,"financial-northwest","金融北街 · 切角总部",-1590,-1607,"三个切角、错台、斜冠的总部与商业裙房在西大道和北街之间形成街区",function(b){
      paving(b,"headquarters-court",0,0,260,369);b.loft("chamfered-west-office",[{y:.36,points:G.roundedRectangle(39,57,12).map(function(p){return [p[0]-73,p[1]+33];})},{y:168,points:G.roundedRectangle(32,46,10).map(function(p){return [p[0]-80,p[1]+23];})}],"blue",{material:1,wx:3.9,wy:4.0,trim:"silver"});
      volume(b,"east-low-office",49,94,80,105,.36,116,"silver");volume(b,"east-setback-office",61,83,55,82,116.36,38,"glass");volume(b,"north-company",12,-96,155,44,.36,61,"ivory");
      b.loft("north-angled-roof",[{y:61.36,points:[[-65,-119],[89,-119],[89,-73],[-65,-73]]},{y:78,points:[[-52,-114],[72,-114],[63,-86],[-48,-86]]}],"gold");
      volume(b,"retail-link",-1,149,225,36,.36,12,"stone");storefront(b,"north-bank",-27,168,77,"BANK","teal");storefront(b,"office-lunch",59,168,47,"CITY KITCHEN","gold");
      cornice(b,"east-terrace",49,94,83,108,117);roofPlant(b,"east-garden",15,112,117.4,15,57);roofService(b,"north-services",-16,-96,78.6,[9,8]);plant(b,"entry-plane",-5,21,13.8,6.7,6.0,.8);bench(b,"entry-seat",9,37,0);bin(b,"entry-bin",20,37);
    });
    site(b,"financial-northeast","陆家嘴北街 · 弧冠商务楼",-1138,-1652,"圆角双塔、退台商业与一座细长办公室共同衬托上海中心，形成由北向南升高的天际线",function(b){
      paving(b,"office-court",0,0,408,357);b.cylinder("east-oval-office",132,72,7,38,144,57,"teal",{material:1,wx:4.2,wy:4.0,parameter:.86});b.cylinder("east-oval-crown",132,145,7,33,2,49,"ivory");
      volume(b,"west-folded-office",-126,-2,73,132,.36,137,"silver",{yaw:-.08});volume(b,"west-top-wing",-115,-14,47,107,137.36,41,"blue",{yaw:-.08});volume(b,"north-midrise",2,-110,111,61,.36,83,"ivory");volume(b,"north-setback",17,-120,77,39,83.36,27,"stone");
      volume(b,"south-retail-step",-12,124,290,54,.36,16,"ivory");volume(b,"south-upper-step",-18,121,246,43,16.36,12,"glass");roofPlant(b,"south-garden",-4,120,28.8,125,27);storefront(b,"retail-entry",-12,152,71,"RIVERSIDE MALL","gold");
      roofService(b,"north-services",20,-120,111,[11,9]);plant(b,"lunch-tree",-13,19,11.4,5.9,5.2,-.6);plant(b,"entry-oak",50,69,10.1,5.1,4.4,.5,"green");bench(b,"lunch-seat",-14,37,0);b.light("retail-wash",-60,5,153,"warm",33);
    });
    site(b,"financial-trio-infill-west","三件套西侧 · 地标尺度过渡",-1639,-1122,"弧形银行与带翼酒店在超高层脚下形成街墙，低矮街角广场留出三座地标的视线",function(b){
      paving(b,"block-court",0,0,172,417);b.cylinder("bank-ellipse",-12,44,-94,53,87,75,"silver",{material:1,wx:5.2,wy:4.2});volume(b,"bank-roof-wing",-12,-94,51,97,87.6,16,"gold");
      volume(b,"hotel-east-wing",37,125,54,101,.36,123,"ivory");volume(b,"hotel-west-wing",-33,106,53,72,.36,92,"glass");b.part("hotel-roof-link",1,91,106,44,2.8,22,"silver");
      volume(b,"coffee-pavilion",-33,34,49,27,.36,8,"brick");storefront(b,"coffee",-33,48,45,"COFFEE","gold");roofService(b,"hotel-services",35,139,124,[8,10]);roofPlant(b,"bank-roof",-8,-109,104.2,40,58);plant(b,"street-ash",-55,9,10.9,5.4,5.1,.6);bench(b,"coffee-seat",-31,57,0);
    });
    site(b,"financial-trio-infill-east","环球金融中心东侧 · 双折办公楼",-963,-1203,"两段不同转角的办公翼绕开地标广场，沿东大道布置早餐店与入口雨棚",function(b){
      paving(b,"court",0,0,91,302);volume(b,"north-office",-5,-74,55,126,.36,129,"blue",{yaw:.04});volume(b,"south-office",1,63,61,85,.36,74,"silver",{yaw:-.05});
      volume(b,"south-top-step",-11,59,37,72,74.36,24,"glass");cornice(b,"north-roof",-5,-74,58,129,130);b.part("entry-canopy",30,6.1,4,19,.4,47,"gold");storefront(b,"breakfast",1,106,54,"BREAKFAST","teal");roofService(b,"north-mechanical",-6,-96,130.3,[9,8]);roofPlant(b,"south-terrace",18,72,99.3,12,40);plant(b,"entry-birch",26,29,8.1,3.8,4.1,.3);
    });
    site(b,"financial-southwest","陆家嘴南街 · 城市酒店与住宅",-1575,-376,"三栋不同高度的城市酒店和住宅围住小公园，路边有落客雨棚、便利店与理发店",function(b){
      paving(b,"urban-block",0,0,263,420);volume(b,"west-residential",-78,-21,44,197,.36,88,"ivory");volume(b,"north-residential",20,-157,139,38,.36,69,"stone");volume(b,"east-hotel-base",72,51,63,125,.36,132,"glass");volume(b,"east-hotel-top",65,34,47,91,132.36,38,"silver");
      balconies(b,"home-galleries",-78,77.5,6.1,[-12,12],[9,20,31,42,53,64,75,86],1);balconies(b,"north-home-front",20,-138,6.5,[-47,-24,0,23,47],[8,19,30,41,52,63],1);
      volume(b,"south-retail",4,155,149,32,.36,8,"brick");storefront(b,"barber",-26,172,35,"BARBER","teal");storefront(b,"mart",35,172,41,"DAILY","gold");b.part("hotel-awning",56,6,-24,84,.6,23,"gold");roofService(b,"hotel-services",64,36,171,[10,8]);
      b.part("garden-lawn",-6,.42,20,73,.12,119,"green",{material:7});plant(b,"garden-elm",-10,-17,12.2,6.1,5.6,-.7);plant(b,"garden-camphor",10,62,10.9,5.6,6.0,.5);bench(b,"park-seat",-21,45,0);bin(b,"park-bin",-32,45);
    });
    site(b,"financial-southeast","陆家嘴南街 · 步行商业城",-1144,-360,"退台商场、波浪塔冠办公室与社区公寓之间的公共街可以飞穿；裙房连通而不封闭庭院",function(b){
      paving(b,"shopping-court",0,0,365,413);volume(b,"west-retail",-94,-64,80,175,.36,21,"stone");volume(b,"south-retail",-3,133,261,44,.36,17,"ivory");volume(b,"east-office",114,-80,49,114,.36,185,"blue");
      b.loft("office-wave-crown",[{y:185.36,points:G.roundedRectangle(24.5,57,6).map(function(p){return [p[0]+114,p[1]-80];})},{y:207,points:G.roundedRectangle(19,43,5).map(function(p){return [p[0]+118,p[1]-88];})}],"silver",{material:1,wx:3.4,wy:4.1});
      volume(b,"north-apartment",-30,-161,127,37,.36,75,"ivory");balconies(b,"north-balconies",-30,-142.5,6.6,[-40,-20,0,20,40],[9,20,31,42,53,64,73],1);roofPlant(b,"retail-green-roof",-94,-68,22.1,57,131);roofService(b,"apartment-services",-32,-167,76.2,[8,7]);
      storefront(b,"cinema",-21,156,83,"CINEMA","violet");storefront(b,"south-dining",78,156,49,"NOODLES","gold");b.part("public-stair-a",-91,.72,32,49,.8,18,"stone");b.part("public-stair-b",-91,1.31,27,49,.5,9,"silver");plant(b,"plaza-tree",12,9,12.4,6.3,5.7,.4);bench(b,"plaza-seat",12,28,0);
    });
    site(b,"financial-west-residential","西城过渡 · 密度较低的住区",-1965,-1604,"三栋不同年代的住宅与口袋绿地在金融大道和公园之间过渡，高层体量向公园一侧下降",function(b){
      paving(b,"housing-ground",0,0,255,610);volume(b,"north-slab",33,-210,67,147,.36,91,"stone");volume(b,"middle-L-main",-45,0,69,163,.36,62,"ivory");volume(b,"middle-L-foot",19,68,74,35,.36,62,"ivory");volume(b,"south-house",34,214,101,59,.36,46,"brick");
      balconies(b,"north-balconies",33,-136.5,6.8,[-21,0,21],[9,22,35,48,61,74,87],1);balconies(b,"south-balconies",34,243.5,6.6,[-34,-11,11,34],[8,18,28,38],1);pitchedRoof(b,"south-roof",34,214,106,63,47.2,5.3,"roof");roofService(b,"north-services",33,-238,92.1,[9,8]);roofPlant(b,"L-roof-bed",15,68,63,53,24);
      plant(b,"community-plane",36,-57,11.8,6.3,5.4,.7);plant(b,"community-ginkgo",-24,174,12.4,5.2,5.8,-.4,"gold");bench(b,"community-seat",49,-36,0);storefront(b,"community-cafe",22,86,42,"NEIGHBOURS","gold");
    });
    site(b,"financial-west-warehouses","西城厂房改造街区",-1988,-1010,"锯齿采光厂房改作书店、工作室和展厅，旧砖墙与新玻璃办公翼形成清晰的街道层次",function(b){
      paving(b,"creative-ground",0,0,268,462);volume(b,"north-warehouse",-19,-110,155,109,.36,19,"brick",{wx:8,wy:5.4});volume(b,"east-studio",75,44,49,125,.36,64,"glass");volume(b,"south-gallery",-20,163,167,48,.36,13,"ivory",{wx:8,wy:5.4});
      [-165,-127,-89,-51].forEach(function(z,i){b.part("sawtooth-roof-"+i,-19,22,z,162,.45,32,"roof",{pitch:.18});b.part("sawtooth-glazing-"+i,-19,21,z+15,153,3,.35,"warm",{material:10,wx:8,wy:2.4});});
      shell(b,"open-reading-hall",-40,35,97,79,8.2,11);[-71,-47,-23].forEach(function(x,i){b.part("reading-shelf-"+i,x,2.1,24,1.2,3.5,20,"warm",{material:5,glyph:"|"});});b.text("studio-title","ART / BOOKS",-40,7.2,76,"warm",2.6);storefront(b,"gallery",-20,188,62,"CITY GALLERY","teal");
      plant(b,"yard-plane",-73,102,12.9,6.6,5.9,-.6);bench(b,"creative-seat",-41,103,0);b.light("reading-light",-40,6,39,"warm",32);roofService(b,"studio-roof",75,42,65,[9,8]);
    });
    site(b,"financial-river-homes","西岸滨江 · 住宅与公共泳池",-1460,278,"逐段错开的滨江住宅、公共泳池和社区图书馆，向东方明珠与沿河步道留出观景空隙",function(b){
      paving(b,"riverside-community",0,0,452,507);volume(b,"northwest-home",-132,-116,52,148,.36,117,"ivory");volume(b,"northwest-upper",-139,-136,36,101,117.36,21,"silver");volume(b,"northeast-home",110,-135,65,120,.36,96,"stone");volume(b,"southwest-home",-130,89,71,103,.36,72,"silver");volume(b,"southeast-home",132,147,62,92,.36,64,"ivory");
      balconies(b,"northwest-front",-132,-42,7.2,[-16,16],[10,24,38,52,66,80,94,108],1);balconies(b,"northeast-front",110,-75,7.4,[-21,0,21],[8,20,32,44,56,68,80,92],1);balconies(b,"southwest-front",-130,140.5,7.3,[-24,0,24],[8,20,32,44,56,68],1);
      volume(b,"library-wing",20,-37,119,43,.36,13,"brick");b.part("library-broad-roof",20,14.4,-37,128,.6,54,"gold");storefront(b,"library-entry",20,-14,48,"LIBRARY","gold");b.part("outdoor-swim-pool",22,.55,95,58,.15,27,"water",{material:3,solid:false});paving(b,"pool-deck",22,96,78,45,"ivory");b.part("swim-water-surface",22,.57,95,58,.17,27,"water",{material:3,solid:false});
      roofService(b,"northwest-roof",-140,-136,139,[8,10]);plant(b,"river-plane",-10,193,14.1,7,6.8,.8);plant(b,"pool-palm",62,76,10.8,4.7,4.9,-.4);bench(b,"library-seat",18,5,0);bin(b,"pool-bin",58,118);
    });
    site(b,"financial-river-infill","东方明珠西侧 · 连续街墙",-1094,120,"两座弧形办公楼与一栋阶梯公寓把塔群和沿江商业连接起来，屋顶设备与露台明确可见",function(b){
      paving(b,"block-court",0,0,322,651);b.cylinder("north-round-office",-62,63,-210,46,125,62,"blue",{parameter:.91,material:1,wx:4.2,wy:4.1});b.cylinder("south-elliptic-office",46,76,46,42,152,84,"silver",{material:1,wx:3.8,wy:4.0});
      volume(b,"south-apartment-low",-74,235,88,84,.36,45,"ivory");volume(b,"south-apartment-mid",-93,221,49,58,45.36,24,"stone");volume(b,"south-apartment-top",-100,214,33,43,69.36,19,"silver");balconies(b,"terrace-home",-74,277,6.9,[-28,-9,9,28],[8,18,28,38],1);
      volume(b,"north-podium",1,-105,223,49,.36,11,"stone");storefront(b,"office-dining",1,-79,89,"RIVER FOOD HALL","gold");roofPlant(b,"terrace-bed",-40,228,45.9,17,48);roofService(b,"top-services",-100,214,89,[7,8]);plant(b,"lunch-tree",-37,2,11.9,5.6,6.1,-.6);bench(b,"lunch-seat",-31,21,0);
    });
    site(b,"financial-street-life","金融区公共交通与街具",0,0,"公交候车亭、快递柜、共享单车停车架、地下入口与路面井盖对应通勤活动",function(b){
      busStop(b,"financial-stop",-875,-825,0,"LUJIAZUI / 8");paving(b,"financial-wait",-875,-826,7,20);bin(b,"stop-bin",-870,-818);
      b.part("parcel-lockers",-970,.99,-687,7.2,1.9,.8,"gold",{material:5,glyph:"=",wx:.8,wy:.5});b.part("metro-entry-sign",-1276,4.2,-694,6,1.3,.3,"red",{material:8,glyph:"M",emission:.2});b.part("metro-entry-stairs",-1276,.25,-674,14,.5,29,"ink",{material:2,wx:1.8,wy:.8});b.part("metro-entry-canopy",-1276,4,-674,18,.4,32,"silver");
      [-1035,-1027,-1019,-1011].forEach(function(x,i){b.beam("cycle-rack-"+i,[x,.45,-692],[x,1.1,-692],.12,"silver");});[-1189,-1512,-963].forEach(function(x,i){b.cylinder("street-drain-"+i,x,.30,-709,.55,.04,.55,"silver",{material:5,glyph:"+",solid:false});});
    },"street-furniture");
  }
  function arcade(b,id,x,z,width,height,pillarX){b.part(id+"-ceiling",x,height,z,width,.4,6.3,"ivory");pillarX.forEach(function(px,i){b.cylinder(id+"-column-"+i,x+px,height/2+.36,z+2.8,.26,height-.36,.26,"ivory");});}
  function oldtown(b){
    site(b,"oldtown-north-corner","骑楼北街 · 钟楼书铺",-628,1293,"西式钟楼、转角书铺与退台旧公寓沿骑楼北街组成第一处老城街角",function(b){
      paving(b,"courtyard",0,0,157,129);volume(b,"bookstore-body",28,-19,62,42,4.5,15,"ivory",{wx:3.9,wy:3.7});volume(b,"west-residence",-45,10,49,91,.36,24,"brick");volume(b,"clock-tower",25,-38,19,19,19.5,19,"stone");
      arcade(b,"bookstore-arcade",28,4,68,4.5,[-28,-9,11,30]);storefront(b,"books",25,1,42,"OLD BOOKS","teal");pitchedRoof(b,"west-roof",-45,10,54,95,25,5.7,"roof");b.cylinder("clock-face",25,31.8,-28.4,2.6,.20,2.6,"ivory",{pitch:Math.PI/2,material:5,glyph:"+",solid:false});b.cylinder("clock-crown",25,41,-38,12,5,12,"roof",{parameter:.12});
      balconies(b,"west-balcony",-45,55.5,7,[-14,14],[8,15,22],1);b.part("bookstore-upper-balcony",29,12,6,56,.2,3.7,"stone");b.part("bookstore-upper-rail",29,12.6,7.8,56,1,.12,"silver",{material:5,glyph:"|"});ac(b,"bookshop-ac",44,17,3,0);plant(b,"corner-banyan",-5,45,9.9,6.4,5.3,1.1);bench(b,"old-town-seat",13,44,0);
    });
    site(b,"oldtown-market-arcade","骑楼中街 · 鲜货与面馆",-469,1439,"侧向骑廊让行人沿店面通行，面馆、五金铺和菜档各有不同的屋檐、窗台与晾衣细节",function(b){
      paving(b,"street-edge",0,0,75,210);volume(b,"north-noodle-house",3,-70,43,54,.36,14,"ivory");volume(b,"south-hardware-house",7,50,51,85,.36,19,"brick");volume(b,"back-live-wing",29,-13,24,40,.36,23,"stone");
      b.part("west-arcade-ceiling",-28,4.3,-8,13,.4,197,"ivory");[-96,-70,-39,-7,22,56,82].forEach(function(z,i){b.cylinder("west-arcade-column-"+i,-34,2.3,z,.25,3.9,.25,"ivory");});
      b.part("noodle-west-front",-19,2.4,-68,.24,4,42,"warm",{material:10,wx:4.4,wy:3.8});b.part("hardware-west-front",-19,2.4,49,.24,4,66,"warm",{material:10,wx:4.8,wy:3.9});b.part("west-shop-sign",-20,5.4,-62,.25,1.5,35,"gold",{material:5,glyph:"=",emission:.16});
      b.part("market-stall-counter",-30,1.18,8,3.3,1.64,9,"ivory");b.part("vegetables",-30,2.12,8,2.8,.24,8,"green",{material:4,solid:false});b.part("market-fabric-awning",-30,3.7,8,5.8,.15,11,"red");
      pitchedRoof(b,"noodle-roof",3,-70,48,60,14.8,4.8,"roof");pitchedRoof(b,"hardware-roof",7,50,55,91,19.8,5.4,"roof");balconies(b,"hardware-balconies",7,92.5,6.5,[-15,15],[8,15],1);ac(b,"noodle-ac",-18,9,-52,-Math.PI/2);ac(b,"hardware-ac",-19,13,78,-Math.PI/2);b.part("kitchen-chimney",17,17.4,-64,1.4,6,1.4,"brick");
      b.part("drying-line",26,26.3,-13,17,.12,.12,"silver");b.part("drying-shirt",22,25.5,-13,1.7,1.2,.06,"white",{solid:false});bin(b,"market-bin",-29,107);b.light("market-lamp",-31,3.6,28,"warm",21);
    },"market");
    site(b,"oldtown-west-north","骑楼西街 · 红砖院子",-1286,1324,"砖厂宿舍、坡顶小楼与沿北街的修车铺围合大树院子",function(b){
      paving(b,"brick-court",0,0,303,206);volume(b,"north-brick-row",-10,-57,227,33,.36,17,"brick");volume(b,"west-residence",-112,11,29,102,.36,23,"ivory");volume(b,"east-workshop",92,24,64,87,.36,11,"stone");
      pitchedRoof(b,"brick-row-roof",-10,-57,234,39,17.8,4.9,"roof");pitchedRoof(b,"west-home-roof",-112,11,33,108,23.7,4.2,"brick");b.part("workshop-shutter",92,4.6,68,47,7.5,.16,"silver",{material:5,glyph:"=",solid:false});b.text("repair-sign","CYCLE REPAIR",93,9.3,68,"warm",1.6);storefront(b,"north-grocer",-61,-39,38,"GROCER","gold");
      balconies(b,"brick-row-home",-10,-40.5,6.6,[-79,-52,-25,2,29,56,83],[7,13.7],1);roofService(b,"workshop-services",95,35,12,[6,8]);plant(b,"yard-banyan",-31,27,12.8,8.9,7.5,1.4);bench(b,"neighbour-seat",-26,46,0);bin(b,"recycling-bin",57,59);
    });
    site(b,"oldtown-central-north","骑楼北街 · 花窗茶楼",-802,1318,"花窗茶楼、转角客栈与两层老住宅在公交步行道旁形成细密街墙",function(b){
      paving(b,"tea-court",0,0,301,199);volume(b,"tea-main",26,-46,101,52,.36,19,"ivory");volume(b,"tea-rear-wing",64,7,39,61,.36,19,"ivory");volume(b,"west-guesthouse",-98,2,47,103,.36,31,"brick");volume(b,"south-home",-21,64,87,37,.36,14,"stone");
      arcade(b,"tea-front",26,-13,108,4.4,[-48,-25,0,25,48]);storefront(b,"teahouse",23,-17,69,"YUM CHA","gold");pitchedRoof(b,"tea-roof",26,-46,108,58,20.1,6.1,"roof");pitchedRoof(b,"guesthouse-roof",-98,2,53,110,32.1,6.4,"roof");
      balconies(b,"guesthouse-balconies",-98,53.5,6.1,[-13,13],[8,16,24],1);b.part("tea-window-screen",26,13,-18,68,6,.2,"gold",{material:5,glyph:"+",wx:1.8,wy:1.8});ac(b,"guest-ac",-81,26,54,0);plant(b,"tea-court-tree",-32,22,9.4,5.6,5.1,-.7);bench(b,"tea-seat",-30,37,0);
    });
    site(b,"oldtown-east-north","老城北街 · 曲尺住宅",-337,1322,"曲尺公寓、坡顶小学旧楼与一排沿街杂货共同形成混合社区",function(b){
      paving(b,"community-ground",0,0,317,206);volume(b,"west-home",-102,9,38,125,.36,35,"ivory");volume(b,"north-home",-26,-64,186,35,.36,35,"stone");volume(b,"east-old-school",111,-6,54,96,.36,23,"brick");volume(b,"south-shops",16,69,141,31,.36,8,"ivory");
      balconies(b,"north-balcony",-26,-46.5,7,[-61,-30,1,32,63],[8,17,26,33],1);pitchedRoof(b,"old-school-roof",111,-6,60,101,24,7,"roof");storefront(b,"fruit-shop",-20,86,48,"FRUIT","gold");storefront(b,"tailor",53,86,33,"TAILOR","teal");roofService(b,"north-home-roof",17,-64,36.2,[7,6]);
      plant(b,"courtyard-camphor",14,-4,13.1,6.6,6.2,.8);b.part("play-court",26,.43,20,49,.12,44,"green",{material:7});bench(b,"residents-seat",-40,45,0);bin(b,"court-bin",-54,43);
    });
    site(b,"oldtown-river-east","东侧骑楼 · 花窗客栈",96,1324,"弧形转角的客栈、面向河岸的旧住宅与沿街餐馆，为滨江绿道提供日常活动",function(b){
      paving(b,"river-block",0,0,360,205);b.cylinder("corner-inn",111,20,-31,34,39,50,"ivory",{material:1,wx:4.2,wy:3.7});volume(b,"inn-side-wing",48,-49,77,45,.36,27,"stone");volume(b,"west-home",-115,-17,53,121,.36,21,"brick");volume(b,"south-restaurant",-11,62,112,39,.36,11,"ivory");
      pitchedRoof(b,"west-old-roof",-115,-17,58,127,22,5.7,"roof");pitchedRoof(b,"restaurant-roof",-11,62,119,43,12.1,4.4,"roof");balconies(b,"old-house-balconies",-115,43.5,6.6,[-15,15],[7,14],1);storefront(b,"restaurant",-12,83,76,"DIM SUM","gold");b.part("inn-entry-arch",109,5.3,23,16,3,1,"gold");
      plant(b,"river-court-willow",-27,-2,11.5,7.1,5.6,1.1);bench(b,"inn-court-seat",-28,22,0);roofPlant(b,"inn-roof-bed",48,-49,28.1,54,27);ac(b,"restaurant-ac",37,7.9,83,0);
    });
    site(b,"oldtown-west-middle","老城西街 · 里巷住居",-1290,1741,"两条高低不同的里巷住宅、坡屋顶与拱廊围住带晾晒、花盆和石凳的生活院落",function(b){
      paving(b,"laneway-ground",0,0,320,409);volume(b,"north-long-home",-4,-155,223,41,.36,29,"ivory");volume(b,"west-home",-126,-14,34,177,.36,20,"brick");volume(b,"east-home",110,10,45,155,.36,33,"stone");volume(b,"south-home",8,150,209,47,.36,25,"ivory");
      pitchedRoof(b,"north-home-roof",-4,-155,229,47,30.1,5.8,"roof");pitchedRoof(b,"south-home-roof",8,150,216,53,26,4.9,"roof");balconies(b,"north-home-gallery",-4,-134.5,6.7,[-80,-54,-28,-2,24,50,76],[8,17,26],1);balconies(b,"south-home-gallery",8,173.5,6.7,[-70,-42,-14,14,42,70],[7,15,23],1);
      shell(b,"neighbourhood-hall",-15,19,98,62,7.3,10);b.text("community-title","COMMUNITY",-15,6.5,51,"warm",2);plant(b,"old-camphor",-46,94,13.5,8.1,6.8,1.4);bench(b,"community-seat",-25,110,0);roofService(b,"east-services",112,5,34,[7,10]);b.part("hall-noticeboard",37,1.7,57,4.5,2.5,.18,"teal",{material:5,glyph:"=",solid:false});
    });
    site(b,"oldtown-market-middle","老城菜市 · 榕树广场",-814,1744,"有顶菜市、低层转角餐馆与错台旧公寓围合榕树广场，沿中街保留连续骑楼通道",function(b){
      paving(b,"market-square",0,0,335,408);shell(b,"covered-market",-51,-77,143,138,8.5,16);volume(b,"east-terraced-home",119,-13,45,186,.36,38,"ivory");volume(b,"east-terraced-upper",112,-46,31,103,38.36,14,"stone");volume(b,"south-restaurant",-51,148,148,44,.36,14,"brick");
      pitchedRoof(b,"south-eating-roof",-51,148,154,50,14.9,5,"roof");storefront(b,"restaurant",-51,172,82,"NIGHT KITCHEN","gold");balconies(b,"east-home-gallery",119,80,6.6,[-13,13],[8,18,28,37],1);roofPlant(b,"terraced-home-garden",126,29,39,13,58);
      [[-93,-103],[-42,-105],[-89,-46],[-34,-48]].forEach(function(v,i){b.part("market-table-"+i,v[0],1.15,v[1],21,1.6,8,"ivory");b.part("market-produce-"+i,v[0],2.1,v[1],18,.3,6,i%2?"warm":"green",{material:4,solid:false});});
      plant(b,"square-banyan",-13,58,14.8,10.1,8.6,1.5);bench(b,"square-seat-east",11,64,Math.PI/2);bench(b,"square-seat-south",-11,83,0);bin(b,"market-bin",-94,52);b.light("market-light",-48,6,-68,"warm",40);
    },"market");
    site(b,"oldtown-east-middle","旧城东街 · 红砖混合住区",-338,1744,"T形公寓、底层幼儿活动空间和两栋坡顶老楼形成院落，屋顶晾衣与空调表现日常生活",function(b){
      paving(b,"housing-court",0,0,324,410);volume(b,"T-main",-19,-75,192,43,.36,43,"stone");volume(b,"T-stem",-8,12,42,132,.36,43,"ivory");volume(b,"west-old-house",-128,97,38,132,.36,18,"brick");volume(b,"east-old-house",120,89,49,157,.36,25,"ivory");
      balconies(b,"T-front-balconies",-19,-53.5,7.5,[-69,-41,-13,15,43,71],[8,19,30,41],1);pitchedRoof(b,"west-old-roof",-128,97,43,137,19,5.3,"roof");pitchedRoof(b,"east-old-roof",120,89,55,164,26.1,5.9,"roof");volume(b,"kids-club",28,158,103,31,.36,7,"gold");storefront(b,"kids-club-front",28,175,64,"KIDS CLUB","teal");
      roofService(b,"T-services",-33,-75,44.1,[8,7]);b.part("roof-drying-bar",19,46.1,-75,24,.13,.13,"silver");b.part("hanging-quilt",17,44.9,-75,3.4,2.1,.08,"pink",{solid:false});plant(b,"community-plane",-71,29,10.8,6.3,5.7,-.8);bench(b,"kids-parent-seat",27,129,0);
    });
    site(b,"oldtown-southwest","骑楼南街 · 小学与住宅",-1289,2034,"小学教学楼、开放操场与旧住宅并置，校园大门面向南街而不占用道路",function(b){
      paving(b,"school-ground",0,0,318,189);volume(b,"teaching-north",-10,-59,203,35,.36,21,"ivory");volume(b,"teaching-east",99,-7,32,89,.36,21,"stone");b.part("school-awning",-7,5.2,-38,180,.4,5.2,"gold");
      b.part("play-court",-34,.45,16,132,.15,62,"teal",{material:7});b.part("court-central-line",-34,.55,16,.14,.03,59,"ivory",{solid:false});b.cylinder("flag-pole",72,6,59,.09,11,.09,"silver");b.part("school-flag",73.9,10.5,59,3.8,1.9,.08,"red",{solid:false});
      volume(b,"west-old-residence",-126,-1,30,110,.36,29,"brick");pitchedRoof(b,"west-house-roof",-126,-1,35,116,30,5,"roof");b.part("school-gate-west",-30,2.8,76,2,5,2,"stone");b.part("school-gate-east",24,2.8,76,2,5,2,"stone");b.text("school-title","RIVERSIDE SCHOOL",-3,5.5,77,"warm",1.7);plant(b,"school-elm",82,49,9.2,4.8,4.4,.3);bin(b,"school-bin",34,66);
    },"school");
    site(b,"oldtown-south-centre","骑楼南街 · 双院住居",-812,2037,"两座错台住居和中部开放小巷衔接菜市场与南街，前院有修补铺与共享花坛",function(b){
      paving(b,"housing-court",0,0,339,192);volume(b,"west-long-home",-83,-4,71,137,.36,38,"ivory");volume(b,"east-long-home",94,-7,68,142,.36,49,"stone");volume(b,"west-upper-wing",-94,-16,45,86,38.36,14,"brick");volume(b,"east-upper-wing",102,-36,41,78,49.36,17,"silver");
      balconies(b,"west-front",-83,64.5,7.3,[-23,0,23],[8,18,28,37],1);balconies(b,"east-front",94,64,7.1,[-22,0,22],[8,19,30,41],1);storefront(b,"repair",-83,65,51,"REPAIR","gold");storefront(b,"flowers",94,65,46,"FLOWERS","teal");roofPlant(b,"west-terrace",-57,18,39,12,50);roofService(b,"east-top-roof",101,-36,67.1,[7,8]);
      plant(b,"central-magnolia",-1,-27,11.4,5.9,5.5,-.4);bench(b,"yard-seat",-1,24,0);bin(b,"yard-bin",14,28);b.part("shared-flowerbed",-4,58/100,49,47,.5,14,"stone");b.part("flowers",-4,.9,49,44,.22,11,"pink",{material:4,solid:false});
    });
    site(b,"oldtown-southeast","老城南侧 · 斜角公寓与诊所",-327,2038,"折角公寓、老居民楼和底层社区诊所组合，街角雨棚与候诊庭院有清楚的入口",function(b){
      paving(b,"clinic-block",0,0,316,196);volume(b,"north-apartment",-38,-54,169,39,.36,61,"ivory",{yaw:.025});volume(b,"west-apartment",-106,19,39,85,.36,45,"stone");volume(b,"east-old-home",106,-4,47,126,.36,32,"brick");shell(b,"clinic",4,42,100,50,7.6,8);
      b.part("clinic-canopy",4,5.2,73,111,.4,18,"gold");b.text("clinic-title","CLINIC",4,6.4,76,"warm",2);balconies(b,"north-front",-38,-34.5,7.4,[-54,-27,0,27,54],[9,21,33,45,57],1);pitchedRoof(b,"old-home-roof",106,-4,52,132,33,5.4,"roof");roofService(b,"north-roof",-23,-54,62.1,[8,9]);b.light("clinic-light",4,5,39,"warm",26);plant(b,"clinic-oak",-65,48,10.1,5.2,4.8,.6);bench(b,"waiting-seat",-38,73,0);
    },"health");
    site(b,"oldtown-east-south","老城东街 · 院落公寓与小剧场",100,1900,"开放院落、转角小剧场和高低错开的住居连接老城与南岸生活街",function(b){
      paving(b,"east-courtyard",0,0,359,477);volume(b,"north-home",-39,-161,157,47,.36,44,"ivory");volume(b,"east-home",125,-10,39,192,.36,55,"stone");volume(b,"south-home",5,184,206,39,.36,34,"brick");
      balconies(b,"north-home-balconies",-39,-137.5,6.9,[-50,-25,0,25,50],[8,18,28,38],1);balconies(b,"south-home-balconies",5,203.5,6.8,[-71,-43,-15,13,41,69],[7,16,25,33],1);volume(b,"little-theatre",-76,12,107,132,.36,23,"ivory",{wx:9,wy:6});b.loft("theatre-fold-roof",[{y:23.4,points:[[-130,-54],[-22,-54],[-22,78],[-130,78]]},{y:37,points:[[-113,-39],[-40,-39],[-33,61],[-122,61]]}],"gold");
      storefront(b,"theatre-entry",-76,80,64,"THEATRE","violet");roofService(b,"east-services",126,35,56.1,[7,10]);plant(b,"court-elm",24,-23,13.1,7.2,6.4,-.9);bench(b,"theatre-seat",-49,114,0);bin(b,"theatre-bin",-66,118);
    });
  }
  function civic(b){
    site(b,"civic-hospital","北城综合医院",1140,-1818,"门诊、病房、急诊与院内花园相连，入口朝向公共服务大道，裙房退台有真实雨棚",function(b){
      paving(b,"hospital-court",0,0,449,349);volume(b,"north-outpatient",-18,-101,339,53,.36,24,"ivory",{wx:5.6,wy:4.4});volume(b,"west-ward",-136,8,54,139,.36,91,"silver");volume(b,"east-ward",131,24,57,164,.36,112,"blue");volume(b,"south-treatment",-11,110,219,48,.36,41,"ivory");
      volume(b,"east-ward-setback",125,10,43,116,112.36,19,"silver");b.part("arrival-canopy",-13,6.4,-141,258,.6,31,"gold");b.part("emergency-canopy",167,5.6,88,53,.5,21,"red");b.text("hospital-title","CITY HOSPITAL",-18,15,-129,"white",4);b.text("emergency-title","ER",165,7.4,101,"white",2);
      b.part("red-cross-horizontal",134,122,105,14,3,.35,"red",{material:6,emission:.3,solid:false});b.part("red-cross-vertical",134,122,105,3,14,.35,"red",{material:6,emission:.3,solid:false});roofService(b,"ward-roof",126,19,132.2,[10,8]);roofPlant(b,"treatment-roof",-12,114,42.1,184,27);
      b.part("healing-garden",-6,.43,14,161,.12,107,"green",{material:7});plant(b,"garden-ginkgo",-47,24,11.2,5.3,5.7,-.7,"gold");plant(b,"garden-plane",43,-4,12.9,6.6,5.9,.6);bench(b,"family-seat",-15,42,0);bin(b,"hospital-bin",21,-153);b.light("emergency-light",165,4.4,99,"warm",37);
    },"health");
    site(b,"civic-school","北城中学与操场",1170,-1190,"教学楼、图书室、体育馆和开放操场组成完整校园，旗杆、看台与树荫使校园具有生活尺度",function(b){
      paving(b,"campus-ground",0,0,425,322);volume(b,"north-teaching",-33,-93,268,44,.36,27,"ivory");volume(b,"west-lab",-171,0,42,116,.36,23,"stone");volume(b,"east-library",151,4,53,120,.36,18,"brick");volume(b,"south-sports-hall",-90,110,151,42,.36,16,"silver",{wx:8,wy:5});
      b.loft("sports-hall-arched-roof",[{y:16.4,points:[[-167,89],[-14,89],[-14,132],[-167,132]]},{y:25,points:[[-142,94],[-39,94],[-39,125],[-142,125]]}],"gold");b.part("running-court",18,.44,10,192,.14,103,"red",{material:7});b.part("field",18,.54,10,143,.08,69,"green",{material:7});b.part("field-midline",18,.6,10,.15,.04,69,"white",{solid:false});
      [-1,1].forEach(function(s){b.part("goal-top-"+s,18+s*70,2.7,10,.15,.16,7.3,"white");b.part("goal-post-a-"+s,18+s*70,1.6,6.4,.15,2.2,.15,"white");b.part("goal-post-b-"+s,18+s*70,1.6,13.6,.15,2.2,.15,"white");});
      b.cylinder("flagpole",128,7.7,112,.10,14.6,.10,"silver");b.part("flag",130.4,13.2,112,4.8,2.2,.08,"red",{solid:false});b.text("school-name","NORTH CITY SCHOOL",-35,17,-69,"warm",3);plant(b,"school-tree-a",165,119,10.9,5.2,4.8,.3);plant(b,"school-tree-b",-186,-126,9.7,4.6,4.4,-.5);bench(b,"school-seat",100,119,0);roofService(b,"lab-roof",-171,0,24.1,[7,8]);
    },"school");
    site(b,"civic-fire-police","消防站与社区警务",1590,-1708,"车库卷帘、训练塔、消防院与警务大厅分别设计，街道入口面向港区联络路",function(b){
      paving(b,"emergency-yard",0,0,229,496);volume(b,"fire-garage",-14,-105,164,97,.36,14,"brick",{wx:12,wy:5.5});volume(b,"fire-admin",-76,-190,38,59,.36,31,"ivory");volume(b,"training-tower",69,-144,24,31,.36,46,"stone");
      [-64,-22,20,62].forEach(function(x,i){b.part("garage-door-"+i,x,5.3,-56,31,9,.22,"red",{material:5,glyph:"=",solid:false});});b.text("fire-name","FIRE / 119",-12,12,-55,"white",3.1);b.part("garage-apron",-14,.23,-23,176,.1,57,"asphalt",{material:11});
      volume(b,"police-headquarters",16,108,131,118,.36,26,"silver");volume(b,"police-top-wing",41,88,71,77,26.36,14,"blue");shell(b,"police-service-hall",-52,180,76,46,7.3,9);b.text("police-name","POLICE / 110",-45,6.2,204,"warm",1.8);roofService(b,"police-roof",41,88,41.1,[8,7]);plant(b,"yard-tree",-74,36,11.1,5.2,5.6,-.5);bin(b,"yard-bin",-86,64);
    },"emergency");
    site(b,"civic-media-homes","媒体区 · 立体住居",-331,-1667,"一栋曲尺住宅和两座高度不同的公寓沿媒体区生活街布置，沿街餐馆衔接央视总部",function(b){
      paving(b,"media-community",0,0,195,551);volume(b,"north-home",0,-196,153,53,.36,73,"ivory");volume(b,"middle-west-home",-53,-26,45,156,.36,58,"stone");volume(b,"middle-home-foot",2,40,71,35,.36,58,"stone");volume(b,"south-house",9,189,127,53,.36,42,"brick");
      balconies(b,"north-balconies",0,-169.5,7.1,[-49,-24,1,26,51],[9,22,35,48,61,71],1);balconies(b,"south-balconies",9,215.5,6.6,[-41,-20,1,22,43],[8,18,28,38],1);roofPlant(b,"L-roof-garden",-3,40,59.1,56,23);roofService(b,"north-services",-13,-196,74.1,[9,7]);storefront(b,"media-dining",9,217,70,"MEDIA DINING","gold");plant(b,"yard-tree",34,-51,12.3,5.9,5.6,-.6);bench(b,"yard-seat",32,-25,0);
    });
    site(b,"civic-media-north","央视北侧 · 媒体园区",-13,-1849,"两座斜顶工作楼、演播室和公共中庭把高层总部与街道连接起来",function(b){
      paving(b,"media-campus",0,0,325,248);volume(b,"west-editing",-98,-7,50,130,.36,86,"silver");volume(b,"east-editing",103,3,47,151,.36,68,"blue");volume(b,"north-studio",-7,-83,162,43,.36,26,"ivory");
      b.loft("west-sloping-roof",[{y:86.4,points:[[-124,-73],[-72,-73],[-72,60],[-124,60]]},{y:101,points:[[-119,-55],[-79,-55],[-84,43],[-116,43]]}],"gold");volume(b,"east-top-step",107,-12,34,93,68.36,17,"glass");b.part("public-court-lawn",-1,.42,22,110,.12,94,"green",{material:7});storefront(b,"studio-entry",-8,-60,74,"MEDIA STUDIO","teal");
      plant(b,"editing-tree",-27,21,13.8,6.4,6.2,.4);plant(b,"east-tree",36,42,11.3,5.2,5.8,-.5);bench(b,"editing-seat",-18,47,0);roofService(b,"studio-roof",-31,-83,27.1,[9,8]);b.part("communications-mast",104,96,-21,.6,22,.6,"silver");b.ball("satellite-dish",104,100,-21,4.3,2,4.3,"ivory",{pitch:.55});
    });
    site(b,"civic-zun-neighbours","中国尊街区 · 组团总部",716,-1855,"两座较低办公楼与街角商业退台衬托尊形主塔，天际线有明确的主次关系",function(b){
      paving(b,"zun-north-court",0,0,314,235);volume(b,"east-headquarters",108,-1,51,126,.36,193,"silver");volume(b,"east-headquarters-upper",102,-10,38,91,193.36,31,"glass");volume(b,"west-company",-71,-35,75,73,.36,118,"blue");volume(b,"north-podium",-15,-85,186,29,.36,11,"ivory");
      b.cylinder("west-round-crown",-71,123,-35,36,9,36,"gold",{parameter:.76});storefront(b,"north-bank",-18,-70,90,"CITY BANK","teal");roofService(b,"east-services",101,-10,225.1,[8,8]);roofPlant(b,"podium-garden",-11,-85,12.1,145,18);plant(b,"north-oak",29,-20,10.6,5.1,5.6,.4);bench(b,"entry-seat",31,0,0);
    });
    site(b,"civic-north-housing","北城大道 · 高低住区",1174,-2155,"两座圆角住宅与一栋长条公寓在站前大道和高架之间组成连续社区",function(b){
      paving(b,"north-housing-court",0,0,775,209);volume(b,"west-long-residence",-260,0,64,145,.36,79,"ivory");volume(b,"centre-wide-residence",-7,-16,151,62,.36,63,"stone");volume(b,"east-residence",267,8,76,119,.36,97,"silver");
      volume(b,"east-upper-residence",278,-6,49,77,97.36,22,"blue");balconies(b,"west-front",-260,72.5,6.8,[-21,0,21],[9,20,31,42,53,64,75],1);balconies(b,"centre-front",-7,15,7.3,[-51,-26,-1,24,49],[9,21,33,45,57],1);balconies(b,"east-front",267,67.5,7.1,[-25,0,25],[9,22,35,48,61,74,87],1);
      volume(b,"community-retail",126,67,101,31,.36,9,"brick");storefront(b,"station-mart",126,83,67,"STATION MART","gold");roofService(b,"west-roof",-260,-31,80.1,[8,10]);roofPlant(b,"central-green-roof",-4,-14,64.1,114,41);plant(b,"west-yard-tree",-152,17,11.8,5.4,5.9,-.6);plant(b,"east-yard-tree",160,-22,10.3,5.1,4.4,.7);bench(b,"station-seat",-151,35,0);
    });
    site(b,"civic-canal-community","运河西岸 · 口袋住宅",140,-1810,"紧凑的三栋住宅面向运河步道，斜屋顶、小露台和河畔长椅形成连续生活界面",function(b){
      paving(b,"canal-edge",0,0,160,326);volume(b,"north-house",-14,-112,100,41,.36,39,"ivory");volume(b,"middle-house",-31,-6,68,73,.36,56,"stone");volume(b,"south-house",-5,108,104,39,.36,32,"brick");
      balconies(b,"north-front",-14,-91.5,6.5,[-31,-10,11,32],[8,18,28,38],1);balconies(b,"south-front",-5,127.5,6.2,[-32,-10,12,34],[7,15,23,31],1);pitchedRoof(b,"south-roof",-5,108,111,44,33.1,5.1,"roof");roofService(b,"middle-roof",-31,-6,57.1,[7,8]);paving(b,"river-path",69,0,12,310);bench(b,"river-seat",69,27,Math.PI/2);plant(b,"river-willow",55,-68,11.2,5.7,5.3,1.1);
    });
    site(b,"civic-birdnest","北京国家体育场 · 鸟巢",-664,-1650,"椭圆看台、开放球场与交织钢梁形成鸟巢轮廓，外围公共环廊与城市公园相连",function(b){
      paving(b,"stadium-plinth",0,0,411,523,"ivory");var count=48;
      for(var ring=0;ring<8;ring++){var innerX=63+ring*9,innerZ=105+ring*11,outerX=innerX+9,outerZ=innerZ+11,y=2+ring*4.8;for(var i=0;i<count;i++){var a=i*2*Math.PI/count,c=(i+1)*2*Math.PI/count;b.triangle("stand-"+ring+"-"+i+"a",[[Math.cos(a)*innerX,y,Math.sin(a)*innerZ],[Math.cos(c)*innerX,y,Math.sin(c)*innerZ],[Math.cos(c)*outerX,y+4,Math.sin(c)*outerZ]],"red",{material:5,glyph:"="});b.triangle("stand-"+ring+"-"+i+"b",[[Math.cos(a)*innerX,y,Math.sin(a)*innerZ],[Math.cos(c)*outerX,y+4,Math.sin(c)*outerZ],[Math.cos(a)*outerX,y+4,Math.sin(a)*outerZ]],"red",{material:5,glyph:"="});}}
      for(var i=0;i<24;i++){var a=i*2*Math.PI/24,h=48+Math.cos(a*2)*10,foot=[Math.cos(a)*154,.36,Math.sin(a)*215],top=[Math.cos(a+.085)*149,h,Math.sin(a+.085)*208],other=[Math.cos(a+.48)*150,40+Math.cos((a+.48)*2)*10,Math.sin(a+.48)*211];b.beam("main-column-"+i,foot,top,2.5,"silver");b.beam("woven-diagonal-"+i,foot,other,2.1,"silver");b.beam("top-weave-"+i,top,[Math.cos(a+.70)*142,44+Math.cos((a+.7)*2)*10,Math.sin(a+.70)*202],2.4,"ivory");b.beam("upper-inward-strut-"+i,top,[Math.cos(a+.10)*91,39,Math.sin(a+.1)*141],1.6,"silver");}
      [17,31,43].forEach(function(y,index){b.ring("outer-ring-"+index,G.polygon(153-index*2,214-index*3,48).map(function(p){return [p[0],y+Math.cos(Math.atan2(p[1],p[0])*2)*5,p[1]];}),1.8,"silver");});
      for(var i=0;i<48;i++){var a=i*2*Math.PI/48,c=a+.29,d=a-.34,outer=[Math.cos(a)*149,45+Math.cos(a*2)*7,Math.sin(a)*208],inner=[Math.cos(c)*93,37+Math.cos(c*2)*2,Math.sin(c)*142];b.beam("facade-crossing-up-"+i,[Math.cos(a)*154,3.5,Math.sin(a)*215],[Math.cos(c)*150,44+Math.cos(c*2)*7,Math.sin(c)*209],1.0,"ivory");b.beam("facade-crossing-down-"+i,[Math.cos(a)*153,33+Math.cos(a*2)*5,Math.sin(a)*212],[Math.cos(d)*154,9.5,Math.sin(d)*214],1.1,"silver");b.beam("roof-woven-in-"+i,outer,inner,1.0,"ivory");b.beam("roof-woven-out-"+i,outer,[Math.cos(d)*94,38+Math.cos(d*2)*2,Math.sin(d)*143],.9,"silver");}
      b.ring("roof-inner-rim",G.polygon(93,142,48).map(function(p){return [p[0],37+Math.cos(Math.atan2(p[1],p[0])*2)*2,p[1]];}),1.2,"ivory");
      b.cylinder("running-track",0,.45,0,63,.06,105,"red",{material:7});b.part("pitch",0,.55,0,68,.08,105,"green",{material:7});b.part("centre-line",0,.615,0,68,.03,.15,"white",{solid:false});b.ring("centre-circle",G.polygon(9.15,9.15,36).map(function(p){return [p[0],.615,p[1]];}),.10,"ivory",{solid:false});
      [-1,1].forEach(function(s){b.part("goal-bar-"+s,0,3.03,s*52.5,7.32,.12,.12,"white");[-1,1].forEach(function(t){b.part("goal-post-"+s+"-"+t,t*3.60,1.81,s*52.5,.12,2.44,.12,"white");});for(var j=0;j<10;j++)b.beam("goal-net-"+s+"-"+j,[-3.6+j*.8,3,s*52.5],[-3.6+j*.8,.62,s*54],.018,"silver",{solid:false});});
      b.text("stadium-title","BIRD'S NEST",0,8,229,"warm",4);b.light("stadium-wash-a",-131,8,145,"warm",70);b.light("stadium-wash-b",131,8,145,"warm",70);plant(b,"stadium-tree-a",-173,192,10.4,5.1,5.7,.7);plant(b,"stadium-tree-b",173,-171,11.6,5.8,5.2,-.6);
    },"landmark","https://www.herzogdemeuron.com/projects/226-national-stadium/");
  }
  function culture(b){
    site(b,"culture-south-business","文化横街 · 层叠商务街",1212,-205,"两座不同截面的办公楼和退台商业围绕文化轴布置，空中花园、临街商店和步行院落相接",function(b){
      paving(b,"business-court",0,0,397,344);volume(b,"west-office",-111,-25,59,150,.36,161,"silver");volume(b,"west-top-step",-117,-39,40,111,161.36,28,"glass");b.cylinder("east-tri-lobe-office",121,90,-23,46,179,61,"blue",{material:1,wx:4.0,wy:4.2,parameter:.83});
      volume(b,"north-retail",-2,-131,243,41,.36,15,"ivory");volume(b,"south-retail",-3,114,231,55,.36,21,"stone");volume(b,"south-retail-top",-28,107,167,36,21.36,9,"glass");storefront(b,"restaurants",-1,143,107,"FOOD / DESIGN","gold");roofPlant(b,"retail-roof-bed",-13,105,31.1,135,24);roofService(b,"west-office-roof",-117,-39,190.1,[8,10]);
      plant(b,"court-plane",-11,1,13.4,6.8,6.1,-.5);bench(b,"business-seat",-15,22,0);bin(b,"business-bin",6,20);
    });
    site(b,"culture-north-corners","平安商圈 · 错角双塔",1107,-589,"切角金融楼和偏转玻璃楼衬托平安主塔，街边两层餐饮与通透入口形成紧凑街区",function(b){
      paving(b,"office-court",0,0,347,274);b.loft("chamfered-financial",[{y:.36,points:G.roundedRectangle(37,57,12).map(function(p){return [p[0]-99,p[1]-26];})},{y:213,points:G.roundedRectangle(28,41,10).map(function(p){return [p[0]-106,p[1]-35];})}],"silver",{material:1,wx:4.1,wy:4.4,trim:"ivory"});
      volume(b,"east-offset-office",104,-21,63,130,.36,153,"glass",{yaw:.08});volume(b,"east-offset-top",109,-33,43,102,153.36,31,"blue",{yaw:.08});volume(b,"south-dining",-3,87,206,43,.36,10,"brick");storefront(b,"business-dining",-3,110,91,"BUSINESS TABLE","gold");roofPlant(b,"restaurant-roof",-4,87,11.1,164,27);plant(b,"bank-square-oak",-3,17,10.3,5.1,4.8,.5);bench(b,"bank-seat",-1,35,0);
    });
    site(b,"culture-east-living","文化轴东侧 · 街墙住区",1567,-330,"两座住宅和社区商业在文化大道东侧组成生活街墙，阳台、晒台与低层花园使办公区有居民生活",function(b){
      paving(b,"east-court",0,0,197,538);volume(b,"north-home",-3,-174,119,54,.36,82,"ivory");volume(b,"middle-long-home",42,28,45,201,.36,71,"stone");volume(b,"south-home",-13,192,123,45,.36,56,"silver");
      balconies(b,"north-front",-3,-147,7,[-39,-13,13,39],[9,21,33,45,57,69,80],1);balconies(b,"south-front",-13,214.5,7,[-40,-13,14,41],[8,20,32,44,55],1);volume(b,"community-shop",-44,19,39,111,.36,9,"brick");storefront(b,"home-shop",-44,76,35,"DAILY MART","gold");roofPlant(b,"north-green-roof",-3,-174,83.1,83,33);roofService(b,"middle-roof",42,-20,72.1,[8,11]);plant(b,"yard-camphor",-1,91,12.5,5.9,6.3,-.7);bench(b,"yard-seat",-1,112,0);
    });
    site(b,"culture-east-business","东大道 · 三棱商务楼",1569,-1132,"三棱塔冠和水平退台的办公室沿东大道布置，底层咖啡、前庭与绿化衔接港区",function(b){
      paving(b,"business-ground",0,0,201,429);b.loft("triangular-office",[{y:.36,points:[[-69,-129],[70,-108],[11,-18]]},{y:154,points:[[-53,-123],[51,-111],[8,-40]]},{y:173,points:[[-41,-116],[32,-111],[7,-57]]}],"blue",{material:1,wx:4.1,wy:4.2,trim:"silver"});volume(b,"south-stepped-office",-2,89,121,108,.36,76,"stone");volume(b,"south-upper",11,73,82,73,76.36,31,"glass");
      volume(b,"coffee-base",-15,-4,139,39,.36,8,"ivory");storefront(b,"coffee-front",-15,17,68,"WORK CAFE","gold");roofPlant(b,"office-terrace",-38,115,77.1,16,41);roofService(b,"south-services",11,73,108.1,[9,8]);plant(b,"entry-tree",56,32,10.7,5.2,4.7,.4);bench(b,"work-seat",38,32,Math.PI/2);
    });
    site(b,"culture-library-museum","文化轴 · 图书馆与城市博物馆",1250,147,"悬挑图书馆、折面博物馆和开放的下层公共街在大剧院北侧形成文化组团",function(b){
      paving(b,"cultural-square",0,0,309,314);volume(b,"library-west-leg",-88,-58,33,117,.36,16,"stone");volume(b,"library-east-leg",66,-58,31,117,.36,16,"stone");volume(b,"library-upper-hall",-11,-58,194,127,16.36,24,"ivory",{wx:7.5,wy:5});b.part("library-canopy",-11,14.6,19,206,.6,34,"gold");
      b.loft("museum-large",[{y:.36,points:[[-120,57],[-62,25],[34,35],[42,135],[-69,144]]},{y:28,points:[[-104,66],[-48,43],[22,46],[26,123],[-54,128]]},{y:42,points:[[-81,72],[-34,57],[3,61],[2,111],[-48,111]]}],"silver",{material:5,glyph:"/"});
      volume(b,"museum-cafe",91,94,52,79,.36,11,"glass",{wx:6,wy:5});storefront(b,"cafe",91,134,43,"MUSEUM CAFE","gold");b.text("library-title","CITY LIBRARY",-10,30,8,"warm",3.3);plant(b,"library-tree",-98,7,11.3,5.6,4.9,-.5);bench(b,"library-seat",-85,29,0);b.light("under-library-light",-13,10,-25,"warm",42);
    },"culture");
    site(b,"culture-axis-gardens","文化轴绿带与河岸",0,0,"广场树阵、草地、花坛、可通行的运河步桥和河岸座椅把文化建筑连成公共空间",function(b){
      [[1001,-222,9.8,4.3,4.8],[1044,-128,10.7,5,4.7],[1005,1,11.1,4.8,5.2],[1047,154,11.7,5.6,5.0],[1002,294,12.4,5.5,5.8],[1048,424,10.6,5.1,4.9]].forEach(function(v,i){plant(b,"axis-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.5:-.4);bench(b,"axis-seat-"+i,v[0]+5,v[1]+8,0);});
      b.part("canal-footbridge",365,2.9,652,174,.6,12,"ivory");b.part("bridge-west-ramp",273,1.68,652,14,.5,12,"stone",{roll:.17});b.part("bridge-east-ramp",457,1.68,652,14,.5,12,"stone",{roll:-.17});b.beam("bridge-north-rail",[280,4.1,646],[450,4.1,646],.15,"silver");b.beam("bridge-south-rail",[280,4.1,658],[450,4.1,658],.15,"silver");
      b.part("river-rest-platform",1290,.22,648,112,.44,25,"ivory",{material:2});bench(b,"river-seat",1270,649,0);bench(b,"river-seat-east",1309,649,0);bin(b,"river-bin",1318,649);plant(b,"river-plane",1260,638,12.4,5.6,5.4,.7);
    },"park");
  }
  function walkway(b,id,points,width,tint){for(var i=0;i<points.length-1;i++){var a=points[i],c=points[i+1],dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],length=Math.hypot(dx,dy,dz);b.part(id+"-"+i,(a[0]+c[0])/2,(a[1]+c[1])/2,(a[2]+c[2])/2,width,.24,length+.25,tint||"stone",{material:2,wx:2.4,wy:2.7,yaw:Math.atan2(dx,dz),pitch:-Math.asin(dy/length)});}}
  function parks(b){
    site(b,"flower-axis-park","花城步行轴 · 邻里花园",1000,1770,"两侧绿地、曲折小路、咖啡座与喷泉把步行轴变成有人停留的连续公共空间",function(b){
      b.part("west-lawn",-26,.18,9,35,.28,233,"green",{material:7});b.part("east-lawn",27,.18,20,38,.28,235,"leaf",{material:7});walkway(b,"west-garden-link",[[-37,.25,-67],[-20,.25,-30],[-23,.25,61],[-39,.25,97]],3.8);walkway(b,"east-garden-link",[[39,.25,-64],[21,.25,-34],[25,.25,49],[40,.25,98]],3.8);
      [[-35,-76,9.8,4.6,4.4],[-19,-38,10.7,4.8,5.1],[-33,28,11.2,5.3,4.7],[-19,67,9.2,4.5,4.8],[35,-77,10.4,4.9,5.2],[24,-10,11.6,5.7,5.1],[37,49,10.1,4.7,4.9],[22,99,9.6,4.5,4.1]].forEach(function(v,i){plant(b,"garden-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.5:-.3,"leaf",.32);});
      [[-40,-45,0],[20,21,Math.PI/2],[-21,78,0],[38,72,0]].forEach(function(v,i){paving(b,"seat-pad-"+i,v[0],v[1],7,7);bench(b,"garden-seat-"+i,v[0],v[1],v[2]);});
      paving(b,"cafe-terrace",22,-113,39,25);b.cylinder("cafe-table-a",23,1.08,-114,.67,.12,.67,"ivory");b.cylinder("cafe-table-b",32,1.08,-112,.63,.12,.63,"ivory");b.cylinder("table-leg-a",23,.75,-114,.08,.6,.08,"silver");b.cylinder("table-leg-b",32,.75,-112,.08,.6,.08,"silver");bench(b,"cafe-bench",23,-115.15,0);bench(b,"cafe-bench-east",32,-113.15,0);
      b.cylinder("umbrella-mast",27,2.2,-113,.06,3.6,.06,"silver");b.cylinder("umbrella-canopy",27,3.5,-113,3.7,.6,3.7,"gold",{parameter:.05});b.cylinder("fountain-basin",-24,.52,-85,8,.6,8,"silver");b.cylinder("fountain-water",-24,.83,-85,7.4,.06,7.4,"water",{material:3,solid:false});bin(b,"cafe-bin",41,-116);
    },"park");
    site(b,"west-hill-park","山海绿廊 · 山坡公园",-2414,-1350,"山坡、观景平台、坡道和高低错落的林冠形成城市西侧的自然背景，步道与社区相接",function(b){
      b.loft("north-hill",[{y:.08,points:G.polygon(134,305,24)},{y:42,points:G.polygon(112,251,24).map(function(p){return [p[0]-6,p[1]-12];})},{y:98,points:G.polygon(69,154,24).map(function(p){return [p[0]-18,p[1]-47];})},{y:172,points:G.polygon(19,51,24).map(function(p){return [p[0]-25,p[1]-71];})}],"leaf",{material:7});
      walkway(b,"hill-east-trail",[[151,.25,-308],[153,.25,-94],[151,.25,181],[83,.25,326]],5.6);walkway(b,"raised-observation-walk",[[141,.25,-302],[142,12,-207],[138,24,-136],[130,40,-59],[125,51,7]],5.2,"warm");
      b.part("observation-deck",125,51,7,21,.5,19,"warm",{material:2,wx:1.6,wy:1.8});b.beam("deck-east-rail",[135,52.2,-2],[135,52.2,16],.16,"silver");b.beam("deck-south-rail",[115,52.2,16],[135,52.2,16],.16,"silver");
      [[-75,-301,15,7.6,6.4],[-38,-342,17.1,7.4,8.2],[16,-329,14.6,6.4,7.1],[61,-297,16.8,7.1,6.7],[115,-284,14.2,6.3,5.8],[165,-229,13.4,5.6,6.2],[175,-98,16.2,6.7,7.3],[174,45,15.1,6.7,6.4],[168,210,13.9,6.1,6.3],[96,319,14.7,6.2,7.0],[18,357,16.1,7.3,7.0],[-63,323,14.4,6.1,6.9],[-119,261,13.1,5.9,5.8],[-145,117,16.9,7.5,7.1],[-153,-75,15.8,6.5,7.3],[-134,-226,14.8,6.6,6.2]].forEach(function(v,i){plant(b,"forest-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.7:-.8,i%3?"leaf":"green",.09);});
      paving(b,"east-trail-seat-pad",157,43,12,9);bench(b,"trail-seat",157,43,Math.PI/2);paving(b,"trail-bin-pad",145,45,4,4);bin(b,"trail-bin",145,45);b.text("park-sign","HILL / RIVER",151,3.2,-302,"warm",1.1);
    },"park");
    site(b,"west-lake-park","山海绿廊 · 湖畔花园",-2298,-849,"湖面、曲折栈桥、观鸟亭、花圃与高低不同的林冠把公园与金融区串联",function(b){
      b.cylinder("lake",-18,.15,-16,126,.16,131,"water",{material:3,solid:false});walkway(b,"boardwalk",[[-151,.25,-92],[-95,.25,-141],[19,.25,-151],[107,.25,-94],[124,.25,33],[68,.25,127],[-44,.25,149],[-144,.25,90]],5.8,"warm");
      b.part("birdwatch-pavilion-floor",69,.32,126,30,.4,25,"ivory");b.part("pavilion-roof",69,5.4,126,35,.6,31,"gold",{pitch:.05});[[56,116],[82,117],[56,136],[82,136]].forEach(function(v,i){b.cylinder("pavilion-column-"+i,v[0],2.8,v[1],.16,5,.16,"silver");});bench(b,"pavilion-seat",69,133,0,"warm",.52);
      [[-175,-158,13.5,6.4,6.7],[-55,-188,15.2,7.2,6.4],[82,-171,14.1,6.6,6.2],[160,-84,13.7,5.9,6.5],[173,50,15.6,6.9,7.2],[104,167,13.9,6.1,6.7],[-17,184,15.1,7,6.8],[-155,151,14.6,6.7,6.2],[-190,27,16.4,7.8,7.1],[-189,-84,14.5,6.6,6.8]].forEach(function(v,i){plant(b,"lake-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.9:-.7,"leaf",.09);});
      b.part("flowerbed-west",-163,.31,38,27,.45,57,"stone");b.part("flowers-west",-163,.6,38,24,.24,53,"pink",{material:4,solid:false});paving(b,"trail-pad",164,107,14,11);bench(b,"lake-seat",164,107,Math.PI/2);bin(b,"lake-bin",154,112);
    },"park");
    site(b,"west-playground","山海绿廊 · 亲子运动公园",-2318,-346,"儿童攀爬、滑梯、秋千、篮球与社区咖啡馆共享绿荫，不把公园做成空白草坪",function(b){
      b.part("park-lawns",0,.16,0,403,.24,480,"green",{material:7});paving(b,"playground-pad",-84,-58,102,96);paving(b,"basketball-pad",79,-112,125,86);paving(b,"swing-pad",-13.5,32,25,28);paving(b,"parent-seat-pad",-46,-26,8,7);paving(b,"swing-parent-pad",7,44,8,7);paving(b,"tai-chi-pad",44,-10,28,22);paving(b,"cafe-terrace",-78,115,119,93);
      walkway(b,"south-walk",[[-142,.25,181],[158,.25,181]],8);walkway(b,"garden-link",[[7,.25,181],[7,.25,52],[7,.25,-26],[24,.25,-73],[24,.25,-159]],5.5);walkway(b,"play-link",[[-85,.25,-27],[-46,.25,-26],[7,.25,-26]],4);walkway(b,"cafe-link",[[-78,.25,181],[-78,.25,157]],6);
      b.part("basketball-court",79,.43,-112,115,.14,76,"teal",{material:7});b.part("court-centre-line",79,.53,-112,.15,.04,72,"ivory",{solid:false});[-1,1].forEach(function(s){b.part("basket-post-"+s,79+s*52,2.4,-112,.15,4,.15,"silver");b.part("backboard-"+s,79+s*50,3.8,-112,.12,1.25,2.15,"ivory");b.cylinder("basket-rim-"+s,79+s*49,3.5,-112,.40,.10,.40,"red",{solid:false});});
      b.part("sand-area",-84,.4,-58,72,.12,57,"warm",{material:7});b.part("play-tower-floor",-85,2.3,-54,8,.3,7,"red");[[-88,-56],[-82,-56],[-88,-51],[-82,-51]].forEach(function(v,i){b.cylinder("play-tower-post-"+i,v[0],1.5,v[1],.14,2.4,.14,"silver");});b.part("slide",-85,1.5,-46,2,.22,9,"gold",{pitch:.35});b.beam("climbing-a",[-101,.5,-66],[-101,3.3,-66],.14,"silver");b.beam("climbing-b",[-96,.5,-66],[-96,3.3,-66],.14,"silver");[.9,1.5,2.1,2.7,3.3].forEach(function(y,i){b.beam("climb-rung-"+i,[-101,y,-66],[-96,y,-66],.10,"teal");});
      b.beam("swing-frame-a",[-18,.36,32],[-16,3.8,32],.14,"silver");b.beam("swing-frame-b",[-9,.36,32],[-11,3.8,32],.14,"silver");b.beam("swing-top",[-16,3.8,32],[-11,3.8,32],.14,"silver");
      shell(b,"park-cafe",-78,115,96,70,6.8,12);b.part("cafe-roof",-78,8,115,103,.6,78,"gold",{pitch:.06});b.text("cafe-title","PARK CAFE",-78,5.8,151,"warm",2);b.light("cafe-light",-74,4.8,134,"warm",29);bench(b,"parent-bench",-46,-26,0);bench(b,"swing-parent-seat",7,44,Math.PI/2);bin(b,"playground-bin",-45,26);
      [[-159,-155,13.3,6.3,6.5],[168,-28,12.7,5.9,6.8],[160,126,11.8,6,5.6],[60,193,14.2,7,6.3],[-161,159,12.9,6.1,5.8],[-176,23,13.1,6.8,6.2],[36,-214,11.9,5.4,5.9],[-52,57,9.7,4.6,5.1],[34,68,10.2,5.2,4.8],[63,24,11.1,5.8,5.3],[-117,29,12.4,5.5,6.2],[104,83,11.5,5.3,5.9],[-20,-145,10.6,5.4,5.1],[106,145,10.2,4.9,5.2]].forEach(function(v,i){plant(b,"play-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.7:-.5,"leaf",.28);});
    },"park");
    site(b,"west-river-garden","西岸滨江 · 湿地植物园",-2270,297,"步行环线、温室、低洼湿地与观江平台把山海绿廊接到北岸跑步道",function(b){
      b.part("wetland-soil",-5,.13,21,531,.18,365,"green",{material:7});b.cylinder("wetland-water",-55,.17,9,142,.12,95,"water",{material:3,solid:false});walkway(b,"wetland-boardwalk",[[-180,.25,-148],[-67,.25,-131],[67,.25,-98],[193,.25,-41],[155,.25,134],[11,.25,183],[-145,.25,152]],5.5,"warm");
      shell(b,"greenhouse",119,-136,100,77,8.2,10);b.part("greenhouse-glass-roof",119,9.2,-136,108,.3,81,"glass",{material:16,pitch:.06,solid:false});b.part("greenhouse-front-glass",119,4.5,-97,96,7.8,.2,"blue",{material:16,solid:false});plant(b,"greenhouse-tree",132,-144,6.5,3.3,3.4,-.2,"green",.36);
      [[-221,-181,15.8,7,7.4],[-179,-91,11.9,6,5.8],[-211,71,15.2,7.1,6.6],[-92,184,13.7,6.4,6.1],[93,203,14.4,6.8,6.5],[225,113,15.1,6.6,6.9],[238,-14,14.2,6.5,6.1]].forEach(function(v,i){plant(b,"wetland-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.8:-.7,"leaf",.23);});
      paving(b,"view-platform",49,297,117,27);bench(b,"view-seat",30,296,0);bench(b,"view-seat-east",64,296,0);bin(b,"view-bin",87,293);
    },"park");
    site(b,"southeast-wetland","东南湿地 · 栈道与观鸟屋",2224,2400,"连续栈道跨过水池与芦苇，低矮观鸟屋和社区绿道连接河口居住区",function(b){
      b.cylinder("pond",7,.16,17,169,.12,107,"water",{material:3,solid:false});walkway(b,"boardwalk",[[-188,.25,-106],[-122,.25,-59],[-39,.25,-82],[65,.25,-46],[189,.25,1],[167,.25,98],[49,.25,145]],5.2,"warm");
      shell(b,"bird-hide",147,104,45,31,4.9,6);b.part("bird-hide-sloping-cap",147,6,104,51,.5,38,"roof",{pitch:.08});b.part("view-slot",147,2.5,120,33,1.1,.12,"ink",{solid:false});bench(b,"hide-seat",145,115,0);b.text("hide-title","WETLAND",147,4.2,121,"warm",1.4);
      [[-174,-151,10.2,5,4.4],[-71,-146,11.3,5.4,5.1],[74,-146,12.1,5.9,5.5],[211,-95,10.7,4.8,5.2],[214,138,11.8,5.6,5.1],[-154,145,10.6,5.3,4.9],[-211,16,12.2,6.1,5.9]].forEach(function(v,i){plant(b,"wetland-tree-"+i,v[0],v[1],v[2],v[3],v[4],i%2?.6:-.4,"leaf",.11);});
      [[-92,-15],[-11,-37],[68,63],[134,15],[-89,81]].forEach(function(v,i){b.ball("reed-bed-"+i,v[0],.8,v[1],18,1.2,10,"gold",{material:4,solid:false});});bin(b,"entry-bin",-181,-101);
    },"park");
  }
  function harbor(b){
    site(b,"port-north-logistics","东港仓储与分拣中心",2051,-1695,"两座不同断面的物流仓库、办公楼、装卸雨棚和货柜组成港区北部的作业院落",function(b){
      paving(b,"logistics-yard",0,0,539,542,"asphalt");volume(b,"west-sorting-hall",-120,-43,168,339,.36,21,"ivory",{wx:14,wy:6});volume(b,"east-warehouse",116,31,162,307,.36,27,"silver",{wx:13,wy:6});volume(b,"north-office",20,-225,245,39,.36,41,"glass");
      b.part("west-sawtooth-roof-a",-120,23,-145,175,.5,125,"roof",{pitch:.045});b.part("west-sawtooth-roof-b",-120,25,-35,175,.5,108,"roof",{pitch:.065});b.part("west-sawtooth-roof-c",-120,27,71,175,.5,109,"roof",{pitch:.08});pitchedRoof(b,"east-gabled-roof",116,31,169,312,28,8.6,"roof");
      [-142,-79,-16,47,110].forEach(function(z,i){b.part("west-loading-door-"+i,-34,6.4,z,.15,10,25,"teal",{material:5,glyph:"=",solid:false});b.part("loading-platform-"+i,-22,1.4,z,23,2.1,31,"stone");});b.part("loading-canopy",-25,8.2,-14,31,.45,309,"gold");
      [[-202,190,18,2,"red"],[-150,191,22,1,"teal"],[-92,204,15,3,"silver"],[7,204,29,2,"blue"],[70,220,19,1,"gold"]].forEach(function(v,i){b.part("outgoing-container-"+i,v[0],v[3]*1.3+.36,v[1],v[2],v[3]*2.6,11,v[4],{material:5,glyph:"|"});});roofService(b,"office-services",20,-225,42.1,[12,8]);b.text("logistics-title","EAST PORT LOGISTICS",18,14,-204,"warm",4);bin(b,"yard-bin",-235,215);
    },"industry");
    site(b,"port-south-industry","东港制造与维修街区",2025,-344,"锯齿厂房、维修库、工人餐厅与低层宿舍在生活横街南侧形成完整工业街区",function(b){
      paving(b,"industrial-yard",0,0,491,867,"asphalt");volume(b,"north-manufacturing",-100,-254,164,276,.36,28,"ivory",{wx:12,wy:6});volume(b,"east-repair-hall",108,-108,165,300,.36,18,"silver",{wx:12,wy:6});volume(b,"south-worker-home",-88,295,163,91,.36,38,"stone");volume(b,"south-canteen",119,327,131,78,.36,10,"brick");
      [-354,-279,-204,-129].forEach(function(z,i){b.part("factory-tooth-roof-"+i,-100,31.2,z,171,.6,70,"roof",{pitch:.12});b.part("factory-skylight-"+i,-100,30.8,z+32,165,5,.25,"glass",{material:10,wx:10,wy:4.2});});pitchedRoof(b,"repair-hall-roof",108,-108,170,306,19.1,7,"roof");
      balconies(b,"worker-home-gallery",-88,340.5,7.3,[-55,-28,-1,26,53],[8,18,28,37],1);storefront(b,"canteen",119,367,85,"WORKERS TABLE","gold");roofService(b,"worker-home-roof",-111,295,39.1,[8,9]);plant(b,"canteen-shade",7,312,11.6,6.1,5.3,.6);bench(b,"canteen-seat",5,336,0);
      b.part("repair-inspection-bay",92,.42,110,129,.2,130,"stone",{material:2});b.part("factory-stack",-121,37.5,-73,9,75,9,"brick");b.cylinder("stack-mouth",-121,76,-73,5.2,2,5.2,"ink");b.text("repair-title","PORT REPAIR",108,12,43,"warm",3);bin(b,"workshop-bin",183,74);
    },"industry");
    site(b,"port-crane-yard","东港集装箱码头",2826,-1490,"岸吊、门式起重机、不同装载高度的货柜和伸向海湾的泊位体现实际港口层次",function(b){
      paving(b,"quay",-55,0,161,1320,"asphalt");b.part("quay-wall",19,-1.4,0,10,3.4,1340,"stone");
      [-390,-30,338].forEach(function(z,i){b.beam("crane-west-leg-"+i,[-120,.36,z-42],[-68,67,z-18],2.2,"gold");b.beam("crane-east-leg-"+i,[-22,.36,z+43],[-68,67,z+18],2.2,"gold");b.beam("crane-crosshead-"+i,[-68,66,z-65],[-68,66,z+65],3,"gold");b.beam("crane-mast-"+i,[-68,66,z],[-75,102,z],2.1,"gold");b.beam("crane-seaward-boom-"+i,[-68,71,z],[83,71,z],2.4,"gold");b.beam("crane-landward-boom-"+i,[-68,71,z],[-132,71,z],2.4,"gold");b.beam("crane-seaward-cable-"+i,[-75,102,z],[82,72,z],.28,"silver");b.beam("crane-land-cable-"+i,[-75,102,z],[-132,72,z],.28,"silver");b.part("crane-cabin-"+i,-54,67,z+8,9,7,8,"glass",{material:1,wx:3,wy:3});});
      [[-160,-535,37,3,"blue"],[-161,-452,48,2,"red"],[-161,-277,39,4,"silver"],[-159,-166,51,2,"teal"],[-161,130,45,3,"gold"],[-161,244,34,1,"brick"],[-163,491,52,3,"blue"],[-164,587,41,2,"red"]].forEach(function(v,i){b.part("container-stack-"+i,v[0],v[3]*1.3+.36,v[1],v[2],v[3]*2.6,41,v[4],{material:5,glyph:"|"});});
      b.part("dock-service-office",-100,8.4,584,58,16,61,"ivory",{material:1,wx:5,wy:4});b.text("port-title","EAST PORT",-101,13,616,"warm",3.1);b.light("quay-light",-24,14,154,"warm",70);
    },"port");
    site(b,"port-utilities","港区供水与能源设施",2599,102,"变电设备、净水池、储罐与控制楼组成港区基础设施，设备管道有明确连接关系",function(b){
      paving(b,"utility-yard",0,0,177,488,"asphalt");b.cylinder("water-tank-north",0,13,-137,54,25,54,"silver");b.cylinder("water-tank-south",-14,10,36,47,19,47,"ivory");b.cylinder("tank-dome",0,26,-137,54,7,54,"silver",{parameter:.45});volume(b,"control-house",15,170,101,59,.36,17,"stone");
      b.beam("tank-connecting-pipe",[39,2,-121],[41,2,161],1.1,"teal");b.beam("north-pipe-branch",[3,2,-104],[41,2,-104],1.1,"teal");b.beam("south-pipe-branch",[0,2,59],[41,2,59],1.0,"teal");[-65,-8,49].forEach(function(x,i){b.part("transformer-"+i,x,2.8,-43,15,4.8,22,"silver",{material:5,glyph:"|"});b.cylinder("insulator-"+i,x,6.1,-43,1,2.1,1,"ivory",{material:5,glyph:"="});});b.text("utility-title","WATER / POWER",15,12,201,"warm",2.1);roofService(b,"control-roof",16,173,18.1,[9,8]);
    },"infrastructure");
    site(b,"port-construction","东港更新 · 建筑工地",1569,303,"尚未完成的楼层、塔吊、脚手架和材料堆表现城市持续建设，围挡留出街道通行",function(b){
      paving(b,"building-yard",0,0,201,327,"asphalt");[-56,-24,8,40,72].forEach(function(x,i){[-93,-41,11,63].forEach(function(z,j){b.part("concrete-column-"+i+"-"+j,x,28,z,1.8,55,1.8,"stone");});});[6,14,22,30,38,46,54].forEach(function(y,i){b.part("floor-slab-"+i,9,y,-17,140,.7,164,"silver");});
      b.part("unfinished-core",16,39,-63,29,78,27,"stone");b.beam("tower-crane-mast",[-74,.36,-108],[-74,94,-108],2.1,"gold");b.beam("tower-crane-jib",[-137,93,-108],[43,93,-108],1.6,"gold");b.beam("tower-crane-stay-a",[-74,105,-108],[-136,94,-108],.25,"silver");b.beam("tower-crane-stay-b",[-74,105,-108],[42,94,-108],.25,"silver");b.part("crane-cabin",-66,91,-108,7,6,6,"glass",{material:1});
      b.part("materials-bricks",-45,1.1,115,43,1.6,19,"brick",{material:5,glyph:"="});b.part("materials-steel",35,1.2,109,55,1.7,15,"silver",{material:5,glyph:"|"});b.part("north-hoarding",0,1.65,-159,194,2.6,.24,"teal",{material:5,glyph:"|"});b.part("west-hoarding",-95,1.65,0,.24,2.6,317,"teal",{material:5,glyph:"|"});b.text("site-title","CITY IN PROGRESS",2,2.3,157,"warm",2.1);
    },"construction");
  }
  function airport(b){
    site(b,"airport-terminal","西湾空港 · 航站楼",-1878,1760,"流线屋顶、开放候机厅、登机廊与落客雨棚连接跑道、空港大道和公共交通",function(b){
      paving(b,"terminal-ground",0,0,318,787,"ivory");paving(b,"terminal-main-floor",-8,0,188,416,"ivory");b.part("east-glass-facade",86,8.4,0,.15,15.8,404,"blue",{material:16,solid:false});b.part("west-glass-facade",-102,8.4,0,.15,15.8,404,"blue",{material:16,solid:false});
      [-1,1].forEach(function(end){[-1,1].forEach(function(side){b.part("end-glass-"+end+"-"+side,-8+side*52.75,8.4,end*208,82.5,15.8,.15,"blue",{material:16,solid:false});});b.part("end-lintel-"+end,-8,16.6,end*208,188,.6,.5,"silver");});
      [-194,-110,-30,51,131,198].forEach(function(z,i){[-99,82].forEach(function(x,j){b.cylinder("hall-column-"+i+"-"+j,x,8.8,z,.42,16.88,.42,"ivory");});});
      var roof=[[-116,17],[-94,22],[-59,27],[-7,30],[43,28],[83,23],[110,17]];for(var i=0;i<roof.length-1;i++){var a=roof[i],c=roof[i+1];b.triangle("wing-roof-"+i+"a",[[a[0],a[1],-220],[c[0],c[1],-220],[c[0],c[1],220]],"silver");b.triangle("wing-roof-"+i+"b",[[a[0],a[1],-220],[c[0],c[1],220],[a[0],a[1],220]],"silver");}
      [-194,-110,-30,51,131,198].forEach(function(z,row){for(var i=0;i<roof.length-1;i++){var a=roof[i],c=roof[i+1];b.beam("roof-rib-"+row+"-"+i,[a[0],a[1]-.4,z],[c[0],c[1]-.4,z],.3,"ivory");}});
      b.part("arrival-canopy",131,7.3,0,54,.45,440,"gold",{roll:.045});[-173,-84,7,97,181].forEach(function(z,i){b.part("boarding-bridge-"+i,-185,6.2,z,160,3.5,7,"silver",{material:1,wx:4.8,wy:2.8});b.part("boarding-bridge-leg-"+i,-153,3,z,1.6,5.5,1.6,"stone");});
      volume(b,"north-service-wing",-19,-294,220,71,.36,12,"ivory");volume(b,"south-service-wing",-25,300,209,65,.36,11,"stone");b.text("terminal-title","WEST BAY AIRPORT",-8,11,209,"warm",3.4);b.text("arrival-title","ARRIVALS",-28,6.5,333,"warm",2.4);
      [-110,-40,31,102,172].forEach(function(z,i){bench(b,"terminal-seat-"+i,44,z,Math.PI/2,"silver");});b.part("check-in-counter",-19,1.6,-167,81,2.4,3.4,"ivory");b.part("departure-board",-15,9.1,-168,43,4,.2,"ink",{material:5,glyph:"=",emission:.1});b.light("terminal-light-a",-13,12,-61,"warm",68);b.light("terminal-light-b",-13,12,113,"warm",68);
      [-110,-40,31,102,172].forEach(function(z,group){[-70,-55].forEach(function(x,row){for(var seat=0;seat<10;seat++){var pz=z+(seat-4.5)*1.08,id="waiting-"+group+"-"+row+"-"+seat;b.part(id+"-seat",x,.91,pz,.68,.16,.92,"blue");b.part(id+"-back",x-.31,1.24,pz,.12,.68,.92,"blue");b.part(id+"-foot",x,.56,pz,.35,.40,.13,"silver");b.part(id+"-arm",x,1.08,pz+.44,.64,.08,.06,"silver");}});b.text("gate-name-"+group,"GATE A"+(group+1),-69,4.3,z-8,"warm",.75);});
      [-51,-33,-15,3].forEach(function(x,i){b.part("counter-screen-"+i,x,3.2,-167,1.2,.82,.10,"blue",{material:6,emission:.4});b.text("check-in-number-"+i,"0"+(i+1),x,5.1,-168,"warm",.67);[-1,1].forEach(function(s){b.cylinder("queue-post-"+i+"-"+s,x+s*3,1.14,-157,.07,1.56,.07,"silver");});b.beam("queue-belt-"+i,[x-3,1.65,-157],[x+3,1.65,-157],.035,"teal",{solid:false});});
      shell(b,"hall-coffee-kiosk",-57,195,38,20,4.1,5);b.text("coffee-kiosk-name","COFFEE",-57,3.5,205.2,"warm",.72);b.part("information-desk",-19,1.23,32,11,1.74,4.2,"stone");b.text("information-name","INFORMATION",-19,4.7,30,"warm",.56);b.part("info-screen",-20,2.48,32,1.6,.97,.11,"blue",{material:6,emission:.45});
      [[44,-37],[-70,34],[-55,104]].forEach(function(v,i){b.part("luggage-"+i,v[0]+.9,.81,v[1],.42,.83,.57,["red","gold","teal"][i]);b.part("luggage-handle-"+i,v[0]+.9,1.38,v[1],.29,.30,.06,"silver");});
    },"airport");
    site(b,"airport-runway","西湾空港 · 跑道与滑行道",-2305,1910,"带中线、阈值、编号、边灯的长跑道和相连滑行道让机场成为可辨识的城市交通设施",function(b){
      b.part("runway",0,.12,0,67,.24,1110,"asphalt",{material:11});b.part("taxiway",116,.11,0,19,.22,1080,"asphalt",{material:11});walkway(b,"taxi-link-north",[[0,.12,-391],[116,.12,-391],[176,.12,-311]],17,"asphalt");walkway(b,"taxi-link-south",[[0,.12,393],[116,.12,393],[176,.12,314]],17,"asphalt");
      for(var z=-503;z<=503;z+=64){b.part("runway-centreline-"+z,0,.26,z,1.4,.05,30,"white",{material:6,emission:.12,solid:false});[-1,1].forEach(function(s){b.light("runway-edge-"+z+"-"+s,s*34,.45,z,"white",9,{emission:1.4});});}
      [-1,1].forEach(function(s){[-22,-14,-6,6,14,22].forEach(function(x,i){b.part("threshold-"+s+"-"+i,x,.26,s*491,3,.04,37,"white",{solid:false});});});b.text("runway-number","09",0,1,-460,"white",8.3);b.part("apron",198,.08,0,129,.16,650,"asphalt",{material:11});
      b.cylinder("control-tower-shaft",241,22,-466,7,44,7,"ivory",{parameter:.74});b.cylinder("control-room",241,47,-466,14,8,14,"blue",{material:1,wx:5.3,wy:3.6,parameter:1.25});b.cylinder("control-roof",241,53,-466,18,2,18,"silver");b.light("control-beacon",241,56,-466,"red",16,{emission:1.4});
    },"airport");
    site(b,"airport-hangars","西湾空港 · 机库与地面服务",-2193,2595,"两座不同屋顶的机库、地勤维修与燃料服务区靠近跑道，库内保留开放通路",function(b){
      paving(b,"hangar-yard",0,0,651,194,"asphalt");shell(b,"west-hangar",-204,-20,125,111,18,31);pitchedRoof(b,"west-hangar-roof",-204,-20,133,119,18.7,8.1,"roof");shell(b,"east-hangar",22,-20,138,117,21,38);b.part("east-hangar-slope-roof",22,23,-20,146,.55,124,"silver",{roll:-.03});
      volume(b,"ground-services",235,-14,134,93,.36,13,"ivory");b.cylinder("fuel-tank",285,5,66,21,9.4,21,"silver");b.part("fuel-pipe",254,1,63,50,1.2,1.2,"teal");b.text("hangar-title","AIR SERVICE",16,14,40,"warm",3.4);b.light("hangar-light",13,13,-25,"warm",45);
    },"airport");
    site(b,"airport-living","空港大道 · 通勤社区",-1758,1317,"旅客酒店、空港宿舍和便利商店在机场北入口形成有人使用的街区",function(b){
      paving(b,"airport-community",0,0,563,191);volume(b,"west-traveller-hotel",-180,0,81,131,.36,73,"silver");volume(b,"hotel-upper",-188,-14,59,87,73.36,22,"glass");volume(b,"centre-dormitory",-4,-7,121,89,.36,45,"ivory");volume(b,"east-transit-house",181,9,71,119,.36,61,"stone");
      balconies(b,"dormitory-front",-4,37.5,7,[-39,-13,13,39],[8,18,28,38],1);storefront(b,"hotel-food",-180,67,49,"AIRPORT HOTEL","gold");storefront(b,"dormitory-mart",-4,39,52,"MART","teal");roofService(b,"hotel-service",-188,-14,96.1,[9,8]);roofPlant(b,"dormitory-green-roof",-4,-7,46.1,87,59);plant(b,"airport-court-plane",90,41,12.3,6,5.6,.7);bench(b,"hotel-seat",-99,29,0);
    });
  }
  function infill(b){
    site(b,"north-green-tunnel","北城绿顶隧道",-1750,-1900,"金融区入口道路穿过绿顶盖挖空间，开放的两端、衬砌、灯带和检修步道可以实际飞穿",function(b){
      b.part("tunnel-west-wall",-17.7,5.4,0,1.4,10.6,184,"stone",{material:5,glyph:"|"});b.part("tunnel-east-wall",17.7,5.4,0,1.4,10.6,184,"stone",{material:5,glyph:"|"});b.part("tunnel-roof",0,11.1,0,37,1,188,"silver");b.part("green-roof",0,11.68,0,37,.15,188,"leaf",{material:7});
      b.part("maintenance-west",-15.9,.33,0,1.2,.12,179,"ivory",{material:2,wx:2.5,wy:2.2});b.part("maintenance-east",15.9,.33,0,1.2,.12,179,"ivory",{material:2,wx:2.5,wy:2.2});[-1,1].forEach(function(s){b.beam("roof-pipe-"+s,[s*13,9.7,-90],[s*13,9.7,90],.22,"teal");[-70,-34,4,41,77].forEach(function(z,i){b.light("tunnel-lamp-"+s+"-"+i,s*14.8,6.7,z,"warm",27);});});
      b.text("tunnel-title","NORTH GREEN TUNNEL",0,9.2,94,"warm",2);b.part("entrance-west-wing",-26,3.1,93,15,5.6,10,"ivory");b.part("entrance-east-wing",26,3.1,93,15,5.6,10,"ivory");
    },"tunnel");
    site(b,"axis-west-street","花城步行轴西侧 · 日常商住街",888,1795,"贴近步行轴的曲尺住居、斜角办公翼与楼下小店把原本空白的街区补成连续生活界面",function(b){
      paving(b,"mixed-court",0,0,95,251);volume(b,"west-long-home",-19,19,29,164,.36,47,"ivory");volume(b,"north-turning-home",17,-88,56,40,.36,47,"stone");volume(b,"south-home",8,100,65,39,.36,35,"brick");
      b.loft("north-angled-crown",[{y:47.36,points:[[-11,-109],[46,-109],[46,-67],[-11,-67]]},{y:60,points:[[-5,-101],[39,-101],[39,-79],[-5,-79]]}],"silver");balconies(b,"south-balconies",8,119.5,6.8,[-21,0,21],[8,18,28,34],1);storefront(b,"south-bakery",8,121,37,"BREAD","gold");b.part("east-side-shop-front",38,2.7,11,.22,4.7,75,"warm",{material:10,wx:7.4,wy:4.2});b.part("east-shop-awning",41,5.4,11,6,.3,84,"teal");
      roofPlant(b,"home-roof-garden",-18,31,48.1,18,87);roofService(b,"south-roof",9,97,36.1,[7,6]);plant(b,"street-court-tree",17,43,10.6,4.8,5.3,.4);bench(b,"resident-seat",21,63,0);bin(b,"shop-bin",42,62);
    });
    site(b,"axis-east-street","花城步行轴东侧 · 小型商务与住居",1073,1808,"圆角办公楼、L形公寓和下层餐饮围出开放庭院，缩小步行轴与两侧街墙之间的距离",function(b){
      paving(b,"urban-court",0,0,104,303);volume(b,"north-office",-4,-91,44,75,.36,64,"silver");b.cylinder("north-office-elliptic-crown",-4,70,-91,21,11,35,"gold",{parameter:.7});volume(b,"east-residential",32,51,30,157,.36,43,"ivory");volume(b,"south-turning-wing",-7,115,64,28,.36,43,"stone");
      balconies(b,"south-home-balconies",-7,129,6.4,[-21,0,21],[8,18,28,38],1);b.part("west-cafe-glass",-33,2.8,-8,.18,4.8,47,"warm",{material:10,wx:6.5,wy:4.2});b.part("west-cafe-awning",-36,5.6,-8,6,.35,57,"gold");volume(b,"cafe-body",-17,-8,33,49,.36,8,"brick");
      roofService(b,"office-service",-5,-110,76.1,[8,7]);roofPlant(b,"home-garden",30,63,44.1,20,86);plant(b,"courtyard-magnolia",-8,55,9.8,4.4,5.1,-.3);bench(b,"cafe-seat",-39,35,Math.PI/2);bin(b,"cafe-bin",-40,50);
    });
    site(b,"raffles-east-neighbours","朝天门东侧 · 滨江生活组团",2415,1412,"弧形酒店、退台住宅与河岸餐馆围绕来福士形成有居民、有店面、有屋顶庭院的滨江街区",function(b){
      paving(b,"waterfront-block",0,0,319,773);b.cylinder("north-oval-hotel",53,-.5+70,-254,49,139,84,"silver",{material:1,wx:4.7,wy:4.3,parameter:.86});volume(b,"west-home",-89,-17,47,184,.36,97,"ivory");volume(b,"south-long-home",-14,261,207,65,.36,75,"stone");volume(b,"south-stepped-top",-39,256,133,46,75.36,21,"glass");
      volume(b,"east-small-home",116,57,47,139,.36,62,"brick");balconies(b,"south-front",-14,293.5,7.2,[-71,-43,-15,13,41,69],[9,22,35,48,61,73],1);balconies(b,"west-home-front",-89,75,7,[-15,15],[10,24,38,52,66,80,94],1);volume(b,"river-cafe",-87,-260,65,111,.36,12,"ivory");storefront(b,"river-food",-87,-202,61,"RIVER CAFE","gold");
      roofPlant(b,"south-roof-garden",60,271,76.1,26,39);roofService(b,"south-roof-services",-49,256,97.1,[9,8]);plant(b,"river-community-tree",1,51,13.3,6.4,6.7,.7);plant(b,"hotel-lunch-tree",-28,-150,12,5.7,5.9,-.6);bench(b,"community-seat",3,76,0);bin(b,"community-bin",18,76);
    });
    site(b,"raffles-south-community","朝天门南侧 · 社区与商业",2040,2044,"四栋不同高度的住宅、生活商场与开放广场围住东岸社区路，湿地公园就在街道另一侧",function(b){
      paving(b,"community-ground",0,0,542,241);volume(b,"west-home",-201,-7,52,171,.36,69,"ivory");volume(b,"east-home",202,10,60,153,.36,91,"silver");volume(b,"north-home",-52,-72,140,40,.36,55,"stone");volume(b,"south-home",33,75,153,39,.36,42,"brick");
      volume(b,"east-upper-home",214,-5,39,101,91.36,19,"glass");balconies(b,"north-front",-52,-52,7,[-46,-23,0,23,46],[8,20,32,44,54],1);balconies(b,"south-front",33,94.5,6.8,[-50,-25,0,25,50],[8,18,28,38],1);volume(b,"community-retail",36,-19,83,84,.36,11,"ivory");storefront(b,"community-food",36,24,65,"DAILY FOOD","gold");
      roofPlant(b,"home-green-roof",-53,-72,56.1,106,26);roofService(b,"east-services",214,-5,111.1,[8,10]);plant(b,"community-camphor",-78,28,12.1,6,5.8,.5);bench(b,"community-seat",-77,47,0);bin(b,"community-bin",-63,47);
    });
    site(b,"raffles-parking","东岸社区 · 停车与充电",2450,2044,"开放停车楼、地面停车位、充电桩和社区便利店组成路旁的日常交通设施",function(b){
      paving(b,"parking-ground",0,0,166,244,"asphalt");[0,1,2].forEach(function(level){b.part("parking-floor-"+level,-13,level*4+.36,0,131,.45,170,"stone");[-57,-13,31].forEach(function(x,i){[-65,0,65].forEach(function(z,j){b.part("parking-column-"+level+"-"+i+"-"+j,x,level*4+2.3,z,1.1,3.8,1.1,"silver");});});b.part("parking-edge-"+level,-13,level*4+1.1,85,132,1,.25,"teal");});
      b.part("parking-side-ramp",66,4.35,0,11,.45,113,"asphalt",{material:11,pitch:-.071});b.part("charging-stall",-55,1.18,112,1.1,1.6,.6,"teal");b.part("charging-display",-55,1.46,112.32,.78,.55,.05,"blue",{material:6,emission:.2});b.text("parking-title","P / EV",-18,10.7,85,"white",2.8);bin(b,"parking-bin",37,107);
    },"parking");
  }
  function author(b){flower(b);financial(b);oldtown(b);civic(b);culture(b);parks(b);harbor(b);airport(b);infill(b);}
  return Object.freeze({author:author});
});
