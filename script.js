(() => {
  const $ = selector => document.querySelector(selector);
  const display=$("#display"), expressionView=$("#expression"), status=$("#status");
  const memoryIndicator=$("#memory-indicator"), modeLabel=$("#mode-label");
  const voiceToggle=$("#voice-toggle"), voiceLabel=$("#voice-label");
  let current="0", tokens=[], memory=0, gstRate=18, justEvaluated=false;
  let steps=[], stepIndex=-1, replayTimer=null, voiceEnabled=true, lastMrc=false;

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
    display.classList.remove("review-result");
    display.textContent=current!=="" && Number.isFinite(n) ? fmt(n) : current;
    expressionView.textContent=tokens.length ? tokens.join(" ") + (/[+−×÷]$/.test(tokens[tokens.length-1]) ? "" : " "+current) : "";
    memoryIndicator.textContent=memory!==0?"M":"";
  };
  const stopReplay = () => { if(replayTimer!==null){clearInterval(replayTimer);replayTimer=null;} };
  const spokenLabel = button => {
    if (button.dataset.value !== undefined) return ({".":"decimal point","00":"double zero","+":"plus","−":"minus","×":"multiply","÷":"divide"})[button.dataset.value] || button.dataset.value;
    const labels={"clear":"all clear","clear-entry":"clear entry","sign":"change sign","percent":"percent","sqrt":"square root","equals":"equals","gst-plus":"add GST","gst-minus":"remove GST","rate":"GST rate","memory-plus":"memory plus","memory-minus":"memory minus","memory-recall":"memory recall","check-prev":"previous step","check-next":"next step","correct":"correct","replay":"replay steps"};
    return labels[button.dataset.action] || button.textContent.replace(/\s+/g," ").trim().toLowerCase();
  };
  const speak = text => {
    if (!voiceEnabled || !("speechSynthesis" in window) || !text) return;
    try { const u=new SpeechSynthesisUtterance(String(text));u.lang="en-IN";u.rate=.92;u.pitch=1;window.speechSynthesis.speak(u); } catch (_) {}
  };
  const speakCalculation = (expression, result) => {
    const spoken = String(expression).replace(/×/g," multiplied by ").replace(/÷/g," divided by ").replace(/−/g," minus ").replace(/\+/g," plus ");
    speak("Calculation: " + spoken + ". Result: " + result);
  };
  const setVoice = on => {
    voiceEnabled=on;voiceToggle.setAttribute("aria-pressed",String(on));
    voiceLabel.textContent=on?"Voice on":"Voice off";
    voiceToggle.title=on?"Turn spoken button feedback off":"Turn spoken button feedback on";
    voiceToggle.querySelector(".sound-symbol").textContent=on?"◖":"◗";
    if(on)speak("Voice feedback on");else if("speechSynthesis" in window)window.speechSynthesis.cancel();
  };
  voiceToggle.addEventListener("click",()=>setVoice(!voiceEnabled));

  // Speech-to-text input: turn spoken number/operator words into a normal expression.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micToggle = $("#mic-toggle"), micLabel = $("#mic-label");
  let recognition = null, listening = false;
  const smallNumbers = {zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,shunya:0,ek:1,do:2,teen:3,chaar:4,char:4,paanch:5,panch:5,chhe:6,che:6,saat:7,aath:8,aat:8,nau:9,das:10,gyarah:11,barah:12,terah:13,chaudah:14,pandrah:15,solah:16,satrah:17,atharah:18,unnis:19,"शून्य":0,"एक":1,"दो":2,"तीन":3,"चार":4,"पाँच":5,"पांच":5,"छह":6,"सात":7,"आठ":8,"नौ":9,"दस":10};
  const tensNumbers = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,bees:20,tees:30,chalis:40,chaalis:40,pachaas:50,saath:60,sattar:70,assi:80,navve:90,"बीस":20,"तीस":30,"चालीस":40,"पचास":50,"साठ":60,"सत्तर":70,"अस्सी":80,"नब्बे":90};
  const numberWords = new Set([...Object.keys(smallNumbers),...Object.keys(tensNumbers),"hundred","thousand","sau","hazaar","हज़ार","हजार","सौ"]);
  const parseNumberWords = words => {
    let total=0,group=0,seen=false;
    for(const word of words){
      if(Object.prototype.hasOwnProperty.call(smallNumbers,word)){group+=smallNumbers[word];seen=true;}
      else if(Object.prototype.hasOwnProperty.call(tensNumbers,word)){group+=tensNumbers[word];seen=true;}
      else if(word==="hundred"||word==="sau"||word==="सौ"){group=Math.max(1,group)*100;seen=true;}
      else if(word==="thousand"||word==="hazaar"||word==="हज़ार"||word==="हजार"){total+=Math.max(1,group)*1000;group=0;seen=true;}
    }
    return seen?String(total+group):null;
  };
  const speechExpression = transcript => {
    const cleaned=transcript.toLowerCase()
      .replace(/[^a-z0-9.+\-×÷−\sऀ-ॿ]/g," ")
      .replace(/([+\-×÷−])/g," $1 ")
      .replace(/\b(please|calculate|equals?|equal to|what is|what's|the answer|how much|kitna|kitne|hota|hoti|hai|hain|batao|nikalo|karo|answer|is|what)\b/g," ")
      .trim();
    const words=cleaned.split(/\s+/).filter(Boolean),atoms=[];
    const operators={plus:"+",add:"+",added:"+",jod:"+",jama:"+",जोड़:"+",जमा:"+",minus:"−",subtract:"−",take:"−",ghata:"−",ghatao:"−",घटा:"−",घटाओ:"−",times:"×",multiply:"×",multiplied:"×",into:"×",guna:"×",गुना:"×",divide:"÷",divided:"÷",over:"÷",bhaag:"÷",bhag:"÷",भाग:"÷"};
    let numberGroup=[];
    const pushNumberGroup=()=>{
      if(!numberGroup.length)return;
      const hasScale=numberGroup.some(w=>["hundred","thousand","sau","hazaar","हज़ार","हजार","सौ"].includes(w));
      const startsWithTens=Object.prototype.hasOwnProperty.call(tensNumbers,numberGroup[0]);
      // Preserve compound numbers, but don't glue consecutive standalone digits together.
      if(numberGroup.length>1&&!hasScale&&!startsWithTens){
        for(const word of numberGroup)atoms.push({type:"number",value:String(smallNumbers[word])});
      }else{
        const value=parseNumberWords(numberGroup);
        if(value!==null)atoms.push({type:"number",value});
      }
      numberGroup=[];
    };
    for(const word of words){
      if(numberWords.has(word)){numberGroup.push(word);continue;}
      if(word==="point"||word==="dot"||word==="दशमलव"){pushNumberGroup();atoms.push({type:"decimal"});continue;}
      if(operators[word]){pushNumberGroup();atoms.push({type:"operator",value:operators[word]});continue;}
      if(/^\d+(?:\.\d+)?$/.test(word)){pushNumberGroup();atoms.push({type:"number",value:word});continue;}
      if(word==="and"||word==="aur"||word==="और")continue;
      pushNumberGroup();
    }
    pushNumberGroup();
    // Some mobile engines omit spoken operators and return "50 50".
    // Treat distinct number chunks as separate addends, never as "5050".
    let expression="",previous="start";
    for(const atom of atoms){
      if(atom.type==="number"){
        if(previous==="number")expression+="+";
        expression+=atom.value;previous="number";
      }else if(atom.type==="decimal"){
        if(previous!=="number")throw new Error("I couldn't understand the decimal point");
        expression+=".";previous="decimal";
      }else{
        expression+=atom.value;previous="operator";
      }
    }
    if(!expression||!/^[\d.]+(?:[+−×÷][\d.]+)*$/.test(expression))throw new Error("I couldn't understand that. Try saying “2 plus 5 minus 67”.");
    return expression;
  };
  const resetMicUI = () => {
    listening=false;micToggle.setAttribute("aria-pressed","false");micToggle.classList.remove("listening");micLabel.textContent="Speak";
  };
  const stopListening = () => {
    resetMicUI();
    if(recognition){try{recognition.stop();}catch(_){}}
  };
  const processSpokenCalculation = transcript => {
    try{
      const expression=speechExpression(transcript);
      tokens=[];current="0";justEvaluated=false;
      const trace=[],result=evaluate(expression,trace);
      trace.forEach(step=>{steps.push(step);if(steps.length>119)steps.shift();});
      saveStep(expression+" =",fmt(result));
      expressionView.textContent=expression+" =";current=String(result);justEvaluated=true;
      message("Heard: "+expression+" · result saved");render();speakCalculation(expression,fmt(result));
    }catch(error){message(error.message||"Could not understand that calculation");speak("Sorry, I could not understand that calculation");}
  };
  if(SpeechRecognition){
    recognition=new SpeechRecognition();recognition.lang="en-IN";recognition.interimResults=true;recognition.continuous=false;
    let finalTranscript="";
    recognition.onstart=()=>{finalTranscript="";listening=true;micToggle.setAttribute("aria-pressed","true");micToggle.classList.add("listening");micLabel.textContent="Listening";message("Listening · say your calculation");};
    recognition.onresult=event=>{
      let interim="";
      finalTranscript="";
      // Collect every finalized segment, but wait until recognition ends before parsing.
      // This prevents an early finalized "1" from being treated as the whole calculation.
      for(let i=0;i<event.results.length;i++){
        const text=event.results[i][0].transcript;
        if(event.results[i].isFinal)finalTranscript+=text+" ";
        else interim+=text;
      }
      if(interim)message("Hearing: "+interim);
      else if(finalTranscript.trim())message("Recognized: "+finalTranscript.trim());
    };
    recognition.onerror=event=>{resetMicUI();message(event.error==="not-allowed"?"Microphone permission is blocked. Allow it in your browser settings.":"Voice input error · "+event.error);};
    recognition.onend=()=>{
      const transcript=finalTranscript.trim();
      const shouldProcess=listening;
      resetMicUI();
      if(shouldProcess&&transcript)processSpokenCalculation(transcript);
      else if(shouldProcess)message("No speech detected · tap Speak and try again");
    };
    micToggle.addEventListener("click",()=>{if(listening){stopListening();message("Voice input stopped");return;}try{recognition.start();}catch(_){message("Voice input is already starting. Try again in a moment.");}});
  }else{
    micToggle.disabled=true;micLabel.textContent="Unavailable";micToggle.title="Speech recognition is not supported in this browser";
    micToggle.addEventListener("click",()=>message("Speech recognition is not supported in this browser. Try a supported browser such as Chrome."));
  }

  // Recursive-descent parser: multiplication/division take precedence over addition/subtraction.
  const evaluate = (source, trace=[]) => {
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
    const term=()=>{let v=factor();while(parts[i]==="*"||parts[i]==="/"){const left=v,op=parts[i++],r=factor();if(op==="/"&&r===0)throw new Error("Cannot divide by zero");v=op==="*"?v*r:v/r;trace.push({label:fmt(left)+(op==="*"?" × ":" ÷ ")+fmt(r)+" =",result:fmt(v)});}return v;};
    const expr=()=>{let v=term();while(parts[i]==="+"||parts[i]==="-"){const left=v,op=parts[i++],r=term();v=op==="+"?v+r:v-r;trace.push({label:fmt(left)+(op==="+"?" + ":" − ")+fmt(r)+" =",result:fmt(v)});}return v;};
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
    const source=expressionText(),trace=[];
    const result=evaluate(source,trace);
    steps.push(...trace);saveStep(source+" =",fmt(result));current=String(result);tokens=[];justEvaluated=true;
    message("Result saved · "+steps.length+" of 120 review steps");render();speakCalculation(source,fmt(result));
  };
  const clear=()=>{current="0";tokens=[];justEvaluated=false;modeLabel.textContent="STANDARD";message("Ready");render();};
  const clearEntry=()=>{current="0";justEvaluated=false;message("Current entry cleared");render();};
  const showStep=()=>{
    const item=steps[stepIndex];if(!item)return;
    expressionView.textContent=item.label;display.textContent=item.result;display.classList.add("review-result");
    message("Step "+(stepIndex+1)+" of "+steps.length);
  };
  const correct=()=>{
    if(stepIndex<0||!steps[stepIndex]){message("No calculation selected · press CHECK first");return;}
    const item=steps[stepIndex];
    const gstMatch=item.label.match(/^([\d,.]+) ([+−]) GST ([\d.]+)%/);
    if(gstMatch){
      const rateText=prompt("Correct the GST rate (%):",gstMatch[3]);
      if(rateText===null)return;
      const rate=Number(rateText),amount=Number(gstMatch[1].replace(/,/g,""));
      if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error("Enter a GST rate from 0 to 100");
      const result=gstMatch[2]==="+"?amount*(1+rate/100):amount/(1+rate/100);
      steps[stepIndex]={label:fmt(amount)+(gstMatch[2]==="+"?" + GST ":" − GST ")+rate+"% = (corrected)",result:fmt(result)};
      gstRate=rate;current=String(Number(result.toFixed(10)));tokens=[];justEvaluated=true;showStep();message("GST step corrected and recalculated");return;
    }
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
      speak(spokenLabel(button));if(navigator.vibrate)navigator.vibrate(8);
      if(action)handle(action);else if(value&&["+","−","×","÷"].includes(value))operator(value);else if(value)input(value);
    });
  });
  window.addEventListener("keydown",event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const k=event.key;
    if(/^[0-9.]$/.test(k)){speak(k==="."?"decimal point":k);input(k);}
    else if(k==="Enter"||k==="="){speak("equals");handle("equals");}
    else if(k==="Escape"){speak("all clear");clear();}
    else if(k==="Backspace"){current=current.length>1?current.slice(0,-1):"0";render();}
    else if(k==="+"||k==="-"||k==="*"||k==="/"){event.preventDefault();speak(({ "+":"plus","-":"minus","*":"multiply","/":"divide"})[k]);operator(({ "+":"+","-":"−","*":"×","/":"÷"})[k]);}
    else if(k==="%"){speak("percent");handle("percent");}
  });
  render();
})();