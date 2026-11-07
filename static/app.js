// Packer frontend: explicit physical confirmation, actual weather, optional real YOLO.
const $ = (id) => document.getElementById(id);
let mode = 'auto';
let plan = null;
let visionActive = false;
let visionDetections = [];
let frameTimer = null;
let cameraStreamActive = false;
// A location cue only: never automatically mark an item as packed from vision.
const BAG_ZONE_KEY = 'packer_bag_zone_v1';
const DEFAULT_BAG_ZONE = {x:0.34,y:0.23,w:0.32,h:0.55};
function safeBagZone(value){
  if(!value || !['x','y','w','h'].every(k=>Number.isFinite(Number(value[k])))) return {...DEFAULT_BAG_ZONE};
  const x=Math.max(0,Math.min(0.95,Number(value.x)));
  const y=Math.max(0,Math.min(0.95,Number(value.y)));
  return {x,y,w:Math.max(0.05,Math.min(1-x,Number(value.w))),h:Math.max(0.05,Math.min(1-y,Number(value.h)))};
}
let bagZone = {...DEFAULT_BAG_ZONE};
try{bagZone=safeBagZone(JSON.parse(localStorage.getItem(BAG_ZONE_KEY)||'null'));}catch{}
let editingBagZone=false;
let bagWatch = {targetId:null,seenOutside:false,outsideAt:0,insideFrames:0,candidate:false};
let lastAnalyzedFrame=-1;
function resetBagWatch(){bagWatch={targetId:null,seenOutside:false,outsideAt:0,insideFrames:0,candidate:false};lastAnalyzedFrame=-1;updateBagStatus();}
function currentTarget(){return plan?.items?.find(i=>!i.packed)||null;}
function setBagOverlay(){
 const el=$('bag-zone-overlay');
 el.style.left=(bagZone.x*100)+'%';el.style.top=(bagZone.y*100)+'%';
 el.style.width=(bagZone.w*100)+'%';el.style.height=(bagZone.h*100)+'%';
}
function insideBag(d){
  const c=d.center;
  if(!Array.isArray(c)||c.length<2)return false;
  return c[0]>=bagZone.x&&c[0]<=bagZone.x+bagZone.w&&c[1]>=bagZone.y&&c[1]<=bagZone.y+bagZone.h;
}
function updateBagStatus(){
  const el=$('bag-zone-status');if(!el)return;
  el.classList.toggle('possible',bagWatch.candidate);
  const target=currentTarget();
  if(!target){el.textContent=plan?'All items have been confirmed!':'Create a plan to begin bag-area tracking.';return;}
  if(!visionActive){el.textContent='Start the camera and point it toward the open bag and items, or use manual/micro:bit confirmation.';return;}
  if(!target.detect_class){el.textContent=`${target.name}: no standard YOLO class. Use visual inspection and press micro:bit A (or Packed ✓).`;return;}
  if(bagWatch.candidate){el.textContent=`Possible placement of ${target.name}: YOLO saw the object enter the marked bag area. Check that it stayed inside; press A to confirm or B to retry.`;return;}
  if(bagWatch.seenOutside){el.textContent=`Tracking ${target.name}: detected outside bag area. Move it inside the purple box; keep it visible briefly.`;return;}
  el.textContent=`Looking for ${target.name} (${target.detect_class}) on the table. Make sure it and the bag opening are visible.`;
}
function analyzeBagMovement(frameId){
  const target=currentTarget();
  if(!target || !visionActive){resetBagWatch();return;}
  if(target.id!==bagWatch.targetId){bagWatch={targetId:target.id,seenOutside:false,outsideAt:0,insideFrames:0,candidate:false};}
  if(frameId===lastAnalyzedFrame)return; // Count real YOLO frames, not repeated HTTP polls.
  lastAnalyzedFrame=frameId;
  if(!target.detect_class || bagWatch.candidate){updateBagStatus();return;}
  const matching=visionDetections.filter(d=>d.label===target.detect_class && Array.isArray(d.center));
  const outside=matching.some(d=>!insideBag(d));
  const inside=matching.some(d=>insideBag(d));
  const now=Date.now();
  if(outside){bagWatch.seenOutside=true;bagWatch.outsideAt=now;}
  if(!inside)bagWatch.insideFrames=0;
  else if(bagWatch.seenOutside && (now-bagWatch.outsideAt)<90000){
    bagWatch.insideFrames++;
    if(bagWatch.insideFrames>=2)bagWatch.candidate=true;
  }
  updateBagStatus();
}
function setZoneSelection(enabled){
 editingBagZone=enabled;
 $('camera-stage').classList.toggle('setting-zone',enabled);
 $('bag-zone-set').textContent=enabled?'Cancel drawing':'Draw bag area';
 $('bag-zone-help').textContent=enabled?'Drag a rectangle around the bag opening on the video.':'Point the camera toward the table and open bag. Draw around the bag opening.';
}
$('bag-zone-set').addEventListener('click',()=>{
 if(!visionActive || $('camera-stage').hidden){$('bag-zone-help').textContent='Start the camera first.';return;}
 setZoneSelection(!editingBagZone);
});
$('bag-zone-reset').addEventListener('click',()=>{
 bagZone={...DEFAULT_BAG_ZONE};localStorage.setItem(BAG_ZONE_KEY,JSON.stringify(bagZone));
 setBagOverlay();resetBagWatch();setZoneSelection(false);
});
let zoneStart=null;
const drawLayer=$('zone-draw');
function normalizedPointer(ev){
 const r=drawLayer.getBoundingClientRect();
 return {x:Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height))};
}
drawLayer.addEventListener('pointerdown',ev=>{
 if(!editingBagZone)return;
 zoneStart=normalizedPointer(ev);drawLayer.setPointerCapture(ev.pointerId);
});
drawLayer.addEventListener('pointermove',ev=>{
 if(!zoneStart || !editingBagZone)return;
 const p=normalizedPointer(ev);
 bagZone=safeBagZone({x:Math.min(zoneStart.x,p.x),y:Math.min(zoneStart.y,p.y),w:Math.abs(p.x-zoneStart.x),h:Math.abs(p.y-zoneStart.y)});
 setBagOverlay();
});
drawLayer.addEventListener('pointerup',ev=>{
 if(!zoneStart)return;
 const p=normalizedPointer(ev);
 if(Math.abs(p.x-zoneStart.x)<.06 || Math.abs(p.y-zoneStart.y)<.06){
 $('bag-zone-help').textContent='Please draw a larger rectangle around the bag.';zoneStart=null;return;
 }
 bagZone=safeBagZone({x:Math.min(zoneStart.x,p.x),y:Math.min(zoneStart.y,p.y),w:Math.abs(p.x-zoneStart.x),h:Math.abs(p.y-zoneStart.y)});
 localStorage.setItem(BAG_ZONE_KEY,JSON.stringify(bagZone));
 zoneStart=null;setBagOverlay();resetBagWatch();setZoneSelection(false);
});
drawLayer.addEventListener('pointercancel',()=>{zoneStart=null;setZoneSelection(false);});
setBagOverlay();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = (v) => /^\d{2}:\d{2}$/.test(v) ? v : '—';
const setMessage = (text) => { $('message').textContent = text; };
const examples = {
  auto:'Tomorrow I have math and science at school, then I\'m playing football with friends.',
  school:'Tomorrow I have math, science and PE at school.',
  friends:'I am playing football with my friends tomorrow afternoon.',
  vacation:'I am going to Kyoto for 3 days. I will stay at a hotel.'
};
function nextLocalDay(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
$('date').value=nextLocalDay();
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click',()=>{
  mode=button.dataset.mode;
  document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b===button));
  $('prompt').value=examples[mode];
  if(mode==='vacation') {$('days').value=3;$('destination').value='Kyoto';}
  else {$('days').value=1;$('destination').value='Tokyo';}
}));
async function generate(){
  const button=$('generate');button.disabled=true;button.textContent='Generating plan…';setMessage('Checking weather and analyzing your plans…');
  try{
    const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      mode,prompt:$('prompt').value,destination:$('destination').value,date:$('date').value,days:Number($('days').value),
      timetable: timetable, use_timetable: $('timetable-enabled').checked
    })});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Could not create plan');
    plan=result; plan.items.forEach(i=>i.packed=false);
    resetBagWatch();render();store();
    setMessage(result.engine==='claude'?'Plan generated by Claude. Confirm each physical packing step.':
      result.engine==='rules-fallback'?'Claude request failed; using a rule-based plan. Physical packing is still available.':
      'Rule-based plan ready. Set ANTHROPIC_API_KEY on the server to enable Claude.');
  }catch(err){setMessage('Error: '+err.message);}
  finally{button.disabled=false;button.innerHTML='✦ &nbsp;Generate packing plan <span>↗</span>';}
}
$('generate').addEventListener('click',generate);
function store(){if(plan)localStorage.setItem('packer_plan_v1',JSON.stringify(plan));}
function render(){if(!plan)return;
  const w=plan.weather||{};
  $('weather-temp').textContent=w.available?`${Math.round(w.high_c)}° / ${Math.round(w.low_c)}°C`:'—';
  $('weather-desc').textContent=w.available?`${w.place} · ${plan.date}`:(w.message||'Weather unavailable');
  $('weather-row').textContent=w.available?`☂ Up to ${w.rain_chance??'?'}% precipitation chance over ${w.days_covered||1} forecast day(s)${w.days_covered<w.days_requested?' · partial forecast':''}`:'No weather-derived additions when a forecast is unavailable';
  $('timeline-total').textContent=`${plan.timeline.length} ACTIVITIES`;
  $('timeline-list').innerHTML=plan.timeline.length?plan.timeline.map(e=>`<div class="event"><div class="event-time">${esc(formatTime(e.time))}</div><div class="event-title">${esc(e.title)}</div><div class="event-detail">${esc(e.detail)}</div></div>`).join(''):'<div class="empty">No activities yet.</div>';
  const packed=plan.items.filter(i=>i.packed).length;
  $('packed-count').innerHTML=`${packed} <span>/ ${plan.items.length}</span>`;
  const pct=plan.items.length?Math.round(packed/plan.items.length*100):0;
  $('completion').textContent=pct+'%';$('progress-fill').style.width=pct+'%';
  $('queue-total').textContent=`${plan.items.length} ITEMS`;
  const next=plan.items.find(i=>!i.packed);
  $('next-item').textContent=next?`Pack: ${next.name}`:'All items confirmed!';
  $('next-desc').textContent=next?next.reason:'The operator has confirmed each item as packed.';
  const detected=new Set(visionDetections.map(x=>x.label));
  $('item-list').innerHTML=plan.items.map(item=>{
    const cameraStatus=item.detect_class?(visionActive?(detected.has(item.detect_class)?'● Camera: seen':'○ Not currently seen'):'Camera: off'):'Manual confirmation';
    const nextTarget=currentTarget();
    const bagCue=nextTarget?.id===item.id && bagWatch.candidate?' · ◇ Possibly in bag — verify':'';
    return `<div class="item-row ${item.packed?'packed':''}"><div class="item-icon">${item.packed?'✓':'▣'}</div><div><div class="item-title">${esc(item.name)}</div><div class="item-reason">${esc(item.reason)}</div><div class="item-tags">${esc(item.activity)} · ${esc(cameraStatus)}${esc(bagCue)}</div></div><button class="pack-btn ${item.packed?'undo':''}" data-id="${esc(item.id)}">${item.packed?'Undo':'Packed ✓'}</button></div>`;
  }).join('')||'<div class="empty">No items found.</div>';
  document.querySelectorAll('.pack-btn').forEach(b=>b.addEventListener('click',()=>{
    const item=plan.items.find(i=>i.id===b.dataset.id);
    if(item){item.packed=!item.packed;resetBagWatch();store();render();}
  }));
}
async function toggleVision(){
  const url=visionActive?'/api/vision/stop':'/api/vision/start';
  $('vision-message').textContent=visionActive?'Stopping camera…':'Starting YOLO and checking your webcam…';
  try{await fetch(url,{method:'POST'});}catch(err){$('vision-message').textContent='Camera request failed: '+err.message;}
  await pollVision();
}
$('vision-toggle').addEventListener('click',toggleVision);
async function pollVision(){
  try{
    const r=await fetch('/api/vision/status',{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    visionActive=data.active;
    visionDetections=data.detections||[];
    $('vision-toggle').textContent=visionActive?'Stop camera':'Start camera';
    $('vision-indicator').textContent=visionActive?'● CAMERA LIVE':'CAMERA OFF';
    $('vision-indicator').className=visionActive?'pill':'pill soft';
    const showCamera=visionActive&&data.has_frame;
    $('camera-stage').hidden=!showCamera;
    $('camera-placeholder').style.display=showCamera?'none':'flex';
    if(!showCamera && editingBagZone)setZoneSelection(false);
    const stats = data.fps ? ` · ${data.fps.toFixed(1)} FPS · inference ${data.inference_ms} ms` : '';
    $('vision-message').textContent=data.error|| (visionActive?'Live YOLO detections'+stats+'. Camera runs locally; no robot motion is commanded.':'Camera offline. Detection is optional.');
    $('detections').innerHTML=visionDetections.length?visionDetections.map(d=>`<div class="detected">${esc(d.label)} <span>${Math.round(d.confidence*100)}%</span></div>`).join(''):'<div class="empty">No objects currently detected.</div>';
    // Continuous MJPEG feed; avoid reloading a single still image every 850 ms.
    if(showCamera && !cameraStreamActive){
      $('camera-feed').src='/api/vision/stream?t='+Date.now();
      cameraStreamActive=true;
    }else if(!showCamera && cameraStreamActive){
      $('camera-feed').removeAttribute('src');
      cameraStreamActive=false;
    }
    analyzeBagMovement(data.frame_id);
    if(plan)render();
  }catch(err){$('vision-message').textContent='Could not reach the vision service. '+err.message;}
}

// micro:bit serial remote. Press A AFTER seeing the item inside the bag;
// pressing B leaves the current item unconfirmed so the robot can retry.
let microbitLastSeq = null;
let microbitIsConnected = false;
async function connectMicrobit(){
  const btn=$('microbit-connect'); btn.disabled=true;
  $('microbit-message').textContent='Connecting to micro:bit USB...';
  try {
    const r=await fetch(microbitIsConnected?'/api/microbit/disconnect':'/api/microbit/connect', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({port:$('microbit-port').value.trim()||'auto'})
    });
    const data=await r.json();
    microbitIsConnected=!!data.connected;
    microbitLastSeq=data.seq;
    $('microbit-message').textContent=data.error||(microbitIsConnected?'Connected! Button A = packed, B = retry.':'Disconnected.');
  } catch(err){$('microbit-message').textContent='Connection error: '+err.message;}
  finally{btn.disabled=false;}
  pollMicrobit();
}
$('microbit-connect').addEventListener('click',connectMicrobit);
async function pollMicrobit(){
  try {
    const after=microbitLastSeq===null?Number.MAX_SAFE_INTEGER:microbitLastSeq;
    const r=await fetch('/api/microbit/status?after='+after,{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    microbitIsConnected=!!data.connected;
    $('microbit-connect').textContent=microbitIsConnected?'Disconnect micro:bit':'Connect micro:bit';
    $('microbit-status').textContent=microbitIsConnected?`● CONNECTED ${data.port||''}`:'NOT CONNECTED';
    $('microbit-status').className=microbitIsConnected?'pill':'pill soft';
    if(!microbitIsConnected && data.error) $('microbit-message').textContent=data.error;
    if(microbitLastSeq===null){microbitLastSeq=data.seq;return;}
    for(const ev of data.events||[]){
      if(ev.seq<=microbitLastSeq)continue;
      microbitLastSeq=ev.seq;
      if(!plan || !Array.isArray(plan.items)){
        $('microbit-message').textContent='Generate a packing plan first.';continue;
      }
      const next=plan.items.find(item=>!item.packed);
      if(!next){$('microbit-message').textContent='Everything is already confirmed.';continue;}
      if(ev.button==='A'){
        next.packed=true;resetBagWatch();store();render();
        $('microbit-message').textContent=`Operator confirmed: ${next.name} is inside the bag.`;
      }else if(ev.button==='B'){
        resetBagWatch();
        $('microbit-message').textContent=`Placement failed: retry ${next.name}. Nothing marked packed.`;
      }
    }
    if(data.seq>microbitLastSeq)microbitLastSeq=data.seq;
  } catch(err){$('microbit-message').textContent='micro:bit status unavailable: '+err.message;}
}
setInterval(pollMicrobit, 400);

// TIME TABLE: local, editable Monday-Friday schedule + optional Claude image reader.
const timetableDays = ['monday','tuesday','wednesday','thursday','friday'];
const dayLabels = ['Monday / 月','Tuesday / 火','Wednesday / 水','Thursday / 木','Friday / 金'];
const timetableKey = 'packer_timetable_v1';
function emptyTimetable(){return Object.fromEntries(timetableDays.map(d=>[d,Array(6).fill('')]));}
let timetable = emptyTimetable();
try {
  const saved = JSON.parse(localStorage.getItem(timetableKey)||'null');
  if(saved && typeof saved==='object') for(const d of timetableDays) {
    if(Array.isArray(saved[d])) timetable[d]=Array.from({length:6},(_,i)=>String(saved[d][i]||'').slice(0,40));
  }
} catch {}
function saveTimetable(){localStorage.setItem(timetableKey,JSON.stringify(timetable));updateTimetableInfo();}
function drawTimetable(){
  $('timetable-grid').innerHTML=Array.from({length:6},(_,i)=>
    `<tr><th>${i+1}</th>${timetableDays.map(d=>`<td><input aria-label="${d} period ${i+1}" data-day="${d}" data-period="${i}" maxlength="40" value="${esc(timetable[d][i])}" placeholder="—"></td>`).join('')}</tr>`
  ).join('');
  $('timetable-grid').querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
    timetable[input.dataset.day][Number(input.dataset.period)] = input.value.trim();saveTimetable();
  }));
  updateTimetableInfo();
}
function updateTimetableInfo(){
  const dateInput=$('date').value;
  if(!dateInput){$('timetable-day-info').textContent='Select a date to see relevant classes';return;}
  const dateObject=new Date(dateInput+'T12:00:00');
  if(Number.isNaN(dateObject.valueOf()))return;
  const index=(dateObject.getDay()+6)%7;
  if(index>=5){$('timetable-day-info').textContent='Weekend: no classes are added automatically.';return;}
  const subjects=timetable[timetableDays[index]].filter(Boolean);
  $('timetable-day-info').textContent=dayLabels[index]+': '+(subjects.length?subjects.join(', '):'No classes entered');
}
$('date').addEventListener('change',updateTimetableInfo);
$('timetable-enabled').addEventListener('change',()=>{localStorage.setItem('packer_timetable_enabled_v1',$('timetable-enabled').checked?'1':'0');});
$('timetable-enabled').checked=localStorage.getItem('packer_timetable_enabled_v1')!=='0';
$('timetable-clear').addEventListener('click',()=>{
  if(!confirm('Clear all timetable subjects?'))return;
  timetable=emptyTimetable();saveTimetable();drawTimetable();
  $('timetable-message').textContent='Timetable cleared. Enter subjects or upload another photo.';
});
async function importTimetable(file){
  if(!file)return;
  const text=$('timetable-message');
  text.textContent='Reading timetable photo…';
  if(file.size>6*1024*1024){text.textContent='Image exceeds 6MB. Please use a smaller photo.';return;}
  const form=new FormData();form.append('image',file,'timetable.'+(file.type==='image/png'?'png':'jpg'));
  try {
    const resp=await fetch('/api/timetable/read',{method:'POST',body:form});
    const data=await resp.json();
    if(!resp.ok)throw Error(data.error||'Image could not be read');
    timetable=emptyTimetable();
    for(const d of timetableDays)if(Array.isArray(data.days?.[d]))timetable[d]=Array.from({length:6},(_,i)=>String(data.days[d][i]||''));
    saveTimetable();drawTimetable();
    text.textContent=data.message||'Review the subjects and correct any errors.';
  }catch(err){text.textContent='Could not read photo: '+err.message;}
}
$('timetable-file').addEventListener('change',async(e)=>{
  await importTimetable(e.target.files?.[0]);e.target.value='';
});
$('timetable-capture').addEventListener('click',()=>{
  const img=$('camera-feed');
  if(!visionActive || !img.complete || !img.naturalWidth){
    $('timetable-message').textContent='Start the YOLO camera first, or upload a saved photo instead.';return;
  }
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0);
  canvas.toBlob(blob=>{if(blob)importTimetable(new File([blob],'timetable.jpg',{type:'image/jpeg'}));},'image/jpeg',0.9);
});
drawTimetable();

(async()=>{
  try{const res=await fetch('/api/health');const h=await res.json();$('ai-status').textContent=h.claude_available?'● CLAUDE CONNECTED':'RULE-BASED MODE';}
  catch{$('ai-status').textContent='OFFLINE';}
  try{const saved=localStorage.getItem('packer_plan_v1');if(saved){plan=JSON.parse(saved);if(Array.isArray(plan.items)&&Array.isArray(plan.timeline))render();}}
  catch{}
  await pollVision();
  frameTimer=setInterval(pollVision,850);
})();
