import React, {useMemo, useState, useEffect} from 'react';
import { createRoot } from 'react-dom/client';
import { Scissors, Clock, MapPin, ShieldCheck, Menu, UserRound, Tv, ListChecks, LogOut, ChevronRight, Search, Trash2, Play, CheckCircle, BellRing, XCircle, MoveRight, QrCode, Home } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './styles.css';
import { createClient } from '@supabase/supabase-js';const BARBERS = [
  {id:'alves', name:'Alves', role:'admin'},
  {id:'president', name:'Président', role:'barber'},
  {id:'adesoulbarber', name:'Adesoulbarber', role:'admin'},
];

const SERVICES = [
  ['Femme','Coupe femme',27,30],
  ['Homme','Soin de barbe',10,15],['Homme','Coupe enfant',20,30],['Homme','Coupe simple',25,30],['Homme','Coupe mi-longue',30,30],['Homme','Coupe cheveux longs',35,45],['Homme','Coupe et barbe',30,45],
  ['Bac','Shampoing',5,15],['Bac','Soin de cheveux',10,15],
  ['Coiffage','Braids - courtes',50,30],['Coiffage','Braids - longues',200,90],['Coiffage','Knotless braids - courtes',60,45],['Coiffage','Knotless braids - longues',210,90],['Coiffage','Locks crochet latching - courtes',50,60],['Coiffage','Locks crochet latching - longues',80,105],['Coiffage','Locks twist / vanilles - courtes',40,45],['Coiffage','Locks twist / vanilles - longues',80,90],['Coiffage','Nattes collées - courtes',30,30],['Coiffage','Nattes collées - longues',60,60],['Coiffage','Tresses sans rajouts cheveux courts',40,30],['Coiffage','Tresses sans rajouts cheveux longs',70,60],['Coiffage','Vanilles avec rajouts - courtes',50,30],['Coiffage','Vanilles avec rajouts - longues',150,60],['Coiffage','Vanilles sans rajouts - cheveux courts',40,30],['Coiffage','Vanilles sans rajouts - cheveux longs',70,60],
  ['Coloration','Coloration locks cheveux courts',20,30],['Coloration','Coloration locks cheveux longs',60,60],['Coloration','Coloration et coupe mi-longue',50,60],['Coloration','Coloration et coupe cheveux longs',95,90],['Coloration','Coloration et coupe femme cheveux courts',47,60],['Coloration','Coloration et coupe femme cheveux longs',87,90],['Coloration','Coloration et coupe simple cheveux courts',45,60],['Coloration','Coloration et coupe simple cheveux longs',85,90],
].map((s,i)=>({id:'s'+i, category:s[0], name:s[1], price:s[2], duration:s[3]}));

const ACCESS = { alves2026: {name:'Alves', role:'admin', barber:'alves'}, adesoul2026: {name:'Adesoulbarber', role:'admin', barber:'adesoulbarber'}, alves:{name:'Alves', role:'barber', barber:'alves'}, president:{name:'Président', role:'barber', barber:'president'}, adesoul:{name:'Adesoulbarber', role:'barber', barber:'adesoulbarber'} };
const STORE = 'alvesmcut_queue_v1';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function nowTime(){return new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
function getStore(){
  try {
    return JSON.parse(localStorage.getItem(STORE)) || [];
  } catch {
    return [];
  }
}

function setStoreLocal(items){
  localStorage.setItem(STORE, JSON.stringify(items));
  window.dispatchEvent(new Event('queue-change'));
}

function fromDb(row){
  const created = row.created_at ? new Date(row.created_at) : new Date();

  return {
    id: row.tracking_token || row.id,
    token: row.tracking_token || row.id,
    first: row.customer_first_name || '',
    last: row.customer_last_name || '',
    phone: row.phone || '',
    comment: row.comment || '',
    barberId: row.barber_id,
    requested: row.requested_barber_option || row.barber_id,
    serviceId: row.service_id,
    status: row.status || 'waiting',
    position: row.position || 1,
    estimatedWait: row.estimated_wait_minutes || 0,
    createdAt: created.getTime(),
    time: created.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null
  };
}

function toDb(item){
  const s = service(item.serviceId);
  const token = item.token || item.id || uid();

  return {
    customer_first_name: item.first || '',
    customer_last_name: item.last || '',
    phone: item.phone || '',
    comment: item.comment || '',
    barber_id: item.barberId,
    requested_barber_option: item.requested || item.barberId,
    service_id: item.serviceId,
    service_name: s?.name || '',
    service_price: s?.price || 0,
    service_duration: s?.duration || 30,
    status: item.status || 'waiting',
    position: item.position || 1,
    estimated_wait_minutes: item.estimatedWait || 0,
    tracking_token: token,
    created_at: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    started_at: item.startedAt ? new Date(item.startedAt).toISOString() : null,
    completed_at: item.completedAt ? new Date(item.completedAt).toISOString() : null
  };
}

async function fetchQueue(){
  if (!supabase) return getStore();

  const { data, error } = await supabase
    .from('queue_items')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('supabase fetch error', error);
    return getStore();
  }

  return positions((data || []).map(fromDb));
}

async function syncQueue(nextItems, previousItems = []){
  if (!supabase) {
    alert('supabase non connecté : vérifie les variables vercel');
    return;
  }

  const nextTokens = nextItems.map(i => i.token || i.id).filter(Boolean);
  const previousTokens = previousItems.map(i => i.token || i.id).filter(Boolean);
  const removedTokens = previousTokens.filter(t => !nextTokens.includes(t));

  if (removedTokens.length) {
    const { error: deleteError } = await supabase
      .from('queue_items')
      .delete()
      .in('tracking_token', removedTokens);

    if (deleteError) {
      alert('erreur suppression supabase : ' + deleteError.message);
      console.error(deleteError);
      return;
    }
  }

  if (nextItems.length) {
    const rows = nextItems.map(toDb);

    const { error: upsertError } = await supabase
      .from('queue_items')
      .upsert(rows, { onConflict: 'tracking_token' });

    if (upsertError) {
      alert('erreur ajout supabase : ' + upsertError.message);
      console.error(upsertError);
      return;
    }

   
  }
}
function useQueue(){
  const [items, setItems] = useState(getStore());

  async function refresh(){
    const fresh = await fetchQueue();
    setItems(fresh);
    setStoreLocal(fresh);
  }

  useEffect(() => {
    refresh();

    const localRefresh = () => setItems(getStore());
    window.addEventListener('storage', localRefresh);
    window.addEventListener('queue-change', localRefresh);

    const timer = setInterval(refresh, 2500);

    return () => {
      window.removeEventListener('storage', localRefresh);
      window.removeEventListener('queue-change', localRefresh);
      clearInterval(timer);
    };
  }, []);

  function updateQueue(next){
    const updated = positions(next);
    const previous = items;

    setItems(updated);
    setStoreLocal(updated);
    syncQueue(updated, previous);
  }

  return [items, updateQueue];
}function active(items){return items.filter(i=>!['completed','cancelled','absent'].includes(i.status))}
function service(id){return SERVICES.find(s=>s.id===id)}
function barber(id){return BARBERS.find(b=>b.id===id)}
function waitForBarber(items, barberId){return active(items).filter(i=>i.barberId===barberId).reduce((sum,i)=>sum+(service(i.serviceId)?.duration||30),0)}
function positions(items){
  const clone = [...items];
  BARBERS.forEach(b=>{
    let pos=1, wait=0;
    clone.filter(i=>i.barberId===b.id && !['completed','cancelled','absent'].includes(i.status)).sort((a,b)=>a.createdAt-b.createdAt).forEach(i=>{ i.position=pos++; i.estimatedWait=wait; wait += service(i.serviceId)?.duration||30; });
  });
  return clone;
}
function navigate(path){window.history.pushState({},'',path); window.dispatchEvent(new Event('popstate')); window.scrollTo(0,0)}
function usePath(){const [path,setPath]=useState(location.pathname); useEffect(()=>{const f=()=>setPath(location.pathname); window.addEventListener('popstate',f); return()=>window.removeEventListener('popstate',f)},[]); return path}
function Logo(){return <div className="logo" onClick={()=>navigate('/')}><div className="logoIcon"><Scissors size={22}/></div><div><b>alvesmcut</b><span>barber · colombes</span></div></div>}
function Header(){const [open,setOpen]=useState(false); const links=[['/','accueil'],['/check-in','rejoindre'],['/services','prestations'],['/ecran','écran salon'],['/dashboard','espace barber']]; return <><header><Logo/><button className="pill" onClick={()=>navigate('/check-in')}>rejoindre</button><button className="menu" onClick={()=>setOpen(!open)}><Menu/></button></header>{open&&<nav className="mobileNav">{links.map(([p,l])=><button key={p} onClick={()=>{setOpen(false);navigate(p)}}>{l}</button>)}</nav>}</>}
function Layout({children}){return <main><Header/>{children}</main>}
function HomePage(){return <Layout><section className="hero"><div className="badge">• file ouverte · 10h-20h</div><h1>ton barber.<br/><span>ta place.</span><br/>ton tour.</h1><p>rejoins la file walk-in, choisis ton barber et garde ta liberté. ta position évolue en direct sur ton téléphone.</p><div className="actions"><button className="primary" onClick={()=>navigate('/check-in')}>rejoindre la file <ChevronRight size={18}/></button><button className="secondary" onClick={()=>navigate('/services')}>voir les prestations</button><button className="linkBtn" onClick={()=>navigate('/dashboard')}>espace barber</button></div><div className="mini"><span><MapPin size={15}/> colombes</span><span><Clock size={15}/> tous les jours</span><span><ShieldCheck size={15}/> gratuit, sans sms</span></div></section><section className="card"><h3>comment ça marche</h3>{[['01','choisis ton barber','alves, président, adesoulbarber ou le premier disponible.'],['02','choisis ta prestation','le prix et la durée sont clairs avant de valider.'],['03','suis ta place','un lien privé et un qr code pour suivre ta position en direct.']].map(x=><div className="step" key={x[0]}><b>{x[0]}</b><div><strong>{x[1]}</strong><p>{x[2]}</p></div></div>)}<button className="yellowCard" onClick={()=>navigate('/check-in')}><span>à l’entrée</span>scanne ou utilise la tablette <QrCode size={28}/></button></section></Layout>}
function CheckIn(){const [items,setItems]=useQueue(); const [step,setStep]=useState(1); const [barberChoice,setBarberChoice]=useState(''); const [serviceId,setServiceId]=useState(''); const [form,setForm]=useState({first:'',last:'',phone:'',comment:''}); const cats=[...new Set(SERVICES.map(s=>s.category))]; const chosenService=service(serviceId); const available = chosenService ? chosenService.duration <= minutesUntilClose() : true; const assigned = useMemo(()=>{ if(!barberChoice||barberChoice==='first') {let b=[...BARBERS].sort((a,b)=>waitForBarber(items,a.id)-waitForBarber(items,b.id))[0]; return b?.id} return barberChoice},[barberChoice,items]); const position = assigned ? active(items).filter(i=>i.barberId===assigned).length+1 : 1; const wait = assigned ? waitForBarber(items,assigned) : 0;
 function submit(){if(!form.first||!form.phone||!serviceId||!assigned)return; const id=uid(); const next=positions([...items,{id, token:id, first:form.first,last:form.last, phone:form.phone, comment:form.comment, barberId:assigned, requested:barberChoice, serviceId, status:'waiting', createdAt:Date.now(), time:nowTime()}]); setItems(next); navigate('/suivi/'+id)}
 return <Layout><section className="pageTitle"><h1>rejoindre la file</h1><p>simple, rapide, sans sms. garde ton lien de suivi.</p></section><div className="progress"><span className={step>=1?'on':''}></span><span className={step>=2?'on':''}></span><span className={step>=3?'on':''}></span><span className={step>=4?'on':''}></span></div>{step===1&&<section className="card"><h2>choisis ton barber</h2><div className="grid">{BARBERS.map(b=><button className={'choice '+(barberChoice===b.id?'selected':'')} onClick={()=>setBarberChoice(b.id)} key={b.id}><UserRound/>{b.name}<small>{waitForBarber(items,b.id)} min d’attente</small></button>)}<button className={'choice '+(barberChoice==='first'?'selected':'')} onClick={()=>setBarberChoice('first')}><Search/>premier disponible<small>le plus rapide</small></button></div><button className="primary" disabled={!barberChoice} onClick={()=>setStep(2)}>continuer</button></section>}{step===2&&<section className="card"><h2>choisis ta prestation</h2>{cats.map(cat=><div key={cat} className="serviceCat"><h3>{cat}</h3>{SERVICES.filter(s=>s.category===cat).map(s=><button className={'service '+(serviceId===s.id?'selected':'')} key={s.id} onClick={()=>setServiceId(s.id)}><Scissors/><span>{s.name}</span><b>{s.price} €</b><small>{s.duration} min</small></button>)}</div>)}{chosenService&&!available&&<p className="alert">cette prestation dépasse l’heure de fermeture aujourd’hui.</p>}<div className="row"><button className="secondary" onClick={()=>setStep(1)}>retour</button><button className="primary" disabled={!serviceId||!available} onClick={()=>setStep(3)}>continuer</button></div></section>}{step===3&&<section className="card"><h2>tes informations</h2><input placeholder="prénom *" value={form.first} onChange={e=>setForm({...form,first:e.target.value})}/><input placeholder="nom" value={form.last} onChange={e=>setForm({...form,last:e.target.value})}/><input placeholder="téléphone *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><textarea placeholder="commentaire optionnel" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/><div className="row"><button className="secondary" onClick={()=>setStep(2)}>retour</button><button className="primary" disabled={!form.first||!form.phone} onClick={()=>setStep(4)}>continuer</button></div></section>}{step===4&&<section className="card confirm"><h2>confirmation</h2><p>barber : <b>{barber(assigned)?.name}</b></p><p>prestation : <b>{chosenService?.name}</b></p><p>position estimée : <b>n°{position}</b></p><p>attente estimée : <b>{wait} min</b></p><div className="row"><button className="secondary" onClick={()=>setStep(3)}>retour</button><button className="primary" onClick={submit}>confirmer mon inscription</button></div></section>}</Layout>}
function minutesUntilClose(){const d=new Date(); const close=new Date(); close.setHours(20,0,0,0); return Math.max(0,Math.floor((close-d)/60000));}
function Tracking(){const [items]=useQueue(); const id=location.pathname.split('/').pop(); const it=items.find(i=>i.id===id || i.token===id); if(!it)return <Layout><section className="card"><h2>chargement de ta position...</h2><p>si la page ne se met pas à jour, rafraîchis dans quelques secondes.</p></section></Layout> const s=service(it.serviceId); const people=Math.max((it.position||1)-1,0); const msg = it.status==='called'?'c’est ton tour, présente-toi à ton barber.': it.position===1?'c’est bientôt ton tour.': it.position===2?'ton tour approche, reste proche du salon.':'tu es bien inscrit. garde cette page ouverte.'; return <Layout><section className="tracking"><div className="bigStatus">{it.status==='called'?'à ton tour':'position n°'+it.position}</div><h1>{it.first}, {msg}</h1><div className="info"><p>barber <b>{barber(it.barberId)?.name}</b></p><p>prestation <b>{s?.name}</b></p><p>personnes avant toi <b>{people}</b></p><p>attente estimée <b>{it.estimatedWait||0} min</b></p></div><div className="qr"><QRCodeCanvas value={location.href} size={160}/><small>scanne pour garder ta place</small></div></section></Layout>}
function Login(){const [code,setCode]=useState(''); function submit(){const u=ACCESS[code.trim()]; if(u){localStorage.setItem('alves_user',JSON.stringify(u)); navigate('/dashboard')} } return <Layout><section className="card"><h1>connexion barber</h1><p>entre ton code d’accès.</p><input value={code} onChange={e=>setCode(e.target.value)} placeholder="code" type="password"/><button className="primary" onClick={submit}>se connecter</button></section></Layout>}
function getUser(){try{return JSON.parse(localStorage.getItem('alves_user'))}catch{return null}}
function Dashboard({admin=false}){const [items,setItems]=useQueue(); const user=getUser(); if(!user)return <Login/>; const visible = admin || user.role==='admin' ? BARBERS : BARBERS.filter(b=>b.id===user.barber); function update(id,status){setItems(positions(items.map(i=>i.id===id?{...i,status, startedAt:status==='in_progress'?Date.now():i.startedAt, completedAt:['completed','absent','cancelled'].includes(status)?Date.now():i.completedAt}:i)))} function remove(id){setItems(positions(items.filter(i=>i.id!==id)))} return <Layout><section className="pageTitle"><h1>{admin?'admin salon':'dashboard barber'}</h1><p>connecté : {user.name}</p><button className="secondary" onClick={()=>{localStorage.removeItem('alves_user');navigate('/')}}><LogOut size={16}/> déconnexion</button></section><div className="dashGrid">{visible.map(b=><section className="queueCard" key={b.id}><h2>{b.name}</h2><p>{waitForBarber(items,b.id)} min d’attente · {active(items).filter(i=>i.barberId===b.id).length} client(s)</p>{active(items).filter(i=>i.barberId===b.id).sort((a,b)=>a.position-b.position).map(i=><div className={'client '+i.status} key={i.id}><div><b>#{i.position} {i.first}</b><span>{service(i.serviceId)?.name} · {service(i.serviceId)?.duration} min</span><small>arrivé à {i.time}{i.comment?' · '+i.comment:''}</small></div><div className="clientBtns"><button onClick={()=>update(i.id,'called')}><BellRing size={15}/> appeler</button><button onClick={()=>update(i.id,'in_progress')}><Play size={15}/> commencer</button><button onClick={()=>update(i.id,'completed')}><CheckCircle size={15}/> terminé</button><button onClick={()=>update(i.id,'absent')}><XCircle size={15}/> absent</button>{admin&&<button onClick={()=>remove(i.id)}><Trash2 size={15}/> supprimer</button>}</div></div>)}{active(items).filter(i=>i.barberId===b.id).length===0&&<p className="empty">aucun client en attente</p>}</section>)}</div>{user.role==='admin'&& !admin && <button className="floating" onClick={()=>navigate('/admin')}>ouvrir admin</button>}</Layout>}
function ServicesPage(){const cats=[...new Set(SERVICES.map(s=>s.category))]; return <Layout><section className="pageTitle"><h1>prestations</h1><p>prix et durées indicatifs.</p></section><section className="card">{cats.map(cat=><div className="serviceCat" key={cat}><h2>{cat}</h2>{SERVICES.filter(s=>s.category===cat).map(s=><div className="service line" key={s.id}><Scissors/><span>{s.name}</span><b>{s.price} €</b><small>{s.duration} min</small></div>)}</div>)}</section></Layout>}
function Screen(){const [items]=useQueue(); return <div className="screen"><Logo/><h1>file d’attente alvesmcut</h1><div className="screenGrid">{BARBERS.map(b=>{const q=active(items).filter(i=>i.barberId===b.id).sort((a,b)=>a.position-b.position); return <section key={b.id}><h2>{b.name}</h2><div className="now">{q[0]?<>maintenant<br/><b>{q[0].first}</b></>:'libre'}</div><h3>prochains</h3>{q.slice(1,5).map(i=><p key={i.id}>#{i.position} {i.first} · {service(i.serviceId)?.name}</p>)}</section>})}</div></div>}
function App(){const path=usePath(); if(path.startsWith('/check-in'))return <CheckIn/>; if(path.startsWith('/suivi/'))return <Tracking/>; if(path.startsWith('/dashboard'))return <Dashboard/>; if(path.startsWith('/admin'))return <Dashboard admin/>; if(path.startsWith('/ecran'))return <Screen/>; if(path.startsWith('/services'))return <ServicesPage/>; if(path.startsWith('/login'))return <Login/>; return <HomePage/>}

createRoot(document.getElementById('root')).render(<App/>);
