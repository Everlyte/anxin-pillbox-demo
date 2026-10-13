import {transition,validItems} from './logic.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=()=>new Date().toLocaleDateString('sv-SE');
const sample='示例药品 A，08:00，每次 1 片\n示例药品 B，08:00，每次 1 粒\n示例药品 C，20:00，每次 1 片';
const key='anxin-demo-v1';
const initial=()=>({plan:[{name:'示例药品 A',dose:'1 片',time:'08:00',slot:1},{name:'示例药品 B',dose:'1 粒',time:'08:00',slot:2},{name:'示例药品 C',dose:'1 片',time:'20:00',slot:3}],start:localDate(),end:'',day:localDate(),states:{},events:[],active:'08:00'});
let state;try{state=JSON.parse(localStorage.getItem(key))||initial();}catch{state=initial();}
let timer=null,deadline=0,reminders=0,audio=null,reviewItems=[],sourceVersion='';
const labels={pending:'待开启',opened:'已开盒 · 未确认',confirmed:'本人确认已服用',uncertain:'不确定 · 待核实',snoozed:'稍后提醒'};
function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{$('#message').innerHTML='<div class="notice warning">浏览器未能保存数据，关闭页面可能丢失记录。</div>';}}
function stopTimer(){clearInterval(timer);timer=null;deadline=0;window.speechSynthesis?.cancel();$('#countdown').textContent='当前没有进行中的提醒';}
function rollover(){if(state.day!==localDate()){stopTimer();state.day=localDate();state.states={};state.active=state.plan[0]?.time;persist();}}
function tasks(){if(state.start>localDate()||(state.end&&state.end<localDate()))return [];return [...new Set(state.plan.map(x=>x.time))].sort();}
function current(){return state.states[state.active]||{status:'pending'};}
function meds(){return state.plan.filter(x=>x.time===state.active);}
function addEvent(title,detail){state.events.unshift({at:new Date().toISOString(),title,detail,task:state.active});state.events=state.events.slice(0,300);persist();}
function switchTab(id){document.querySelectorAll('.tab').forEach(el=>el.hidden=el.id!==id);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(id==='history')renderHistory();}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function render(){
 rollover();const times=tasks();if(times.length&&!times.includes(state.active))state.active=times[0];
 const c=current(), list=meds();$('#date').innerHTML=esc(new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}))+'<br>愿每一天，从容有序';
 $('#status').textContent=times.length?labels[c.status]:'暂无任务';$('#status').className='status'+(['opened','uncertain','snoozed'].includes(c.status)?' warn':'');
 $('#task-content').innerHTML=times.length?`<div class="time">${esc(state.active)}<small>既定用药时间 · ${list.length} 种药品</small></div>${list.map(x=>`<div class="med-row"><span class="pill-icon">◒</span><div><div class="med-name">${esc(x.name)}</div><div class="med-sub">${x.slot} 号药格 · 按已确认的安排</div></div><div class="med-dose">${esc(x.dose)}</div></div>`).join('')}`:'<div class="empty">今天没有生效的用药任务。<br>请在计划设置中核对生效日期。</div>';
 let message='请核对当前药品。服用之后，再按“已服用”。';
 if(c.status==='opened')message='药盒已打开，本次尚未确认。服用后请按确认键。';
 if(c.status==='confirmed')message=`您于 ${new Date(c.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 确认已服用。本条为本人确认记录。`;
 if(c.status==='uncertain')message='本次状态待核实。请先核实实际服用情况，必要时联系家属或医药专业人员。系统不会建议您再服用一次。';
 if(c.status==='snoozed')message='已暂停本次提示，稍后再提醒。原有用药安排未改变。';
 $('#message').innerHTML=times.length?`<div class="notice ${['opened','uncertain'].includes(c.status)?'warning':''}">${message}</div>`:'';
 $('#actions').innerHTML=times.length?`<div class="actions">${['opened','snoozed'].includes(c.status)?'<button class="solid" id="confirm">✓ 我已服用</button><button class="outline" id="snooze">稍后提醒</button><button class="outline" id="uncertain">不确定是否已服用</button>':''}${c.status==='pending'?'<button class="solid" id="start-task">打开药盒，开始核对</button>':''}${c.status==='uncertain'?'<button class="outline" id="resolve">已核实：本人确认已服用</button>':''}${c.status==='confirmed'?'<button class="outline" id="see-record">查看本次记录 →</button>':''}</div>`:'';
 $('#slots').innerHTML=[1,2,3,4].map(n=>{const names=[...new Set(state.plan.filter(x=>Number(x.slot)===n).map(x=>x.name))];return `<div class="slot ${times.length&&list.some(x=>Number(x.slot)===n)&&!['confirmed','uncertain'].includes(c.status)?'lit':''}"><b>0${n}</b>${esc(names.join(' / ')||'空药格')}</div>`;}).join('');
 $('#device-label').textContent=times.length?(c.status==='pending'?'等待开启药盒':labels[c.status]):'暂无生效任务';$('#open-box').disabled=!times.length;
 $('#schedule').innerHTML=times.length?times.map(t=>`<div class="schedule-row"><strong>${t}</strong><span>${state.plan.filter(x=>x.time===t).map(x=>esc(x.name)).join('、')}</span><span>${labels[state.states[t]?.status||'pending']}</span><button class="outline" data-time="${t}">${t===state.active?'当前查看':'查看任务'}</button></div>`).join(''):'<p>当前计划不在生效日期内。</p>';
 document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{if(timer){$('#message').innerHTML='<div class="notice warning">请先处理当前未确认任务，再切换查看。</div>';return;}state.active=b.dataset.time;persist();render();});
 $('#confirm')?.addEventListener('click',()=>act('confirm'));$('#resolve')?.addEventListener('click',()=>act('confirm'));$('#snooze')?.addEventListener('click',()=>act('snooze'));$('#uncertain')?.addEventListener('click',()=>act('uncertain'));$('#start-task')?.addEventListener('click',openBox);$('#see-record')?.addEventListener('click',()=>switchTab('history'));
 renderHistory();
}
function enableAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}}
function speak(text){if(!$('#sound').checked)return;enableAudio();try{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(0,audio.currentTime);gain.gain.linearRampToValueAtTime(.1,audio.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.5);oscillator.start();oscillator.stop(audio.currentTime+.5);}catch{}if('speechSynthesis' in window){speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(text);utter.lang='zh-CN';utter.rate=.85;speechSynthesis.speak(utter);}}
function startTimer(seconds,reset=true){clearInterval(timer);if(reset)reminders=0;deadline=Date.now()+seconds*1000;const tick=()=>{if(state.day!==localDate()){rollover();render();return;}const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('#countdown').textContent=`${left} 秒后提醒 · 最多 2 次`;if(left>0)return;reminders++;const phrase='本次还没有确认记录。如果您已经服药，请按确认键。';speak(phrase);addEvent('未确认提醒',`第 ${reminders} 次提醒；${$('#sound').checked?'已请求播放声音':'声音未开启，仅显示文字'}`);$('#message').innerHTML=`<div class="notice warning">${phrase}<br><small>第 ${reminders} 次提醒 · ${$('#sound').checked?'提示音已启用':'当前静音'}</small></div>`;if(reminders>=2){clearInterval(timer);timer=null;deadline=0;$('#countdown').textContent='本轮提醒已结束 · 仍保留未确认状态';}else deadline=Date.now()+Number($('#delay').value)*1000;renderHistory();};timer=setInterval(tick,250);tick();}
function openBox(){rollover();if(!tasks().length)return;enableAudio();const c=current();addEvent('检测到开盒','模拟传感器事件，不能证明已服用');if(['confirmed','uncertain'].includes(c.status)){render();return;}state.states[state.active]={status:transition(c.status,'open')};persist();render();if(!timer)startTimer(Number($('#delay').value));}
function act(event){const c=current(),next=transition(c.status,event);if(next===c.status)return;stopTimer();state.states[state.active]={status:next,at:new Date().toISOString()};addEvent(labels[next],event==='confirm'?'用户自行确认；设备没有验证真实服药':event==='uncertain'?'暂停服药催促，保留待核实状态':'稍后再次提示，不改变用药计划');render();if(event==='snooze')startTimer(Number($('#delay').value));if(event==='confirm')speak('已记录');}
$('#open-box').onclick=openBox;$('#sound').onchange=()=>{if($('#sound').checked){enableAudio();speak('提示音已开启');}else speechSynthesis?.cancel();};$('#try-sound').onclick=()=>{$('#sound').checked=true;speak('本次还没有确认记录。如果您已经服药，请按确认键。');};
$('#due').onclick=()=>{if(!tasks().length)return;const c=current();if(['confirmed','uncertain'].includes(c.status)){$('#countdown').textContent='本轮已确认或待核实，不再催促服药';return;}addEvent('到点提醒','演示控制触发；按已确认计划显示本轮任务');render();speak('到了既定用药时间，请核对当前任务。');$('#countdown').textContent='已模拟到点提醒，请打开药盒核对';};
$('#restart').onclick=()=>{stopTimer();delete state.states[state.active];addEvent('重新演示','已重置当前轮次状态，既有历史记录保留');render();};
function renderHistory(){$('#history-list').innerHTML=state.events.length?state.events.map(e=>`<div class="history-item"><time>${esc(new Date(e.at).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}))}<br>${esc(new Date(e.at).toLocaleTimeString('zh-CN'))}</time><div><strong>${esc(e.title)}</strong><p>${esc(e.task||'')} · ${esc(e.detail)}</p></div></div>`).join(''):'<div class="empty">还没有记录。打开药盒，开始第一次演示。</div>';}
$('#sample').onclick=()=>{$('#source').value=sample;invalidate();};$('#incomplete').onclick=()=>{$('#source').value='示例药品 A，每日两次，每次 1 片';invalidate();};
function invalidate(){$('#reviewed').checked=false;$('#save-plan').disabled=true;$('#extract-message').textContent='原文已更改，请重新提取后核对。';reviewItems=[];$('#review').innerHTML='<div class="empty">请重新提取最新安排。</div>';}
$('#source').addEventListener('input',invalidate);
$('#extract').onclick=async()=>{
 const text=$('#source').value.trim();if(!text){$('#extract-message').textContent='请先输入已有安排。';return;}
 $('#extract').disabled=true;$('#save-plan').disabled=true;$('#reviewed').checked=false;reviewItems=[];$('#review').innerHTML='<div class="empty">正在提取…</div>';$('#extract-message').textContent='正在整理已有安排…';
 try{const response=await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const data=await response.json();if(!response.ok)throw Error(data.error||'提取失败');if($('#source').value.trim()!==text)throw Error('原文已变化，请重新提取');sourceVersion=text;const names=[...new Set(data.items.map(x=>x.name))];reviewItems=data.items.map(x=>({...x,slot:names.indexOf(x.name)+1}));
 $('#extract-message').textContent=(data.mode==='model'?`已通过 ${data.provider||'AI'} 真实模型提取`:'本地规则演示，未调用 AI 模型')+' · 请对照原文核对所有字段。';
 $('#review').innerHTML=`${reviewItems.some(x=>!x.time||!x.dose)?'<div class="notice warning">发现缺失信息。请根据已确定的安排补全，系统不会推断。</div>':''}${reviewItems.map((x,i)=>`<div class="review-row"><label>药品名称<input required data-index="${i}" data-field="name" value="${esc(x.name)}"></label><label>每次用量<input required data-index="${i}" data-field="dose" value="${esc(x.dose)}" placeholder="请核对并补充"></label><label>明确的用药时间<input required type="time" data-index="${i}" data-field="time" value="${esc(x.time)}"></label><label>对应药格<select data-index="${i}" data-field="slot"><option value="">请选择</option>${[1,2,3,4].map(n=>`<option value="${n}" ${n===x.slot?'selected':''}>${n} 号药格</option>`).join('')}</select></label></div>`).join('')}`;
 document.querySelectorAll('[data-index]').forEach(el=>el.oninput=()=>{reviewItems[el.dataset.index][el.dataset.field]=el.value;$('#reviewed').checked=false;validateReview();});validateReview();
 }catch(e){$('#extract-message').textContent=e.message;$('#review').innerHTML='<div class="empty">未生成可核对的结果，请重试。</div>';}finally{$('#extract').disabled=false;}
};
function validateReview(){const start=$('#start-date').value,end=$('#end-date').value;const valid=validItems(reviewItems)&&start&&(!end||end>=start);$('#save-plan').disabled=!(valid&&$('#reviewed').checked);$('#save-message').textContent=end&&end<start?'结束日期不能早于开始日期。':'';}
$('#reviewed').onchange=validateReview;['start-date','end-date'].forEach(id=>$('#'+id).onchange=()=>{$('#reviewed').checked=false;validateReview();});$('#start-date').value=state.start;$('#end-date').value=state.end;
$('#save-plan').onclick=()=>{
 if(!validItems(reviewItems)||!$('#reviewed').checked||sourceVersion!==$('#source').value.trim())return;
 const slotMap=new Map();for(const x of reviewItems){const n=Number(x.slot);if(slotMap.has(n)&&slotMap.get(n)!==x.name.trim()){$('#save-message').textContent='不同药品不能绑定同一个药格，请调整后重新核对。';return;}slotMap.set(n,x.name.trim());}
 const seen=new Set();for(const x of reviewItems){const k=x.name.trim()+'|'+x.time;if(seen.has(k)){$('#save-message').textContent='同一药品在同一时间出现重复条目，请修改原文后重新提取。';return;}seen.add(k);}
 stopTimer();state.plan=reviewItems.map(x=>({...x,name:x.name.trim(),dose:x.dose.trim(),slot:Number(x.slot)}));state.start=$('#start-date').value;state.end=$('#end-date').value;state.states={};state.active=state.plan[0].time;addEvent('计划已核对并保存',`${state.plan.length} 条安排；${state.start} 起生效${state.end?'，至 '+state.end:''}`);render();switchTab('today');
};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({notice:'演示记录；开盒不证明服药，确认由用户自行作出',...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`安心药盒记录-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();setInterval(()=>{if(state.day!==localDate())render();},10000);
if(['opened','snoozed'].includes(current().status))$('#countdown').textContent='页面重新打开，旧计时已停止；可再次开盒恢复演示';

fetch('/api/config').then(r=>r.json()).then(c=>{$('#provider-note').textContent=c.mode==='model'?`提取由 ${c.provider} 提供，点击提取将发送输入文本至该服务。请使用虚构示例。`:'当前为本地规则演示，未调用 AI。';}).catch(()=>{$('#provider-note').textContent='无法检测提取服务，请检查连接。';});
