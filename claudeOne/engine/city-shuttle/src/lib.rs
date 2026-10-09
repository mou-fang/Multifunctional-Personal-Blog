//! Authored-world ASCII ray caster. No external crates or JavaScript math imports.
use std::cell::RefCell;

const STRIDE: usize = 26;
const FAR: f32 = 10000.0;
#[inline(always)] fn small(a:f32,b:f32)->f32 {if a<b {a}else{b}}
#[inline(always)] fn large(a:f32,b:f32)->f32 {if a>b {a}else{b}}
#[inline(always)] fn fract(v:f32)->f32 {v-v.floor()}
#[inline(always)] fn area(lo:V,hi:V)->f32 {let s=hi.sub(lo);s.x*s.y+s.x*s.z+s.y*s.z}
fn sign_row(glyph:u8,row:usize)->u8 {
    // Original block-letter strokes sampled in world space; signs do not repeat a letter per cell.
    let rows=match glyph {
        b'A'=>[14,17,17,31,17,17,17],b'B'=>[30,17,17,30,17,17,30],b'C'=>[14,17,16,16,16,17,14],
        b'D'=>[30,17,17,17,17,17,30],b'E'=>[31,16,16,30,16,16,31],b'F'=>[31,16,16,30,16,16,16],
        b'G'=>[14,17,16,23,17,17,15],b'H'=>[17,17,17,31,17,17,17],b'I'=>[14,4,4,4,4,4,14],
        b'J'=>[7,2,2,2,2,18,12],b'K'=>[17,18,20,24,20,18,17],b'L'=>[16,16,16,16,16,16,31],
        b'M'=>[17,27,21,21,17,17,17],b'N'=>[17,25,25,21,19,19,17],b'O'=>[14,17,17,17,17,17,14],
        b'P'=>[30,17,17,30,16,16,16],b'Q'=>[14,17,17,17,21,18,13],b'R'=>[30,17,17,30,20,18,17],
        b'S'=>[15,16,16,14,1,1,30],b'T'=>[31,4,4,4,4,4,4],b'U'=>[17,17,17,17,17,17,14],
        b'V'=>[17,17,17,17,17,10,4],b'W'=>[17,17,17,21,21,21,10],b'X'=>[17,17,10,4,10,17,17],
        b'Y'=>[17,17,10,4,4,4,4],b'Z'=>[31,1,2,4,8,16,31],
        b'0'=>[14,17,19,21,25,17,14],b'1'=>[4,12,4,4,4,4,14],b'2'=>[14,17,1,2,4,8,31],
        b'3'=>[30,1,1,14,1,1,30],b'4'=>[2,6,10,18,31,2,2],b'5'=>[31,16,16,30,1,1,30],
        b'6'=>[14,16,16,30,17,17,14],b'7'=>[31,1,2,4,8,8,8],b'8'=>[14,17,17,14,17,17,14],
        b'9'=>[14,17,17,15,1,1,14],b'/'=>[1,1,2,4,8,16,16],b'+'=>[0,4,4,31,4,4,0],
        b'-'=>[0,0,0,31,0,0,0],_=>[31,17,21,21,21,17,31]
    };rows[row.min(6)]
}
#[derive(Clone, Copy, Default, Debug)]
struct V { x: f32, y: f32, z: f32 }
impl V {
    fn new(x: f32, y: f32, z: f32) -> Self { Self { x, y, z } }
    fn add(self, b: Self) -> Self { Self::new(self.x+b.x,self.y+b.y,self.z+b.z) }
    fn sub(self, b: Self) -> Self { Self::new(self.x-b.x,self.y-b.y,self.z-b.z) }
    fn mul(self, s: f32) -> Self { Self::new(self.x*s,self.y*s,self.z*s) }
    fn dot(self, b: Self) -> f32 { self.x*b.x+self.y*b.y+self.z*b.z }
    fn cross(self,b:Self)->Self {Self::new(self.y*b.z-self.z*b.y,self.z*b.x-self.x*b.z,self.x*b.y-self.y*b.x)}
    fn unit(self) -> Self { self.mul(1.0/self.dot(self).sqrt().max(0.00001)) }
    fn axis(self, a: usize) -> f32 { match a { 0=>self.x,1=>self.y,_=>self.z } }
    fn min(self, b: Self) -> Self { Self::new(self.x.min(b.x),self.y.min(b.y),self.z.min(b.z)) }
    fn max(self, b: Self) -> Self { Self::new(self.x.max(b.x),self.y.max(b.y),self.z.max(b.z)) }
}
#[derive(Clone)]
struct Object { p: V, h: V, cos: f32, sin: f32, color: V, material: u32,
    glyph: u8, emission: f32, wx: f32, wy: f32, mask: u32, shape: u32,
    solid: bool, detail: f32, trim: V, phase: f32, lo: V, hi: V, basis:[V;3],tilted:bool,
    parameter:f32,vertices:[V;3] }
impl Object {
    fn local(&self, v: V) -> V { if self.tilted {V::new(v.dot(self.basis[0]),v.dot(self.basis[1]),v.dot(self.basis[2]))}else{V::new(self.cos*v.x-self.sin*v.z,v.y,self.sin*v.x+self.cos*v.z)} }
    fn world(&self, v: V) -> V { if self.tilted {self.basis[0].mul(v.x).add(self.basis[1].mul(v.y)).add(self.basis[2].mul(v.z))}else{V::new(self.cos*v.x+self.sin*v.z,v.y,-self.sin*v.x+self.cos*v.z)} }
    fn contains(&self,p:V,radius:f32)->bool {
        if self.shape==3 {
            let n=self.vertices[1].sub(self.vertices[0]).cross(self.vertices[2].sub(self.vertices[0])).unit();
            let distance=p.sub(self.vertices[0]).dot(n);
            return distance.abs()<radius&&self.triangle_inside(p.sub(n.mul(distance)),radius);
        }
        let p=self.local(p.sub(self.p));let h=self.h.add(V::new(radius,radius,radius));
        if self.shape==1 {let q=V::new(p.x/h.x,p.y/h.y,p.z/h.z);q.dot(q)<1.0}
        else if self.shape==2 {let factor=self.radius_at(p.y).max(0.02);let x=p.x/(self.h.x*factor+radius);let z=p.z/(self.h.z*factor+radius);p.y.abs()<h.y&&x*x+z*z<1.0}
        else {p.x.abs()<h.x&&p.y.abs()<h.y&&p.z.abs()<h.z}
    }
    fn radius_at(&self,y:f32)->f32 {1.0+(self.parameter.max(0.02)-1.0)*((y/self.h.y+1.0)*0.5)}
    fn triangle_inside(&self,p:V,padding:f32)->bool {
        let a=self.vertices[1].sub(self.vertices[0]);let b=self.vertices[2].sub(self.vertices[0]);let v=p.sub(self.vertices[0]);
        let aa=a.dot(a);let ab=a.dot(b);let bb=b.dot(b);let denom=aa*bb-ab*ab;
        if denom.abs()<0.0000001 {return false;}
        let u=(bb*v.dot(a)-ab*v.dot(b))/denom;let w=(aa*v.dot(b)-ab*v.dot(a))/denom;
        let area=a.cross(b).dot(a.cross(b)).sqrt();let longest=aa.max(bb).max(a.sub(b).dot(a.sub(b))).sqrt();
        let edge=padding/(area/longest.max(0.001)).max(0.001);u>=-edge&&w>=-edge&&u+w<=1.0+edge
    }
    fn intersect(&self, ro: V, rd: V, max_t: f32, inflate: f32) -> Option<(f32,V,V)> {
        if self.shape==3 {
            let edge1=self.vertices[1].sub(self.vertices[0]);let edge2=self.vertices[2].sub(self.vertices[0]);let normal=edge1.cross(edge2).unit();
            let denominator=normal.dot(rd);if denominator.abs()<0.0000001 {return None;}
            let facing=if denominator>0.0 {normal.mul(-1.0)}else{normal};
            let mut t=(normal.dot(self.vertices[0].sub(ro))-inflate*denominator.signum())/denominator;
            if t<=0.001&&inflate>0.0 {t=(normal.dot(self.vertices[0].sub(ro))+inflate*denominator.signum())/denominator;}
            if t<=0.001||t>=max_t {return None;}
            let point=ro.add(rd.mul(t));let on_plane=point.sub(normal.mul(normal.dot(point.sub(self.vertices[0]))));
            if !self.triangle_inside(on_plane,inflate) {return None;}
            return Some((t,facing,point.sub(self.p)));
        }
        let o=self.local(ro.sub(self.p)); let d=self.local(rd); let h=self.h.add(V::new(inflate,inflate,inflate));
        if self.shape==2 {
            let rx=self.h.x;let rz=self.h.z;let padding=inflate/rx.min(rz).max(0.001);
            let slope=(self.parameter.max(0.02)-1.0)/(2.0*self.h.y);
            let base=(1.0+self.parameter.max(0.02))*0.5+padding;
            let q0=base+slope*o.y;let qd=slope*d.y;
            let a=d.x*d.x/(rx*rx)+d.z*d.z/(rz*rz)-qd*qd;
            let b=o.x*d.x/(rx*rx)+o.z*d.z/(rz*rz)-q0*qd;
            let c=o.x*o.x/(rx*rx)+o.z*o.z/(rz*rz)-q0*q0;
            let mut closest=max_t;let mut result=None;let disc=b*b-a*c;
            if disc>=0.0 {
                let roots=if a.abs()<0.0000001 {[-c/(2.0*b),-c/(2.0*b)]}else{[(-b-disc.sqrt())/a,(-b+disc.sqrt())/a]};
                for t in roots {
                    let p=o.add(d.mul(t));
                    if t>0.001&&t<closest&&p.y.abs()<=h.y {closest=t;let factor=base+slope*p.y;
                        result=Some((t,V::new(p.x/(rx*rx),-slope*factor,p.z/(rz*rz)).unit(),p));}
                }
            }
            if d.y.abs()>0.0000001 {for sign in [-1.0,1.0] {
                let t=(sign*h.y-o.y)/d.y;let p=o.add(d.mul(t));let r=self.radius_at(sign*self.h.y).max(0.02)+padding;
                if t>0.001&&t<closest&&p.x*p.x/(rx*rx)+p.z*p.z/(rz*rz)<=r*r {closest=t;result=Some((t,V::new(0.0,sign,0.0),p));}
            }}
            return result;
        }
        if self.shape==1 {
            let q=V::new(o.x/h.x,o.y/h.y,o.z/h.z); let v=V::new(d.x/h.x,d.y/h.y,d.z/h.z);
            let a=v.dot(v); let b=q.dot(v); let c=q.dot(q)-1.0; let disc=b*b-a*c;
            if disc<0.0 { return None; }
            let t=(-b-disc.sqrt())/a; let t=if t>0.001 { t } else {(-b+disc.sqrt())/a};
            if t<=0.001 || t>=max_t {return None;}
            let point=o.add(d.mul(t));
            return Some((t,V::new(point.x/(h.x*h.x),point.y/(h.y*h.y),point.z/(h.z*h.z)).unit(),point));
        }
        let mut near=-FAR; let mut far=max_t; let mut axis=0; let mut sign=1.0;
        let mut exit_axis=0; let mut exit_sign=1.0;
        for a in 0..3 {
            let da=d.axis(a); let oa=o.axis(a); let ha=h.axis(a);
            if da.abs()<0.000001 { if oa.abs()>ha {return None;} continue; }
            let mut t0=(-ha-oa)/da; let mut t1=(ha-oa)/da; let mut s=-1.0;
            if t0>t1 {std::mem::swap(&mut t0,&mut t1);s=1.0;}
            if t0>near {near=t0;axis=a;sign=s;}
            if t1<far {far=t1;exit_axis=a;exit_sign=-s;}
            if near>far {return None;}
        }
        if far<0.001 {return None;}
        if near<0.001 {near=far;axis=exit_axis;sign=exit_sign;}
        if near>=max_t {return None;}
        let n=match axis {0=>V::new(sign,0.0,0.0),1=>V::new(0.0,sign,0.0),_=>V::new(0.0,0.0,sign)};
        let point=o.add(d.mul(near));
        if self.material==8 && inflate==0.0 {
            if n.z.abs()<0.5 {return None;}
            let column=(((point.x/h.x)*0.5+0.5)*5.0).floor().clamp(0.0,4.0) as u32;
            let row=(((1.0-point.y/h.y)*0.5)*7.0).floor().clamp(0.0,6.0) as usize;
            if sign_row(self.glyph,row)&(1<<(4-column))==0 {return None;}
        }
        if self.material==10 && inflate==0.0 && n.y.abs()<0.5 {
            let horizontal=if n.x.abs()>0.5 {point.z+h.z}else{point.x+h.x};
            let x=fract((horizontal+self.phase)/self.wx.max(1.0));let y=fract((point.y+h.y)/self.wy.max(1.0));
            if x>0.22 && x<0.78 && y>0.30 && y<0.85 {return None;}
        }
        Some((near,n,point))
    }
}
fn decode_object(a:&[f32])->Option<Object> {
    if a.len()!=STRIDE||a.iter().any(|v|!v.is_finite()) {return None;}
    let shape=a[16] as u32;
    let identity=[V::new(1.0,0.0,0.0),V::new(0.0,1.0,0.0),V::new(0.0,0.0,1.0)];
    if shape==3 {
        // Triangles use three world-space vertices, followed by colour and material.
        let vertices=[V::new(a[0],a[1],a[2]),V::new(a[3],a[4],a[5]),V::new(a[6],a[7],a[8])];
        if vertices[1].sub(vertices[0]).cross(vertices[2].sub(vertices[0])).dot(vertices[1].sub(vertices[0]).cross(vertices[2].sub(vertices[0])))<0.000001 {return None;}
        let lo=vertices[0].min(vertices[1]).min(vertices[2]);let hi=vertices[0].max(vertices[1]).max(vertices[2]);
        let p=vertices[0].add(vertices[1]).add(vertices[2]).mul(1.0/3.0);
        return Some(Object {p,h:hi.sub(lo).mul(0.5),cos:1.0,sin:0.0,color:V::new(a[9],a[10],a[11]),material:a[12] as u32,
            glyph:a[13] as u8,emission:a[14],wx:a[15],wy:a[18],mask:a[24] as u32,shape,solid:a[17]>0.5,detail:a[25],
            trim:V::new(a[20],a[21],a[22]),phase:a[19],lo:lo.sub(V::new(0.001,0.001,0.001)),hi:hi.add(V::new(0.001,0.001,0.001)),basis:identity,tilted:false,parameter:1.0,vertices});
    }
    if a[3]<=0.0||a[4]<=0.0||a[5]<=0.0||shape>3 {return None;}
    let p=V::new(a[0],a[1],a[2]);let h=V::new(a[3],a[4],a[5]);let cos=a[6].cos();let sin=a[6].sin();
    let cx=a[24].cos();let sx=a[24].sin();let cz=a[25].cos();let sz=a[25].sin();
    let basis=[V::new(cos*cz+sin*sx*sz,cx*sz,-sin*cz+cos*sx*sz),V::new(-cos*sz+sin*sx*cz,cx*cz,sin*sz+cos*sx*cz),V::new(sin*cx,-sx,cos*cx)];
    let parameter=if a[23]==0.0 {1.0}else{a[23]};let widest=if shape==2 {parameter.max(1.0)}else{1.0};
    let bh=V::new(h.x*widest,h.y,h.z*widest);
    let bound=V::new(basis[0].x.abs()*bh.x+basis[1].x.abs()*bh.y+basis[2].x.abs()*bh.z,basis[0].y.abs()*bh.x+basis[1].y.abs()*bh.y+basis[2].y.abs()*bh.z,basis[0].z.abs()*bh.x+basis[1].z.abs()*bh.y+basis[2].z.abs()*bh.z);
    Some(Object {p,h,cos,sin,color:V::new(a[7],a[8],a[9]),material:a[10] as u32,glyph:a[11] as u8,emission:a[12],wx:a[13],wy:a[14],mask:a[15] as u32,shape,
        solid:a[17]>0.5,detail:a[18],trim:V::new(a[19],a[20],a[21]),phase:a[22],lo:p.sub(bound),hi:p.add(bound),basis,tilted:a[24]!=0.0||a[25]!=0.0,parameter,vertices:[V::default();3]})
}
#[derive(Default)]
struct Node {lo: V, hi: V, left: usize, right: usize, start: usize, count: usize}
#[derive(Clone,Copy)]
struct Light {position:V,direction:V,color:V,radius:f32,spot:bool}
struct Engine {input: Vec<f32>,objects: Vec<Object>,order: Vec<usize>,nodes: Vec<Node>,pixels: Vec<u8>,state:[f32;8],time:f32,
    dynamic_input:Vec<f32>,dynamic_objects:Vec<Object>,dynamic_order:Vec<usize>,dynamic_nodes:Vec<Node>,static_lights:Vec<Light>,active_lights:Vec<Light>}
impl Default for Engine {
    fn default()->Self {Self {input:Vec::new(),objects:Vec::new(),order:Vec::new(),nodes:Vec::new(),pixels:Vec::new(),state:[0.0,18.0,290.0,0.0,0.0,0.0,0.0,0.0],time:0.0,
        dynamic_input:Vec::new(),dynamic_objects:Vec::new(),dynamic_order:Vec::new(),dynamic_nodes:Vec::new(),static_lights:Vec::new(),active_lights:Vec::new()}}
}
thread_local! {static ENGINE: RefCell<Engine> = RefCell::new(Engine::default());}
fn bounds_hit(o:V,d:V,lo:V,hi:V,max:f32)->bool {
    let mut t0: f32=0.0; let mut t1=max;
    for a in 0..3 {
        let da=d.axis(a);let oa=o.axis(a);
        if da.abs()<0.000001 {if oa<lo.axis(a)||oa>hi.axis(a) {return false;}continue;}
        let x=(lo.axis(a)-oa)/da;let y=(hi.axis(a)-oa)/da;
        t0=t0.max(x.min(y));t1=t1.min(x.max(y));if t0>t1 {return false;}
    } true
}
#[inline(always)]
fn bounds_fast(o:V,inv:V,lo:V,hi:V,max:f32)->f32 {
    let x0=(lo.x-o.x)*inv.x;let x1=(hi.x-o.x)*inv.x;
    let y0=(lo.y-o.y)*inv.y;let y1=(hi.y-o.y)*inv.y;
    let z0=(lo.z-o.z)*inv.z;let z1=(hi.z-o.z)*inv.z;
    let near=large(large(large(small(x0,x1),small(y0,y1)),small(z0,z1)),0.0);
    let far=small(small(small(large(x0,x1),large(y0,y1)),large(z0,z1)),max);
    if near<=far {near}else{FAR*10.0}
}
fn trace_tree(objects:&[Object],order:&[usize],nodes:&[Node],o:V,d:V,limit:f32,solid_only:bool)->Option<(usize,f32,V,V)> {
    if nodes.is_empty() {return None;}
    let inv=V::new(if d.x.abs()<0.000001 {1e20}else{1.0/d.x},if d.y.abs()<0.000001 {1e20}else{1.0/d.y},if d.z.abs()<0.000001 {1e20}else{1.0/d.z});
    let mut stack=[0usize;128];let mut entries=[0.0f32;128];let mut size=1;let mut nearest=limit;let mut hit=None;
    entries[0]=bounds_fast(o,inv,nodes[0].lo,nodes[0].hi,nearest);
    while size>0 {
        size-=1;let n=&nodes[stack[size]];if entries[size]>nearest {continue;}
        if n.count>0 {for &i in &order[n.start..n.start+n.count] {
            if solid_only&&!objects[i].solid {continue;}
            if let Some((t,normal,p))=objects[i].intersect(o,d,nearest,0.0) {nearest=t;hit=Some((i,t,normal,p));}
        }}else {
            let left=&nodes[n.left];let right=&nodes[n.right];let a=bounds_fast(o,inv,left.lo,left.hi,nearest);let b=bounds_fast(o,inv,right.lo,right.hi,nearest);
            if a<nearest&&b<nearest {if a<b {stack[size]=n.right;entries[size]=b;stack[size+1]=n.left;entries[size+1]=a;}else {stack[size]=n.left;entries[size]=a;stack[size+1]=n.right;entries[size+1]=b;}size+=2;}
            else if a<nearest {stack[size]=n.left;entries[size]=a;size+=1;}else if b<nearest {stack[size]=n.right;entries[size]=b;size+=1;}
        }
    }hit
}
fn occupied_tree(objects:&[Object],order:&[usize],nodes:&[Node],p:V,radius:f32)->bool {
    if nodes.is_empty(){return false;}let mut stack=[0usize;128];let mut size=1;
    while size>0 {size-=1;let n=&nodes[stack[size]];
        if p.x+radius<n.lo.x||p.x-radius>n.hi.x||p.y+radius<n.lo.y||p.y-radius>n.hi.y||p.z+radius<n.lo.z||p.z-radius>n.hi.z {continue;}
        if n.count>0 {if order[n.start..n.start+n.count].iter().any(|&i|objects[i].solid&&objects[i].contains(p,radius)){return true;}}
        else {stack[size]=n.left;stack[size+1]=n.right;size+=2;}
    }false
}
fn object_light(obj:&Object)->Option<Light> {
    if (obj.material==6||obj.material==12)&&obj.emission>=1.8 {
        Some(Light {position:obj.p,direction:obj.world(V::new(0.0,-0.08,1.0)).unit(),color:obj.color,
            radius:if obj.parameter>1.0 {obj.parameter}else{obj.wx.max(12.0)},spot:obj.material==12})
    }else{None}
}
impl Engine {
    fn build(&mut self,start:usize,end:usize,depth:usize)->usize {
        let mut lo=V::new(FAR*10.0,FAR*10.0,FAR*10.0);let mut hi=lo.mul(-1.0);
        for &i in &self.order[start..end] {lo=lo.min(self.objects[i].lo);hi=hi.max(self.objects[i].hi);}
        let id=self.nodes.len(); self.nodes.push(Node {lo,hi,start,count:end-start,..Node::default()});
        if end-start>4&&depth<48 {
            // Surface-area split keeps long streets and the ground slab out of tower branches.
            let count=end-start;let mut best=f32::INFINITY;let mut split=count/2;let mut selected=Vec::new();
            for axis in 0..3 {
                let mut sorted=self.order[start..end].to_vec();
                sorted.sort_unstable_by(|a,b|self.objects[*a].p.axis(axis).total_cmp(&self.objects[*b].p.axis(axis)));
                let mut suffix=vec![(V::default(),V::default());count];
                let mut tail_lo=V::new(FAR*10.0,FAR*10.0,FAR*10.0);let mut tail_hi=tail_lo.mul(-1.0);
                for i in (0..count).rev() {let obj=&self.objects[sorted[i]];tail_lo=tail_lo.min(obj.lo);tail_hi=tail_hi.max(obj.hi);suffix[i]=(tail_lo,tail_hi);}
                let mut head_lo=V::new(FAR*10.0,FAR*10.0,FAR*10.0);let mut head_hi=head_lo.mul(-1.0);
                for i in 0..count-1 {let obj=&self.objects[sorted[i]];head_lo=head_lo.min(obj.lo);head_hi=head_hi.max(obj.hi);
                    let cost=area(head_lo,head_hi)*(i+1) as f32+area(suffix[i+1].0,suffix[i+1].1)*(count-i-1) as f32;
                    if cost<best {best=cost;split=i+1;selected=sorted.clone();}
                }
            }
            self.order[start..end].copy_from_slice(&selected);
            let mid=start+split;let left=self.build(start,mid,depth+1);let right=self.build(mid,end,depth+1);
            self.nodes[id].left=left;self.nodes[id].right=right;self.nodes[id].count=0;
        } id
    }
    fn build_dynamic(&mut self,start:usize,end:usize)->usize {
        let mut lo=V::new(FAR*10.0,FAR*10.0,FAR*10.0);let mut hi=lo.mul(-1.0);
        for &i in &self.dynamic_order[start..end] {lo=lo.min(self.dynamic_objects[i].lo);hi=hi.max(self.dynamic_objects[i].hi);}
        let id=self.dynamic_nodes.len();self.dynamic_nodes.push(Node {lo,hi,start,count:end-start,..Node::default()});
        if end-start>4 {let extent=hi.sub(lo);let axis=if extent.x>extent.y&&extent.x>extent.z {0}else if extent.y>extent.z {1}else{2};
            let objects=&self.dynamic_objects;self.dynamic_order[start..end].sort_unstable_by(|a,b|objects[*a].p.axis(axis).total_cmp(&objects[*b].p.axis(axis)));
            let mid=(start+end)/2;let left=self.build_dynamic(start,mid);let right=self.build_dynamic(mid,end);
            self.dynamic_nodes[id].left=left;self.dynamic_nodes[id].right=right;self.dynamic_nodes[id].count=0;
        }id
    }
    fn trace(&self,o:V,d:V)->Option<(bool,usize,f32,V,V)> {
        let first=trace_tree(&self.objects,&self.order,&self.nodes,o,d,FAR,false);let limit=first.map(|h|h.1).unwrap_or(FAR);
        if let Some((i,t,n,p))=trace_tree(&self.dynamic_objects,&self.dynamic_order,&self.dynamic_nodes,o,d,limit,false) {Some((true,i,t,n,p))}
        else {first.map(|(i,t,n,p)|(false,i,t,n,p))}
    }
    fn collide(&self,start:V,end:V)->Option<(f32,V)> {
        let delta=end.sub(start);let length=delta.dot(delta).sqrt();if length<0.00001 {return None;}
        let direction=delta.mul(1.0/length);let mut nearest=length+0.01;let mut hit=None;
        let padding=V::new(1.0,1.0,1.0);
        for (objects,order,nodes) in [(&self.objects,&self.order,&self.nodes),(&self.dynamic_objects,&self.dynamic_order,&self.dynamic_nodes)] {
            if nodes.is_empty() {continue;}
            let mut stack=[0usize;128];let mut size=1;
            while size>0 {size-=1;let node=&nodes[stack[size]];
                if !bounds_hit(start,direction,node.lo.sub(padding),node.hi.add(padding),nearest) {continue;}
                if node.count>0 {for &i in &order[node.start..node.start+node.count] {let obj=&objects[i];
                    if obj.solid {if let Some((t,n,_))=obj.intersect(start,direction,nearest,0.8) {nearest=t;hit=Some(((t-0.15).max(0.0)/length,obj.world(n)));}}
                }}else{stack[size]=node.left;stack[size+1]=node.right;size+=2;}
            }
        }hit
    }
    fn prepare_lights(&mut self,camera:V) {
        self.active_lights.clear();
        for light in self.static_lights.iter().copied().chain(self.dynamic_objects.iter().filter_map(object_light)) {
            if light.position.sub(camera).dot(light.position.sub(camera))<(350.0+light.radius).powi(2) {self.active_lights.push(light);}
        }
        self.active_lights.sort_unstable_by(|a,b|a.position.sub(camera).dot(a.position.sub(camera)).total_cmp(&b.position.sub(camera).dot(b.position.sub(camera))));
        self.active_lights.truncate(28);
    }
    fn shade(&self,obj:&Object,t:f32,n:V,p:V)->(u8,V) {
        let world_n=obj.world(n);let diffuse=world_n.dot(V::new(-0.45,0.72,0.51)).max(0.0);
        let mut color=obj.color.mul(0.72+diffuse*0.38);let mut glyph=obj.glyph;
        let horizontal=if obj.shape==2 {(p.z/obj.h.z).atan2(p.x/obj.h.x)*(obj.h.x+obj.h.z)*0.5}
            else if obj.shape==3 {if n.x.abs()>0.5 {p.z+obj.p.z}else{p.x+obj.p.x}}
            else if n.x.abs()>0.5 {p.z+obj.h.z}else {p.x+obj.h.x};
        let vertical=if obj.shape==2||obj.shape==3 {p.y+obj.p.y}else{p.y+obj.h.y};
        match obj.material {
            1|10 if n.y.abs()<0.5 => {
                let x=fract((horizontal+obj.phase)/obj.wx.max(1.0));
                let y=fract(vertical/obj.wy.max(1.0));
                let column=((horizontal+obj.phase)/obj.wx.max(1.0)).floor() as i32;
                let row=(vertical/obj.wy.max(1.0)).floor() as i32;
                let bit=(column+row*3).rem_euclid(16) as u32;
                let lit=obj.mask&(1<<bit)!=0;
                if x<0.13||x>0.87 {color=obj.trim.mul(1.05+diffuse*0.4);glyph=b'|';}
                else if y<0.12 {color=obj.trim.mul(0.9);glyph=b'=';}
                else if y<0.26 {color=obj.color.mul(0.7);glyph=b'-';}
                else if lit {color=obj.color.mul(1.6+obj.emission);glyph=if x<0.3 {b'['}else if x>0.72 {b']'}else if obj.detail>1.0&&y>0.68 {b'='}else {b':'};}
                else {color=obj.color.mul(0.34);glyph=b':';}
            },
            2=> {let a=fract((p.x+obj.p.x)/obj.wx.max(1.0))*obj.wx.max(1.0);let b=fract((p.z+obj.p.z)/obj.wy.max(1.0))*obj.wy.max(1.0);
                glyph=if a<0.24||b<0.24 {b'+'}else {b'_'};color=color.mul(if a<0.24||b<0.24 {1.5}else{1.0});},
            3=> {let wave=((p.x+obj.p.x)*0.16+(p.z+obj.p.z)*0.11+self.time*0.45).sin();
                color=obj.color.mul(0.55+0.23*wave);glyph=if wave>0.3 {b'~'}else{b'-'};},
            4=> {let v=((p.x*1.3+p.z*1.7+p.y*2.1+obj.phase)*2.0).sin();glyph=if v>0.6 {b'&'}else if v>0.0 {b'*'}else{b'+'};color=color.mul(0.82+v*0.24);},
            5=> {glyph=if n.y.abs()>0.5 {b'-'}else if fract(horizontal/1.8)<0.195 {b'|'}else {obj.glyph};},
            6|8|12=> {color=obj.color.mul(1.25+obj.emission);if obj.material==8 {glyph=b'#';}},
            7=> {glyph=if (p.x*0.5+p.z*0.7).sin()>0.2 {b','}else{b'.'};},
            11=> {let grain=(p.x*1.17+p.z*0.73).sin()*(p.z*2.3-p.x*0.51).sin();glyph=if grain>0.6 {b','}else{b'.'};color=color.mul(0.94+grain*0.06);},
            13=> {let stripe=fract((p.y+obj.h.y)*8.0);if obj.detail>2.5&&(stripe<0.12||stripe>0.91) {color=V::new(0.76,0.78,0.71);glyph=b'=';}else{glyph=if stripe<0.08 {b'-'}else{obj.glyph};}},
            14=> {let wave=((p.y+obj.p.y)*0.009+self.time*0.19+obj.phase).sin()*0.5+0.5;
                color=obj.color.mul(0.8+wave*0.65).add(V::new(0.48,0.10,0.32).mul(wave*0.4));glyph=if n.y.abs()>0.6 {b'-'}else{b'|'};},
            _=>{if n.y>0.5 {glyph=b'=';} else if n.x.abs()>0.5 {color=color.mul(0.83);}}
        }
        if ![1,10,6,8,12].contains(&obj.material) {color=color.add(obj.color.mul(obj.emission));}
        if obj.material!=6&&obj.material!=8&&obj.material!=12 {
            let point=if obj.shape==3 {p.add(obj.p)}else{obj.world(p).add(obj.p)};
            for light in &self.active_lights {let delta=point.sub(light.position);let distance2=delta.dot(delta);
                if distance2>=light.radius*light.radius||distance2<0.01 {continue;}
                let distance=distance2.sqrt();let direction=delta.mul(1.0/distance);let mut strength=(1.0-distance/light.radius).powi(2)*world_n.dot(direction.mul(-1.0)).max(0.0);
                if light.spot {strength*=((direction.dot(light.direction)-0.84)/0.16).clamp(0.0,1.0).powi(2);}
                if light.spot&&strength>0.045 {
                    if let Some((moving,index,blocking,_,_))=self.trace(light.position.add(direction.mul(0.6)),direction) {
                        let blocker=if moving {&self.dynamic_objects[index]}else{&self.objects[index]};
                        if blocking<distance-0.9&&blocker.material!=16 {continue;}
                    }
                }
                color=color.add(light.color.mul(strength*0.8));
            }
        }
        let fog=(-t*0.00012).exp();color=color.mul(fog);
        (glyph,color)
    }
    fn surface_color(&self,o:V,d:V)->(u8,V) {
        let mut origin=o;let mut travelled=0.0;let mut transmission=1.0;let mut glass=V::default();
        for _ in 0..5 {
            if let Some((dynamic,index,t,n,p))=self.trace(origin,d) {
                let obj=if dynamic {&self.dynamic_objects[index]}else{&self.objects[index]};
                if obj.material==16 {glass=glass.add(obj.color.mul(0.055*transmission));transmission*=0.91;origin=origin.add(d.mul(t+0.025));travelled+=t+0.025;continue;}
                let (glyph,c)=self.shade(obj,travelled+t,n,p);return (glyph,c.mul(transmission).add(glass));
            }
            break;
        }
        let horizon=(1.0-d.y.abs()*1.5).max(0.0);
        (b' ',V::new(0.075,0.115,0.18).add(V::new(0.055,0.055,0.035).mul(horizon)).mul(transmission).add(glass))
    }
    fn render(&mut self,columns:usize,rows:usize,aspect:f32) {
        self.pixels.resize(columns*rows*4,0);
        let o=V::new(self.state[0],self.state[1],self.state[2]);let yaw=self.state[3];let pitch=self.state[4];let roll=self.state[5];
        self.prepare_lights(o);
        let forward=V::new(yaw.sin()*pitch.cos(),pitch.sin(),-yaw.cos()*pitch.cos());
        let right=V::new(yaw.cos(),0.0,yaw.sin());let up=V::new(-yaw.sin()*pitch.sin(),pitch.cos(),yaw.cos()*pitch.sin());
        let r=right.mul(roll.cos()).add(up.mul(roll.sin()));let u=up.mul(roll.cos()).sub(right.mul(roll.sin()));
        let tangent=0.62;
        for y in 0..rows {for x in 0..columns {
            let sx=((x as f32+0.5)/columns as f32*2.0-1.0)*tangent*aspect;
            let sy=(1.0-(y as f32+0.5)/rows as f32*2.0)*tangent;
            let d=forward.add(r.mul(sx)).add(u.mul(sy)).unit();
            let (glyph,color)=self.surface_color(o,d);
            let index=(y*columns+x)*4;self.pixels[index]=glyph;
            self.pixels[index+1]=(color.x.clamp(0.0,1.0)*255.0) as u8;
            self.pixels[index+2]=(color.y.clamp(0.0,1.0)*255.0) as u8;
            self.pixels[index+3]=(color.z.clamp(0.0,1.0)*255.0) as u8;
        }}
    }
}
#[no_mangle] pub extern "C" fn scene_buffer(count:u32)->*mut f32 {ENGINE.with(|e|{let mut e=e.borrow_mut();e.input.resize(count.min(50000) as usize*STRIDE,0.0);e.input.as_mut_ptr()})}
#[no_mangle] pub extern "C" fn scene_commit(count:u32)->u32 {ENGINE.with(|e|{
    let mut e=e.borrow_mut();e.objects.clear();let count=(count as usize).min(e.input.len()/STRIDE);
    e.dynamic_objects.clear();e.dynamic_order.clear();e.dynamic_nodes.clear();e.time=0.0;
    for i in 0..count {
        if let Some(obj)=decode_object(&e.input[i*STRIDE..(i+1)*STRIDE]) {e.objects.push(obj);}
    }
    e.static_lights=e.objects.iter().filter_map(object_light).collect();
    e.order=(0..e.objects.len()).collect();e.nodes.clear();let len=e.objects.len();if len>0 {e.build(0,len,0);}len as u32
})}
#[no_mangle] pub extern "C" fn dynamic_buffer(count:u32)->*mut f32 {ENGINE.with(|e|{let mut e=e.borrow_mut();e.dynamic_input.resize(count.min(12000) as usize*STRIDE,0.0);e.dynamic_input.as_mut_ptr()})}
#[no_mangle] pub extern "C" fn dynamic_commit(count:u32)->u32 {ENGINE.with(|e|{let mut e=e.borrow_mut();e.dynamic_objects.clear();let count=(count as usize).min(e.dynamic_input.len()/STRIDE);
    for i in 0..count {if let Some(obj)=decode_object(&e.dynamic_input[i*STRIDE..(i+1)*STRIDE]) {e.dynamic_objects.push(obj);}}
    e.dynamic_order=(0..e.dynamic_objects.len()).collect();e.dynamic_nodes.clear();let len=e.dynamic_objects.len();if len>0 {e.build_dynamic(0,len);}len as u32
})}
#[no_mangle] pub extern "C" fn world_time()->f32 {ENGINE.with(|e|e.borrow().time)}
#[no_mangle] pub extern "C" fn reset_flight(x:f32,y:f32,z:f32,yaw:f32,pitch:f32) {ENGINE.with(|e|{let mut e=e.borrow_mut();e.state=[x,y,z,yaw,pitch,0.0,0.0,0.0];})}
#[no_mangle] pub extern "C" fn flight_tick(dt:f32,flags:u32,turn_x:f32,turn_y:f32) {ENGINE.with(|e|{
    let mut e=e.borrow_mut();let dt=dt.clamp(0.0,0.05);e.time+=dt;
    e.state[3]+=turn_x*dt*1.7;e.state[4]=(e.state[4]+turn_y*dt*1.3).clamp(-1.45,1.45);
    let target=if flags&16!=0 {210.0}else if flags&1!=0 {34.0}else if flags&2!=0 {-13.0}else{0.0};
    e.state[6]+=(target-e.state[6])*(1.0-(-dt*3.5).exp());
    e.state[5]+=(-turn_x*0.16-e.state[5])*(1.0-(-dt*4.0).exp());
    let yaw=e.state[3];let pitch=e.state[4];let forward=V::new(yaw.sin()*pitch.cos(),pitch.sin(),-yaw.cos()*pitch.cos());
    let side=if flags&4!=0 {-1.0}else if flags&8!=0 {1.0}else{0.0};
    let vertical=if flags&32!=0 {1.0}else if flags&64!=0 {-1.0}else{0.0};
    let delta=forward.mul(e.state[6]*dt).add(V::new(yaw.cos(),0.0,yaw.sin()).mul(side*21.0*dt)).add(V::new(0.0,vertical*21.0*dt,0.0));
    let start=V::new(e.state[0],e.state[1],e.state[2]);let mut end=start.add(delta);e.state[7]=0.0;
    if let Some((fraction,n))=e.collide(start,end) {let contact=start.add(delta.mul(fraction.min(1.0)));let remainder=delta.mul(1.0-fraction.min(1.0));let slide=remainder.sub(n.mul(remainder.dot(n).min(0.0)));end=contact;
        if e.collide(contact,contact.add(slide)).is_none() {end=end.add(slide);}e.state[6]*=0.85;e.state[7]=1.0;}
    e.state[0]=end.x.clamp(-4200.0,4200.0);e.state[1]=end.y.clamp(1.1,1500.0);e.state[2]=end.z.clamp(-4500.0,4200.0);
})}
#[no_mangle] pub extern "C" fn state_ptr()->*const f32 {ENGINE.with(|e|e.borrow().state.as_ptr())}
#[no_mangle] pub extern "C" fn render_ascii(columns:u32,rows:u32,aspect:f32)->*const u8 {ENGINE.with(|e|{let mut e=e.borrow_mut();e.render(columns.clamp(32,420) as usize,rows.clamp(24,240) as usize,aspect.clamp(0.5,4.0));e.pixels.as_ptr()})}
#[no_mangle] pub extern "C" fn engine_version()->u32 {3}
#[no_mangle] pub extern "C" fn scene_stride()->u32 {STRIDE as u32}
#[no_mangle] pub extern "C" fn is_space_clear(x:f32,y:f32,z:f32,radius:f32)->u32 {ENGINE.with(|e|{let e=e.borrow();let p=V::new(x,y,z);let r=radius.clamp(0.0,10.0);u32::from(!occupied_tree(&e.objects,&e.order,&e.nodes,p,r)&&!occupied_tree(&e.dynamic_objects,&e.dynamic_order,&e.dynamic_nodes,p,r))})}
#[no_mangle] pub extern "C" fn floor_height(x:f32,z:f32,above:f32,depth:f32)->f32 {ENGINE.with(|e|{
    let e=e.borrow();let d=V::new(0.0,-1.0,0.0);let mut origin=V::new(x,above,z);let bottom=above-depth.clamp(0.1,5000.0);
    for _ in 0..32 {if let Some((index,t,n,_))=trace_tree(&e.objects,&e.order,&e.nodes,origin,d,(origin.y-bottom).max(0.0),true) {
        let obj=&e.objects[index];let height=origin.y-t;if obj.solid&&obj.world(n).y>0.45 {return height;}
        origin=V::new(x,height-0.02,z);if origin.y<=bottom {break;}
    }else {break;}}f32::NAN
})}
