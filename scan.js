(() => {
  const $ = id => document.getElementById(id);
  const dialog=$("scan-dialog"), file=$("scan-file"), raw=$("scan-raw"), expr=$("scan-expression"), answer=$("scan-answer");
  const progress=$("scan-progress"), result=$("scan-result");
  if(!dialog||!file)return;
  $("scan-toggle").addEventListener("click",()=>{result.textContent="";result.className="scan-result";dialog.showModal();});
  const cleanNumber = value => value.replace(/,/g,"").replace(/[^0-9.\-]/g,"");
  const suggestExpression = text => {
    const lines=text.split(/\n+/).map(line=>line.trim()).filter(Boolean);
    const cleaned=lines.map(line=>line.replace(/^\s*(?:\d{1,3}[.)]|[•*-])\s*/,"").replace(/(?:answer|total|result)\s*[:=]?/i,"").trim()).filter(Boolean);
    let joined=cleaned.join(" ").replace(/[×xX]/g,"*").replace(/[÷]/g,"/").replace(/[−–—]/g,"-").replace(/,/g,"");
    const equalsMatch=joined.match(/^(.*?)=\\s*([\\d.]+)\\s*$/);
    if(equalsMatch){
      if(!answer.value.trim())answer.value=equalsMatch[2];
      joined=equalsMatch[1];
    }
    const tokens=joined.match(/\d+(?:\.\d+)?|[+*/-]/g)||[];
    const candidate=tokens.join(" ").replace(/\s*([+*/-])\s*/g," $1 ").trim();
    if(/\d/.test(candidate)&&/^[\d.]+(?:\s[+*/-]\s[\d.]+)*$/.test(candidate))return candidate.replace(/\s+/g," ");
    return "";
  };
  file.addEventListener("change",async()=>{
    const image=file.files&&file.files[0];if(!image)return;
    $("scan-file-label").textContent=image.name||"Photo selected";
    progress.textContent="Loading OCR engine…";
    result.textContent="";result.className="scan-result";
    try{
      if(!window.Tesseract){
        await new Promise((resolve,reject)=>{
          const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.onload=resolve;s.onerror=()=>reject(new Error("Could not load OCR. Check your internet connection and try again."));document.head.append(s);
        });
      }
      progress.textContent="Reading the photo… This can take a little while.";
      const worker=await Tesseract.createWorker("eng",1,{logger:m=>{if(m.status==="recognizing text")progress.textContent="Recognizing… "+Math.round((m.progress||0)*100)+"%";}});
      const data=await worker.recognize(image);await worker.terminate();
      raw.value=(data.data.text||"").trim();
      expr.value=suggestExpression(raw.value);
      progress.textContent="Recognition finished. Review every digit and operator carefully; rough handwriting can be misread.";
      if(!expr.value)progress.textContent+=" Please type the calculation into the editable calculation box.";
      const answerMatch=raw.value.match(/(?:answer|total|result)\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
      if(answerMatch)answer.value=answerMatch[1];
    }catch(error){progress.textContent=error.message||"OCR could not read this photo. You can still type the calculation manually.";}
  });
  $("scan-verify").addEventListener("click",()=>{
    const expression=expr.value.trim().replace(/×/g,"*").replace(/[÷]/g,"/").replace(/[−–—]/g,"-");
    if(!/^[\d.]+(?:\s*[+*/-]\s*[\d.]+)*$/.test(expression)){result.className="scan-result bad";result.textContent="Please correct the calculation. Use numbers and +, −, × or ÷.";return;}
    if(/(?:^|[+*/-])(?:\s*[+*/-]|\s*$)/.test(expression)){result.className="scan-result bad";result.textContent="The calculation looks incomplete. Check the operators.";return;}
    const written=cleanNumber(answer.value.trim());
    if(!written||!Number.isFinite(Number(written))){result.className="scan-result bad";result.textContent="Enter the answer written on the paper so it can be checked.";return;}
    // Use the calculator's own keypad and equals action so its existing engine/history remain authoritative.
    document.querySelector('[data-action="clear"]').click();
    const parts=expression.match(/\d+(?:\.\d+)?|[+*/-]/g)||[];
    for(const part of parts){
      if(/[+*/-]/.test(part)&&part.length===1){
        const map={"+":"+","-":"−","*":"×","/":"÷"};
        document.querySelector('[data-value="'+map[part]+'"]').click();
      }else{
        for(const char of part)document.querySelector('[data-value="'+char+'"]')?.click();
      }
    }
    document.querySelector('[data-action="equals"]').click();
    const displayed=(document.getElementById("display").textContent||"").replace(/,/g,"");
    const calculated=Number(displayed), expected=Number(written);
    if(!Number.isFinite(calculated)){result.className="scan-result bad";result.textContent="The calculator could not evaluate this expression. Check it and try again.";return;}
    const matches=Math.abs(calculated-expected)<=Math.max(1e-9,Math.abs(calculated)*1e-10);
    result.className="scan-result "+(matches?"good":"bad");
    result.textContent=matches?"✓ Matches the answer written on the paper. Calculated: "+displayed:"✕ Does not match. Calculated: "+displayed+" · Written: "+written;
    progress.textContent="The verified calculation has also been sent to the calculator and saved in its history.";
  });
})();