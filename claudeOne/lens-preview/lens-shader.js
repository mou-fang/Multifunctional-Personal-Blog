/* Derived from Lens GlassRenderer LENS, MIT, ruiqichenbiec/design-systems
 * Copyright (c) 2026 DayDreamInAReverie.
 * commit 7a424c93b9be13cf835b91ea67495fec2ec0584e.
 * Original license: ../libs/lens-1.1.0-showcase.1-20261017/LICENSE.
 * Only the subpixel blur path is optimized; all optical effects are retained.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export const lensFragment = `#version 300 es
precision highp float;
in vec2 vPixel;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec2 uResolution;
uniform vec4 uBox;
uniform vec2 uLocalSize;
uniform mat2 uInverse;
uniform vec2 uBend;
uniform float uPressure;
uniform float uEnergy;
uniform vec2 uPointer;
uniform float uRadius;
uniform float uScale;
uniform float uRefraction;
uniform float uBlur;
uniform float uDispersion;
uniform float uTint;
uniform float uDark;
uniform float uCompare;
uniform float uHover;
uniform vec4 uAccent;
uniform float uOpacity;
uniform float uOpticKind;
uniform vec4 uOptic;
uniform vec3 uEmission;
uniform float uFlow;
uniform float uZoom;
uniform float uWaveTime;

float roundedBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x,q.y),0.) + length(max(q,0.)) - r;
}
float surfaceDistance(vec2 world){
  vec2 p=uInverse*world;
  vec2 halfSize=uLocalSize*.5;
  vec2 q=clamp(p/max(halfSize,vec2(1.)),vec2(-1.3),vec2(1.3));
  // A dragged surface bows between its corners, then settles with the spring.
  // This same shape drives silhouette, refraction normals and specular light.
  p -= uBend * vec2(1.-q.y*q.y,1.-q.x*q.x)*.7;
  float r=min(uRadius*(1.+uPressure*.15),min(halfSize.x,halfSize.y));
  return roundedBox(p,halfSize,r);
}
vec3 sampleScene(vec2 px){
  return texture(uScene,clamp(px/uResolution,vec2(.001),vec2(.999))).rgb;
}
vec3 blurred(vec2 px, float blur){
  // At subpixel blur the hardware bilinear sample already filters the grid.
  // Keep the full nine-tap blur for the upstream soft/thick presets.
  if(blur <= .5*uScale) return sampleScene(px);
  vec3 c = sampleScene(px) * .24;
  c += sampleScene(px + vec2(blur,0.)) * .12;
  c += sampleScene(px - vec2(blur,0.)) * .12;
  c += sampleScene(px + vec2(0.,blur)) * .12;
  c += sampleScene(px - vec2(0.,blur)) * .12;
  c += sampleScene(px + vec2(blur,blur)*.707) * .07;
  c += sampleScene(px - vec2(blur,blur)*.707) * .07;
  c += sampleScene(px + vec2(blur,-blur)*.707) * .07;
  c += sampleScene(px + vec2(-blur,blur)*.707) * .07;
  return c;
}
void main(){
  vec2 center = uBox.xy + uBox.zw * .5;
  vec2 p = vPixel - center;
  vec2 b = uLocalSize * .5;
  vec2 local = uInverse*p;
  vec2 opticalUV = clamp(local/max(uLocalSize,vec2(1.))+.5,0.,1.);
  float d = surfaceDistance(p);
  vec3 base = sampleScene(vPixel);
  bool progressGlass = uOpticKind > .5 && uOpticKind < 1.5;
  bool wellGlass = uOpticKind > 1.5 && uOpticKind < 2.5;
  bool fieldGlass = uOpticKind > 2.5 && uOpticKind < 3.5;
  bool magnifier = uOpticKind > 3.5;
  float filled = progressGlass ? (1.-smoothstep(uOptic.x-.007,uOptic.x+.007,opticalUV.x))*step(.0001,uOptic.x) : 0.;
  vec3 sourceColor = mix(vec3(.42,.86,1.),uEmission,uOptic.y);
  vec2 emitter = vec2(-b.x+uLocalSize.x*uOptic.x,0.);
  float sourceGlow = exp(-length((local-emitter)/vec2(23.,15.)/uScale)*1.6)*step(.0001,uOptic.x);
  float halo = exp(-max(d,0.)/(7.*uScale));
  if(progressGlass) base += sourceColor*(sourceGlow*.23+halo*uOptic.y*.075)*uOpacity;
  if(wellGlass) base += vec3(.37,.8,1.)*halo*uOptic.w*.14*uOpacity;
  if(uOptic.z>0.) base += uEmission*halo*uOptic.z*.055*uOpacity;
  float shadowD = surfaceDistance(p+vec2(0.,(5.+uPressure*3.)*uScale));
  float shadow = exp(-max(shadowD,0.)/((7.+uPressure*2.)*uScale))*.078;
  base *= 1. - shadow * uOpacity * smoothstep(-.5*uScale,1.5*uScale,d);
  if(d > 1.5*uScale){outColor=vec4(base,1.);return;}

  float e = .7 * uScale;
  vec2 n2 = normalize(vec2(
    surfaceDistance(p+vec2(e,0.))-surfaceDistance(p-vec2(e,0.)),
    surfaceDistance(p+vec2(0.,e))-surfaceDistance(p-vec2(0.,e))
  )+vec2(.00001));
  float bevel = min(min(b.x,b.y)*.48,19.*uScale);
  float edge = clamp(1.+d/bevel,0.,1.);
  float slope = pow(edge,1.65)*.94;
  vec2 faceNormal=clamp(p/max(b,vec2(1.)),vec2(-1.),vec2(1.))*.045*(1.-edge);
  vec2 normalXY=n2*slope+faceNormal;
  if(wellGlass) normalXY *= mix(-1.,1.,uOptic.z);
  vec3 normal = vec3(normalXY,sqrt(max(1.-dot(normalXY,normalXY),.001)));
  // Snell's law: air (1.0) -> a glass-like medium (1.45).
  vec3 ray = refract(vec3(0.,0.,-1.),normal,1./1.45);
  float thickness = (18.+uRefraction*57.)*uScale*(1.+uPressure*.13+uEnergy*.12);
  vec2 offset = ray.xy/max(-ray.z,.05)*thickness*uRefraction;
  offset -= p * .016 * uRefraction;
  offset *= 1.+filled*.85;
  if(progressGlass) offset.y += sin(opticalUV.x*24.-uWaveTime*2.2)*filled*2.4*uScale;
  offset *= 1.-uCompare;
  vec2 at = vPixel + offset;
  if(magnifier) at = center+p/max(uZoom,1.)+offset*.18;
  float blur = uBlur * 10. * uScale + uCompare * 5. * uScale;
  blur *= magnifier ? .12 : 1.-filled*.65;
  vec3 c = blurred(at,blur);
  vec2 split = n2*pow(edge,2.8)*uDispersion*2.6*uScale*(1.-uCompare);
  c.r += (sampleScene(at+split).r-sampleScene(at).r)*.8;
  c.b += (sampleScene(at-split).b-sampleScene(at).b)*.8;
  // Very slight saturation lift plus an adaptive, readable material tint.
  float luma = dot(c,vec3(.2126,.7152,.0722));
  c = mix(vec3(luma),c,1.035);
  vec3 tint = mix(vec3(.97,.985,1.),vec3(.16,.24,.34),uDark);
  c = mix(c,tint,uTint+uBlur*.12+uCompare*.11+uDark*.10);
  c = mix(c,uAccent.rgb,uAccent.a);
  if(fieldGlass){
    vec2 q=clamp((local+b-vec2(40.*uScale))/max(uLocalSize-vec2(80.*uScale),vec2(1.)),0.,1.);
    vec3 low=mix(vec3(.50,.66,.82),vec3(.89,.69,.47),q.x);
    vec3 high=mix(vec3(.60,.55,.69),vec3(.83,.58,.59),q.x);
    c=mix(low,high,q.y);
    vec2 lines=abs(fract(q*8.+.5)-.5)/max(fwidth(q*8.),vec2(.001));
    float grid=1.-smoothstep(.2,.9,min(lines.x,lines.y));
    float axes=1.-smoothstep(.002,.006,min(abs(q.x-.5),abs(q.y-.5)));
    c=mix(c,vec3(.97),grid*.18+axes*.26);
  }

  vec2 light = normalize(uPointer-center+vec2(-80.,150.)*uScale);
  float directional = pow(max(dot(n2,light),0.),7.);
  float opposite = pow(max(dot(n2,-light),0.),7.)*.52;
  float fresnel = .04+.96*pow(1.-normal.z,5.);
  float outline = 1.-smoothstep(.12*uScale,1.1*uScale,abs(d+.65*uScale));
  float edgeLight = (directional+opposite)*pow(edge,4.);
  float spec = edgeLight*.065 + outline*(.018+directional*.35+opposite*.15);
  spec += fresnel*.035;
  spec *= 1.-uCompare;
  vec3 environment=sampleScene(vPixel+n2*34.*uScale);
  c=mix(c,environment,fresnel*.12*(1.-uCompare));
  c += mix(vec3(1.),environment,.18)*spec;
  float caustic=exp(-pow((d+3.*uScale)/(1.65*uScale),2.));
  c += caustic*opposite*.038*(1.-uCompare);
  // A broad, quiet reflection follows the pointer inside the material.
  float glint = exp(-length((vPixel-uPointer)/vec2(180.,150.)/uScale)*2.);
  c += glint*.024*(.4+uHover)*(1.-uCompare);
  vec2 face=p/max(b,vec2(1.));
  float broadReflection=exp(-pow((face.x*.55+face.y*.8-light.x*.4)*1.6,2.));
  vec3 ambient=sampleScene(center+vec2(-b.x*.6,b.y*.55));
  c=mix(c,clamp(ambient+vec3(.15),0.,1.),broadReflection*(.045+uPressure*.035)*(1.-uCompare));
  c -= pow(edge,8.)*max(dot(n2,vec2(.45,-.89)),0.)*.085*(1.-uCompare);
  if(wellGlass){
    // Reverse the bevel and occlusion: the receiver sits below the glass plane.
    c -= pow(edge,2.)*max(dot(n2,normalize(vec2(-.4,.9))),0.)*.24*(1.-uOptic.z);
    c += pow(edge,4.)*max(dot(n2,normalize(vec2(.4,-.9))),0.)*.19*(1.-uOptic.z);
    c += vec3(.3,.76,1.)*uOptic.w*(pow(edge,3.)*.35+.04);
    c=mix(c,c*vec3(.89,1.04,.95)+uEmission*.045,uOptic.z*.55);
  }
  float phase=fract(atan(local.y/max(b.y,1.),local.x/max(b.x,1.))/6.2831853+.5);
  float travel=fract(phase-uFlow*1.15+1.);
  float flow=uFlow>=0. ? exp(-pow(travel/.105,2.))*sin(3.14159265*clamp(uFlow,0.,1.)) : 0.;
  float lightEdge=exp(-pow((d+1.4*uScale)/(1.25*uScale),2.));
  float innerEdge=exp(-pow((d+4.*uScale)/(3.*uScale),2.));
  if(progressGlass){
    float fiberY=local.y/uScale-sin(opticalUV.x*16.-uWaveTime*2.8)*1.5-sin(opticalUV.x*31.-uWaveTime*4.1)*.35;
    float fiber=exp(-pow(fiberY/1.0,2.))*.24+exp(-pow((fiberY-5.)/.65,2.))*.11;
    float spark=exp(-pow((fract(opticalUV.x-uWaveTime*.12)-.08)/.065,2.));
    c += sourceColor*(filled*(fiber*(1.+spark*.42)+innerEdge*.10)+sourceGlow*.42+lightEdge*uOptic.y*.26);
    c += mix(vec3(.8,.98,1.),uEmission,uOptic.y)*(lightEdge*.75+innerEdge*.15)*flow;
  }
  c += uEmission*uOptic.z*(lightEdge*.28+innerEdge*.045);
  if(!progressGlass) c += mix(uEmission,vec3(1.),.45)*uOptic.z*(lightEdge*.8+innerEdge*.18)*flow;
  float aa=max(fwidth(d)*.7,.5*uScale);
  float mask = 1.-smoothstep(-aa,aa,d);
  outColor=vec4(mix(base,c,mask*uOpacity),1.);
}`;
