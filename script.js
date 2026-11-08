(() => {
  const $ = selector => document.querySelector(selector);
  const display=$("#display"), expressionView=$("#expression"), status=$("#status");
  const memoryIndicator=$("#memory-indicator"), modeLabel=$("#mode-label");
  const soundToggle=$("#sound-toggle"), soundLabel=$("#sound-label");
  let current="0", tokens=[], memory=0, gstRate=18, justEvaluated=false;
  let steps=[], stepIndex=-1, replayTimer=null, soundEnabled=true, audioContext=null, lastMrc=false;

  const message = value => { status.textContent=value; };
  const fmt = value => {
    if(!Number.isFinite(value)) throw new Error("That calculation is outside the supported range");
    const rounded=Number(value.toFixed(10));
    return rounded.toLocaleString("en-IN",{maximumFractionDigits:10});
  };
  const raw = () => {
    const n=Number(current);
    if(!Number.isFinite(n)) throw new Error("Enter a valid number");
    return n;
  };
  const render = () => {
    const n=Number(current);
    display.textContent=current!=="" && Number.isFinite(n) ? fmt(n) : current;
    expressionView.textContent=tokens.join(" ") + (tokens.length ? (tokens[tokens.length-1] && /[+−×÷]$/.test(tokens[tokens.length-1]) ? "" : "") : "");
    memoryIndicator.textContent=memory!==0?"M":"";
  };
  const stopReplay = () => { if(replayTimer!==null){clearInterval(replayTimer);replayTimer=null;} };
  const tone = kind => {
    if(!soundEnabled)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      audioContext ||= new AC();if(audioContext.state==="suspended")audioContext.resume();
      const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
      const cfg=kind==="equals"?[740,.10,.04,"sine"]:kind==="operator"?[510,.06,.025,"sine"]:kind==="utility"?[390,.055,.02,"triangle"]:[620,.045,.017,"sine"];
      osc.type=cfg[3];osc.frequency.setValueAtTime(cfg[0],now);
      if(kind==="equals")osc.frequency.exponentialRampToValueAtTime(880,now+cfg[1]);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(cfg[2],now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+cfg[1]);
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+cfg[1]+.01);
    }catch(_){}
  };
  const setSound=on=>{
    soundEnabled=on;soundToggle.setAttribute("aria-pressed",String(on));
    soundLabel.textContent=on?"Sound on":"Sound off";
    soundToggle.title=on?"Turn button sounds off":"Turn button sounds on";
    soundToggle.querySelector(".sound-symbol").textContent=on?"♪":"∅";
  };
  soundToggle.addEventListener("click",()=>{setSound(!soundEnabled);if(soundEnabled)tone("utility");});

  // Recursive-descent parser: multiplication/division take precedence over addition/subtraction.
  const evaluate = source => {
    const s=source.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/,/g,"").replace(/\s+/g,"");
    const parts=s.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g)||[];
    if(parts.join("")!==s || !parts.length)throw new Error("Check the calculation and try again");
    let i=0;
    const factor=()=>{
      if(parts[i]==="+"){i++;return factor();}
      if(parts[i]==="-"){i++;return -factor();}
      if(parts[i]==="("){i++;const v=expr();if(parts[i++]!==")")throw new Error("Missing closing bracket");return v;}
      const p=parts[i++];if(!p||!/^\d*\.?\d+$/.test(p))throw new Error("Incomplete calculation");
      return Number(p);
    };
    const term=()=>{let v=factor();while(parts[i]==="*"||parts[i]==="/"){const op=parts[i++],r=factor();if(op==="/"&&r===0)throw new Error("Cannot divide by zero");v=op==="*"?v*r:v/r;}return v;};
    const expr=()=>{let v=term();while(parts[i]==="+"||parts[i]==="-"){const op=parts[i++],r=term();v=op==="+"?v+r:v-r;}return v;};
    const result=expr();if(i!==parts.length)throw new Error("Invalid calculation");if(!Number.isFinite(result))throw new Error("Invalid result");return Number(result.toFixed(10));
  };
  const expressionText=()=>tokens.join(" ")+(tokens.length?" ":"")+current;
  const saveStep=(label,result)=>{
    steps.push({label,result:String(result)});if(steps.length>120)steps.shift();
    stepIndex=steps.length-1;
  };
  const input=value=>{
    if(justEvaluated){current="0";tokens=[];justEvaluated=false;}
    if(value==="."&&current.includes("."))return;
    if(value==="."&&current==="0"){current="0.";render();return;}
    if(current==="0"&&value!=="0")current=value;
    else if(current==="0"&&value==="0")return;
    else current+=value;
    lastMrc=false;render();
  };
  const operator=op=>{
    if(justEvaluated){tokens=[current];justEvaluated=false;}
    else if(!tokens.length)tokens.push(current);
    else if(/[+−×÷]$/.test(tokens[tokens.length-1]))tokens[tokens.length-1]=op;
    else tokens.push(current);
    if(tokens[tokens.length-1]!==op)tokens.push(op);
    current="0";lastMrc=false;render();
  };
  const equals=()=>{
    const source=expressionText(),result=evaluate(source);
    saveStep(source+" =",fmt(result));current=String(result);tokens=[];justEvaluated=true;
    message("Result saved · "+steps.length+" of 120 review steps");render();
  };
  const clear=()=>{current="0";tokens=[];justEvaluated=false;modeLabel.textContent="STANDARD";message("Ready");render();};
  const clearEntry=()=>{current="0";justEvaluated=false;message("Current entry cleared");render();};
  const showStep=()=>{
    const item=steps[stepIndex];if(!item)return;
    expressionView.textContent=item.label;display.textContent=item.result;
    message("Step "+(stepIndex+1)+" of "+steps.length);
  };
  const correct=()=>{
    if(stepIndex<0||!steps[stepIndex]){message("No calculation selected · press CHECK first");return;}
    const item=steps[stepIndex];
    const revised=prompt("Correct the calculation expression:",item.label.replace(/\s*=\s*$/,""));
    if(revised===null)return;
    const result=evaluate(revised);
    steps[stepIndex]={label:revised+" = (corrected)",result:fmt(result)};
    current=String(result);tokens=[];justEvaluated=true;showStep();message("Step corrected and recalculated");
  };
  const replay=()=>{
    stopReplay();
    if(!steps.length){message("No saved steps to replay yet");return;}
    stepIndex=0;showStep();message("Auto replay · step 1 of "+steps.length);
    if(steps.length===1){message("Replay complete · 1 step");return;}
    replayTimer=setInterval(()=>{
      if(stepIndex<steps.length-1){stepIndex++;showStep();message("Auto replay · step "+(stepIndex+1)+" of "+steps.length);}
      else{stopReplay();message("Replay complete · "+steps.length+" steps");}
    },1100);
  };
  const gst=direction=>{
    const amount=raw(),result=direction==="add"?amount*(1+gstRate/100):amount/(1+gstRate/100);
    const label=fmt(amount)+(direction==="add"?" + GST ":" − GST ")+gstRate+"%";
    saveStep(label+" =",fmt(result));current=String(Number(result.toFixed(10)));tokens=[];justEvaluated=true;
    modeLabel.textContent="GST "+gstRate+"%";message(direction==="add"?"GST added at "+gstRate+"%":"GST removed at "+gstRate+"%");render();
  };
  const handle=action=>{
    try{
      switch(action){
        case "clear":clear();break;
        case "clear-entry":clearEntry();break;
        case "sign":current=String(-raw());render();break;
        case "percent":current=String(raw()/100);message("Converted to percentage");render();break;
        case "sqrt":{const n=raw();if(n<0)throw new Error("Square root needs a non-negative number");const result=Math.sqrt(n);saveStep("√("+fmt(n)+") =",fmt(result));current=String(result);tokens=[];justEvaluated=true;message("Square root calculated");render();break;}
        case "equals":equals();break;
        case "gst-plus":gst("add");break;
        case "gst-minus":gst("remove");break;
        case "rate":{const value=prompt("GST rate (%)",String(gstRate));if(value===null)return;const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw new Error("Enter a GST rate from 0 to 100");gstRate=n;modeLabel.textContent="GST RATE · "+n+"%";message("GST rate set to "+n+"%");break;}
        case "memory-plus":memory=Number((memory+raw()).toFixed(10));lastMrc=false;message("Added current value to memory");render();break;
        case "memory-minus":memory=Number((memory-raw()).toFixed(10));lastMrc=false;message("Subtracted current value from memory");render();break;
        case "memory-recall":
          if(lastMrc){memory=0;lastMrc=false;message("Memory cleared");}
          else if(memory!==0){current=String(memory);tokens=[];justEvaluated=true;lastMrc=true;message("Memory recalled · press MRC again to clear");}
          else message("Memory is empty");
          render();break;
        case "check-prev":stopReplay();if(stepIndex>0){stepIndex--;showStep();}else if(steps.length){stepIndex=0;showStep();message("First saved step");}else message("No saved steps yet");break;
        case "check-next":stopReplay();if(stepIndex<steps.length-1){stepIndex++;showStep();}else message(steps.length?"Last saved step":"No saved steps yet");break;
        case "correct":stopReplay();correct();break;
        case "replay":replay();break;
      }
    }catch(error){message(error.message||"Could not complete that action");}
  };

  document.querySelectorAll(".key,.review-key").forEach(button=>{
    button.addEventListener("click",()=>{
      stopReplay();
      const action=button.dataset.action,value=button.dataset.value;
      const kind=button.classList.contains("equals")||action==="equals"?"equals":button.classList.contains("operation")?"operator":button.classList.contains("review-key")||button.classList.contains("gst")||button.classList.contains("function")||button.classList.contains("memory")?"utility":"key";
      tone(kind);if(navigator.vibrate)navigator.vibrate(8);
      if(action)handle(action);else if(value&&["+","−","×","÷"].includes(value))operator(value);else if(value)input(value);
    });
  });
  window.addEventListener("keydown",event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const k=event.key;
    if(/^[0-9.]$/.test(k)){input(k);}
    else if(k==="Enter"||k==="="){tone("equals");handle("equals");}
    else if(k==="Escape"){tone("utility");clear();}
    else if(k==="Backspace"){current=current.length>1?current.slice(0,-1):"0";render();}
    else if(k==="+"||k==="-"||k==="*"||k==="/"){event.preventDefault();operator(({ "+":"+","-":"−","*":"×","/":"÷"})[k]);}
    else if(k==="%")handle("percent");
  });
  setSound(true);render();
})();