/* Authored road hierarchy shared by physical geometry and the city's traffic. */
(function(root,factory){var api=factory(typeof module==="object"&&module.exports?require("./city-shuttle-geometry.js"):root.CityShuttleGeometry);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.CityShuttleStreets=api;})(typeof window!=="undefined"?window:globalThis,function(G){
  "use strict";
  function quadratic(a,b,c,count){var out=[];for(var i=1;i<=count;i++){var t=i/count,s=1-t;out.push(a.map(function(v,j){return s*s*v+2*s*t*b[j]+t*t*c[j];}));}return out;}
  function gradeCorners(points,radius){var out=[points[0]];for(var i=1;i<points.length-1;i++){var p=points[i-1],q=points[i],r=points[i+1],a=p.map(function(v,j){return v-q[j];}),c=r.map(function(v,j){return v-q[j];}),la=Math.hypot.apply(Math,a),lc=Math.hypot.apply(Math,c),cut=Math.min(radius,la*.25,lc*.25),start=q.map(function(v,j){return v+a[j]/la*cut;}),end=q.map(function(v,j){return v+c[j]/lc*cut;});out.push(start);out=out.concat(quadratic(start,q,end,8));}out.push(points[points.length-1]);return out;}
  var ring=[[-2440,24,-2400],[2540,24,-2400]];
  ring=ring.concat(quadratic([2540,24,-2400],[2700,24,-2400],[2700,24,-2240],10),[[2700,24,2290]],quadratic([2700,24,2290],[2700,24,2450],[2540,24,2450],10),[[-2440,24,2450]],quadratic([-2440,24,2450],[-2600,24,2450],[-2600,24,2290],10),[[-2600,24,-2240]],quadratic([-2600,24,-2240],[-2600,24,-2400],[-2440,24,-2400],10));
  var ROADS=Object.freeze([
    {id:"ring-express",name:"都市环城高速",type:"express",width:36,lanes:6,closed:true,points:ring,description:"连续高架环线、四处圆弧转角、支墩、中央护栏与六条车道"},
    {id:"north-link",name:"北城高速联络线",type:"express",width:26,lanes:4,points:[[-2390,24,-2400],[-1800,24,-2320],[-1100,24,-2280],[0,24,-2250],[1240,24,-2290],[2540,24,-2400]],description:"空港、北城与东港之间的高架联络线"},
    {id:"south-ramp-east",name:"花城东匝道",type:"ramp",width:12,lanes:2,points:[[1520,24,2450],[1460,24,2400],[1390,20,2340],[1300,14,2290],[1200,7,2280],[1145,.08,2220]],description:"双向接驳匝道，把高速长途公交接到花城商业街"},
    {id:"north-ramp-west",name:"金融区西匝道",type:"ramp",width:12,lanes:2,points:[[-1940,24,-2400],[-1880,24,-2360],[-1792,24,-2317],[-1800,24,-2240],[-1800,24,-2190],[-1805,20,-2110],[-1810,14,-2030],[-1810,7,-1940],[-1810,.08,-1845],[-1810,.08,-1735],[-1750,.08,-1735]],description:"从高速联络线跨过轨道后缓慢下降，沿绿顶隧道西侧进入金融大道"},
    {id:"port-ramp",name:"东港货运匝道",type:"ramp",width:12,lanes:2,points:[[2700,24,-1560],[2654,24,-1527],[2600,18.5,-1500],[2530,12,-1465],[2470,6.1,-1432],[2410,.08,-1408],[2380,.08,-1400]],description:"货运车辆独立进出港区的高架连接，末段平接主干道"},
    {id:"flower-east",name:"花城东路",type:"arterial",width:30,lanes:4,points:[[1145,.08,1120],[1145,.08,2220]],description:"塔东商业街与公交站组成连续活力街道"},
    {id:"flower-west",name:"花城西路",type:"street",width:20,lanes:2,points:[[825,.08,1110],[825,.08,2300]],description:"塔西住宅、咖啡馆与骑行街相连"},
    {id:"flower-cross",name:"花城生活横街",type:"arterial",width:26,lanes:4,points:[[500,.08,1630],[1610,.08,1630]],description:"步行轴、东西商业街与社区公交的主要交叉街"},
    {id:"flower-south",name:"南岸社区路",type:"street",width:20,lanes:2,points:[[500,.08,2110],[1740,.08,2110]],description:"住宅社区、菜市场与东岸社区相接的南岸横街"},
    {id:"cultural-west",name:"文化轴西大道",type:"arterial",width:28,lanes:4,points:[[900,.08,-2010],[900,.08,590]],description:"接通北城公共服务大道、办公、文化设施与滨江公园的林荫主干道"},
    {id:"cultural-east",name:"文化轴东大道",type:"arterial",width:28,lanes:4,points:[[1440,.08,-1450],[1440,.08,640]],description:"总部商圈、歌剧院和滨江空间由连续街道串联"},
    {id:"cultural-cross",name:"金融文化横街",type:"arterial",width:28,lanes:4,points:[[470,.08,-410],[1760,.08,-410]],description:"连接旧城滨水、办公裙房与文化轴的横向街道"},
    {id:"cultural-bridge",name:"花城跨江大桥",type:"bridge",width:31,lanes:4,points:[[1000,.08,555],[1000,24,725],[1000,24,1000],[1000,.08,1140],[1145,.08,1180]],description:"文化轴跨越主江，桥下保持完整航道与飞行空间"},
    {id:"financial-west",name:"金融区西大道",type:"arterial",width:28,lanes:4,points:[[-1750,.08,-2040],[-1750,.08,615]],description:"金融街区西缘的公交与机动车主干道"},
    {id:"financial-east",name:"金融区东大道",type:"arterial",width:26,lanes:4,points:[[-890,.08,-1900],[-890,.08,625]],description:"三座高层与滨江商圈之间的街道"},
    {id:"financial-north",name:"陆家嘴北街",type:"street",width:22,lanes:2,points:[[-1800,.08,-1380],[-810,.08,-1380]],description:"三件套北侧的总部入口与店面街"},
    {id:"financial-south",name:"陆家嘴南街",type:"street",width:22,lanes:2,points:[[-1800,.08,-710],[-810,.08,-710]],description:"塔群南侧的街角咖啡、酒店落客与小广场"},
    {id:"west-connector",name:"西城联络横街",type:"arterial",width:26,lanes:4,points:[[-2450,.08,-630],[-720,.08,-630]],description:"山地公园、金融街区与旧工坊之间的横街"},
    {id:"old-west-extension",name:"旧城北延路",type:"street",width:19,lanes:2,points:[[-215,.08,-910],[-215,.08,-2170]],description:"旧工坊北部与央视媒体区、车站之间的延伸街道"},
    {id:"rain-west-detour",name:"折环总部西侧街",type:"street",width:18,lanes:2,points:[[-215,.04,-140],[-236,.04,-125],[-241,.04,-95],[-241,.04,-60],[-236,.04,-27],[-215,.04,-12]],description:"绕开折环总部基座，衔接旧城区南北生活街的实际支路"},
    {id:"civic-north",name:"北城公共服务大道",type:"arterial",width:30,lanes:4,points:[[-1860,.08,-2010],[1740,.08,-2010]],description:"学校、医院、体育设施、公共交通与住宅所在的北城大道"},
    {id:"civic-south",name:"北城南横街",type:"street",width:22,lanes:2,points:[[300,.08,-1390],[1770,.08,-1390]],description:"中国尊、社区服务与金融区相连的横街"},
    {id:"civic-south-west",name:"媒体区生活横街",type:"street",width:22,lanes:2,points:[[-215,.08,-1390],[300,.08,-1390]],description:"媒体区、北城住宅与服务街的连接横街"},
    {id:"port-gate",name:"东港物流大道",type:"arterial",width:32,lanes:4,points:[[1740,.08,-2010],[2380,.08,-2010],[2380,.08,500]],description:"物流仓储、制造车间与码头之间的重型车辆通道"},
    {id:"port-cross",name:"港区生活横街",type:"street",width:23,lanes:2,points:[[1630,.08,-860],[2600,.08,-860]],description:"物流办公、餐饮、维修与货物中转的交叉街"},
    {id:"port-west",name:"东港西侧路",type:"arterial",width:28,lanes:4,points:[[1740,.08,-2010],[1740,.08,-840]],description:"仓储片区西侧与公共服务大道接通的道路"},
    {id:"oldtown-north",name:"骑楼北街",type:"street",width:22,lanes:2,points:[[-1450,.08,1200],[560,.08,1200]],description:"两岸桥头、传统街市与骑楼店面的主要街道"},
    {id:"oldtown-south",name:"骑楼南街",type:"street",width:21,lanes:2,points:[[-1450,.08,2170],[470,.08,2170]],description:"老城住宅、学校与社区公园之间的南侧街道"},
    {id:"oldtown-west-local",name:"榕树巷",type:"street",width:10,lanes:2,points:[[-1060,.08,1213],[-1060,.08,2156]],description:"住宅院落与旧厂房之间的社区巷道"},
    {id:"oldtown-east-local",name:"书铺巷",type:"street",width:10,lanes:2,points:[[-170,.08,1213],[-170,.08,2156]],description:"骑楼院落、书店与社区诊所之间的慢速生活巷"},
    {id:"oldtown-market-local",name:"菜市横巷",type:"street",width:10,lanes:2,points:[[-1440,.08,1450],[-550,.08,1450]],description:"菜市场北缘与榕树巷相连的生活街"},
    {id:"oldtown-centre-local",name:"老城中横巷",type:"street",width:10,lanes:2,points:[[-1440,.08,1552],[337,.08,1552]],description:"中部住宅、茶馆与市场之间的连续社区街道"},
    {id:"oldtown-south-local",name:"小学横街",type:"street",width:10,lanes:2,points:[[-1440,.08,1950],[337,.08,1950]],description:"小学校园、诊所、街角公园与沿街店铺所在的横街"},
    {id:"oldtown-spine",name:"骑楼中街",type:"street",width:20,lanes:2,points:[[-530,.08,1090],[-530,.08,2250]],description:"菜市、餐馆、老城广场和住宅院落之间的主街"},
    {id:"oldtown-east",name:"老城东侧路",type:"street",width:20,lanes:2,points:[[350,.08,1090],[350,.08,2360]],description:"沿河住宅、社区服务与南岸商业之间的道路"},
    {id:"oldtown-bridge",name:"西湾跨江桥",type:"bridge",width:24,lanes:2,points:[[-1400,.08,610],[-1400,.08,638],[-1400,20,770],[-1400,20,975],[-1400,.08,1140],[-1400,.08,1200]],description:"西城与南岸骑楼城区之间的开放桥梁，平顺桥头接通骑楼北街"},
    {id:"airport-link",name:"西湾空港大道",type:"arterial",width:34,lanes:4,points:[[-2450,.08,1200],[-1650,.08,1200],[-1580,.08,1650],[-1560,.08,2240]],description:"航站楼、接驳公交、出租车与高速道路相接的空港大道"},
    {id:"airport-service",name:"空港接驳环路",type:"street",width:10,lanes:2,closed:true,points:[[-2085,.08,1419],[-1715,.08,1419],[-1715,.08,2210],[-2085,.08,2210],[-2085,.08,1419]],description:"航站楼、停车落客与接驳公交之间的慢速服务环路"},
    {id:"raffles-gate",name:"朝天门滨江路",type:"arterial",width:28,lanes:4,points:[[1740,.08,1070],[1740,.08,1890],[2600,.08,1890]],description:"来福士的公交落客、江边商业与东岸社区街道"},
    {id:"wetland-road",name:"湿地社区路",type:"street",width:19,lanes:2,points:[[1730,.08,2200],[2560,.08,2200]],description:"住宅与湿地公园入口之间的慢速社区道路"},
    {id:"wetland-east-link",name:"东岸社区东路",type:"street",width:19,lanes:2,points:[[2560,.08,1890],[2560,.08,2200]],description:"滨江路与湿地入口之间的住宅社区连接"},
    {id:"wetland-west-link",name:"东岸社区西路",type:"street",width:19,lanes:2,points:[[1740,.08,1890],[1740,.08,2200]],description:"朝天门落客区和湿地公园之间的生活街"},
    {id:"tower-walk",name:"花城步行轴",type:"walk",width:14,lanes:0,points:[[1000,.25,1400],[1000,.25,2030]],description:"围绕地标的步行、休憩、餐饮和广场活动轴线"},
    {id:"north-riverwalk",name:"北岸滨江步道",type:"walk",width:12,lanes:0,points:[[-2250,.25,652],[280,.25,652],[490,.25,652],[2650,.25,652]],description:"公园、码头、文化建筑与城市夜景相连的沿江公共步道"},
    {id:"south-riverwalk",name:"南岸滨江绿道",type:"walk",width:12,lanes:0,points:[[-2300,.25,1050],[500,.25,1050],[1600,.25,1050],[2550,.25,1050]],description:"连接老城、广州塔片区、来福士与公共码头的步行骑行绿道"},
    {id:"science-west",name:"科创街西路",type:"street",width:22,lanes:2,points:[[-810,.08,-1380],[-810,.08,-630]],description:"金融区、鸟巢南侧社区与旧城之间的实际连接"},
    {id:"science-east",name:"科创街东路",type:"street",width:18,lanes:2,points:[[-270,.08,-1390],[-270,.08,-630]],description:"媒体住区与科创街南北生活路"},
    {id:"science-cross",name:"科创生活横街",type:"street",width:18,lanes:2,points:[[-890,.08,-1050],[-215,.08,-1050]],description:"商店、书院和城市院落组成紧凑街道"},
    {id:"science-north",name:"体育场南街",type:"street",width:18,lanes:2,points:[[-810,.08,-1340],[-215,.08,-1340]],description:"体育场活动区与日常住区的街边联系"},
    {id:"canal-city-cross",name:"运河社区桥",type:"bridge",width:20,lanes:2,points:[[-215,.08,-1120],[248,.08,-1120],[298,11,-1120],[446,11,-1120],[506,.08,-1120],[900,.08,-1120]],description:"两岸生活街跨过真实运河，桥下保留船行与飞行空间"},
    {id:"canal-east-local",name:"运河东岸生活路",type:"street",width:18,lanes:2,points:[[810,.08,-1390],[810,.08,-410]],description:"北城、科技办公和旧港区之间的生活街"},
    {id:"west-bridge-approach",name:"西湾桥北接线",type:"street",width:22,lanes:2,points:[[-1750,.08,610],[-1400,.08,610]],description:"金融大道与跨江桥相接，长途公交实际通行"},
    {id:"oldtown-flower-link",name:"南岸社区连接",type:"street",width:20,lanes:2,points:[[550,.08,1200],[825,.08,1200]],description:"骑楼北街接通广州塔西街，补齐两片城区之间的道路"},
    {id:"oldtown-riverlane",name:"滨江生活街",type:"street",width:14,lanes:2,points:[[-1400,.08,1090],[350,.08,1090]],description:"绿道后方的连续滨江住宅、餐馆与社区交通"},
    {id:"flower-east-local",name:"花城东侧邻里路",type:"street",width:20,lanes:2,points:[[1570,.08,1180],[1570,.08,2200],[1740,.08,2200]],description:"新商住街区、南岸社区路和东岸湿地相连"},
    {id:"rail-access-west",name:"西湾站接驳路",type:"street",width:18,lanes:2,points:[[-1660,.08,-2130],[-1660,.08,-2010]],description:"轨道站楼梯和车站广场接到金融大道"},
    {id:"rail-access-east",name:"东港站接驳路",type:"street",width:18,lanes:2,points:[[1710,.08,-2165],[1710,.08,-2010]],description:"高架列车、公交和港区工作街之间的实际接驳"},
    {id:"science-south",name:"科创南侧街",type:"street",width:18,lanes:2,points:[[-810,.08,-630],[-215,.08,-630]],description:"金融区联络横街与科创生活街的完整连接"},
    {id:"flower-local-north",name:"东岸邻里北街",type:"street",width:20,lanes:2,points:[[1145,.08,1180],[1740,.08,1180]],description:"广州塔东路、邻里商业与朝天门水岸相接"},
    {id:"rail-terminal-east",name:"东港终点站接驳路",type:"street",width:18,lanes:2,points:[[2300,.08,-2160],[2300,.08,-2010]],description:"终点站、城市公交和东港物流大道相连"}
  ]);
  ROADS.forEach(function(r){if(["ramp","bridge"].includes(r.type))r.points=gradeCorners(r.points,r.type==="bridge"?38:28);});
  var JUNCTIONS=Object.freeze([
    {id:"flower-east-cross",x:1145,z:1630,phase:0,width:30},
    {id:"flower-west-cross",x:825,z:1630,phase:8,width:22},
    {id:"flower-pedestrian-cross",x:1000,z:1630,phase:15,width:26},
    {id:"flower-east-south",x:1145,z:2110,phase:16,width:30},
    {id:"financial-west-north",x:-1750,z:-1380,phase:10,width:28},
    {id:"financial-east-south",x:-890,z:-710,phase:23,width:26},
    {id:"cultural-west-cross",x:900,z:-410,phase:4,width:28},
    {id:"cultural-east-cross",x:1440,z:-410,phase:12,width:28},
    {id:"civic-services",x:900,z:-2010,phase:19,width:30},
    {id:"oldtown-market",x:-530,z:1200,phase:27,width:22},
    {id:"oldtown-south",x:-530,z:2170,phase:6,width:22},
    {id:"oldtown-centre",x:-530,z:1552,phase:42,width:20},
    {id:"port-cross",x:2380,z:-860,phase:11,width:32},
    {id:"science-west-cross",x:-810,z:-1050,phase:5,width:22},
    {id:"science-east-cross",x:-270,z:-1050,phase:18,width:22},
    {id:"flower-local-cross",x:1570,z:1630,phase:27,width:26}
  ]);
  function segments(road){var result=[],total=0;for(var i=0;i<road.points.length-1;i++){var a=road.points[i],b=road.points[i+1],delta=b.map(function(v,j){return v-a[j];}),length=Math.hypot.apply(Math,delta);result.push({a:a,b:b,delta:delta,length:length,start:total});total+=length;}return {segments:result,length:total};}
  function sample(road,distance,offset){var path=road._path||segments(road);distance=((distance%path.length)+path.length)%path.length;var seg=path.segments[path.segments.length-1];for(var i=0;i<path.segments.length;i++)if(distance<path.segments[i].start+path.segments[i].length){seg=path.segments[i];break;}
    var t=(distance-seg.start)/seg.length,yaw=Math.atan2(seg.delta[0],seg.delta[2]),pitch=-Math.asin(seg.delta[1]/seg.length),side=offset||0;
    return {x:seg.a[0]+seg.delta[0]*t+Math.cos(yaw)*side,y:seg.a[1]+seg.delta[1]*t,z:seg.a[2]+seg.delta[2]*t-Math.sin(yaw)*side,yaw:yaw,pitch:pitch};}
  function curbPieces(b,id,a,c,road,side){var dx=c[0]-a[0],dz=c[2]-a[2],length=Math.hypot(dx,dz),cuts=[];
    if(road.points.length>2)cuts.push([0,Math.min(1,12/length)],[Math.max(0,1-12/length),1]);
    JUNCTIONS.forEach(function(j){var t=((j.x-a[0])*dx+(j.z-a[2])*dz)/(length*length),x=a[0]+dx*t,z=a[2]+dz*t;if(t>=0&&t<=1&&Math.hypot(x-j.x,z-j.z)<road.width/2+1){var half=(j.width/2+4)/length;cuts.push([Math.max(0,t-half),Math.min(1,t+half)]);}});
    // Every physical street crossing needs a curb opening, including unsignalled
    // side streets. A signal list is not a complete map of road connections.
    ROADS.forEach(function(other){if(other===road||other.type==="walk")return;segments(other).segments.forEach(function(s){var ex=s.delta[0],ez=s.delta[2],cross=dx*ez-dz*ex;if(Math.abs(cross)<.001)return;var ax=s.a[0]-a[0],az=s.a[2]-a[2],t=(ax*ez-az*ex)/cross,u=(ax*dz-az*dx)/cross;if(t<-.01||t>1.01||u<-.01||u>1.01)return;var y=a[1]+(c[1]-a[1])*t,oy=s.a[1]+s.delta[1]*u;if(Math.abs(y-oy)>.55)return;var half=(other.width/2+6)/(length*Math.max(.25,Math.abs(cross)/(length*Math.hypot(ex,ez))));cuts.push([Math.max(0,t-half),Math.min(1,t+half)]);});});
    cuts.sort(function(a,c){return a[0]-c[0];});cuts.push([1,1]);var cursor=0,index=0,yaw=Math.atan2(dx,dz),offset=road.width/2*side;
    cuts.forEach(function(cut){if(cut[0]-cursor>.0001){var p=a.map(function(v,i){return v+(c[i]-v)*cursor;}),q=a.map(function(v,i){return v+(c[i]-v)*cut[0];});b.beam(id+"-"+index++,[p[0]+Math.cos(yaw)*offset,p[1]+.25,p[2]-Math.sin(yaw)*offset],[q[0]+Math.cos(yaw)*offset,q[1]+.25,q[2]-Math.sin(yaw)*offset],.28,"ivory");}cursor=Math.max(cursor,cut[1]);});
  }
  function raisedGaps(road,path){var gaps=[];
    if(road.type==="ramp")gaps.push([0,75],[path.length-90,path.length]);
    if(road.type==="bridge")gaps.push([0,30],[path.length-35,path.length]);
    if(road.id==="north-link")gaps.push([0,350],[460,790],[path.length-350,path.length]);
    if(road.id==="ring-express")[[1520,2450],[-1940,-2400],[2700,-1560],[-2390,-2400],[2540,-2400]].forEach(function(p){var best=Infinity,distance=0;path.segments.forEach(function(seg){var dx=seg.b[0]-seg.a[0],dz=seg.b[2]-seg.a[2],t=Math.max(0,Math.min(1,((p[0]-seg.a[0])*dx+(p[1]-seg.a[2])*dz)/(dx*dx+dz*dz))),delta=Math.hypot(seg.a[0]+dx*t-p[0],seg.a[2]+dz*t-p[1]);if(delta<best){best=delta;distance=seg.start+t*seg.length;}});gaps.push([distance-88,distance+88]);});
    ROADS.forEach(function(other){if(other===road||other.type==="walk")return;var op=segments(other);path.segments.forEach(function(a){op.segments.forEach(function(c){var dx=a.delta[0],dz=a.delta[2],ex=c.delta[0],ez=c.delta[2],cross=dx*ez-dz*ex;if(Math.abs(cross)<.001)return;var ax=c.a[0]-a.a[0],az=c.a[2]-a.a[2],t=(ax*ez-az*ex)/cross,u=(ax*dz-az*dx)/cross;if(t<0||t>1||u<0||u>1||Math.abs(a.a[1]+t*a.delta[1]-c.a[1]-u*c.delta[1])>.55)return;var d=a.start+t*a.length,half=(other.width/2+7)/Math.max(.25,Math.abs(cross)/(Math.hypot(dx,dz)*Math.hypot(ex,ez)));gaps.push([d-half,d+half]);});});});return gaps;
  }
  function raisedEdge(b,id,seg,road,side,height,width,tint,gaps){var cuts=gaps.map(function(g){return [Math.max(0,(g[0]-seg.start)/seg.length),Math.min(1,(g[1]-seg.start)/seg.length)];}).filter(function(g){return g[1]>g[0];}).sort(function(a,c){return a[0]-c[0];});cuts.push([1,1]);var cursor=0,index=0,yaw=Math.atan2(seg.delta[0],seg.delta[2]),offset=side*road.width/2;
    cuts.forEach(function(cut){if(cut[0]-cursor>.0001){var a=seg.a.map(function(v,i){return v+seg.delta[i]*cursor;}),c=seg.a.map(function(v,i){return v+seg.delta[i]*cut[0];});b.beam(id+"-"+index++,[a[0]+Math.cos(yaw)*offset,a[1]+height,a[2]-Math.sin(yaw)*offset],[c[0]+Math.cos(yaw)*offset,c[1]+height,c[2]-Math.sin(yaw)*offset],width,tint);}cursor=Math.max(cursor,cut[1]);});
  }
  function authorRoad(b,road){b.site("road-"+road.id,road.name,0,0,road.description,function(b){
    var path=segments(road),isRaised=["express","ramp","bridge"].includes(road.type),walk=road.type==="walk",gaps=isRaised?raisedGaps(road,path):[];
    road.points.forEach(function(p,i){if(i===road.points.length-1&&road.closed)return;
      // Round end caps join the two full-width decks at their actual elevation.
      // Rectangles with tiny longitudinal overlap leave wedges at bends.
      var before=road.points[Math.max(0,i-1)],after=road.points[Math.min(road.points.length-1,i+1)];
      if(isRaised&&(Math.abs(before[1]-p[1])>.001||Math.abs(after[1]-p[1])>.001))return;
      b.cylinder("deck-join-"+i,p[0],p[1],p[2],road.width/2,walk?.24:.38,road.width/2,walk?"stone":"asphalt",{material:walk?2:11});
    });
    path.segments.forEach(function(seg,i){var a=seg.a,c=seg.b,centre=a.map(function(v,j){return (v+c[j])/2;}),yaw=Math.atan2(seg.delta[0],seg.delta[2]),pitch=-Math.asin(seg.delta[1]/seg.length);
      b.part("surface-"+i,centre[0],centre[1],centre[2],road.width,walk?.24:.38,seg.length+.4,walk?"stone":"asphalt",{material:walk?2:11,wx:3.1,wy:3.5,yaw:yaw,pitch:pitch});
      if(isRaised){b.part("box-girder-"+i,centre[0],centre[1]-1.10,centre[2],road.width-1.2,1.9,seg.length+.6,"stone",{yaw:yaw,pitch:pitch});
        if(road.type==="express")raisedEdge(b,"central-barrier-"+i,seg,road,0,.64,.52,"ivory",gaps);}
      [-1,1].forEach(function(side){var dx=Math.cos(yaw)*road.width/2*side,dz=-Math.sin(yaw)*road.width/2*side;
        if(isRaised)raisedEdge(b,"curb-"+i+"-"+side,seg,road,side,.25,.28,"silver",gaps);else if(!walk)curbPieces(b,"curb-"+i+"-"+side,a,c,road,side);else b.beam("curb-"+i+"-"+side,[a[0]+dx,a[1]+.25,a[2]+dz],[c[0]+dx,c[1]+.25,c[2]+dz],.16,"ivory",{solid:false});
        if(isRaised)raisedEdge(b,"guardrail-"+i+"-"+side,seg,road,side,1.25,.23,"silver",gaps);
        else if(!walk)b.part("sidewalk-"+i+"-"+side,centre[0]+dx+Math.cos(yaw)*2.0*side,centre[1]+.19,centre[2]+dz-Math.sin(yaw)*2.0*side,3.9,.28,seg.length,"stone",{material:2,wx:2.7,wy:3,yaw:yaw,pitch:pitch});
      });
    });
    if(!walk){for(var lane=1;lane<road.lanes;lane++){
      var offset=(lane/road.lanes-.5)*road.width;
      for(var distance=4;distance<path.length-4;distance+=14){var a=sample(road,distance,offset),c=sample(road,Math.min(distance+6,path.length-.1),offset);
        b.beam("lane-line-"+lane+"-"+Math.round(distance),[a.x,a.y+.25,a.z],[c.x,c.y+.25,c.z],.14,lane===road.lanes/2?"gold":"ivory",{material:6,emission:.06,solid:false});
      }
    }}
    for(var d=28;d<path.length-24;d+=isRaised?91:76){var p=sample(road,d,road.width/2+1.1);
      if(!isRaised||!gaps.some(function(g){return d>=g[0]&&d<=g[1];})){
      b.cylinder("lamp-post-"+Math.round(d),p.x,p.y+4.8,p.z,.17,9.6,.17,"silver");
      b.light("lamp-head-"+Math.round(d),p.x-1.3*Math.cos(p.yaw),p.y+9.6,p.z+1.3*Math.sin(p.yaw),"warm",isRaised?40:34);
      b.beam("lamp-arm-"+Math.round(d),[p.x,p.y+9.6,p.z],[p.x-1.3*Math.cos(p.yaw),p.y+9.6,p.z+1.3*Math.sin(p.yaw)],.16,"silver");
      }
      if(isRaised&&p.y>4){var px=p.x-road.width*.43*Math.cos(p.yaw),pz=p.z+road.width*.43*Math.sin(p.yaw);b.cylinder("viaduct-pier-"+Math.round(d),px,(p.y-2)/2,pz,1.25,p.y-2,1.25,"stone");b.part("pier-cap-"+Math.round(d),px,p.y-2.2,pz,road.width*.81,1.3,3.3,"silver",{yaw:p.yaw});b.part("pier-footing-"+Math.round(d),px,.28,pz,4.6,.56,5.2,"stone",{yaw:p.yaw});}
    }
    if(isRaised)for(var d=9;d<path.length-5;d+=12){if(gaps.some(function(g){return d>=g[0]&&d<=g[1];}))continue;[-1,1].forEach(function(side){var p=sample(road,d,side*(road.width/2-.18));b.cylinder("guard-post-"+side+"-"+d,p.x,p.y+.73,p.z,.055,1.12,.055,"silver");});if(d%36===9){var p=sample(road,d);b.part("deck-expansion-joint-"+d,p.x,p.y+.205,p.z,road.width-.7,.025,.16,"ink",{yaw:p.yaw,pitch:p.pitch,solid:false});}}
    if(isRaised){[path.length*.23,path.length*.61].forEach(function(d,i){var p=sample(road,d);b.beam("gantry-"+i,[p.x-Math.cos(p.yaw)*road.width*.45,p.y+6.7,p.z+Math.sin(p.yaw)*road.width*.45],[p.x+Math.cos(p.yaw)*road.width*.45,p.y+6.7,p.z-Math.sin(p.yaw)*road.width*.45],.35,"silver");
      b.part("direction-sign-"+i,p.x,p.y+6.7,p.z,8.5,2.1,.25,"teal",{yaw:p.yaw,material:6,emission:.2,solid:false});});}
  },{kind:"road",roadId:road.id});}
  function authorJunction(b,j){b.site("junction-"+j.id,"路口 · "+j.id,j.x,j.z,"带斑马线、信号灯、停止线与路边控制箱的真实路口",function(b){
    var edge=j.width/2+1.7;
    b.part("raised-crossing-table",0,.34,0,j.width+7,.14,j.width+7,"asphalt",{material:11});
    [-1,1].forEach(function(s){b.part("east-west-approach-"+s,s*(j.width/2+6),.27,0,5,.14,j.width,"asphalt",{material:11,roll:-s*.028});b.part("north-south-approach-"+s,0,.27,s*(j.width/2+6),j.width,.14,5,"asphalt",{material:11,pitch:s*.028});});
    [-1,1].forEach(function(sign){for(var i=-4;i<=4;i++){
      b.part("east-west-crossing-"+sign+"-"+i,i*2.25,.43,sign*edge,1.0,.04,5.0,"ivory",{material:6,emission:.05,solid:false});
      b.part("north-south-crossing-"+sign+"-"+i,sign*edge,.43,i*2.25,5.0,.04,1.0,"ivory",{material:6,emission:.05,solid:false});
    }});
    [[-edge,-edge],[edge,-edge],[edge,edge],[-edge,edge]].forEach(function(p,i){b.cylinder("signal-pole-"+i,p[0],2.5,p[1],.14,5,.14,"silver");b.part("signal-housing-"+i,p[0],4.5,p[1],.52,1.7,.32,"ink",{yaw:i*Math.PI/2});});
    b.part("signal-control-box",-edge-1.4,.7,-edge,1.1,1.4,.7,"stone");
  },{kind:"junction",junctionId:j.id});}
  function author(b){ROADS.forEach(function(r){authorRoad(b,r);});JUNCTIONS.forEach(function(j){authorJunction(b,j);});}
  return Object.freeze({ROADS:ROADS,JUNCTIONS:JUNCTIONS,author:author,segments:segments,sample:sample});
});
