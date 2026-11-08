(() => {
  const $ = selector => document.querySelector(selector);
  const display=$("#display"), expressionView=$("#expression"), status=$("#status");
  const memoryIndicator=$("#memory-indicator"), modeLabel=$("#mode-label");
  const voiceToggle=$("#voice-toggle"), voiceLabel=$("#voice-label");
  let current="0", tokens=[], memory=0, gstRate=18, justEvaluated=false, entryStarted=false;
  let steps=[], stepIndex=-1, replayTimer=null, voiceEnabled=true, lastMrc=false;
  const HISTORY_KEY="betterolly-calculator-history-v1";
  let history=[];
  try {
    const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
    if(Array.isArray(saved))history=saved.filter(item=>item&&typeof item.expression==="string"&&typeof item.result==="string").slice(0,50);
  } catch (_) { history=[]; }
  const historyList=$("#history-list"), historyEmpty=$("#history-empty"), historyClear=$("#history-clear");
  const renderHistory=()=>{
    if(!historyList)return;
    historyList.replaceChildren();
    historyEmpty.hidden=history.length>0;
    historyClear.disabled=history.length===0;
    history.forEach((item,index)=>{
      const button=document.createElement("button");
      button.type="button";button.className="history-item";button.dataset.historyIndex=String(index);
      const expression=document.createElement("span");expression.className="history-expression";expression.textContent=item.expression;
      const result=document.createElement("strong");result.className="history-result";result.textContent=item.result;
      const date=document.createElement("small");date.className="history-date";date.textContent=item.time||"";
      button.append(expression,result,date);historyList.append(button);
    });
  };
  const recordHistory=(expression,result)=>{
    history.unshift({expression:String(expression).replace(/\s*=\s*$/,""),result:String(result),time:new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})});
    history=history.slice(0,50);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(_){}
    renderHistory();
  };
  if(historyClear)historyClear.addEventListener("click",()=>{
    history=[];try{localStorage.removeItem(HISTORY_KEY);}catch(_){}
    renderHistory();message("Calculation history cleared");
  });
  if(historyList)historyList.addEventListener("click",event=>{
    const button=event.target.closest("[data-history-index]");
    if(!button)return;
    const item=history[Number(button.dataset.historyIndex)];
    if(!item)return;
    current=item.result.replace(/,/g,"");tokens=[];entryStarted=false;justEvaluated=true;
    expressionView.textContent=item.expression+" =";display.textContent=item.result;display.classList.remove("review-result");
    message("History result restored to calculator");
  });

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
    expressionView.textContent=tokens.length ? tokens.join(" ") + (entryStarted ? " "+current : "") : "";
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
    // Speech recognizers sometimes merge number/operator words into brand-like
    // tokens (for example, "oneplus"). In calculator mode, split those tokens
    // before parsing so the first operand is not silently discarded.
    const operatorWords="plus|minus|times|multiply|multiplied|divide|divided|add|added|subtract|jod|jama|ghata|ghatao|guna|bhaag|bhag";
    const numberWordPattern="zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
    const normalized=String(transcript).toLowerCase()
      .replace(new RegExp("\\b("+numberWordPattern+")("+operatorWords+")\\b","g"),"$1 $2");
    const cleaned=normalized
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
      tokens=[];current="0";justEvaluated=false;entryStarted=false;
      const trace=[],result=evaluate(expression,trace);
      const groupId="calc-"+Date.now()+"-"+steps.length;
      trace.forEach(item=>{item.groupId=groupId;item.expression=expression;});
      appendSteps(trace);
      saveStep(expression+" =",fmt(result),{groupId,expression});
      recordHistory(expression,fmt(result));
      expressionView.textContent=expression+" =";current=String(result);justEvaluated=true;entryStarted=false;
      message("Heard: "+expression+" · result saved");render();speakCalculation(expression,fmt(result));
    }catch(error){message(error.message||"Could not understand that calculation");speak("Sorry, I could not understand that calculation");}
  };
  if(SpeechRecognition){
    recognition=new SpeechRecognition();recognition.lang="en-IN";recognition.interimResults=false;recognition.continuous=false;
    let recognizedSegments=[];
    recognition.onstart=()=>{recognizedSegments=[];listening=true;micToggle.setAttribute("aria-pressed","true");micToggle.classList.add("listening");micLabel.textContent="Listening";message("Listening · say your calculation");};
    recognition.onresult=event=>{
      // Use final results only. Interim speech text can be revised by the
      // browser while listening (for example, changing a spoken "minus"
      // into "plus"), so never show or calculate from those temporary guesses.
      for(let i=event.resultIndex;i<event.results.length;i++){
        if(!event.results[i].isFinal)continue;
        recognizedSegments[i]=event.results[i][0].transcript.trim();
      }
      const preview=recognizedSegments.filter(Boolean).join(" ").trim();
      if(preview)message("Recognized: "+preview);
    };
    recognition.onerror=event=>{resetMicUI();message(event.error==="not-allowed"?"Microphone permission is blocked. Allow it in your browser settings.":"Voice input error · "+event.error);};
    recognition.onend=()=>{
      const transcript=recognizedSegments.filter(Boolean).join(" ").trim();
      const shouldProcess=listening;
      resetMicUI();
      if(shouldProcess&&transcript)processSpokenCalculation(transcript);
      else if(shouldProcess)message("No speech detected · tap Speak and try again");
    };
    micToggle.addEventListener("click",()=>{stopReplay();if(listening){stopListening();message("Voice input stopped");return;}try{recognition.start();}catch(_){message("Voice input is already starting. Try again in a moment.");}});
  }else{
    micToggle.disabled=true;micLabel.textContent="Unavailable";micToggle.title="Speech recognition is not supported in this browser";
    micToggle.addEventListener("click",()=>message("Speech recognition is not supported in this browser. Try a supported browser such as Chrome."));
  }

  // Recursive-descent parser: multiplication/division take precedence over addition/subtraction.
  const evaluate = (source, trace=[]) => {
    const s=source.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/,/g,"").replace(/\s+/g,"");
    const parts=s.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/^]/g)||[];
    if(parts.join("")!==s || !parts.length)throw new Error("Check the calculation and try again");
    let i=0;
    const atom=()=>{
      if(parts[i]==="("){i++;const v=expr();if(parts[i++]!==")")throw new Error("Missing closing bracket");return v;}
      const p=parts[i++];if(!p||!/^\d*\.?\d+$/.test(p))throw new Error("Incomplete calculation");
      return Number(p);
    };
    const power=()=>{
      const base=atom();
      if(parts[i]==="^"){
        i++;const exponent=factor(),value=Math.pow(base,exponent);
        if(!Number.isFinite(value))throw new Error("Invalid power operation");
        trace.push({label:fmt(base)+" ^ "+fmt(exponent)+" =",result:fmt(value)});
        return value;
      }
      return base;
    };
    const factor=()=>{
      if(parts[i]==="+"){i++;return factor();}
      if(parts[i]==="-"){i++;return -factor();}
      return power();
    };
    const term=()=>{let v=factor();while(parts[i]==="*"||parts[i]==="/"){const left=v,op=parts[i++],r=factor();if(op==="/"&&r===0)throw new Error("Cannot divide by zero");v=op==="*"?v*r:v/r;trace.push({label:fmt(left)+(op==="*"?" × ":" ÷ ")+fmt(r)+" =",result:fmt(v)});}return v;};
    const expr=()=>{let v=term();while(parts[i]==="+"||parts[i]==="-"){const left=v,op=parts[i++],r=term();v=op==="+"?v+r:v-r;trace.push({label:fmt(left)+(op==="+"?" + ":" − ")+fmt(r)+" =",result:fmt(v)});}return v;};
    const result=expr();if(i!==parts.length)throw new Error("Invalid calculation");if(!Number.isFinite(result))throw new Error("Invalid result");return Number(result.toFixed(10));
  };
  const expressionText=()=>{
    // The token list is the committed expression; current is the editable final operand.
    // Never replace or discard an earlier operand when another operator is pressed.
    if(!tokens.length)return current;
    return tokens.join(" ")+(entryStarted?" "+current:"");
  };
  const appendSteps=items=>{
    for(const item of items){
      steps.push(item);
      if(steps.length>120)steps.shift();
    }
    stepIndex=steps.length-1;
  };
  const saveStep=(label,result,metadata={})=>{
    appendSteps([{label,result:String(result),...metadata}]);
  };
  const input=value=>{
    if(justEvaluated){current="0";tokens=[];justEvaluated=false;entryStarted=false;}
    if(value==="."&&current.includes("."))return;
    if(value==="."){
      if(!entryStarted)current="0.";
      else current+=".";
      entryStarted=true;lastMrc=false;render();return;
    }
    if(!entryStarted || current==="0")current=value==="00"?"0":value;
    else current+=value;
    entryStarted=true;lastMrc=false;render();
  };
  const operator=op=>{
    // Commit the currently typed operand before appending an operator.
    // If the user presses two operators in a row, replace only the pending operator.
    if(justEvaluated){tokens=[current];justEvaluated=false;entryStarted=false;}
    else if(!tokens.length){tokens.push(current);}
    else if(/[+−×÷^]$/.test(tokens[tokens.length-1])){
      if(entryStarted){tokens.push(current);}
      else {tokens[tokens.length-1]=op;current="0";render();return;}
    }else if(entryStarted){tokens.push(current);}
    else {throw new Error("Enter a number before choosing an operator");}
    tokens.push(op);
    current="0";entryStarted=false;lastMrc=false;render();
  };
  const equals=()=>{
    const source=expressionText(),trace=[];
    const result=evaluate(source,trace);
    const groupId="calc-"+Date.now()+"-"+steps.length;
    trace.forEach(item=>{item.groupId=groupId;item.expression=source;});
    appendSteps(trace);saveStep(source+" =",fmt(result),{groupId,expression:source});recordHistory(source,fmt(result));
    current=String(result);tokens=[];justEvaluated=true;entryStarted=false;
    message("Result saved · "+steps.length+" of 120 review steps");render();speakCalculation(source,fmt(result));
  };
  const clear=()=>{current="0";tokens=[];justEvaluated=false;entryStarted=false;modeLabel.textContent="STANDARD";message("Ready");render();};
  const clearEntry=()=>{
    // CE clears only the number being entered; earlier operands/operators remain intact.
    current="0";entryStarted=false;justEvaluated=false;
    message(tokens.length?"Current entry cleared · expression preserved":"Current entry cleared");render();
  };
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
    const revised=prompt(
      item.expression?"Correct the full calculation expression:":"Correct this calculation step:",
      item.expression||item.label.replace(/\s*=\s*$/,"")
    );
    if(revised===null)return;
    const correctedTrace=[];
    const result=evaluate(revised,correctedTrace);
    if(item.groupId){
      // Replace every review step belonging to this calculation, not just
      // the selected intermediate line, so CHECK and AUTO show consistent results.
      const firstIndex=steps.findIndex(step=>step.groupId===item.groupId);
      const groupId="calc-"+Date.now()+"-"+firstIndex;
      correctedTrace.forEach(step=>{step.groupId=groupId;step.expression=revised;});
      const correctedGroup=[...correctedTrace,{label:revised+" = (corrected)",result:fmt(result),groupId,expression:revised}];
      const retained=steps.filter(step=>step.groupId!==item.groupId);
      retained.splice(Math.max(0,firstIndex),0,...correctedGroup);
      steps=retained.slice(-120);
      stepIndex=steps.findIndex(step=>step.groupId===groupId&&step.label.includes("(corrected)"));
    }else{
      steps[stepIndex]={label:revised+" = (corrected)",result:fmt(result)};
    }
    current=String(result);tokens=[];justEvaluated=true;showStep();message("Calculation corrected and all its review steps recalculated");
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
    saveStep(label+" =",fmt(result));recordHistory(label,fmt(result));
    // GST transforms the current operand without discarding earlier pending operations.
    current=String(Number(result.toFixed(10)));entryStarted=true;justEvaluated=false;
    modeLabel.textContent="GST "+gstRate+"%";message(direction==="add"?"GST added at "+gstRate+"%":"GST removed at "+gstRate+"%");render();
  };
  const handle=action=>{
    try{
      switch(action){
        case "clear":clear();break;
        case "clear-entry":clearEntry();break;
        case "sign":current=String(-raw());entryStarted=true;render();break;
        case "percent":{
          const amount=raw();
          const last=tokens[tokens.length-1];
          const previous=tokens.length>1?Number(tokens[tokens.length-2]):NaN;
          // For +/−, calculate a percentage of the preceding amount (e.g. 200 + 10% = 220).
          // For ×/÷ and standalone %, use the decimal percentage value.
          const result=(last==="+"||last==="−")&&Number.isFinite(previous)
            ? previous*amount/100 : amount/100;
          current=String(Number(result.toFixed(10)));entryStarted=true;justEvaluated=false;
          message("Percentage applied");render();break;
        }
        case "sqrt":{
          const n=raw();
          if(n<0)throw new Error("Square root needs a non-negative number");
          const result=Math.sqrt(n),label="√("+fmt(n)+")";
          saveStep(label+" =",fmt(result));
          // A function key transforms only the current operand. Keep any
          // earlier operands/operators so expressions such as 200 + √(9) survive.
          const hasPendingExpression=tokens.length>0;
          if(!hasPendingExpression)recordHistory(label,fmt(result));
          current=String(Number(result.toFixed(10)));
          entryStarted=hasPendingExpression;
          justEvaluated=!hasPendingExpression;
          message("Square root calculated");
          render();
          break;
        }
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
    if(/^[0-9.]$/.test(k)||["Enter","=","Escape","Backspace","+","-","*","/","^","%"].includes(k))stopReplay();
    if(/^[0-9.]$/.test(k)){speak(k==="."?"decimal point":k);input(k);}
    else if(k==="Enter"||k==="="){speak("equals");handle("equals");}
    else if(k==="Escape"){speak("all clear");clear();}
    else if(k==="Backspace"){
      if(justEvaluated){current="0";tokens=[];justEvaluated=false;entryStarted=false;}
      else if(entryStarted){current=current.length>1?current.slice(0,-1):"0";if(current==="-"||current==="")current="0";if(current==="0")entryStarted=false;}
      render();
    }
    else if(k==="+"||k==="-"||k==="*"||k==="/"||k==="^"){event.preventDefault();speak(({ "+":"plus","-":"minus","*":"multiply","/":"divide","^":"to the power of"})[k]);operator(({ "+":"+","-":"−","*":"×","/":"÷","^":"^"})[k]);}
    else if(k==="%"){speak("percent");handle("percent");}
  });
  render();
  renderHistory();
})();