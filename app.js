/* Usina São Lucas - gestão de produção, estoque e movimentações.
   Configure SUPABASE_URL e SUPABASE_ANON_KEY conforme o README para persistência online. */
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentUser = null;
let production = [], inventory = [], transactions = [];
let toastTimer;
const $ = id => document.getElementById(id);
const today = new Date();
const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthISO = d => dateISO(d).slice(0,7);
const brl = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number = n => Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localKey = kind => `usl_${currentUser || 'demo'}_${kind}`;
function showToast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function readLocal(kind){try{return JSON.parse(localStorage.getItem(localKey(kind))||'[]')}catch{return []}}
function writeLocal(kind,data){localStorage.setItem(localKey(kind),JSON.stringify(data))}
function setNotice(){const n=$('connection-notice');if(supabaseReady){n.textContent='Banco de dados online configurado. Os registros são salvos na sua conta.';n.style.background='#eaf5e8';n.style.borderColor='#d2e7ce';n.style.color='#2f6338'}else{n.textContent='Modo de demonstração: configure o Supabase para salvar e sincronizar os dados online.'}}
async function login(username,password){
  if(supabaseReady){
    const {data,error}=await db.auth.signInWithPassword({email:`${username.trim().toLowerCase()}@usinasl.local`,password});
    if(error) throw error;
    currentUser=data.user.id;
  }else{
    // Demonstração local: não use como proteção de um site publicado.
    if(username.trim().toLowerCase()!=='martins'||password!=='bubbles') throw new Error('Usuário ou senha incorretos.');
    currentUser='martins';
  }
  $('login-screen').classList.add('hidden');$('app-screen').classList.remove('hidden');
  await loadAll();setNotice();renderAll();
}
async function logout(){if(db) await db.auth.signOut();currentUser=null;$('app-screen').classList.add('hidden');$('login-screen').classList.remove('hidden');$('password').value=''}
async function loadAll(){
  if(!supabaseReady){production=readLocal('production');inventory=readLocal('inventory');transactions=readLocal('transactions');return}
  const tables=[['production','production_records'],['inventory','inventory_items'],['transactions','transactions']];
  for(const [state,table] of tables){const {data,error}=await db.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;const mapped=(data||[]).map(row=>({...row, id:row.id, date:row.record_date||row.date, type:row.product_stage||row.type, quantity:row.quantity, goal:row.goal, notes:row.notes, name:row.name, category:row.category, minimum:row.minimum, cost:row.unit_cost??row.cost, unit:row.unit, kind:row.kind, description:row.description, amount:row.amount}));if(state==='production')production=mapped;else if(state==='inventory')inventory=mapped;else transactions=mapped}
}
async function persist(kind,item){
  const state=kind==='production'?production:kind==='inventory'?inventory:transactions;
  if(!supabaseReady){writeLocal(kind,state);return}
  let table,payload;
  if(kind==='production'){table='production_records';payload={user_id:currentUser,record_date:item.date,product_stage:item.type,quantity:Number(item.quantity),goal:Number(item.goal||0),notes:item.notes||''}}
  else if(kind==='inventory'){table='inventory_items';payload={user_id:currentUser,name:item.name,category:item.category,quantity:Number(item.quantity),minimum:Number(item.minimum),unit_cost:Number(item.cost||0),unit:item.unit}}
  else {table='transactions';payload={user_id:currentUser,kind:item.kind,record_date:item.date,description:item.description,amount:Number(item.amount)}}
  const {data,error}=await db.from(table).insert(payload).select().single();if(error){state.shift();throw error}
  Object.assign(item,{id:data.id});
}
async function deleteRecord(kind,id){
  const state=kind==='production'?production:kind==='inventory'?inventory:transactions;
  const idx=state.findIndex(x=>String(x.id)===String(id));if(idx<0)return;
  const item=state[idx];
  if(!confirm('Tem certeza que deseja excluir este registro?'))return;
  state.splice(idx,1);
  if(supabaseReady){const table=kind==='production'?'production_records':kind==='inventory'?'inventory_items':'transactions';const {error}=await db.from(table).delete().eq('id',id);if(error){state.splice(idx,0,item);showToast('Não foi possível excluir: '+error.message);return}}
  else writeLocal(kind,state);
  renderAll();showToast('Registro excluído.');
}
function go(page){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$('page-'+page).classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const titles={dashboard:'Visão geral',production:'Produção',inventory:'Estoque',sales:'Vendas e despesas',reports:'Relatórios'};$('page-title').textContent=titles[page];if(page==='reports')renderReports()}
function setDefaultDates(){$('today-label').textContent=today.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});['dashboard-month','production-filter','transaction-filter','report-month'].forEach(id=>$(id).value=monthISO(today));['prod-date','transaction-date'].forEach(id=>$(id).value=dateISO(today))}
function filteredMonth(list,month){return list.filter(x=>(x.date||'').slice(0,7)===month)}
function renderDashboard(){
 const month=$('dashboard-month').value||monthISO(today),p=filteredMonth(production,month),t=filteredMonth(transactions,month);
 $('stat-production').textContent=number(p.reduce((s,x)=>s+Number(x.quantity||0),0))+' kg';$('stat-stock').textContent=inventory.length;
 $('stat-sales').textContent=brl(t.filter(x=>x.kind==='sale').reduce((s,x)=>s+Number(x.amount||0),0));$('stat-expenses').textContent=brl(t.filter(x=>x.kind==='expense').reduce((s,x)=>s+Number(x.amount||0),0));
 const recent=[...p].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4);
 $('recent-production').innerHTML=recent.length?recent.map(x=>`<div class="mini-row"><div><strong>${safe(x.type)}</strong><small>${safe(x.date)}${x.notes?' • '+safe(x.notes):''}</small></div><span class="amount">${number(x.quantity)} kg</span></div>`).join(''):'<div class="empty-state">Nenhuma produção registrada ainda.</div>';
 const low=inventory.filter(x=>Number(x.quantity)<=Number(x.minimum)).slice(0,5);
 $('low-stock').innerHTML=inventory.length?(low.length?low.map(x=>`<div class="mini-row"><div><strong>${safe(x.name)}</strong><small>${safe(x.category)}</small></div><span class="amount">${number(x.quantity)} ${safe(x.unit)} <span class="pill low">Baixo</span></span></div>`).join(''):'<div class="empty-state">Nenhum item com estoque baixo.</div>'):'<div class="empty-state">Nenhum item cadastrado.</div>';
}
function renderProduction(){const q=$('production-search').value.toLowerCase(),m=$('production-filter').value;const rows=[...production].filter(x=>(!m||(x.date||'').slice(0,7)===m)&&`${x.type} ${x.notes||''}`.toLowerCase().includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));$('production-table').innerHTML=rows.map(x=>`<tr><td>${safe(x.date)}</td><td>${safe(x.type)}</td><td><strong>${number(x.quantity)} kg</strong></td><td>${x.goal?number(x.goal)+' kg':'—'}</td><td>${safe(x.notes||'—')}</td><td><button class="delete-btn" data-delete="production" data-id="${safe(x.id)}">Excluir</button></td></tr>`).join('');$('production-empty').classList.toggle('hidden',rows.length>0)}
function renderInventory(){const q=$('stock-search').value.toLowerCase();const rows=inventory.filter(x=>`${x.name} ${x.category}`.toLowerCase().includes(q));$('stock-table').innerHTML=rows.map(x=>{const low=Number(x.quantity)<=Number(x.minimum);return `<tr><td><strong>${safe(x.name)}</strong></td><td>${safe(x.category)}</td><td>${number(x.quantity)} ${safe(x.unit)}</td><td>${number(x.minimum)} ${safe(x.unit)}</td><td>${brl(x.cost)}</td><td><span class="pill ${low?'low':''}">${low?'Estoque baixo':'Normal'}</span></td><td><button class="delete-btn" data-delete="inventory" data-id="${safe(x.id)}">Excluir</button></td></tr>`}).join('');$('stock-empty').classList.toggle('hidden',rows.length>0);$('stock-count').textContent=`${inventory.length} item(ns)`}
function renderTransactions(){const q=$('transaction-search').value.toLowerCase(),m=$('transaction-filter').value;const rows=[...transactions].filter(x=>(!m||(x.date||'').slice(0,7)===m)&&`${x.description} ${x.kind}`.toLowerCase().includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));$('transaction-table').innerHTML=rows.map(x=>`<tr><td>${safe(x.date)}</td><td><span class="pill ${x.kind==='expense'?'expense':''}">${x.kind==='sale'?'Receita':'Despesa'}</span></td><td>${safe(x.description)}</td><td><strong>${brl(x.amount)}</strong></td><td><button class="delete-btn" data-delete="transactions" data-id="${safe(x.id)}">Excluir</button></td></tr>`).join('');$('transaction-empty').classList.toggle('hidden',rows.length>0)}
function renderReports(){const month=$('report-month').value||monthISO(today),p=filteredMonth(production,month),t=filteredMonth(transactions,month);const qty=p.reduce((s,x)=>s+Number(x.quantity||0),0),goal=p.reduce((s,x)=>s+Number(x.goal||0),0),sales=t.filter(x=>x.kind==='sale').reduce((s,x)=>s+Number(x.amount||0),0),expenses=t.filter(x=>x.kind==='expense').reduce((s,x)=>s+Number(x.amount||0),0);$('report-production').textContent=number(qty)+' kg';$('report-goal').textContent=number(goal)+' kg';$('report-sales').textContent=brl(sales);$('report-expenses').textContent=brl(expenses);const pct=goal?Math.min(100,qty/goal*100):0;$('goal-progress').style.width=pct+'%';$('goal-progress-label').textContent=goal?`${number(pct)}% da meta mensal registrada (${number(qty)} de ${number(goal)} kg).`:'Nenhuma meta informada neste mês.'}
function renderAll(){renderDashboard();renderProduction();renderInventory();renderTransactions();renderReports()}
function openForm(id){$(id).classList.remove('hidden')}
function closeForm(id){$(id).classList.add('hidden')}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-message').textContent='';try{await login($('username').value,$('password').value);showToast('Login realizado.')}catch(err){$('login-message').textContent=supabaseReady?'Não foi possível entrar. Confira usuário, senha e configuração.':'Usuário ou senha incorretos.'}});
$('logout-btn').addEventListener('click',logout);
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
$('new-production-btn').onclick=()=>openForm('production-form-wrap');$('cancel-production').onclick=()=>closeForm('production-form-wrap');
$('new-stock-btn').onclick=()=>openForm('stock-form-wrap');$('cancel-stock').onclick=()=>closeForm('stock-form-wrap');
$('new-transaction-btn').onclick=()=>openForm('transaction-form-wrap');$('cancel-transaction').onclick=()=>closeForm('transaction-form-wrap');
$('production-form').addEventListener('submit',async e=>{e.preventDefault();const item={id:crypto.randomUUID(),date:$('prod-date').value,type:$('prod-type').value,quantity:Number($('prod-quantity').value),goal:Number($('prod-goal').value||0),notes:$('prod-notes').value.trim()};production.unshift(item);try{await persist('production',item);closeForm('production-form-wrap');e.target.reset();$('prod-date').value=dateISO(today);renderAll();showToast('Produção registrada com sucesso.')}catch(err){showToast('Erro ao salvar. Confira a conexão do banco de dados.')}});
$('stock-form').addEventListener('submit',async e=>{e.preventDefault();const item={id:crypto.randomUUID(),name:$('stock-name').value.trim(),category:$('stock-category').value,quantity:Number($('stock-quantity').value),minimum:Number($('stock-minimum').value),cost:Number($('stock-cost').value||0),unit:$('stock-unit').value};inventory.unshift(item);try{await persist('inventory',item);closeForm('stock-form-wrap');e.target.reset();$('stock-minimum').value=10;$('stock-cost').value=0;renderAll();showToast('Item cadastrado com sucesso.')}catch(err){showToast('Erro ao salvar. Confira a conexão do banco de dados.')}});
$('transaction-form').addEventListener('submit',async e=>{e.preventDefault();const item={id:crypto.randomUUID(),kind:$('transaction-type').value,date:$('transaction-date').value,description:$('transaction-description').value.trim(),amount:Number($('transaction-amount').value)};transactions.unshift(item);try{await persist('transactions',item);closeForm('transaction-form-wrap');e.target.reset();$('transaction-date').value=dateISO(today);renderAll();showToast('Movimentação registrada com sucesso.')}catch(err){showToast('Erro ao salvar. Confira a conexão do banco de dados.')}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(b)deleteRecord(b.dataset.delete,b.dataset.id)});
['dashboard-month'].forEach(id=>$(id).addEventListener('change',renderDashboard));
['production-search','production-filter'].forEach(id=>$(id).addEventListener(id.endsWith('search')?'input':'change',renderProduction));
['stock-search'].forEach(id=>$(id).addEventListener('input',renderInventory));
['transaction-search','transaction-filter'].forEach(id=>$(id).addEventListener(id.endsWith('search')?'input':'change',renderTransactions));
$('report-month').addEventListener('change',renderReports);
$('export-btn').addEventListener('click',()=>{const month=$('report-month').value||monthISO(today),rows=[['Tipo','Data','Descrição','Quantidade','Meta','Valor','Observações']];filteredMonth(production,month).forEach(x=>rows.push(['Produção',x.date,x.type,x.quantity,x.goal||'', '',x.notes||'']));filteredMonth(transactions,month).forEach(x=>rows.push([x.kind==='sale'?'Receita':'Despesa',x.date,x.description,'','',x.amount,'']));const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));a.download=`relatorio-usina-sao-lucas-${month}.csv`;a.click();URL.revokeObjectURL(a.href)});
setDefaultDates();setNotice();
