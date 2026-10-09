/* Authored activity and traffic schedules, simulated only when the flight advances. */
(function(root,factory){var node=typeof module==="object"&&module.exports,api=factory(node?require("./city-shuttle-geometry.js"):root.CityShuttleGeometry,node?require("./city-shuttle-streets.js"):root.CityShuttleStreets,node?require("./city-shuttle-actors.js"):root.CityShuttleActors,node?require("./city-shuttle-transit.js"):root.CityShuttleTransit);if(node)module.exports=api;if(root)root.CityShuttleLife=api;})(typeof window!=="undefined"?window:globalThis,function(G,S,A,Transit){
  "use strict";
  if(!G||!S||!A||!Transit)throw new Error("City life dependencies are missing");
  function rounded(points,radius){var base=points.slice();if(Math.hypot(...base[0].map(function(v,j){return v-base[base.length-1][j];}))<.01)base.pop();var out=[];
    for(var i=0;i<base.length;i++){var p=base[(i+base.length-1)%base.length],q=base[i],r=base[(i+1)%base.length],a=p.map(function(v,j){return v-q[j];}),b=r.map(function(v,j){return v-q[j];}),la=Math.hypot(...a),lb=Math.hypot(...b),distance=Math.min(radius,la*.25,lb*.25);
      if(la<.01||lb<.01)throw new Error("Activity path has duplicate corners");
      var start=q.map(function(v,j){return v+a[j]/la*distance;}),end=q.map(function(v,j){return v+b[j]/lb*distance;});out.push(start);
      for(var step=1;step<=8;step++){var t=step/8,s=1-t;out.push(q.map(function(v,j){return s*s*start[j]+2*s*t*v+t*t*end[j];}));}
    }out.push(out[0]);return out;
  }
  function path(points,closed,radius){var value={points:closed?rounded(points,radius||9):points.slice()};value._path=S.segments(value);value.closed=!!closed;return value;}
  function point(p,distance,offset){return S.sample(p,Math.min(Math.max(distance,0),p._path.length-.00001),offset);}
  function difference(a,b){return ((a-b+Math.PI*3)%(Math.PI*2))-Math.PI;}
  function green(time,junction,northSouth){var phase=(time+junction.phase)%64;return northSouth?phase<27:phase>=32&&phase<59;}
  function light(time,junction,northSouth){var phase=(time+junction.phase)%64;if(green(time,junction,northSouth))return "green";if(northSouth?phase>=27&&phase<30:phase>=59&&phase<62)return "gold";return "red";}
  var CIRCUITS=Object.freeze([
    {id:"flower",points:[[1145,.08,1630],[1145,.08,2110],[825,.08,2110],[825,.08,1630]],lane:3.75,speed:10.2,units:22,bus:3,busStops:[{id:"tower",x:1145,z:1745.6,direction:-1}]},
    {id:"financial",points:[[-1750,.08,-1380],[-890,.08,-1380],[-890,.08,-710],[-1750,.08,-710]],lane:3.5,speed:11.5,units:20,bus:4,busStops:[{id:"financial",x:-890,z:-829,direction:1}]},
    {id:"cultural",points:[[900,.08,-1390],[1440,.08,-1390],[1440,.08,-410],[900,.08,-410]],lane:3.5,speed:11.0,units:18,bus:2},
    {id:"oldtown",points:[[-530,.08,1200],[350,.08,1200],[350,.08,2170],[-530,.08,2170]],lane:2.5,speed:8.3,units:15,bus:3},
    {id:"port",points:[[1740,.08,-2010],[2380,.08,-2010],[2380,.08,-860],[1740,.08,-860]],lane:4.0,speed:10.5,units:13,freight:true},
    {id:"civic",points:[[-215,.08,-2010],[900,.08,-2010],[900,.08,-1390],[-215,.08,-1390]],lane:3.25,speed:10.3,units:18,bus:3},
    {id:"airport",points:[[-2085,.08,1419],[-1715,.08,1419],[-1715,.08,2210],[-2085,.08,2210]],lane:2.4,speed:7.5,units:14,bus:3,busStops:[{id:"airport",x:-1715,z:1827,direction:1}]},
    {id:"waterfront",points:[[1740,.08,1890],[2560,.08,1890],[2560,.08,2200],[1740,.08,2200]],lane:2.5,speed:8.0,units:16,bus:4},
    {id:"rain-avenue",points:[[0,.04,-359],[0,.04,183],[-215,.04,183],[-215,.04,-12],[-236,.04,-27],[-241,.04,-60],[-241,.04,-95],[-236,.04,-125],[-215,.04,-140],[-215,.04,-359]],lane:3.2,speed:7.4,units:16,bus:4}
  ]);
  var PAINTS=Object.freeze([[.64,.66,.63],[.19,.31,.46],[.55,.23,.19],[.28,.48,.43],[.65,.55,.35],[.43,.45,.50],[.29,.36,.42],[.55,.48,.40],[.25,.38,.53],[.61,.63,.56],[.47,.34,.30],[.33,.43,.37]]);
  var DRIVERS=Object.freeze([12,13,4,18,0,22,6,14,20,3,10,23,2,15,16,11]);
  var PARKED=Object.freeze([
    {id:"rain-bus",x:-8,y:.15,z:245,yaw:0,type:"bus",paint:"red",driver:12},
    {id:"rain-taxi",x:7,y:.15,z:113,yaw:Math.PI,type:"car",paint:"blue",driver:12,taxi:true},
    {id:"market-delivery",x:92,y:.15,z:33,yaw:.13,type:"van",paint:"gold"},
    {id:"hospital-ambulance",x:1307,y:.36,z:-1698,yaw:Math.PI/2,type:"van",paint:"white",driver:15,emergency:"ambulance"},
    {id:"fire-tender",x:1575,y:.36,z:-1735,yaw:0,type:"truck",paint:"red",driver:6,emergency:"fire"},
    {id:"airport-tug",x:-2052,y:.16,z:1690,yaw:0,type:"van",paint:"gold",driver:6},
    {id:"garage-ground-a",x:2407,y:.585,z:1998,yaw:Math.PI/2,type:"car",paint:"silver"},
    {id:"garage-ground-b",x:2407,y:.585,z:2013,yaw:Math.PI/2,type:"car",paint:"red"},
    {id:"garage-ground-c",x:2472,y:.585,z:2070,yaw:-Math.PI/2,type:"car",paint:"teal"},
    {id:"garage-middle-a",x:2407,y:4.585,z:2028,yaw:Math.PI/2,type:"car",paint:"blue"},
    {id:"garage-middle-b",x:2472,y:4.585,z:2007,yaw:-Math.PI/2,type:"van",paint:"white"},
    {id:"garage-upper-a",x:2407,y:8.585,z:2037,yaw:Math.PI/2,type:"car",paint:"gold"},
    {id:"garage-upper-b",x:2472,y:8.585,z:2073,yaw:-Math.PI/2,type:"car",paint:"silver"}
  ]);
  var WALK_PATHS=Object.freeze([
    {id:"tower-axis",points:[[1000,.36,1445],[1000,.36,2030]],speed:1.28,people:52,crossings:true},
    {id:"tower-east-sidewalk",points:[[1129.45,.39,1430],[1129.45,.39,2075]],speed:1.34,people:32,crossings:true,spread:.25},
    {id:"tower-west-sidewalk",points:[[838.5,.39,1410],[838.5,.39,2077]],speed:1.25,people:29,crossings:true,spread:.15},
    {id:"flower-cross-north",points:[[855,.39,1614],[1098,.39,1614]],speed:1.3,people:11,spread:.3},
    {id:"canton-square-west",points:[[920,.35,1187],[920,.35,1267],[920,.35,1371],[954,.35,1371]],speed:1.1,people:8},
    {id:"canton-square-front",points:[[962,.35,1355],[1088,.35,1355]],speed:1.16,people:9},
    {id:"financial-east-sidewalk",points:[[-873.65,.39,-1310],[-873.65,.39,-766]],speed:1.38,people:15,spread:.25},
    {id:"financial-south-sidewalk",points:[[-1707,.39,-697],[-938,.39,-697]],speed:1.27,people:14},
    {id:"shanghai-entry",points:[[-1380,.35,-973],[-1290,.35,-973],[-1180,.35,-973]],speed:1.14,people:7},
    {id:"cultural-west-sidewalk",points:[[884,.39,-1250],[884,.39,-489]],speed:1.30,people:17},
    {id:"cultural-east-sidewalk",points:[[1457.1,.39,-1260],[1457.1,.39,590]],speed:1.4,people:16,spread:.25},
    {id:"opera-front",points:[[1152,.35,568],[1341,.35,568]],speed:1.05,people:11},
    {id:"oldtown-market",points:[[-517,.39,1240],[-517,.39,1590]],speed:1.02,people:14},
    {id:"oldtown-cross",points:[[-410,.39,1186.7],[298,.39,1186.7]],speed:1.24,people:29,spread:.25},
    {id:"north-river-runners",points:[[-1220,.36,651],[-325,.36,651]],speed:2.7,people:10,mode:"run"},
    {id:"south-river-cyclists",points:[[615,.36,1048],[1558,.36,1048]],speed:4.4,people:9,mode:"cycle"},
    {id:"raffles-crystal",points:[[1802,248.79,1515],[2105,248.79,1515]],speed:1.0,people:8},
    {id:"civic-sidewalk",points:[[370,.39,-1993],[834,.39,-1993]],speed:1.19,people:13},
    {id:"port-sidewalk",points:[[1770,.39,-846.5],[2318,.39,-846.5]],speed:1.25,people:19},
    {id:"west-park-walk",points:[[-2263,.36,-1600],[-2261,.36,-1450],[-2263,.36,-1169]],speed:1.16,people:19},
    {id:"lake-boardwalk",points:[[-2449,.36,-941],[-2393,.36,-990],[-2279,.36,-1000],[-2191,.36,-943]],speed:1.11,people:21},
    {id:"playground-walk",points:[[-2460,.36,-165],[-2280,.36,-165],[-2160,.36,-165]],speed:1.03,people:24},
    {id:"hospital-arrival",points:[[967,.36,-1966],[1270,.36,-1966]],speed:1.16,people:23},
    {id:"school-front",points:[[987,.36,-1328],[1335,.36,-1328]],speed:1.23,people:20},
    {id:"station-hall",points:[[-1430,.36,-2129],[-760,.36,-2129]],speed:1.38,people:37},
    {id:"station-platform",points:[[-1534,15.10,-2218.9],[-1445,15.10,-2218.9]],speed:1.07,people:12,spread:.3},
    {id:"airport-terminal",points:[[-1854,.36,1588],[-1854,.36,1945]],speed:1.24,people:29},
    {id:"airport-arrival",points:[[-1747,.36,1587],[-1747,.36,1943]],speed:1.33,people:21},
    {id:"raffles-waterfront",points:[[2165,.36,1048],[2480,.36,1048]],speed:1.16,people:22},
    {id:"rain-avenue-west",points:[[-21,.32,225],[-21,.32,305]],speed:1.1,people:17,spread:.25},
    {id:"rain-avenue-east",points:[[24.8,.32,227],[24.8,.32,309]],speed:1.2,people:18,spread:.25},
    {id:"stadium-runners",points:[[-610,.47,-1650],[-614.1,.47,-1616.3],[-625.8,.47,-1587.8],[-643.3,.47,-1568.7],[-664,.47,-1562],[-684.7,.47,-1568.7],[-702.2,.47,-1587.8],[-713.9,.47,-1616.3],[-718,.47,-1650],[-713.9,.47,-1683.7],[-702.2,.47,-1712.2],[-684.7,.47,-1731.3],[-664,.47,-1738],[-643.3,.47,-1731.3],[-625.8,.47,-1712.2],[-614.1,.47,-1683.7],[-610,.47,-1650]],speed:2.6,people:24,mode:"run",closed:true,spread:.65},
    {id:"stadium-blue-team",points:[[-687,.58,-1668],[-641,.58,-1668]],speed:2.3,people:6,mode:"run",profiles:[1,14,4],team:"blue",spread:2.4},
    {id:"stadium-white-team",points:[[-685,.58,-1632],[-643,.58,-1632]],speed:2.1,people:6,mode:"run",profiles:[4,12,18],team:"white",spread:2.4}
  ]);
  var SOCIAL=Object.freeze([
    {id:"canton-couple-a",x:960,y:.35,z:1368,yaw:Math.PI/2,profile:0,mode:"talk"},
    {id:"canton-couple-b",x:961.35,y:.35,z:1368,yaw:-Math.PI/2,profile:2,mode:"talk"},
    {id:"canton-phone",x:1059,y:.35,z:1357,yaw:.3,profile:19,mode:"phone"},
    {id:"tower-parent",x:999,y:.36,z:1423,yaw:1.4,profile:23,mode:"talk"},
    {id:"tower-child",x:1000.3,y:.36,z:1423,yaw:-1.4,profile:9,mode:"wait"},
    {id:"flower-bus-wait-a",x:1128,y:.39,z:1739,yaw:Math.PI/2,profile:3,mode:"wait"},
    {id:"flower-bus-wait-b",x:1128,y:.39,z:1741,yaw:Math.PI/2,profile:8,mode:"wait"},
    {id:"flower-bus-wait-c",x:1127,y:.39,z:1744,yaw:Math.PI/2,profile:18,mode:"phone"},
    {id:"financial-stop-a",x:-875,y:.39,z:-824,yaw:-Math.PI/2,profile:13,mode:"wait"},
    {id:"financial-stop-b",x:-875,y:.39,z:-827,yaw:-Math.PI/2,profile:16,mode:"phone"},
    {id:"opera-friends-a",x:1159,y:.35,z:565,yaw:.6,profile:5,mode:"talk"},
    {id:"opera-friends-b",x:1160,y:.35,z:566,yaw:-2.6,profile:10,mode:"talk"},
    {id:"crystal-cafe-a",x:1995.7,y:248.80,z:1512,yaw:Math.PI/2,profile:4,mode:"sit"},
    {id:"crystal-cafe-b",x:2000.3,y:248.79,z:1512,yaw:-Math.PI/2,profile:2,mode:"talk"},
    {id:"crystal-garden",x:1830,y:248.79,z:1510,yaw:0,profile:7,mode:"wait"},
    {id:"oldtown-customer",x:-501.15,y:.35,z:1447,yaw:Math.PI/2,profile:21,mode:"buy"},
    {id:"oldtown-student",x:-502.1,y:.35,z:1452.8,yaw:.3,profile:8,mode:"phone"},
    {id:"civic-doctor",x:1140,y:.36,z:-1966,yaw:.2,profile:15,mode:"wait"},
    {id:"civic-conversation-a",x:725,y:.39,z:-1993,yaw:1.5,profile:4,mode:"talk"},
    {id:"civic-conversation-b",x:726.3,y:.39,z:-1993,yaw:-1.5,profile:15,mode:"talk"},
    {id:"port-worker",x:2048,y:.39,z:-846.5,yaw:Math.PI,profile:6,mode:"phone"},
    {id:"riverside-stretch",x:-826,y:.36,z:650,yaw:1,profile:1,mode:"stretch"},
    {id:"axis-cafe-reader",x:1023,y:.36,z:1654.85,yaw:0,profile:4,mode:"eat"},
    {id:"axis-cafe-friend",x:1032,y:.36,z:1656.85,yaw:0,profile:23,mode:"eat"},
    {id:"axis-cafe-waiter",x:1025,y:.36,z:1658,yaw:-.8,profile:11,mode:"talk"},
    {id:"axis-garden-sitter",x:979,y:.36,z:1848,yaw:0,profile:7,mode:"sit"},
    {id:"park-parent",x:-2364,y:.36,z:-372,yaw:0,profile:23,mode:"sit"},
    {id:"park-child",x:-2362.8,y:.36,z:-370.7,yaw:Math.PI,profile:9,mode:"talk"},
    {id:"park-tai-chi-a",x:-2274,y:.36,z:-356,yaw:0,profile:17,mode:"taichi"},
    {id:"park-tai-chi-b",x:-2270,y:.36,z:-356,yaw:.2,profile:7,mode:"taichi"},
    {id:"park-basketball",x:-2239,y:.49,z:-462,yaw:0,profile:1,mode:"basketball"},
    {id:"park-basketball-friend",x:-2231,y:.49,z:-461,yaw:-1.4,profile:14,mode:"talk"},
    {id:"station-platform-sit",x:-1538,y:15.11,z:-2220,yaw:0,profile:13,mode:"sit"},
    {id:"airport-seated",x:-1834,y:.36,z:1720,yaw:Math.PI/2,profile:0,mode:"sit"},
    {id:"airport-seat-west-a",x:-1948,y:.36,z:1648.92,yaw:Math.PI/2,profile:13,mode:"sit"},
    {id:"airport-seat-west-b",x:-1948,y:.36,z:1651.08,yaw:Math.PI/2,profile:19,mode:"sit"},
    {id:"airport-seat-mid-a",x:-1933,y:.36,z:1718.92,yaw:Math.PI/2,profile:4,mode:"sit"},
    {id:"airport-seat-mid-b",x:-1933,y:.36,z:1720,yaw:Math.PI/2,profile:16,mode:"sit"},
    {id:"airport-seat-south-a",x:-1948,y:.36,z:1791.54,yaw:Math.PI/2,profile:7,mode:"sit"},
    {id:"airport-seat-south-b",x:-1948,y:.36,z:1793.7,yaw:Math.PI/2,profile:18,mode:"sit"},
    {id:"airport-seat-family",x:-1933,y:.36,z:1860.38,yaw:Math.PI/2,profile:23,mode:"sit"},
    {id:"airport-family-child",x:-1930.6,y:.36,z:1861.2,yaw:-Math.PI/2,profile:9,mode:"wait"},
    {id:"airport-service-agent",x:-1897,y:.36,z:1788.3,yaw:Math.PI,profile:15,mode:"wait"},
    {id:"airport-coffee-customer",x:-1935,y:.36,z:1960.8,yaw:0,profile:10,mode:"buy"},
    {id:"lake-watch-a",x:-2231,y:.51,z:-716,yaw:0,profile:4,mode:"sit"},
    {id:"lake-watch-b",x:-2229.8,y:.51,z:-716,yaw:0,profile:16,mode:"sit"}
  ]);
  var AMBIENT=Object.freeze([
    {id:"main-river",kind:"water",x:1000,y:0,z:850,radius:340,gain:.65},
    {id:"west-river",kind:"water",x:-1350,y:0,z:850,radius:350,gain:.55},
    {id:"canton-pool",kind:"fountain",x:919,y:.6,z:1315,radius:42,gain:.5},
    {id:"west-park",kind:"birds",x:-2200,y:8,z:-800,radius:450,gain:.45},
    {id:"flower-avenue",kind:"crowd",x:1000,y:1,z:1710,radius:130,gain:.24},
    {id:"oldtown-market",kind:"crowd",x:-530,y:1,z:1470,radius:130,gain:.32},
    {id:"financial-plaza",kind:"crowd",x:-1270,y:1,z:-840,radius:120,gain:.2},
    {id:"opera-plaza",kind:"crowd",x:1220,y:1,z:560,radius:110,gain:.22},
    {id:"crystal-interior",kind:"interior",x:1950,y:255,z:1516,radius:65,gain:.18},
    {id:"port-machinery",kind:"machinery",x:2758,y:27,z:-1520,radius:240,gain:.38},
    {id:"axis-fountain",kind:"fountain",x:976,y:1,z:1685,radius:55,gain:.57},
    {id:"lake-water",kind:"water",x:-2316,y:1,z:-865,radius:175,gain:.5},
    {id:"lake-birds",kind:"birds",x:-2320,y:8,z:-874,radius:210,gain:.38},
    {id:"wetland-birds",kind:"birds",x:2224,y:8,z:2390,radius:270,gain:.46},
    {id:"school-crowd",kind:"crowd",x:1170,y:1,z:-1190,radius:145,gain:.35},
    {id:"station-crowd",kind:"crowd",x:-1100,y:1,z:-2130,radius:240,gain:.39},
    {id:"terminal-interior",kind:"interior",x:-1878,y:9,z:1760,radius:180,gain:.29},
    {id:"play-swing",kind:"swing",x:-2331.5,y:2,z:-314,radius:30,gain:.25},
    {id:"rain-avenue-crowd",kind:"crowd",x:0,y:1,z:267,radius:120,gain:.3},
    {id:"north-tunnel",kind:"interior",x:-1750,y:4,z:-1900,radius:130,gain:.2}
  ]);
  function stopPoints(route){var result=[];S.JUNCTIONS.forEach(function(j){var best=Infinity,distance=0,northSouth=true;
    route._path.segments.forEach(function(seg){var dx=seg.b[0]-seg.a[0],dz=seg.b[2]-seg.a[2],length2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((j.x-seg.a[0])*dx+(j.z-seg.a[2])*dz)/Math.max(.001,length2))),x=seg.a[0]+dx*t,z=seg.a[2]+dz*t,dist=(x-j.x)**2+(z-j.z)**2;
      if(dist<best){best=dist;distance=seg.start+t*seg.length;northSouth=Math.abs(dz)>Math.abs(dx);}
    });if(best<900)result.push({junction:j,distance:distance,northSouth:northSouth});
  });return result;}
  function World(){
    this.time=0;this.vehicles=[];this.people=[];this.routes=[];
    CIRCUITS.forEach(function(c,index){[-1,1].forEach(function(direction){var route=path(direction>0?c.points:c.points.slice().reverse(),true,10);route.id=c.id+"-"+direction;route.stops=stopPoints(route);route.busStops=(c.busStops||[]).filter(function(s){return s.direction===direction;}).map(function(s){var best=Infinity,distance=0;route._path.segments.forEach(function(seg){var dx=seg.b[0]-seg.a[0],dz=seg.b[2]-seg.a[2],f=Math.max(0,Math.min(1,((s.x-seg.a[0])*dx+(s.z-seg.a[2])*dz)/(dx*dx+dz*dz))),d=(seg.a[0]+dx*f-s.x)**2+(seg.a[2]+dz*f-s.z)**2;if(d<best){best=d;distance=seg.start+seg.length*f;}});return {id:s.id,distance:distance};});route.lane=c.lane;route.speed=c.speed;this.routes.push(route);
      for(var i=0;i<c.units;i++){var bus=c.bus&&i%c.bus===0&&i<9,truck=c.freight&&i%3!==0,emergency=c.id==="civic"&&i===11,kind=emergency?"van":bus?"bus":truck?"truck":i%7===4?"van":"car",actor={id:route.id+"-"+i,route:route,distance:((i*.618034+index*.071+.03)%1)*route._path.length,speed:c.speed*(.82+(i%4)*.05),maxSpeed:c.speed*(.88+(i%4)*.04),length:bus?10.8:truck?8.6:kind==="van"?5.2:4.6,
        spec:{type:kind,paint:emergency?"white":PAINTS[(i+index*3+(direction>0?0:5))%PAINTS.length],driver:emergency?15:DRIVERS[(i+index)%DRIVERS.length],passengers:bus?[3,4,8,10,16,18,0,7]:truck||emergency?[]:[(i+3)%24],taxi:!bus&&!truck&&i%5===0,emergency:emergency?"ambulance":null}};
        this.vehicles.push(actor);
      }
    },this);},this);
    var express=S.ROADS.find(function(r){return r.id==="ring-express";});[-1,1].forEach(function(direction){var route={points:direction>0?express.points:express.points.slice().reverse(),closed:true,id:"express-"+direction,lane:6.0,speed:29,stops:[]};route._path=S.segments(route);this.routes.push(route);
      for(var i=0;i<55;i++)this.vehicles.push({id:route.id+"-"+i,route:route,distance:(i/55+.007)%1*route._path.length,speed:26+i%5,maxSpeed:27+i%5,length:i%9===0?8.6:4.6,spec:{type:i%9===0?"truck":"car",paint:PAINTS[(i+direction+12)%PAINTS.length],driver:DRIVERS[(i+7)%DRIVERS.length],passengers:i%9===0?[]:[i%24],cargo:i%2?"silver":"teal"}});
    },this);
    WALK_PATHS.forEach(function(w,index){var route=path(w.points,!!w.closed,5);route.stops=w.crossings?stopPoints(route):[];for(var i=0;i<w.people;i++){var side=(i%3-1)*(w.spread==null?.55:w.spread),d=((i*.618034+index*.13)%1)*route._path.length,p=point(route,d,side),profile=A.PROFILES[w.profiles?w.profiles[i%w.profiles.length]:(i+index*3)%A.PROFILES.length];if(w.team)profile=Object.assign({},profile,{bag:false,hat:null,top:w.team==="blue"?[.21,.47,.64]:[.74,.78,.73],bottom:[.17,.25,.34]});this.people.push({id:w.id+"-"+i,path:route,distance:d,side:side,direction:i%2?1:-1,speed:w.speed*(.9+i%3*.06),profile:profile,mode:w.mode||"walk",waiting:0,yaw:p.yaw+(i%2?0:Math.PI),pose:p});}},this);
    SOCIAL.forEach(function(s){this.people.push({id:s.id,pose:{x:s.x,y:s.y,z:s.z,yaw:s.yaw},profile:A.PROFILES[s.profile],mode:s.mode,speed:0,direction:0});},this);
  }
  World.prototype.update=function(time){var dt=Math.max(0,Math.min(.12,time-this.time));this.time=time;
    if(dt===0)return;
    var speeds=new Map();this.routes.forEach(function(route){var cars=this.vehicles.filter(function(v){return v.route===route;}).sort(function(a,b){return a.distance-b.distance;});
      cars.forEach(function(v,i){var next=cars[(i+1)%cars.length],gap=(next.distance-v.distance+route._path.length)%route._path.length-(v.length+next.length)/2,target=v.maxSpeed;
        if(cars.length>1)target=Math.min(target,Math.sqrt(Math.max(0,2*2.8*(gap-3.2))));
        route.stops.forEach(function(stop){var ahead=(stop.distance-v.distance+route._path.length)%route._path.length;
          if(!green(time,stop.junction,stop.northSouth)&&ahead<Math.max(35,v.speed*v.speed/5+22))target=Math.min(target,Math.sqrt(Math.max(0,2*2.9*(ahead-14-v.length/2))));
        });
        v.dwell=Math.max(0,(v.dwell||0)-dt);if(v.dwell>0)target=0;
        if(v.spec.type==="bus"&&v.dwell===0)(route.busStops||[]).forEach(function(stop){var ahead=(stop.distance-v.distance+route._path.length)%route._path.length;if(v.servedStop===stop.id&&ahead>route._path.length/2)v.servedStop=null;if(v.servedStop===stop.id)return;if(ahead<45)target=Math.min(target,Math.sqrt(Math.max(0,2*2.2*ahead)));if(ahead<.7&&v.speed<.45){v.dwell=8;v.servedStop=stop.id;target=0;}});
        v.spec.atStop=v.dwell>0;
        speeds.set(v,Math.max(0,v.speed+Math.max(-dt*3.2,Math.min(dt*1.8,target-v.speed))));
      });
    },this);
    this.vehicles.forEach(function(v){var speed=speeds.get(v);v.spec.braking=speed<v.speed-.025||speed<.2;v.speed=speed;v.distance=(v.distance+speed*dt)%v.route._path.length;});
    this.people.forEach(function(p){if(!p.path)return;if(p.waiting>0){p.waiting=Math.max(0,p.waiting-dt);return;}
      p.blocked=(p.path.stops||[]).some(function(stop){var ahead=(stop.distance-p.distance)*p.direction,edge=stop.junction.width/2+2.4;return ahead>=edge&&ahead<edge+1.5&&!green(time,stop.junction,stop.northSouth);});if(!p.blocked)p.distance+=p.direction*p.speed*dt;if(p.path.closed)p.distance=(p.distance+p.path._path.length)%p.path._path.length;else if(p.distance>=p.path._path.length){p.distance=p.path._path.length-.001;p.direction=-1;p.waiting=1.5;}else if(p.distance<=0){p.distance=.001;p.direction=1;p.waiting=2.0;}
      var pose=point(p.path,p.distance,p.side),yaw=pose.yaw+(p.direction<0?Math.PI:0);p.yaw+=difference(yaw,p.yaw)*Math.min(1,dt*7);pose.yaw=p.yaw;p.pose=pose;
    });
  };
  World.prototype.frame=function(camera,ground){var b=new G.Builder("living"),audio=[],metrics={people:this.people.length,vehicles:this.vehicles.length+PARKED.length,visiblePeople:0,visibleVehicles:0};
    this.vehicles.forEach(function(v){var pose=point(v.route,v.distance,v.route.lane),ahead=point(v.route,(v.distance+2)%v.route._path.length,v.route.lane),floor=ground?ground(pose.x,pose.z,pose.y+.8):NaN,tyreBottom=v.spec.type==="car"||v.spec.type==="van"?.01:0;pose.y=Number.isFinite(floor)?floor-tyreBottom:pose.y+.19-tyreBottom;
      var distance=Math.hypot(pose.x-camera[0],pose.y-camera[1],pose.z-camera[2]);v.spec.alert=!!v.spec.emergency&&(this.time+v.id.length*3.1)%120<9;if(distance<6200){v.spec.speed=v.speed;v.spec.turning=Math.abs(difference(ahead.yaw,pose.yaw))>.04;A.drawVehicle(b,v.id,pose,v.spec,this.time,distance);metrics.visibleVehicles++;}
      if(distance<170)audio.push({id:v.id,kind:v.spec.type==="bus"?"bus":v.spec.type==="truck"?"truck":"car",x:pose.x,y:pose.y+1,z:pose.z,gain:.55,pitch:.7+v.speed*.045,speed:v.speed,
        horn:v.speed<.4&&(this.time+v.id.length*2.7)%37<.45,braking:v.spec.braking,doors:v.spec.atStop});
      if(distance<380&&v.spec.alert)audio.push({id:v.id+"-siren",kind:"siren",x:pose.x,y:pose.y+2,z:pose.z,gain:.35,radius:380,pitch:1});
    },this);
    PARKED.forEach(function(p){var spec={type:p.type,paint:p.paint,driver:p.driver==null?false:p.driver,passengers:[],parked:true,taxi:!!p.taxi,speed:0,emergency:p.emergency},pose={x:p.x,y:p.y,z:p.z,yaw:p.yaw},floor=ground?ground(p.x,p.z,p.y+.8):NaN;if(Number.isFinite(floor))pose.y=floor-(p.type==="car"||p.type==="van"?.01:0);var distance=Math.hypot(p.x-camera[0],pose.y-camera[1],p.z-camera[2]);if(distance<4200){A.drawVehicle(b,p.id,pose,spec,this.time,distance);metrics.visibleVehicles++;}},this);
    this.people.forEach(function(p){var pose=p.path?point(p.path,p.distance,p.side):p.pose;pose.yaw=p.path?p.yaw:pose.yaw;if(p.path&&ground){var floor=ground(pose.x,pose.z,pose.y+.8);if(Number.isFinite(floor))pose.y=floor-(p.mode==="cycle"?.01:.014*p.profile.height/1.77);}var distance=Math.hypot(pose.x-camera[0],pose.y-camera[1],pose.z-camera[2]);if(distance>2200)return;
      var mode=p.waiting>0||p.blocked?"wait":p.mode,speed=p.path&&p.waiting===0&&!p.blocked?p.speed:0;A.drawPerson(b,p.id,pose,p.profile,mode,this.time,speed,distance);metrics.visiblePeople++;
      if(distance<40&&(speed>0||["talk","phone","buy"].includes(mode)))audio.push({id:p.id,kind:speed>0?mode==="cycle"?"cycle":"footsteps":"voice",x:pose.x,y:pose.y+1.3,z:pose.z,gain:speed>0?.23:.18,pitch:p.profile.child?1.4:p.profile.elder?.85:1,oneShot:speed>0&&mode!=="cycle",event:Math.floor((this.time*(mode==="run"?12:8)+p.profile.height*7.1)/Math.PI)});
    },this);
    S.JUNCTIONS.forEach(function(j){b.site("signals-"+j.id,"信号灯 "+j.id,j.x,j.z,"按道路方向交替运行的红黄绿交通灯",function(b){var edge=j.width/2+1.7;
      [[-edge,-edge],[edge,-edge],[edge,edge],[-edge,edge]].forEach(function(p,i){var yaw=i*Math.PI/2,active=light(this.time,j,i%2===0);[["red",4.95],["gold",4.5],["green",4.05]].forEach(function(c){b.ball("lamp-"+i+"-"+c[0],p[0]+Math.sin(yaw)*.22,c[1],p[1]+Math.cos(yaw)*.22,.115,.115,.065,active===c[0]?c[0]:[.055,.065,.06],{material:6,emission:active===c[0]?1.1:0,solid:false,glyph:"*",yaw:yaw});});},this);
    }.bind(this));},this);
    var transit=Transit.draw(b,this.time,camera);audio=audio.concat(transit.audio.filter(function(s){return Math.hypot(s.x-camera[0],s.y-camera[1],s.z-camera[2])<s.radius;}));Object.assign(metrics,transit.metrics);
    if(Math.hypot(-2239-camera[0],-462-camera[2])<75)audio.push({id:"park-ball",kind:"ball",x:-2238.72,y:.8,z:-461.68,gain:.52,radius:75,oneShot:true,event:Math.floor(this.time*5/Math.PI)});
    AMBIENT.forEach(function(s){var d=Math.hypot(s.x-camera[0],s.y-camera[1],s.z-camera[2]);if(d<s.radius)audio.push(s);});
    function score(s){var distance=Math.hypot(s.x-camera[0],s.y-camera[1],s.z-camera[2]),reference=["crowd","water","birds","plane","rail","machinery"].includes(s.kind)?22:8;return (s.gain||.2)/(1+distance/reference);}
    audio.sort(function(a,c){return score(c)-score(a);});
    var built=b.finish();return {packed:built.packed,objects:built.objects,audio:audio.slice(0,28),metrics:metrics,time:this.time};
  };
  return Object.freeze({World:World,CIRCUITS:CIRCUITS,WALK_PATHS:WALK_PATHS,SOCIAL:SOCIAL,AMBIENT:AMBIENT,PARKED:PARKED,green:green,light:light});
});
