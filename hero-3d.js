/* ZARVIQO — visualización 3D conceptual. Sin datos de clientes ni dependencias externas. */
(() => {
  "use strict";
  const stage=document.getElementById("heroStage");
  const canvas=document.getElementById("heroCanvas");
  const toggle=document.getElementById("heroMotionToggle");
  if(!stage||!canvas||!toggle)return;

  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection=navigator.connection;
  const slow=Boolean(connection&&(connection.saveData||/^(slow-2g|2g)$/.test(connection.effectiveType||"")));
  let gl,program,raf=0,paused=false,visible=true,disposed=false,elapsed=0,last=0;
  let pointer={x:0,y:0},target={x:0,y:0},scroll=0,previousFrame=0;
  const objects=[],uniforms={};

  const vertex=`#version 300 es
  precision highp float;
  in vec3 aPosition;
  in vec3 aNormal;
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
  uniform float uTime;
  uniform int uType;
  out vec3 vNormal;
  out vec3 vPosition;
  void main(){
    vec3 p=aPosition;
    if(uType==0){
      float wave=sin(p.x*5.4+uTime*.65)*sin(p.y*5.1-uTime*.43)*sin(p.z*4.6+uTime*.32);
      p+=aNormal*wave*.052;
    }
    vec4 world=uModel*vec4(p,1.);
    vPosition=world.xyz;
    vNormal=normalize(mat3(uModel)*aNormal);
    gl_Position=uProjection*uView*world;
  }`;
  const fragment=`#version 300 es
  precision highp float;
  in vec3 vNormal;
  in vec3 vPosition;
  uniform vec3 uCamera;
  uniform vec3 uTint;
  uniform float uTime;
  uniform int uType;
  out vec4 color;
  void main(){
    vec3 n=normalize(vNormal);
    vec3 eye=normalize(uCamera-vPosition);
    float facing=max(dot(n,eye),0.);
    float fresnel=pow(1.-facing,2.5);
    vec3 light=normalize(vec3(-.5,.9,1.4));
    float diffuse=max(dot(n,light),0.);
    float spec=pow(max(dot(reflect(-light,n),eye),0.),26.);
    if(uType==2){
      color=vec4(uTint,.29);
      return;
    }
    if(uType==1){
      vec3 hue=mix(uTint,vec3(.91,1.,.78),diffuse*.48+spec*.45);
      color=vec4(hue,.72+fresnel*.24);
      return;
    }
    float ripple=.5+.5*sin(vPosition.y*8.+uTime*.9);
    vec3 glass=mix(vec3(.025,.16,.14),uTint,.35+fresnel*.65);
    glass+=vec3(.14,.29,.2)*diffuse*.38+vec3(.53,.97,.67)*spec*.95;
    glass+=vec3(.08,.15,.09)*ripple*.15;
    color=vec4(glass,.30+fresnel*.57);
  }`;

  function shader(type,source){
    const s=gl.createShader(type);
    gl.shaderSource(s,source);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const error=gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw Error("Shader 3D: "+error);
    }
    return s;
  }
  function createProgram(){
    const v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment);
    const p=gl.createProgram();
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
    gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error("Programa 3D: "+gl.getProgramInfoLog(p));
    return p;
  }
  function identity(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];}
  function multiply(a,b){
    const out=new Array(16).fill(0);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
    return out;
  }
  function translation(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
  function rotateX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];}
  function rotateY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];}
  function rotateZ(a){const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];}
  function scale(n){return [n,0,0,0, 0,n,0,0, 0,0,n,0, 0,0,0,1];}
  function perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),q=1/(near-far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*q,-1, 0,0,2*far*near*q,0];
  }
  function sphere(radius,lat=28,lon=48){
    const verts=[];
    for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
      const point=(u,v)=>{
        const theta=u*Math.PI,phi=v*Math.PI*2;
        const x=Math.sin(theta)*Math.cos(phi),y=Math.cos(theta),z=Math.sin(theta)*Math.sin(phi);
        return [x*radius,y*radius,z*radius,x,y,z];
      };
      const a=point(i/lat,j/lon),b=point((i+1)/lat,j/lon),
        c=point((i+1)/lat,(j+1)/lon),d=point(i/lat,(j+1)/lon);
      verts.push(...a,...b,...c,...a,...c,...d);
    }
    return verts;
  }
  function torus(radius=.0,tube=.0,segments=96,sides=9){
    const verts=[];
    const point=(u,v)=>{
      const t=u*Math.PI*2,p=v*Math.PI*2;
      const nx=Math.cos(t)*Math.cos(p),ny=Math.sin(p),nz=Math.sin(t)*Math.cos(p);
      return [(radius+tube*Math.cos(p))*Math.cos(t),tube*Math.sin(p),(radius+tube*Math.cos(p))*Math.sin(t),nx,ny,nz];
    };
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
      const a=point(i/segments,j/sides),b=point((i+1)/segments,j/sides),
        c=point((i+1)/segments,(j+1)/sides),d=point(i/segments,(j+1)/sides);
      verts.push(...a,...b,...c,...a,...c,...d);
    }
    return verts;
  }
  function lines(){
    const data=[];
    const put=(x,y,z)=>data.push(x,y,z,0,1,0);
    for(let i=-5;i<=5;i++){
      const v=i*.46;
      put(-2.7,-1.72,v);put(2.7,-1.72,v);
      put(v,-1.72,-2.7);put(v,-1.72,2.7);
    }
    return data;
  }
  function mesh(data,mode,tint,primitive){
    const vao=gl.createVertexArray(),buffer=gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,"aPosition"),norm=gl.getAttribLocation(program,"aNormal");
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(norm);gl.vertexAttribPointer(norm,3,gl.FLOAT,false,24,12);
    gl.bindVertexArray(null);
    const obj={vao,buffer,count:data.length/6,mode,tint,primitive:primitive||gl.TRIANGLES};
    objects.push(obj);return obj;
  }
  function draw(obj,model,time){
    gl.uniformMatrix4fv(uniforms.model,false,new Float32Array(model));
    gl.uniform1i(uniforms.type,obj.mode);
    gl.uniform3fv(uniforms.tint,obj.tint);
    gl.uniform1f(uniforms.time,time);
    gl.bindVertexArray(obj.vao);
    gl.drawArrays(obj.primitive,0,obj.count);
  }
  function init(){
    if(motion.matches||slow)return false;
    gl=canvas.getContext("webgl2",{alpha:true,antialias:false,powerPreference:"low-power",depth:true,stencil:false,preserveDrawingBuffer:false});
    if(!gl)return false;
    program=createProgram();
    gl.useProgram(program);
    uniforms.projection=gl.getUniformLocation(program,"uProjection");
    uniforms.view=gl.getUniformLocation(program,"uView");
    uniforms.model=gl.getUniformLocation(program,"uModel");
    uniforms.camera=gl.getUniformLocation(program,"uCamera");
    uniforms.tint=gl.getUniformLocation(program,"uTint");
    uniforms.time=gl.getUniformLocation(program,"uTime");
    uniforms.type=gl.getUniformLocation(program,"uType");
    const grid=mesh(lines(),2,[.19,.64,.43],gl.LINES);
    const ringA=mesh(torus(1.66,.025),1,[.37,.94,.62]);
    const ringB=mesh(torus(1.47,.022),1,[.39,.69,.96]);
    const ringC=mesh(torus(1.94,.012),1,[.74,.98,.64]);
    const core=mesh(sphere(1.15),0,[.17,.76,.56]);
    const satellite=mesh(sphere(.105,12,18),1,[.77,1.,.68]);
    const satelliteB=mesh(sphere(.075,12,18),1,[.44,.75,1.]);
    objects.grid=grid;objects.rings=[ringA,ringB,ringC];objects.core=core;
    objects.satellites=[satellite,satelliteB];
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    stage.classList.add("is-webgl");
    return true;
  }
  function resize(){
    if(!gl)return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    const limit=innerWidth<700?720:1100;
    const factor=Math.min(ratio,limit/Math.max(rect.width,rect.height));
    const w=Math.max(1,Math.round(rect.width*factor)),h=Math.max(1,Math.round(rect.height*factor));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  }
  function render(time){
    if(!gl||disposed||!visible||document.hidden||paused)return;
    const interval=innerWidth<700?1000/30:1000/45;
    if(previousFrame&&time-previousFrame<interval){raf=requestAnimationFrame(render);return;}
    previousFrame=time;
    if(!last)last=time;
    const delta=Math.min((time-last)/1000,.05);last=time;
    elapsed+=delta;
    pointer.x+=(target.x-pointer.x)*Math.min(1,delta*3.2);
    pointer.y+=(target.y-pointer.y)*Math.min(1,delta*3.2);
    resize();
    const w=canvas.width,h=canvas.height;
    if(w<2||h<2){raf=requestAnimationFrame(render);return;}
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    const camera=[pointer.x*.48,1.0+pointer.y*.3,5.75-scroll*.35];
    gl.uniform3fv(uniforms.camera,camera);
    const aspect=w/h,projection=perspective(Math.PI/3.45,aspect,.1,30);
    gl.uniformMatrix4fv(uniforms.projection,false,new Float32Array(projection));
    // Cámara inclinada hacia el centro: giro X suave con traslación inversa.
    const view=multiply(rotateX(-.13),translation(-camera[0],-camera[1],-camera[2]));
    gl.uniformMatrix4fv(uniforms.view,false,new Float32Array(view));
    const turn=elapsed*.16+scroll*1.1+pointer.x*.28;
    const tilt=pointer.y*.17+scroll*.2;
    gl.depthMask(false);
    draw(objects.grid,identity(),elapsed);
    const rotations=[
      multiply(rotateY(turn*.7),rotateX(1.12+tilt)),
      multiply(rotateY(-turn*.5),rotateZ(.75+tilt)),
      multiply(rotateY(turn*.4),rotateX(-.42))
    ];
    objects.rings.forEach((o,i)=>draw(o,rotations[i],elapsed));
    draw(objects.core,multiply(rotateY(-turn*.65),rotateX(tilt)),elapsed);
    const a=elapsed*.43+scroll;
    draw(objects.satellites[0],translation(Math.cos(a)*1.66,Math.sin(a*.8)*.5,Math.sin(a)*1.66),elapsed);
    draw(objects.satellites[1],translation(Math.sin(a*1.2)*1.94,Math.cos(a)*.9,Math.cos(a*1.2)*1.94),elapsed);
    gl.depthMask(true);
    raf=requestAnimationFrame(render);
  }
  function start(){if(gl&&!paused&&visible&&!document.hidden&&!disposed&&!raf){last=0;previousFrame=0;raf=requestAnimationFrame(render);}}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
  function onPointer(e){
    const r=stage.getBoundingClientRect();
    target.x=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2));
    target.y=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2));
  }
  function onScroll(){
    const rect=stage.getBoundingClientRect();
    scroll=Math.max(0,Math.min(1,(-rect.top+window.innerHeight*.18)/Math.max(rect.height,1)));
  }
  function destroy(){
    stop();disposed=true;
    if(gl){objects.forEach(o=>{gl.deleteBuffer(o.buffer);gl.deleteVertexArray(o.vao);});if(program)gl.deleteProgram(program);}
    stage.classList.remove("is-webgl");
  }
  toggle.hidden=true;
  if(motion.matches||slow)return;
  try{
    if(!init())return;
    toggle.hidden=false;
    toggle.addEventListener("click",()=>{
      paused=!paused;
      toggle.textContent=paused?"Reanudar animación":"Pausar animación";
      toggle.setAttribute("aria-pressed",String(paused));
      if(paused)stop();else start();
    });
    stage.addEventListener("pointermove",onPointer,{passive:true});
    stage.addEventListener("pointerleave",()=>{target={x:0,y:0};});
    window.addEventListener("scroll",onScroll,{passive:true});
    window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else start();});
    motion.addEventListener?.("change",event=>{if(event.matches){destroy();toggle.hidden=true;}});
    const observer=new IntersectionObserver(entries=>{
      visible=entries[0]?.isIntersecting||false;
      if(visible)start();else stop();
    },{threshold:0});
    observer.observe(stage);
    canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();destroy();},{once:true});
    onScroll();start();
  }catch(error){
    // Fallo de GPU/WebGL: la ilustración CSS está siempre disponible.
    if(gl){try{destroy();}catch{}}
    toggle.hidden=true;
  }
})();
