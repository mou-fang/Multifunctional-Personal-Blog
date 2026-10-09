(function(root,factory){var api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.CityShuttleCore=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function grid(width,height,detailed){var columns=clamp(Math.floor(width/(detailed?4.5:6)),144,detailed?320:240);var aspect=width/Math.max(height,1);return {columns:columns,rows:clamp(Math.round(columns*.68/aspect),48,160),aspect:aspect};}
  function flags(keys){return (keys.KeyW?1:0)|(keys.KeyS?2:0)|(keys.KeyA?4:0)|(keys.KeyD?8:0)|((keys.ShiftLeft||keys.ShiftRight)&&keys.KeyW?16:0)|((keys.KeyE||keys.Space)?32:0)|(keys.KeyQ?64:0);}
  function district(x,z){var city=typeof window!=="undefined"?window.CityShuttleCity:null;var name=city&&city.district(x,z);if(name)return name;if(x>440)return "潮仓港区";if(x>240)return "镜河滨水";if(x< -300&&z>0)return "月台花园";if(x< -210)return "旧工坊区";if(z< -350)return "北城天际线";if(z< -90)return "冠塔与通光廊";return "雨巷大道";}
  return Object.freeze({grid:grid,flags:flags,district:district,clamp:clamp});
});
