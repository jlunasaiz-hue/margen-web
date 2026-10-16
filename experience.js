/* ZARVIQO Motion System — progressive enhancement, no tracking or network calls. */
(() => {
  "use strict";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const saveData=Boolean(navigator.connection?.saveData);
  const root=document.documentElement;
  const journey=document.querySelector("#zarviqoJourney");
  const progress=document.querySelector("#siteProgress");
  if(!journey)return;
  const steps=Array.from(journey.querySelectorAll("[data-journey-step]"));
  const cards=Array.from(document.querySelectorAll(".tool-grid > a, .problem-grid > article, .report-steps > div, .sample-report, .calculator-result"));
  const animated=Array.from(document.querySelectorAll(".section-shell .section-heading, .tool-launcher, .sample-report, .report-steps, .problem-grid > article, .steps-grid > li, .pilot-facts > div, .faq-list, .privacy-grid > p, .calculator-form, .calculator-result"));
  const canAnimate=()=>!reduced.matches&&!saveData;
  let active=true,scheduled=false,scrollY=0;
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function showAll(){
    animated.forEach(el=>{el.classList.remove("fx-pending");el.classList.add("fx-visible");});
    journey.classList.add("journey-ready");
    root.style.setProperty("--journey-progress","0");
    if(progress)progress.style.transform="scaleX(0)";
  }
  if(!canAnimate()||!("IntersectionObserver" in window)){
    showAll();
    return;
  }
  root.classList.add("motion-enabled");
  const revealObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        entry.target.classList.remove("fx-pending");
        entry.target.classList.add("fx-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  },{rootMargin:"0px 0px -45px 0px",threshold:.08});
  animated.forEach((el,index)=>{
    // Sections are visible without JS; only hide them after observer is ready.
    if(el.getBoundingClientRect().top>window.innerHeight*.92){
      el.classList.add("fx-pending");
      el.style.setProperty("--fx-delay",((index%3)*65)+"ms");
      revealObserver.observe(el);
    }
  });
  const journeyObserver=new IntersectionObserver(entries=>{
    if(entries[0]?.isIntersecting)journey.classList.add("journey-ready");
  },{threshold:.1});
  journeyObserver.observe(journey);

  const visuals=journey.querySelectorAll("[data-story-visual]");
  const nav=journey.querySelectorAll("[data-journey-nav]");
  let current=-1;
  function setStep(index){
    if(index===current||index<0||index>=steps.length)return;
    current=index;
    steps.forEach((step,i)=>step.classList.toggle("is-current",i===index));
    visuals.forEach((visual,i)=>visual.classList.toggle("is-current",i===index));
    nav.forEach((el,i)=>el.classList.toggle("is-current",i===index));
    journey.dataset.activeStep=String(index+1);
  }
  setStep(0);
  function update(){
    scheduled=false;
    if(!active)return;
    const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    if(progress)progress.style.transform="scaleX("+clamp(window.scrollY/max,0,1).toFixed(4)+")";
    const r=journey.getBoundingClientRect();
    const length=Math.max(1,r.height-window.innerHeight*.65);
    const amount=clamp((window.innerHeight*.55-r.top)/length,0,1);
    root.style.setProperty("--journey-progress",amount.toFixed(4));
    const focus=window.innerHeight*.46;
    let nearest=0,dist=Infinity;
    steps.forEach((step,i)=>{
      const rect=step.getBoundingClientRect();
      const d=Math.abs((rect.top+rect.bottom)/2-focus);
      if(d<dist){dist=d;nearest=i;}
    });
    if(r.top<window.innerHeight&&r.bottom>0)setStep(nearest);
  }
  function onScroll(){
    if(!scheduled){scheduled=true;requestAnimationFrame(update);}
  }
  window.addEventListener("scroll",onScroll,{passive:true});
  window.addEventListener("resize",onScroll,{passive:true});
  update();

  // 3D card tilt only on fine pointers, never on touch or reduced motion.
  if(window.matchMedia("(hover: hover) and (pointer: fine)").matches){
    cards.forEach(card=>{
      let raf=0,x=0,y=0;
      card.classList.add("fx-tilt");
      const paint=()=>{
        raf=0;
        card.style.setProperty("--tilt-x",(y*5).toFixed(2)+"deg");
        card.style.setProperty("--tilt-y",(-x*6).toFixed(2)+"deg");
        card.style.setProperty("--glow-x",((x+1)*50).toFixed(1)+"%");
        card.style.setProperty("--glow-y",((y+1)*50).toFixed(1)+"%");
      };
      card.addEventListener("pointermove",event=>{
        const r=card.getBoundingClientRect();
        x=clamp((event.clientX-r.left)/r.width*2-1,-1,1);
        y=clamp((event.clientY-r.top)/r.height*2-1,-1,1);
        if(!raf)raf=requestAnimationFrame(paint);
      },{passive:true});
      card.addEventListener("pointerleave",()=>{
        if(raf)cancelAnimationFrame(raf);
        raf=0;
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
        card.style.removeProperty("--glow-x");
        card.style.removeProperty("--glow-y");
      });
    });
  }
  reduced.addEventListener?.("change",event=>{
    if(event.matches){
      active=false;
      revealObserver.disconnect();
      journeyObserver.disconnect();
      showAll();
      root.classList.remove("motion-enabled");
      cards.forEach(card=>{card.classList.remove("fx-tilt");card.removeAttribute("style");});
    }
  });
})();
