const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const load = () => import(pathToFileURL(path.join(__dirname,'../lens-preview/renderer-performance.js')).href);

test('player glass allocates once for the entire spring trajectory, including reversals', async () => {
  const {bufferPlan} = await load();
  for (const [w,h,ratio] of [[1440,1000,1.25],[2543,1100,1.25],[390,844,3],[320,740,2]]) {
    let plan, allocations=0;
    for (let i=0;i<160;i++) {
      const progress=(1-Math.cos(i/159*Math.PI*4))/2;
      const next=bufferPlan({width:100+(w-100)*progress,height:190-70*progress},{w,h},{player:true,previous:plan,pixelRatio:ratio});
      if (!plan || plan.width!==next.width || plan.height!==next.height) allocations++;
      assert.ok(next.width>=Math.ceil(w*next.dpr)); assert.ok(next.height>=Math.ceil(224*next.dpr));
      assert.ok(next.dpr<=1); plan=next;
    }
    assert.equal(allocations,1,'no per-frame WebGL texture reallocations');
    assert.ok(w*h*plan.dpr**2<=1600001,'cap glass resolution on large/high-DPI screens');
    const smaller=bufferPlan({width:100,height:190},{w:320,h:740},{player:true,previous:plan,pixelRatio:ratio});
    assert.equal(smaller.viewportW,320,'window resize releases the previous viewport allocation');
  }
});

test('overlapping glass composites retain every source pixel while avoiding full-frame copies', async () => {
  const {installRegionCopies} = await load();
  const width=128,height=96,size=width*height;
  const regions=Array.from({length:32},(_,i)=>[11+(i*7)%82,8+(i*13)%61,10+i%13,8+i%9]);
  function compose(optimized,phase) {
    let source=Float64Array.from({length:size},(_,i)=>((i*17+phase*31)%257)/257), destination=new Float64Array(size).fill(-999);
    let pixels=0;
    const gl={blitFramebuffer(x,y,right,top,dx,dy,dright,dtop) {
      assert.equal(x,dx); assert.equal(y,dy); assert.equal(right,dright); assert.equal(top,dtop);
      for (let row=y;row<top;row++) for (let col=x;col<right;col++) destination[row*width+col]=source[row*width+col];
      pixels+=(right-x)*(top-y);
    }};
    const renderer={gl,width,height}, copies=optimized?installRegionCopies(renderer):null;
    copies?.begin();
    for (const [x,y,w,h] of regions) {
      gl.blitFramebuffer(0,0,width,height,0,0,width,height,1,2);
      copies?.lens([x,y,w,h]);
      // Refraction reads beyond the current lens and includes previous lenses.
      for (let row=y;row<y+h;row++) for (let col=x;col<x+w;col++) {
        const at=row*width+col, sample=Math.min(size-1,Math.max(0,at-width*3+5));
        destination[at]=source[at]*.2+source[sample]*.8+.013;
      }
      [source,destination]=[destination,source];
    }
    return {image:source,pixels,stats:copies?.stats};
  }
  for (const phase of [0,1,13]) {
    const original=compose(false,phase), optimized=compose(true,phase);
    assert.deepEqual(optimized.image,original.image,'nested lenses must sample the same accumulated image');
    assert.equal(optimized.stats.fullCopies,1);
    assert.ok(optimized.pixels<original.pixels*.08,'reduce copied pixels by more than 92% in this fixture');
  }
});

test('fractional clipped lens edges copy all touched pixels', async () => {
  const {installRegionCopies} = await load(), calls=[];
  const gl={blitFramebuffer(...args){calls.push(args);}}, renderer={gl,width:100,height:100};
  const copies=installRegionCopies(renderer); copies.begin();
  gl.blitFramebuffer(0,0,100,100,0,0,100,100,1,2);
  copies.lens([12.8,31.2,20.9,19.5]); gl.blitFramebuffer(0,0,100,100,0,0,100,100,1,2);
  assert.deepEqual(calls[1],[12,31,34,51,12,31,34,51,1,2]);
  copies.destroy();
});
