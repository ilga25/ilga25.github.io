(function(root){'use strict';
const ALLERGENS=['gluten','crustaceans','egg','fish','peanut','soy','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs'];
const defaults={goal:'balance',diet:'all',days:3,people:1,meals:4,time:30,equipment:'pan',budget:'normal',variety:'varied',allergies:[],avoid:[],pantry:[],mode:'none',eligible:false,age:30,weight:70,height:170,coefficient:'female',activity:1.55,ownEnergy:2200};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function normalize(input,foods){let p={...defaults,...input};
 for(const[key,allowed]of Object.entries({goal:['balance','lose','gain','protein','recomp'],diet:['all','vegetarian','vegan','pescatarian'],equipment:['none','pan'],budget:['normal','low'],variety:['varied','practical'],mode:['none','estimate','own'],coefficient:['female','male']}))if(!allowed.includes(p[key]))throw Error('Revisa la opción '+key+'.');
 for(const[key,min,max,integer]of[['days',1,7,true],['people',1,6,true],['meals',3,4,true],['time',5,45,true]]){p[key]=Number(p[key]);if(!Number.isFinite(p[key])||p[key]<min||p[key]>max||integer&&!Number.isInteger(p[key]))throw Error('Revisa días, personas, comidas o tiempo disponible.');}
 for(const key of ['allergies','avoid','pantry']){if(!Array.isArray(p[key]))throw Error('Preferencias no válidas.');p[key]=[...new Set(p[key])];if(p[key].some(v=>typeof v!=='string'||(key==='allergies'?!ALLERGENS.includes(v):!foods[v])))throw Error('Hay un alimento o alérgeno desconocido.');}
 if(p.mode!=='none'&&p.eligible!==true)throw Error('Los objetivos numéricos son solo para adultos sin una situación que necesite una pauta clínica. Puedes continuar sin contar calorías.');
 return p;
}
function targets(p){let notes=[],energy=null,maintenance=null,protein=null;
 if(p.mode==='own'){energy=Number(p.ownEnergy);if(!Number.isFinite(energy)||energy<1600||energy>4000)throw Error('Este generador admite objetivos entre 1600 y 4000 kcal. No es un umbral universal de seguridad; si tu pauta queda fuera, utiliza las recetas sin objetivo numérico.');notes.push('Objetivo energético introducido por ti; no se le aplica otro déficit ni superávit.');}
 if(p.mode==='estimate'){
  for(const[key,min,max]of[['age',18,80],['weight',40,200],['height',140,210]])if(!Number.isFinite(Number(p[key]))||p[key]<min||p[key]>max)throw Error('Estimación disponible entre 18–80 años, 40–200 kg y 140–210 cm. Fuera de ese intervalo, usa el modo sin objetivo numérico.');
  if(![1.35,1.55,1.75].includes(Number(p.activity)))throw Error('Selecciona un nivel de actividad válido.');
  let bmi=p.weight/(p.height/100)**2;if(bmi<18.5){notes.push('La combinación de peso y altura queda fuera del uso previsto de esta estimación. No se calcula un objetivo de cambio de peso: puedes explorar recetas y revisar tus necesidades con un profesional.');return{energy:null,maintenance:null,protein:null,notes,scope:'recipes'};}
  let resting=10*p.weight+6.25*p.height-5*p.age+(p.coefficient==='male'?5:-161);maintenance=resting*p.activity;energy=maintenance*(p.goal==='lose'?.9:p.goal==='gain'?1.1:1);
  if(energy<1600||energy>4000){notes.push('La estimación queda fuera del intervalo que admite este generador (1600–4000 kcal). Se muestran raciones de receta sin objetivo diario. Ese intervalo es una limitación de la herramienta, no una prescripción.');energy=null;}
  else energy=Math.round(energy/50)*50;
  if(['protein','recomp','gain'].includes(p.goal))protein=Number(p.weight)*1.6;
  notes.push('Mifflin–St Jeor estima gasto en reposo; el factor de actividad es una aproximación. Para perder grasa se aplica −10 %; para ganar peso +10 %; recomposición y mantenimiento conservan la estimación de mantenimiento. No predice cambios de peso.');
 }
 if(energy&&!protein&&['protein','gain','recomp'].includes(p.goal))protein=energy*.2/4;
 return{energy,maintenance,protein,notes,scope:energy?'estimated':'recipes'};
}
function nutrition(recipe,foods,scale=1){let n={kcal:0,protein:0,carbs:0,fat:0,fiber:0,cost:0};for(const item of recipe.ingredients){let food=foods[item.id];if(!food)throw Error('Ingrediente desconocido.');for(const key of ['kcal','protein','carbs','fat','fiber'])n[key]+=food[key]*item.grams*scale/100;n.cost+=food.price*item.grams*scale/1000;}return n;}
function allowed(recipe,p){return recipe.time<=p.time&&(p.equipment!=='none'||recipe.equipment==='none')&&(p.diet==='all'||p.diet==='vegan'&&recipe.vegan||p.diet==='vegetarian'&&recipe.vegetarian||p.diet==='pescatarian'&&recipe.pescatarian)&&!recipe.allergens.some(a=>p.allergies.includes(a))&&!recipe.ingredients.some(x=>p.avoid.includes(x.id));}
function addNutrition(a,b){for(const key of Object.keys(a))a[key]+=b[key]||0;return a;}
function totals(entries,recipes,foods){const byId=Object.fromEntries(recipes.map(r=>[r.id,r]));return entries.reduce((n,e)=>{if(!byId[e.recipe])throw Error('Receta desconocida.');return addNutrition(n,nutrition(byId[e.recipe],foods,e.scale));},{kcal:0,protein:0,carbs:0,fat:0,fiber:0,cost:0});}
function generate(input,recipes,foods,seed=1,previous=[]){const p=normalize(input,foods),target=targets(p),random=rng(seed),used={},slots=p.meals===4?['breakfast','lunch','dinner','snack']:['breakfast','lunch','dinner'],shares=p.meals===4?[.25,.35,.30,.10]:[.28,.38,.34];let days=[];
 const pools=Object.fromEntries(['breakfast','main','snack'].map(slot=>[slot,recipes.filter(r=>r.slot===slot&&allowed(r,p))]));
 for(const slot of ['breakfast','main',...(p.meals===4?['snack']:[])])if(!pools[slot].length)throw Error('No hay '+({breakfast:'desayunos',main:'comidas principales',snack:'tentempiés'})[slot]+' que cumplan todos tus filtros. Amplía el tiempo o revisa tus gustos. No se ignorará ninguna exclusión.');
 for(let d=0;d<p.days;d++){
  let best=null,bestScore=Infinity;
  for(let trial=0;trial<180;trial++){
   let entries=[],score=0;
   for(let s=0;s<slots.length;s++){
    let slot=slots[s],locked=previous[d]?.entries?.find(e=>e.slot===slot&&e.locked),pool=pools[slot==='lunch'||slot==='dinner'?'main':slot];
    if(locked){let recipe=recipes.find(r=>r.id===locked.recipe);if(recipe&&allowed(recipe,p)){entries.push({...locked});continue;}}
    let recipe=pool[Math.floor(random()*pool.length)],scale=target.energy?clamp(Math.round(target.energy*shares[s]/recipe.nutrition.kcal*8)/8,.625,1.75):1;
    entries.push({slot,recipe:recipe.id,scale,locked:false});
   }
   const sum=totals(entries,recipes,foods);
   if(target.energy)score+=Math.abs(sum.kcal-target.energy)/target.energy*35;
   if(target.protein)score+=Math.max(0,target.protein-sum.protein)/target.protein*7;
   // Practical variety matters as well as a numerical macro match. These are editorial
   // ranking preferences, not nutritional upper limits or a guarantee of adequacy.
   let pulseMeals=0,families={};
   for(const e of entries){let r=recipes.find(r=>r.id===e.recipe),pulse=r.ingredients.filter(x=>['chickpeas','lentils','beans'].includes(x.id)).reduce((s,x)=>s+x.grams*e.scale,0);if(pulse>=100)pulseMeals++;let family=r.ingredients.find(x=>['chicken','salmon','tuna','egg','tofu','yogurt','chickpeas','lentils','beans'].includes(x.id))?.id||'cereal';families[family]=(families[family]||0)+1;let mass=r.ingredients.reduce((s,x)=>s+x.grams*e.scale,0);if(mass>900)score+=(mass-900)/100;}
   score+=Math.max(0,pulseMeals-2)*4;
   score+=Object.values(families).reduce((s,n)=>s+Math.max(0,n-2)*2,0);
   score+=Math.max(0,sum.fiber-50)/10*3;
   if(['protein','recomp'].includes(p.goal))score-=sum.protein/Math.max(1,sum.kcal)*30;
   if(p.goal==='lose'&&!target.energy)score-=sum.fiber/50;
   if(p.budget==='low')score+=sum.cost*.7;
   for(const e of entries){let r=recipes.find(r=>r.id===e.recipe),matches=r.ingredients.filter(x=>p.pantry.includes(x.id)).length;score-=matches*.13;score+=(used[e.recipe]||0)*(p.variety==='varied'?.6:.08);}
   if(entries[1].recipe===entries[2].recipe&&pools.main.length>1)score+=8;
   score+=random()*.2;
   if(score<bestScore){best=entries;bestScore=score;}
  }
  for(const e of best)used[e.recipe]=(used[e.recipe]||0)+1;
  let total=totals(best,recipes,foods);days.push({entries:best,total});
 }
 return{version:1,profile:p,target,days,seed};
}
function shopping(plan,recipes,foods,stock={},prices={}){let entries={},byId=Object.fromEntries(recipes.map(r=>[r.id,r]));for(const day of plan.days)for(const meal of day.entries)for(const item of byId[meal.recipe].ingredients)entries[item.id]=(entries[item.id]||0)+item.grams*meal.scale*plan.profile.people;
 return Object.entries(entries).map(([id,grams])=>{let owned=Number(stock[id]||0),price=Number(prices[id]??foods[id].price);if(!Number.isFinite(owned)||owned<0||owned>100000||!Number.isFinite(price)||price<0||price>1000)throw Error('Revisa cantidades de despensa y precios.');let buy=Math.max(0,grams-owned);return{id,grams,owned,buy,price,cost:buy/1000*price};}).sort((a,b)=>foods[a.id].group.localeCompare(foods[b.id].group,'es')||foods[a.id].name.localeCompare(foods[b.id].name,'es'));
}
function alternatives(plan,day,slot,recipes,foods){let current=plan.days[day].entries.find(e=>e.slot===slot),recipe=recipes.find(r=>r.id===current.recipe),energy=nutrition(recipe,foods,current.scale).kcal;
 return recipes.filter(r=>r.slot===recipe.slot&&r.id!==recipe.id&&allowed(r,plan.profile)).map(r=>{let scale=clamp(Math.round(energy/r.nutrition.kcal*8)/8,.625,1.75);return{recipe:r.id,scale,nutrition:nutrition(r,foods,scale)};}).sort((a,b)=>Math.abs(a.nutrition.kcal-energy)-Math.abs(b.nutrition.kcal-energy));
}
function validateImport(data,recipes,foods){if(!data||data.version!==1||!Array.isArray(data.days))throw Error('Archivo de Mesa Clara no válido.');let profile=normalize(data.profile,foods);if(data.days.length!==profile.days)throw Error('El número de días no coincide.');for(const day of data.days){if(!Array.isArray(day.entries)||day.entries.length!==profile.meals)throw Error('Día incompleto.');let expected=profile.meals===4?['breakfast','lunch','dinner','snack']:['breakfast','lunch','dinner'];for(const slot of expected){let es=day.entries.filter(e=>e.slot===slot);if(es.length!==1)throw Error('Comida duplicada o ausente.');let e=es[0],r=recipes.find(r=>r.id===e.recipe);if(!r||!allowed(r,profile)||!Number.isFinite(e.scale)||e.scale<.5||e.scale>2)throw Error('Una receta o ración no cumple las preferencias del archivo.');}}
 return{version:1,profile,target:targets(profile),seed:1,days:data.days.map(day=>({entries:day.entries.map(e=>({slot:e.slot,recipe:e.recipe,scale:e.scale,locked:Boolean(e.locked)})),total:totals(day.entries,recipes,foods)}))};
}
root.MesaEngine={defaults,ALLERGENS,normalize,targets,nutrition,allowed,totals,generate,shopping,alternatives,validateImport};if(typeof module!=='undefined')module.exports=root.MesaEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
