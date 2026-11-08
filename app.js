'use strict';
const KEY='reefLog.v1',SET='reefLog.settings.v1';
const P=[['ph','pH',0,14,''],['ammonia','Ammonia',0,1000,'ppm'],['nitrite','Nitrite',0,1000,'ppm'],['nitrate','Nitrate',0,1000,'ppm'],['calcium','Calcium',0,5000,'ppm'],['magnesium','Magnesium',0,10000,'ppm'],['alkalinity','Alkalinity',0,100,'ALK'],['phosphate','Phosphate',0,1000,'ppm']];
const $=s=>document.querySelector(s);
const load=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch{return[]}};
const store=a=>localStorage.setItem(KEY,JSON.stringify(a));
const settings=()=>{try{return JSON.parse(localStorage.getItem(SET))||{}}catch{return{}}};
const alkUnit=()=>settings().alkUnit||null;
const pad=n=>String(n).padStart(2,'0');
function nowParts(){const d=new Date();return{date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`}}
function offsetFor(date,time){const d=new Date(`${date}T${time||'12:00'}`);const m=-d.getTimezoneOffset();return (m>=0?'+':'-')+pad(Math.floor(Math.abs(m)/60))+':'+pad(Math.abs(m)%60)}
function unitOf(k,e){return k==='alkalinity'?(e?.units?.alkalinity||alkUnit()||'unit not set'):(k==='ph'?'':'ppm')}
function fmtDate(e){const[y,m,d]=e.date.split('-').map(Number);const s=new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
 if(!e.time)return s+' · time not recorded';const[h,mi]=e.time.split(':').map(Number);return s+' · '+new Date(2000,0,1,h,mi).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}
const sortKey=e=>e.date+'T'+(e.time||'00:00');
// pure validation, exported for tests
function validateEntry(e){const errs=[];if(!e||typeof e!=='object')return['not an object'];
 if(typeof e.id!=='string'||!e.id)errs.push('id');if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''))errs.push('date');
 if(e.time&&!/^\d{2}:\d{2}$/.test(e.time))errs.push('time');if(!e.values||typeof e.values!=='object')errs.push('values');
 else for(const[k,v]of Object.entries(e.values)){const p=P.find(x=>x[0]===k);if(!p||typeof v!=='number'||!isFinite(v)||v<p[2]||v>p[3])errs.push(k)}
 return errs}
function parseVal(s,p){s=String(s).trim().replace(',','.');if(s==='')return{blank:true};if(!/^\d*\.?\d+$|^\d+\.$/.test(s))return{err:'number only'};const v=parseFloat(s);
 if(v<p[2]||v>p[3])return{err:p[0]==='ph'?'pH must be 0–14':'must be ≥ 0'};return{v}}
let editingId=null;
function buildFields(){$('#fields').innerHTML=P.map(p=>`<label>${p[1]} <small class="u" data-k="${p[0]}"></small><input id="f_${p[0]}" inputmode="decimal" enterkeyhint="next" autocomplete="off" placeholder="—"></label>`).join('');refreshUnits()}
function refreshUnits(e){document.querySelectorAll('small.u').forEach(s=>{const u=e?unitOf(s.dataset.k,e):unitOf(s.dataset.k);s.textContent=u?`(${u})`:'(0–14)'});
 $('#alkStatus').textContent=alkUnit()?`Alkalinity unit confirmed: ${alkUnit()}`:'⚠ Alkalinity unit not confirmed yet — pick one above before saving alkalinity.';
 document.querySelectorAll('input[name=alk]').forEach(r=>r.checked=r.value===alkUnit())}
function resetForm(){const n=nowParts();$('#date').value=n.date;$('#time').value=n.time;P.forEach(p=>{const i=$('#f_'+p[0]);i.value='';i.classList.remove('err')});$('#notes').value='';editingId=null;$('#editing').hidden=true;$('#saveBtn').textContent='Save entry';refreshUnits()}
function msg(t,ok){const m=$('#msg');m.textContent=t;m.className=ok?'ok':'bad'}
function save(ev){ev.preventDefault();const values={};let bad=[];
 P.forEach(p=>{const i=$('#f_'+p[0]);const r=parseVal(i.value,p);i.classList.toggle('err',!!r.err);if(r.err)bad.push(`${p[1]}: ${r.err}`);else if(!r.blank)values[p[0]]=r.v});
 const date=$('#date').value,time=$('#time').value;if(!date)bad.push('Date is required');
 if(!Object.keys(values).length)bad.push('Enter at least one reading');
 const all=load();const old=editingId&&all.find(e=>e.id===editingId);
 const alk=old?.units?.alkalinity||alkUnit();if('alkalinity'in values&&!alk)bad.push('Confirm alkalinity unit in Settings first');
 if(bad.length)return msg('Not saved — '+bad.join('; '),false);
 const units={};if('alkalinity'in values)units.alkalinity=alk;
 const e={id:old?old.id:(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)),date,time:time||'',tzOffset:offsetFor(date,time),values,units,notes:$('#notes').value.trim(),createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 try{store(old?all.map(x=>x.id===e.id?e:x):[...all,e])}catch(err){return msg('Not saved — storage error: '+err.message,false)}
 const wasEdit=!!old;resetForm();msg(wasEdit?'✓ Changes saved':'✓ Entry saved',true);render()}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function render(){const a=load().sort((x,y)=>sortKey(y).localeCompare(sortKey(x)));
 $('#list').innerHTML=a.length?a.map(e=>`<li data-id="${esc(e.id)}"><h3>${esc(fmtDate(e))}</h3><dl>${P.map(p=>`<dt>${p[1]}</dt><dd>${p[0]in e.values?esc(e.values[p[0]])+' '+esc(unitOf(p[0],e)):'<span class=hint>not tested</span>'}</dd>`).join('')}</dl>${e.notes?`<p>${esc(e.notes)}</p>`:''}<div class="row"><button data-act="edit">Edit</button><button data-act="del" class="danger">Delete</button></div></li>`).join(''):'<p class="hint">No entries yet. Add your first test on the Add tab.</p>'}
function tab(t){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));['add','history','settings'].forEach(s=>$('#'+s).hidden=s!==t);if(t==='history')render()}
function startEdit(id){const e=load().find(x=>x.id===id);if(!e)return;tab('add');$('#date').value=e.date;$('#time').value=e.time||'';P.forEach(p=>$('#f_'+p[0]).value=p[0]in e.values?e.values[p[0]]:'');$('#notes').value=e.notes||'';editingId=id;$('#editing').hidden=false;$('#saveBtn').textContent='Save changes';refreshUnits(e);msg('',true)}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
function toCSV(a){const q=s=>`"${String(s??'').replace(/"/g,'""')}"`;const h=['date','time','tz_offset',...P.map(p=>p[0]==='alkalinity'?'alkalinity,alkalinity_unit':p[0]),'notes','id'];
 return [h.join(','),...a.map(e=>[e.date,e.time,e.tzOffset,...P.map(p=>p[0]==='alkalinity'?[e.values.alkalinity??'',e.units?.alkalinity??''].join(','):(e.values[p[0]]??'')),q(e.notes),e.id].join(','))].join('\n')}
const stamp=()=>nowParts().date;
let pending=null;
function parseBackup(text){let d;try{d=JSON.parse(text)}catch{return{error:'Not valid JSON'}}const entries=Array.isArray(d)?d:d?.entries;
 if(d?.app&&d.app!=='reef-log')return{error:'Not a Reef Log backup'};if(!Array.isArray(entries))return{error:'No entries list found'};
 const good=[],bad=[];entries.forEach((e,i)=>{const er=validateEntry(e);er.length?bad.push(`#${i+1}: ${er.join(', ')}`):good.push(e)});return{good,bad}}
function mergeEntries(cur,inc){const ids=new Set(cur.map(e=>e.id));const add=inc.filter(e=>!ids.has(e.id));return{merged:[...cur,...add],added:add.length,skipped:inc.length-add.length}}
function init(){buildFields();resetForm();render();
 $('#form').addEventListener('submit',save);$('#cancelEdit').onclick=()=>{resetForm();msg('Edit cancelled',true)};
 document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
 document.querySelectorAll('input[name=alk]').forEach(r=>r.onchange=()=>{if(confirm(`Use ${r.value} for alkalinity on new entries? Saved entries keep their unit.`)){localStorage.setItem(SET,JSON.stringify({...settings(),alkUnit:r.value}))}refreshUnits()});
 $('#list').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const id=b.closest('li').dataset.id;
  if(b.dataset.act==='edit')startEdit(id);if(b.dataset.act==='del'&&confirm('Delete this entry? This cannot be undone.')){store(load().filter(e=>e.id!==id));render()}};
 $('#csv').onclick=()=>download(`reef-log-${stamp()}.csv`,toCSV(load()),'text/csv');
 $('#json').onclick=()=>download(`reef-log-backup-${stamp()}.json`,JSON.stringify({app:'reef-log',version:1,exportedAt:new Date().toISOString(),settings:settings(),entries:load()},null,1),'application/json');
 $('#importFile').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;const r=parseBackup(await f.text());const pv=$('#preview');
  if(r.error){pv.innerHTML=`<p class="bad" id="msgImp">${esc(r.error)}. Nothing imported.</p>`;return}
  const m=mergeEntries(load(),r.good);pending=r.good;
  pv.innerHTML=`<p>${r.good.length} valid entries: <b>${m.added} new</b>, ${m.skipped} already here (kept as is).${r.bad.length?` ${r.bad.length} invalid skipped (${esc(r.bad.slice(0,3).join('; '))}).`:''}</p><div class="row"><button id="doImp" class="primary">Import ${m.added}</button><button id="noImp">Cancel</button></div>`;
  $('#doImp').onclick=()=>{const mm=mergeEntries(load(),pending);store(mm.merged);pv.innerHTML=`<p class="ok">✓ Imported ${mm.added} entries.</p>`;ev.target.value='';render()};
  $('#noImp').onclick=()=>{pv.innerHTML='';ev.target.value=''}};
 if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
if(typeof module!=='undefined')module.exports={validateEntry,parseVal,parseBackup,mergeEntries,toCSV,P};
