(() => {
  const display = document.querySelector("#display");
  const expressionView = document.querySelector("#expression");
  const status = document.querySelector("#status");
  const memoryIndicator = document.querySelector("#memory-indicator");
  const modeLabel = document.querySelector("#mode-label");
  const soundToggle = document.querySelector("#sound-toggle");
  const soundLabel = document.querySelector("#sound-label");

  let current = "0", expression = "", storedValue = null, memory = 0;
  let gstRate = 18, justEvaluated = false, steps = [], stepIndex = -1;
  let soundEnabled = true, audioContext = null;

  const playTone = kind => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ||= new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const settings = kind === "equals" ? {frequency:740,duration:.105,volume:.045,wave:"sine"} :
        kind === "operator" ? {frequency:510,duration:.065,volume:.027,wave:"sine"} :
        kind === "utility" ? {frequency:390,duration:.055,volume:.022,wave:"triangle"} :
        {frequency:620,duration:.045,volume:.018,wave:"sine"};
      oscillator.type = settings.wave;
      oscillator.frequency.setValueAtTime(settings.frequency, now);
      if (kind === "equals") oscillator.frequency.exponentialRampToValueAtTime(880, now + settings.duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(settings.volume, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + settings.duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now); oscillator.stop(now + settings.duration + .01);
    } catch (_) { /* Audio is optional; calculator functions without it. */ }
  };
  const setSound = enabled => {
    soundEnabled = enabled;
    soundToggle.setAttribute("aria-pressed", String(enabled));
    soundLabel.textContent = enabled ? "Sound on" : "Sound off";
    soundToggle.title = enabled ? "Turn button sounds off" : "Turn button sounds on";
    soundToggle.querySelector(".sound-symbol").textContent = enabled ? "♪" : "∅";
  };
  soundToggle.addEventListener("click", () => { setSound(!soundEnabled); if(soundEnabled) playTone("utility"); });

  const format = value => {
    if (!Number.isFinite(value)) throw new Error("Cannot calculate this value");
    return Number(value.toPrecision(12)).toLocaleString("en-IN", {maximumFractionDigits: 10});
  };
  const numeric = () => {
    const n = Number(current.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw new Error("Invalid number");
    return n;
  };
  const setStatus = message => { status.textContent = message; };
  const render = () => {
    display.textContent = current;
    expressionView.textContent = expression;
    memoryIndicator.textContent = memory !== 0 ? "M" : "";
  };
  const saveStep = (label, result) => {
    steps.push({label, result});
    if (steps.length > 120) steps.shift();
    stepIndex = steps.length - 1;
  };
  const clear = () => {
    current = "0"; expression = ""; storedValue = null; justEvaluated = false;
    modeLabel.textContent = "STANDARD"; setStatus("Cleared"); render();
  };
  const input = value => {
    if (justEvaluated) { current = "0"; expression = ""; justEvaluated = false; }
    if (value === "." && current.includes(".")) return;
    if (current === "0" && value !== ".") current = value;
    else if (current === "-0" && value !== ".") current = "-" + value;
    else current += value;
    render();
  };
  const calculate = () => {
    if (!expression) return numeric();
    const left = storedValue, right = numeric();
    switch (expression.slice(-1)) {
      case "+": return left + right;
      case "−": return left - right;
      case "×": return left * right;
      case "÷": if (right === 0) throw new Error("Cannot divide by zero"); return left / right;
      default: return right;
    }
  };
  const chooseOperator = op => {
    const value = numeric();
    if (expression && storedValue !== null) {
      const result = calculate(); storedValue = result; current = String(result);
    } else storedValue = value;
    expression = format(storedValue) + " " + op;
    current = "0"; justEvaluated = false; render();
  };
  const equals = () => {
    const before = expression ? expression + " " + current : current;
    const result = calculate();
    current = String(result); expression = before + " =";
    storedValue = null; justEvaluated = true;
    saveStep(expression, format(result));
    setStatus("Calculation saved in review steps"); render();
  };
  const applyPercent = () => { current = String(numeric() / 100); render(); setStatus("Percentage applied"); };
  const gst = direction => {
    const amount = numeric();
    const result = direction === "add" ? amount * (1 + gstRate / 100) : amount / (1 + gstRate / 100);
    expression = format(amount) + (direction === "add" ? " + " : " − ") + "GST " + gstRate + "%";
    current = String(result); justEvaluated = true;
    modeLabel.textContent = "GST " + gstRate + "%";
    saveStep(expression, format(result)); setStatus((direction === "add" ? "GST added" : "GST removed") + " · " + gstRate + "%"); render();
  };
  const showStep = () => {
    const item = steps[stepIndex]; if (!item) return;
    expressionView.textContent = item.label; display.textContent = item.result;
    setStatus("Step " + (stepIndex + 1) + " of " + steps.length);
  };
  const handle = action => {
    try {
      switch (action) {
        case "clear": clear(); break;
        case "clear-entry": current = "0"; render(); setStatus("Entry cleared"); break;
        case "sign": current = String(-numeric()); render(); break;
        case "percent": applyPercent(); break;
        case "sqrt": { const n=numeric(); if(n<0) throw new Error("Square root needs a non-negative number"); expression="√("+format(n)+")"; current=String(Math.sqrt(n)); justEvaluated=true; saveStep(expression,format(Math.sqrt(n))); render(); break; }
        case "equals": equals(); break;
        case "gst-plus": gst("add"); break;
        case "gst-minus": gst("remove"); break;
        case "rate": { const next=prompt("Enter GST rate (%)",String(gstRate)); if(next===null)return; const n=Number(next); if(!Number.isFinite(n)||n<0||n>100) throw new Error("Enter a GST rate from 0 to 100"); gstRate=n; modeLabel.textContent="GST RATE SET"; setStatus("GST rate set to "+gstRate+"%"); break; }
        case "memory-plus": memory+=numeric(); setStatus("Added to memory"); render(); break;
        case "memory-minus": memory-=numeric(); setStatus("Subtracted from memory"); render(); break;
        case "memory-recall": if(memory!==0){current=String(memory);justEvaluated=true;setStatus("Memory recalled");render();}else setStatus("Memory is empty"); break;
        case "check-prev": if(stepIndex>0){stepIndex--;showStep();}else setStatus("No earlier step"); break;
        case "check-next": if(stepIndex<steps.length-1){stepIndex++;showStep();}else setStatus("No later step"); break;
        case "correct": if(stepIndex>=0){const item=steps[stepIndex];const revised=prompt("Edit this calculation result:",item.result);if(revised!==null&&revised.trim()!==""){const n=Number(revised);if(!Number.isFinite(n))throw new Error("Enter a valid number");steps[stepIndex]={...item,result:format(n)};current=String(n);expression=item.label+" (corrected)";render();setStatus("Review step corrected");}}else setStatus("No step to correct"); break;
        case "replay": if(!steps.length){setStatus("No steps to replay");break;} stepIndex=0;showStep();setStatus("Replay: step 1 of "+steps.length); break;
      }
    } catch (error) { setStatus(error.message || "Something went wrong"); }
  };

  document.querySelectorAll(".key,.review-key").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action, value = button.dataset.value;
      const tone = button.classList.contains("equals") || action === "equals" ? "equals" :
        (button.classList.contains("operator") ? "operator" :
        (button.classList.contains("utility") || button.classList.contains("review-key") ? "utility" : "key"));
      playTone(tone);
      if ("vibrate" in navigator) navigator.vibrate(8);
      if (action) handle(action);
      else if (value && ["+","−","×","÷"].includes(value)) {
        try { chooseOperator(value); } catch(error) { setStatus(error.message); }
      } else if (value) input(value);
    });
  });
  window.addEventListener("keydown", event => {
    const key = event.key;
    if (/^[0-9.]$/.test(key)) input(key);
    else if (key==="Enter"||key==="=") { playTone("equals"); handle("equals"); }
    else if (key==="Escape") { playTone("utility"); clear(); }
    else if (key==="Backspace") { playTone("key"); current=current.length>1?current.slice(0,-1):"0";render(); }
    else if (key==="+") { playTone("operator"); chooseOperator("+"); }
    else if (key==="-") { playTone("operator"); chooseOperator("−"); }
    else if (key==="*") { playTone("operator"); chooseOperator("×"); }
    else if (key==="/") { event.preventDefault();playTone("operator");chooseOperator("÷"); }
    else if (key==="%") { playTone("utility");handle("percent"); }
  });
  setSound(true);
  render();
})();