export function extractLocal(text){
 return text.split(/[\n；;]/).map(x=>x.trim()).filter(Boolean).map(line=>{
  const time=line.match(/(?:^|[\s，,])((?:[01]?\d|2[0-3]):[0-5]\d)(?=\s|$|[，,])/);
  const dose=line.match(/每次\s*([^，,；;\n]+)/);
  const name=line.split(/[，,]/)[0].replace(/\s+(?:[01]?\d|2[0-3]):[0-5]\d.*$/,'').trim();
  return {name,dose:dose?dose[1].trim():'',time:time?time[1].padStart(5,'0'):''};
 });
}
export function transition(status,event){
 const map={pending:{open:'opened'},opened:{confirm:'confirmed',uncertain:'uncertain',snooze:'snoozed'},snoozed:{open:'opened',confirm:'confirmed',uncertain:'uncertain'},uncertain:{confirm:'confirmed'}};
 return map[status]?.[event]||status;
}
export function validItems(items){return items.length>0&&items.every(x=>x.name.trim()&&x.dose.trim()&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)&&Number(x.slot)>=1&&Number(x.slot)<=4);}
