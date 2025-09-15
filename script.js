/* ==========================================================================
   SOFT-ATA — script.js (COMPLETO, ORGANIZADO E COMENTADO)
   Seções:
   0) Helpers
   1) Persistência e Estado
   2) Header (relógio e tema)
   3) Sidebar e Navegação por Abas
   4) Home (cards) + Calendário (mês dinâmico com 4/5/6 semanas)
   5) Cadastros: Clientes (CRUD)
   6) Atendimento: Kanban + Modais
   7) Ordens: Tabela + Ações
   8) Utilitários (WhatsApp e Conversor de data/hora)
   9) Assistente de Cálculos
   10) Configurações (módulos, motivos, atraso)
   11) Perfil (avatar, nome, nascimento, setor)
   12) Bootstrap (DOMContentLoaded)
   ========================================================================== */


/* ==========================================================================
   0) HELPERS
   ========================================================================== */

/** Seletores rápidos */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/** Listener sucinto */
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

// Trata string ISO (YYYY-MM-DD) como meia-noite LOCAL para não voltar 1 dia
const fmt = (d) => {
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(d + 'T00:00:00'); // local time
  }
  return new Date(d);
};

/** Formata data no padrão BR (dd/mm/aaaa) — usar SEMPRE para exibir */
const brDate = (d) => {
  const dt = fmt(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth()+1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const hm  = (d) => {
  const dt = fmt(d);
  const H  = String(dt.getHours()).padStart(2, '0');
  const M  = String(dt.getMinutes()).padStart(2, '0');
  const S  = String(dt.getSeconds()).padStart(2, '0');
  return `${H}:${M}:${S}`;
};

/** Converte Date/string para YYYY-MM-DD */
function ymd(d){
  const dt = fmt(d);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth()+1).padStart(2,'0');
  const da = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

/** Dias úteis: soma/subtrai N dias úteis a partir de uma data ISO */
function addDiasUteis(dataISO, qtd) {
  let d = (typeof dataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataISO))
          ? new Date(dataISO + 'T00:00:00')
          : new Date(dataISO);
  let count = 0;
  const inc = qtd >= 0 ? 1 : -1;
  while (count !== qtd) {
    d.setDate(d.getDate() + inc);
    const weekday = d.getDay(); // 0=Dom ... 6=Sáb
    if (weekday !== 0 && weekday !== 6) count += inc;
  }
  return ymd(d);
}

/** Gera um ID curto */
const uid = (p='') => (p ? p + '_' : '') + Math.random().toString(36).slice(2, 8);

/** Toggle atributo hidden */
const hide = (el, v=true) => { if (el) el.hidden = v; };

/** Escapa texto simples para HTML */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m)=>({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

/** Cria elemento com atributos e filhos */
function h(tag, attrs={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c==null) return;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

/** Clona um <template> pelo id e retorna o primeiro elemento raiz */
function cloneTpl(id){
  const tpl = document.getElementById(id.replace(/^#/, ''));
  if (!tpl || !tpl.content) return null;
  const frag = tpl.content.cloneNode(true);
  return Array.from(frag.children)[0] || null;
}


/* ==========================================================================
   1) PERSISTÊNCIA E ESTADO
   ========================================================================== */

const DB = {
  key: 'softata_state_v1',
  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
    catch { return {}; }
  },
  save(state) { localStorage.setItem(this.key, JSON.stringify(state)); },
};

/** Estado padrão (defaults) */
const defaults = {
  ui: { theme: 'light', currentTab: 'home', sidebarOpen: false, overdueHighlight: true },
  cad: { modulos: ['Fiscal','Contábil','Folha'], motivos: ['Erro no sistema','Dúvida do usuário','Ajuste de cadastro'] },
  clientes: [],
  tickets: [],
  ordens: [],
  calendar: { events: [] }, // events: [{id, date:'YYYY-MM-DD', time:'HH:mm', title, recur?, countType?}]
  profile: { foto: null, nome: '', nascimento: '', setor: '' },
};

const saved = DB.load();
/** Merge seguro (raso com mesclagem de objetos aninhados mais importantes) */
const state = {
  ui:       { ...defaults.ui, ...(saved.ui||{}) },
  cad:      { ...defaults.cad, ...(saved.cad||{}) },
  clientes: saved.clientes || defaults.clientes,
  tickets:  saved.tickets  || defaults.tickets,
  ordens:   saved.ordens   || defaults.ordens,
  calendar: { events: (saved.calendar && saved.calendar.events) || defaults.calendar.events },
  profile:  { ...defaults.profile, ...(saved.profile||{}) },
};

function persist(){ DB.save(state); }

/* ==========================================================================
   2) HEADER (RELÓGIO E TEMA)
   ========================================================================== */

function initClock() {
  const el = $('#clock');
  if (!el) return;
  const tick = () => el.textContent = hm(new Date());
  tick();
  setInterval(tick, 1000);
}

function applyTheme() {
  const dark = state.ui.theme === 'dark';
  document.body.classList.toggle('theme-dark', dark);
}

function initThemeToggle() {
  const btn = $('#themeSwitch');
  if (!btn) return;
  applyTheme(); // aplica tema salvo
  on(btn, 'click', () => {
    state.ui.theme = (state.ui.theme === 'dark') ? 'light' : 'dark';
    applyTheme();
    persist();
  });
}

/* ========================================================================== 
   PERFIL NO HEADER (nome + avatar) 
   ========================================================================== */

function applyHeaderProfile() {
  const me = state.profile || {};
  const av = document.getElementById('profileAvatar');
  const nm = document.getElementById('profileName');
  const sc = document.getElementById('profileSector');

  if (av) {
    if (me.foto) {
      av.src = me.foto;
    } else {
      // fallback: ícone padrão em SVG se não tiver foto
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#e5e7eb"/><circle cx="32" cy="24" r="12" fill="#94a3b8"/><rect x="12" y="40" width="40" height="14" rx="7" fill="#cbd5e1"/></svg>');
      av.src = `data:image/svg+xml;charset=UTF-8,${svg}`;
    }
  }

  if (nm) nm.textContent = (me.nome || '').split(' ')[0] || 'Usuário';
  if (sc) sc.textContent = me.setor || 'Setor';
}

/* ==========================================================================
   3) SIDEBAR E NAVEGAÇÃO POR ABAS
   ========================================================================== */

function openSidebar(v=true){
  state.ui.sidebarOpen = v;
  $('#sidebar')?.classList.toggle('open', v);
  document.body.classList.toggle('with-sidebar', v);
  persist();
}
function initSidebar(){
  on($('#btnHamb'), 'click', () => openSidebar(!state.ui.sidebarOpen));
  openSidebar(state.ui.sidebarOpen);
}

function setTab(name){
  // Botões da nav
  $$('#navList button').forEach(b=>{
    const active = b.getAttribute('data-go') === name;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  // Painéis
  $$('main > .panel').forEach(p=> hide(p, p.id !== `tab-${name}`));
  state.ui.currentTab = name;
  persist();

  // Renderizações sob demanda
  if (name === 'home')      renderHome();
  if (name === 'fila')      renderKanban();
  if (name === 'clientes')  renderClientes();
  if (name === 'ordens')    renderOrdens();
  if (name === 'dashboard') renderKPIs();
  if (name === 'config')    initConfig(); // popula UI de config quando abrir
}

function initTabs(){
  $$('#navList button').forEach(btn => on(btn, 'click', () => setTab(btn.dataset.go)));
  setTab(state.ui.currentTab || 'home'); // aba inicial
}


/* ==========================================================================
   4) HOME + CALENDÁRIO
   ========================================================================== */

function renderHome(){
  // KPIs rápidos no topo (usados como cards)
  const counts = {
    aberto:      state.tickets.filter(t=>t.col==='aberto').length,
    atendimento: state.tickets.filter(t=>t.col==='atendimento').length,
    programacao: state.tickets.filter(t=>t.col==='programacao').length,
    atrasados:   state.ordens.filter(o=> isAtrasada(o.previsto)).length,
  };

  const cont = $('#homeCards');
  if (cont) {
    cont.innerHTML = '';
    [
      ['Abertos', counts.aberto, 'd-abertas'],
      ['Em atendimento', counts.atendimento, 'd-atend'],
      ['Programação', counts.programacao, 'd-prog'],
      ['Atrasadas', counts.atrasados, 'd-atraso'],
    ].forEach(([lbl,val,klass])=>{
      cont.appendChild(h('div',{class:`dashcard ${klass}`},[
        h('div',{},lbl),
        h('div',{}, String(val))
      ]));
    });
  }

  renderCalendar();
}

/** Estado do calendário (mês/ano exibido) */
let calCurrent = (()=>{ const d = new Date(); return {y:d.getFullYear(), m:d.getMonth()}; })();

/** Informações do mês */
function monthInfo(y, m){
  const first = new Date(y, m, 1);
  const startDow = first.getDay(); // 0=Dom
  const daysInMonth = new Date(y, m+1, 0).getDate();
  return { first, startDow, daysInMonth };
}

/** Renderização do calendário com quantidade dinâmica de semanas (4, 5 ou 6) */
function renderCalendar(){
  const title    = $('#calTitle');
  const grid     = $('#calGrid');
  const list     = $('#calListItems');
  const listDate = $('#calListDate');
  if (!title || !grid || !list || !listDate) return;

  const {y,m} = calCurrent;
  const locale = 'pt-BR';
  const monthName = new Date(y, m, 1).toLocaleDateString(locale, { month:'long', year:'numeric' });
  title.textContent = monthName[0].toUpperCase() + monthName.slice(1);

  grid.innerHTML = '';
  const { startDow, daysInMonth } = monthInfo(y,m);
  const prevDays = new Date(y, m, 0).getDate();

  // Preenche “slots” iniciais com dias do mês anterior
  for (let i = 0; i < startDow; i++) {
    const day = prevDays - (startDow - 1) + i;
    grid.appendChild(dayCell(y, m-1, day, true));
  }
  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(dayCell(y, m, d, false));
  }

  // ===== COMPLEMENTO AUTOMÁTICO (4, 5 ou 6 semanas) =====
  const totalPreenchido = grid.children.length;    // anterior + atual
  const totalTeorico    = startDow + daysInMonth;  // slots que o mês ocupa
  const semanas         = Math.ceil(totalTeorico / 7); // 4, 5 ou 6
  const alvo            = semanas * 7;             // 28, 35 ou 42
  const faltam          = Math.max(0, alvo - totalPreenchido);
  for (let d = 1; d <= faltam; d++) {
    grid.appendChild(dayCell(y, m+1, d, true));    // só o necessário do próximo mês
  }

  // Seleção padrão: hoje (se existir na grade), senão primeira célula útil
  const todayISO = ymd(new Date());
  const todayEl  = $(`.cal-cell[data-date="${todayISO}"]`);
  if (todayEl) selectDay(todayISO);
  else if (grid.firstElementChild) selectDay(grid.firstElementChild.dataset.date);

  // Navegação do mês (substitui handlers para não acumular listeners)
  const prev = $('#calPrev');
  const next = $('#calNext');
  if (prev) prev.onclick = () => { calMove(-1); };
  if (next) next.onclick = () => { calMove(1); };

  function calMove(delta){
    let nm = calCurrent.m + delta;
    let ny = calCurrent.y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11){ nm = 0;  ny++; }
    calCurrent = {y:ny, m:nm};
    renderCalendar();
  }
}

/** Cria uma célula de dia */
function dayCell(y, m, d, other){
  const date = new Date(y, m, d);
  const iso  = ymd(date);
  const cell = h('div', { class:'cal-cell', 'data-date': iso });

  if (other) cell.classList.add('other');
  if (iso === ymd(new Date())) cell.classList.add('cal-today');

  cell.appendChild(h('div', {class:'cal-day'}, d.toString()));

  const evs = state.calendar.events.filter(ev => ev.date === iso);
  if (evs.length){
    cell.classList.add('has-ev');
    cell.appendChild(h('div',{class:'cal-dot'}));
    cell.appendChild(h('div',{class:'cal-dot-count'}, String(evs.length)));
  }
  on(cell, 'click', ()=> selectDay(iso));

  return cell;
}

/** Atualiza lista de compromissos do dia selecionado */
function selectDay(iso){
  $$('.cal-cell').forEach(c=> c.classList.toggle('selected', c.dataset.date===iso));

  const list     = $('#calListItems');
  const listDate = $('#calListDate');
  if (!list || !listDate) return;

  list.innerHTML = '';
  listDate.textContent = new Date(iso).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  const evs = state.calendar.events
    .filter(e=> e.date === iso)
    .sort((a,b)=> (a.time||'').localeCompare(b.time||''));

  if (!evs.length){
    list.appendChild(h('div',{class:'chip'},'Sem compromissos.'));
  } else {
    evs.forEach(ev=>{
      list.appendChild(
        h('div',{class:'cal-item'},[
          h('div',{}, `${ev.time||'—'} • ${ev.title}`),
          h('div',{},[
            h('button',{class:'btn sm editar', onClick:()=>editEvent(ev.id)},'Editar'),
            h('button',{class:'btn sm excluir', onClick:()=>delEvent(ev.id)},'Excluir'),
          ])
        ])
      );
    });
  }
}

/** Edição rápida (carrega nos inputs do cabeçalho) */
function editEvent(id){
  const ev = state.calendar.events.find(e=>e.id===id);
  if (!ev) return;
  $('#ev_title').value = ev.title || '';
  $('#ev_date').value  = ev.date || '';
  $('#ev_time').value  = ev.time || '';
  $('#ev_recur').value = ev.recur || 'none';
  $('#ev_count').value = ev.countType || 'corridos';
}

/** Remove evento e re-renderiza */
function delEvent(id){
  state.calendar.events = state.calendar.events.filter(e=> e.id!==id);
  persist();
  renderCalendar();
}

/** Formulário de evento (cabeçalho do calendário) */
function initCalendarForm(){
  const addBtn = $('#ev_add');
  if (!addBtn) return;

  on(addBtn, 'click', ()=>{
    const title = $('#ev_title').value.trim();
    const date  = $('#ev_date').value;
    const time  = $('#ev_time').value;
    const recur = $('#ev_recur').value;     // none|daily|weekly|monthly
    const countType = $('#ev_count').value; // corridos|uteis

    if (!title || !date){
      alert('Informe ao menos Título e Data.');
      return;
    }

    const base = { id:uid('ev'), title, date, time, recur: (recur==='none'?undefined:recur), countType };
    const created = [];

    if (recur === 'none'){
      created.push(base);
    } else {
      // Gera 5 ocorrências como exemplo
      let d = new Date(date);
      for (let i=0;i<5;i++){
        const copy = {...base, id:uid('ev')};
        copy.date = ymd(d);
        created.push(copy);

        if (recur === 'daily')   d.setDate(d.getDate()+1);
        if (recur === 'weekly')  d.setDate(d.getDate()+7);
        if (recur === 'monthly') d.setMonth(d.getMonth()+1);

        // Ajusta para dia útil se escolhido
        if (countType==='uteis'){
          while ([0,6].includes(d.getDay())) d.setDate(d.getDate()+1);
        }
      }
    }

    state.calendar.events.push(...created);
    persist();
    renderCalendar();
    selectDay(date); // mantém o dia selecionado
    $('#ev_title').value = ''; // limpa apenas o título
  });
}


/* ==========================================================================
   5) CLIENTES (CRUD)
   ========================================================================== */

function renderClientes(){
  const tb = $('#tblClientes');
  if (!tb) return;
  tb.innerHTML = '';

  if (!state.clientes.length){
    tb.appendChild(h('tr',{}, h('td',{colspan:'5'},'Nenhum cliente cadastrado.')));
    return;
  }

  state.clientes.forEach(c=>{
    const tr = h('tr', {'data-id': c.id}, [
      h('td',{}, c.codigo||'—'),
      h('td',{}, c.nome||'—'),
      h('td',{}, c.telefone||'—'),
      h('td',{}, c.responsavel||'—'),
      h('td',{}, [
        h('button',{class:'btn sm editar', onClick:()=>editCliente(c.id)},'Editar'),
        h('button',{class:'btn sm excluir', onClick:()=>delCliente(c.id)},'Excluir'),
      ])
    ]);
    tb.appendChild(tr);
  });
}

function editCliente(id){
  const c = state.clientes.find(x=>x.id===id);
  if (!c) return;
  $('#c_nome').value   = c.nome || '';
  $('#c_codigo').value = c.codigo || '';
  $('#c_tel').value    = c.telefone || '';
  $('#c_resp').value   = c.responsavel || '';
}

function delCliente(id){
  state.clientes = state.clientes.filter(c=>c.id!==id);
  persist();
  renderClientes();
}

function initClientesForm(){
  on($('#c_add'), 'click', ()=>{
    const nome = $('#c_nome').value.trim();
    const codigo = $('#c_codigo').value.trim();
    const tel = $('#c_tel').value.trim();
    const resp = $('#c_resp').value.trim();
    if (!nome) { alert('Informe o nome.'); return; }

    const exists = state.clientes.find(c=> c.codigo===codigo && codigo);
    if (exists){
      Object.assign(exists, {nome, telefone:tel, responsavel:resp});
    } else {
      state.clientes.push({ id:uid('cli'), nome, codigo, telefone:tel, responsavel:resp });
    }
    persist();
    renderClientes();
    $('#c_nome').value = $('#c_codigo').value = $('#c_tel').value = $('#c_resp').value = '';
  });
}

// === Perfil atual centralizado ===
function getCurrentProfile() {
  const p = state.profile || {};
  const nome = (p.nome || '').trim();
  return {
    nome,
    firstName: nome.split(/\s+/)[0] || 'Usuário',
    foto: p.foto || ''
  };
}

/* ==========================================================================
   6) ATENDIMENTO (KANBAN + MODAIS)
   ========================================================================== */

const COLS = ['aberto','atendimento','aguardando','programacao','concluido'];

function renderKanban(){
  // Atualiza selects do formulário com base na Config
  const modSel = $('#t_modulo'), motSel = $('#t_motivo');
  if (modSel && motSel){
    // Popular select de clientes e chip "Cliente selecionado"
    const cliSel  = $('#t_cliente');
    const cliInfo = $('#t_cliente_info');
    if (cliSel){
      const selected = cliSel.value;
      cliSel.innerHTML = '<option value="">Selecione um cliente…</option>' +
        state.clientes.map(c =>
          `<option value="${esc(c.id)}">${esc(c.codigo || '')}${c.codigo ? ' — ' : ''}${esc(c.nome || '')}</option>`
        ).join('');
      if (selected) cliSel.value = selected;
      cliSel.onchange = () => {
        const c = state.clientes.find(x=> x.id === cliSel.value);
        if (cliInfo) cliInfo.textContent = c ? `${c.codigo || '—'} — ${c.nome || '—'}` : 'Nenhum cliente selecionado';
      };
      // Atualiza chip na carga inicial
      const c0 = state.clientes.find(x=> x.id === cliSel.value);
      if (cliInfo) cliInfo.textContent = c0 ? `${c0.codigo || '—'} — ${c0.nome || '—'}` : 'Nenhum cliente selecionado';
    }

    modSel.innerHTML = '<option value="">Módulo</option>' + state.cad.modulos.map(m=>`<option>${esc(m)}</option>`).join('');
    motSel.innerHTML = '<option value="">Motivo</option>' + state.cad.motivos.map(m=>`<option>${esc(m)}</option>`).join('');
  }

  COLS.forEach(col=>{
    const list = $(`#col-${col}`);
    if (!list) return;
    list.innerHTML = '';

    const items = state.tickets.filter(t=> t.col===col);
    if (!items.length){
      list.appendChild(h('div',{class:'chip'},'Vazio'));
      return;
    }

    items.forEach(t=>{
      // === CARD VIA TEMPLATE ===
      const card = cloneTpl('ticketCardTpl');
      if (!card) return;

      card.dataset.id = t.id;
      card.dataset.status = col;

      // Título: Código + Nome, ou fallback
      const tituloCliente = (t.codigo || t.nome)
        ? `${t.codigo || '—'} — ${t.nome || '—'}`
        : (t.titulo || 'Sem cliente');
      card.querySelector('[data-bind="clienteTitulo"]').textContent = tituloCliente;
      // Metas
      card.querySelector('[data-bind="modulo"]').textContent = t.modulo || '—';
      card.querySelector('[data-bind="motivo"]').textContent = t.motivo || '—';
      card.querySelector('[data-bind="data"]').textContent   = t.data ? brDate(t.data) : '—';
      card.querySelector('[data-bind="solicitante"]').textContent = t.solicitante || '—';
      // Usuário responsável (foto + primeiro nome)
      const assNameEl = card.querySelector('[data-bind="assigneeName"]');
      const assAvEl   = card.querySelector('[data-bind="assigneeAvatar"]');
      if (assNameEl) assNameEl.textContent = t.assigneeName || 'Sem usuário';
      if (assAvEl)   assAvEl.src = t.assigneeAvatar || '';

      // Não mostrar Problema/Solução no card do Kanban (só na telinha)
      const psBlock = card.querySelector('.ps');
      if (psBlock) psBlock.remove();

      // Botões de status no card
      const acts = card.querySelector('[data-bind="actions"]');
      acts.innerHTML = '';
      const mkBtn = (cls, txt, fn) =>
        h('button', {
          class: `btn sm ${cls}`,
          type: 'button',
          onClick: (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            fn();
          }
        }, txt);

      // botões de status
      if (col === 'concluido'){
        acts.appendChild(mkBtn('aberto reabrir','Reabrir', ()=>moveTicket(t.id,'aberto')));
      } else {
        if (col !== 'aberto')      acts.appendChild(mkBtn('aberto','Aberto', ()=>moveTicket(t.id,'aberto')));
        if (col !== 'atendimento') acts.appendChild(mkBtn('atendimento','Atendimento', ()=>moveTicket(t.id,'atendimento')));
        if (col !== 'aguardando')  acts.appendChild(mkBtn('aguardando','Aguardando', ()=>moveTicket(t.id,'aguardando')));
        if (col !== 'programacao') acts.appendChild(mkBtn('programacao','Programação', ()=>moveTicket(t.id,'programacao')));
        if (col !== 'concluido')   acts.appendChild(mkBtn('concluido','Concluir', ()=>moveTicket(t.id,'concluido')));
      }

      // sempre pode Excluir
      acts.appendChild(mkBtn('excluir','Excluir', ()=>delTicket(t.id)));

      // “Lançar” só nos concluídos
      if (col === 'concluido') {
        acts.appendChild(mkBtn('lancar','Lançar', ()=> {
          createOrderFromTicket(t.id);
        }));
      }

      // Clique no card → abre Popover (telinha) exceto quando alvo é botão
      card.addEventListener('click', function (ev) {
        if (ev.target.closest('.actions, button, .btn, [data-act]')) return;
        openTicketPopover(t.id, card);
      });

      // anexa o card na coluna
      list.appendChild(card);
    });
  });
}

/* === Delegação de cliques para botões dentro dos cards do Kanban (GLOBAL) === */
function initKanbanClicks(){
  const root = document.querySelector('.kanban');
  if (!root) return;
  if (root.__hasKanbanDelegation) return; // evita duplicar
  root.__hasKanbanDelegation = true;

  // capture=true: intercepta ANTES do clique do card (que abriria o popover)
  root.addEventListener('click', (ev) => {
    const btn  = ev.target.closest('button, .btn, [data-act]');
    const card = ev.target.closest('.ticket');
    if (!btn || !card) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = card.dataset.id;

    // Ações diretas
    if (btn.classList.contains('excluir') || btn.dataset.act === 'delete' || btn.dataset.act === 'del'){
      delTicket(id); return;
    }
    if (btn.classList.contains('lancar') || btn.dataset.act === 'lancar' || btn.dataset.act === 'launch'){
      createOrderFromTicket(id); return;
    }
    if (btn.classList.contains('editar') || btn.dataset.act === 'edit'){
      openEditModal(id); return;
    }

    // Mapeia classes → coluna
    const targetCol =
      btn.classList.contains('aberto')       ? 'aberto' :
      btn.classList.contains('atendimento')  ? 'atendimento' :
      btn.classList.contains('aguardando')   ? 'aguardando' :
      btn.classList.contains('programacao')  ? 'programacao' :
      btn.classList.contains('concluido')    ? 'concluido' :
      btn.classList.contains('reabrir')      ? 'aberto' : null;

    if (targetCol) moveTicket(id, targetCol);
  }, true);
}

function labelCol(c){
  return ({
    aberto:'Aberto',
    atendimento:'Em atendimento',
    aguardando:'Aguardando retorno',
    programacao:'Programação',
    concluido:'Concluído'
  })[c] || c;
}

function initKanbanForm(){
  on($('#t_add'), 'click', ()=>{
    const titulo = $('#t_titulo').value.trim();
    const modulo = $('#t_modulo').value;
    const motivo = $('#t_motivo').value;
    const data   = $('#t_data').value || ymd(new Date());
    const solicitante = $('#t_solicitante').value.trim();

    // Cliente obrigatório
    const selId = $('#t_cliente').value;
    const cli   = state.clientes.find(c => c.id === selId);
    if (!cli){
      alert('Selecione um cliente.');
      return;
    }
    if (!titulo){
      alert('Informe o título.');
      return;
    }

    const me = getCurrentProfile();

    state.tickets.push({
      id: uid('t'),
      titulo,
      modulo,
      motivo,
      data,
      solicitante,
      col: 'aberto',
      clienteId: cli.id,
      codigo:    cli.codigo || '',
      nome:      cli.nome   || '',
      assigneeName: me.firstName,
      assigneeAvatar: me.foto
    });

    persist();
    renderKanban();

    // Limpa campos (mantém cliente)
    $('#t_titulo').value = '';
    $('#t_modulo').value = '';
    $('#t_motivo').value = '';
    $('#t_data').value   = '';
  });
}

function moveTicket(id, col){
  const t = state.tickets.find(x=>x.id===id);
  if (!t) return;

  // carimbar quem mexeu
  const me = getCurrentProfile();
  t.assigneeName = me.firstName;
  t.assigneeAvatar = me.foto;

  t.col = col;
  persist();
  renderKanban();
}

function createOrderFromTicket(ticketId){
  const t = state.tickets.find(x => x.id === ticketId);
  if (!t) return;

  const numero   = String((state.ordens[state.ordens.length-1]?.numero || 0) + 1).padStart(3,'0');
  const previsto = ymd(new Date()); // hoje

  state.ordens.push({
    id: uid('o'),
    numero,
    titulo: t.titulo || `${t.codigo || ''} ${t.nome || ''}`.trim() || 'Atendimento',
    status: 'Aberto',
    previsto
  });

  persist();
  renderOrdens();
  setTab('ordens'); // vai direto para Ordens
}

function delTicket(id){
  state.tickets = state.tickets.filter(t=>t.id!==id);
  persist();
  renderKanban();
}

/* ---- MODAL: Editar atendimento (e_*) ---- */
function openEditModal(id){
  const t = state.tickets.find(x=>x.id===id);
  if (!t) return;
  $('#e_ticket_id').value = t.id;
  fillSelect($('#e_modulo'), state.cad.modulos, t.modulo);
  fillSelect($('#e_motivo'), state.cad.motivos, t.motivo);
  $('#e_titulo').value = t.titulo || '';
  $('#e_data').value   = t.data || '';
  modalShow('#editModal', true);
}
function fillSelect(sel, items, selected){
  if (!sel) return;
  sel.innerHTML = items.map(v=> `<option ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}
function initEditModal(){
  on($('#e_cancel'), 'click', ()=> modalShow('#editModal', false));
  on($('#e_save'), 'click', ()=>{
    const id = $('#e_ticket_id').value;
    const t = state.tickets.find(x=>x.id===id);
    if (!t) return;
    t.titulo = $('#e_titulo').value.trim();
    t.modulo = $('#e_modulo').value;
    t.motivo = $('#e_motivo').value;
    t.data   = $('#e_data').value || t.data;
    persist();
    modalShow('#editModal', false);
    renderKanban();
  });
}

/* ---- MODAL: Lançar ordem a partir do atendimento (m_*) ---- */
function openLaunchModal(id){
  const t = state.tickets.find(x=>x.id===id);
  if (!t) return;
  $('#m_ticket_id').value = t.id;
  $('#m_problem').value = t.problem || '';
  $('#m_solution').value = t.solution || '';
  modalShow('#launchModal', true);
}
function initLaunchModal(){
  on($('#m_cancel'), 'click', ()=> modalShow('#launchModal', false));
  on($('#m_save'), 'click', ()=>{
    const id = $('#m_ticket_id').value;
    const t = state.tickets.find(x=>x.id===id);
    if (!t) return;

    // Salva problema/solução no ticket (documentação do atendimento)
    t.problem = $('#m_problem').value.trim();
    t.solution= $('#m_solution').value.trim();

    // Cria ordem baseada no atendimento
    const numero = String((state.ordens[state.ordens.length-1]?.numero || 0) + 1).padStart(3,'0');
    const previsto = ymd(new Date()); // ajuste depois conforme sua regra
    state.ordens.push({ id:uid('o'), numero, titulo: t.titulo, status:'Aberto', previsto });

    persist();
    modalShow('#launchModal', false);
    renderKanban();
    renderOrdens();
    setTab('ordens');
  });
}

/* === TELINHA (Popover) do atendimento — versão final === */
function openTicketPopover(ticketId, anchorEl){
  const root = document.getElementById('popoverRoot');
  if (!root) return;

  // Limpa e injeta template
  root.innerHTML = '';
  const pop = cloneTpl('ticketActionsTpl');
  if (!pop) return;
  root.appendChild(pop);
  root.hidden = false;

  // Centraliza o popover
  const pv = root.querySelector('.popover');
  if (pv){
    const vw = document.documentElement.clientWidth;
    const targetW = Math.min(720, vw - 32);
    pv.style.width = targetW + 'px';
    pv.style.left = '50%';
    pv.style.top = '50%';
    pv.style.transform = 'translate(-50%, -50%)';
  }

  // Ticket corrente
  const t = state.tickets.find(x=>x.id===ticketId);
  if (!t) return;

  // (A) Visibilidade genérica por atributo (ex.: data-visible-for="concluido")
  // Se o template tiver elementos com data-visible-for, só mantém se a coluna atual permitir.
  $$('[data-visible-for]', pop).forEach(el=>{
    const allow = (el.getAttribute('data-visible-for')||'').split(',').map(s=>s.trim());
    if (!allow.includes(t.col)) el.remove();
  });

  // Preenche Problema/Solução
  const pTxt = pop.querySelector('#po_problem');
  const sTxt = pop.querySelector('#po_solution');
  if (pTxt) pTxt.value = t.problem  || '';
  if (sTxt) sTxt.value = t.solution || '';

  // Auto-save enquanto digita
  if (pTxt) pTxt.addEventListener('input', ()=>{ t.problem  = pTxt.value; persist(); });
  if (sTxt) sTxt.addEventListener('input', ()=>{ t.solution = sTxt.value; persist(); });

  // Utilitário para rebind (evita handlers duplicados quando reabrir)
  const rebind = (sel, handler) => {
    const el = typeof sel === 'string' ? pop.querySelector(sel) : sel;
    if (!el) return null;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    clone.addEventListener('click', (ev)=>{ ev.stopPropagation(); handler(ev); });
    return clone;
  };

  // Botões
  const btnEdit   = pop.querySelector('[data-act="edit"]');
  const btnDelete = pop.querySelector('[data-act="delete"]');
  const btnSave   = pop.querySelector('[data-act="save"]');
  const btnLaunch = pop.querySelector('[data-act="launch"]');

  // (B) Regra específica do Lançar: só existe na coluna 'concluido'
  if (btnLaunch && t.col !== 'concluido') {
    btnLaunch.remove(); // remove do DOM para não sobrar espaço/efeitos
  }

  // Editar (abre modal de edição)
  rebind(btnEdit, ()=>{ closeTicketPopover(); openEditModal(ticketId); });

  // Excluir
  rebind(btnDelete, ()=>{ delTicket(ticketId); closeTicketPopover(); });

  // Salvar (sempre disponível): persiste Problema/Solução e fecha
  rebind(btnSave, ()=>{
    if (pTxt) t.problem  = (pTxt.value || '').trim();
    if (sTxt) t.solution = (sTxt.value || '').trim();
    persist();
    closeTicketPopover();
    renderKanban(); // reflete alterações no card
  });

  // Lançar (se existir): abre modal de ordem
  rebind(btnLaunch, ()=> {
    if (!btnLaunch) return;
    // proteção extra, caso alguém injete elemento manualmente
    if (t.col !== 'concluido') return;
    closeTicketPopover();
    openLaunchModal(ticketId);
  });

  // Fechar (X) e clique fora
  pop.querySelector('[data-close]')?.addEventListener('click', closeTicketPopover);
  // Fecha ao clicar no backdrop (fora da telinha)
  root.addEventListener('click', (ev)=>{ if (ev.target === root) closeTicketPopover(); }, { once:true });
}
function closeTicketPopover(){
  const root = document.getElementById('popoverRoot');
  if (root) { root.hidden = true; root.innerHTML = ''; }
}

/* ==========================================================================
   7) ORDENS (TABELA + AÇÕES)
   ========================================================================== */

function isAtrasada(prevISO){
  if (!state.ui.overdueHighlight) return false;
  if (!prevISO) return false;
  const hoje = ymd(new Date());
  return prevISO < hoje;
}

function renderOrdens(){
  const tb = $('#tblOrdens');
  if (!tb) return;
  tb.innerHTML = '';

  if (!state.ordens.length){
    tb.appendChild(h('tr',{}, h('td',{colspan:'5'},'Nenhuma ordem lançada.')));
    return;
  }

  state.ordens.forEach(o=>{
    const stClass = ({
      'Aberto':'open',
      'Em atendimento':'active',
      'Aguardando':'waiting',
      'Programação':'prog',
      'Concluído':'done',
      'Postado':'posted'
    })[o.status] || 'open';

    const previstoTxt = o.previsto ? brDate(o.previsto) : '—';
    const tr = h('tr', {'data-id':o.id}, [
      h('td',{}, o.numero || '—'),
      h('td',{}, o.titulo || '—'),
      h('td',{}, h('span',{class:`pill ${stClass}`}, o.status||'—')),
      h('td',{}, previstoTxt + (isAtrasada(o.previsto) ? ' ⚠' : '')),
      h('td',{}, h('div',{class:'row'},[
  h('button',{class:'btn sm programacao', onClick:()=>setOrdStatus(o.id,'Programação')},'Programação'),
  h('button',{class:'btn sm excluir',     onClick:()=>delOrdem(o.id)},'Excluir'),
]))
    ]);
    tb.appendChild(tr);
  });
}

function setOrdStatus(id, st){
  const o = state.ordens.find(x=>x.id===id);
  if (!o) return;
  o.status = st;
  persist();
  renderOrdens();
}

function delOrdem(id){
  state.ordens = state.ordens.filter(o=>o.id!==id);
  persist();
  renderOrdens();
}

function editOrdem(id){
  const o = state.ordens.find(x=>x.id===id);
  if (!o) return;
  const t = prompt('Título da ordem:', o.titulo || '');
  if (t == null) return;
  const p = prompt('Previsto (YYYY-MM-DD):', o.previsto || ymd(new Date()));
  if (p == null) return;
  o.titulo = t.trim();
  o.previsto = p.trim();
  persist();
  renderOrdens();
}


/* ==========================================================================
   8) UTILITÁRIOS
   ========================================================================== */

function initUtils(){
  // Link WhatsApp
  on($('#u_go'),'click', ()=>{
    const tel = $('#u_tel').value.replace(/\D/g,'');
    const msg = encodeURIComponent($('#u_msg').value || '');
    if (!tel){ alert('Informe o telefone (com DDD).'); return; }
    const url = `https://wa.me/${tel}${msg ? `?text=${msg}` : ''}`;
    const out = $('#u_out'); out.innerHTML='';
    out.appendChild(h('a',{href:url,target:'_blank',class:'chip'}, 'Abrir conversa'));
    out.appendChild(h('div',{class:'chip'}, url));
  });

  // Conversor data/hora
  on($('#u_fmt'), 'click', ()=>{
    const raw = $('#u_dt').value;
    const loc = $('#u_locale').value || 'pt-BR';
    if (!raw){ alert('Informe a data/hora.'); return; }
    const dt = new Date(raw);
    const s1 = dt.toLocaleString(loc);
    const s2 = dt.toISOString();
    const out = $('#u_dt_out'); out.innerHTML='';
    out.appendChild(h('div',{class:'chip'}, s1));
    out.appendChild(h('div',{class:'chip'}, s2));
  });
}


/* ==========================================================================
   9) ASSISTENTE DE CÁLCULOS
   ========================================================================== */

function initCalcs(){
  // % acréscimo/desconto
  on($('#c_aplicar'),'click', ()=>{
    const base = parseFloat($('#c_base').value);
    const pct  = parseFloat($('#c_pct').value);
    if (isNaN(base) || isNaN(pct)){ alert('Informe valores válidos.'); return; }
    const result = base * (1 + pct/100);
    const out = $('#c_out'); out.innerHTML='';
    out.appendChild(h('div',{class:'chip badge'}, `Resultado: ${result.toFixed(2)}`));
  });

  // Regra de 3 simples: A está para B assim como C está para X => X = (B * C) / A
  on($('#r_calc'),'click', ()=>{
    const A = parseFloat($('#r_a').value);
    const B = parseFloat($('#r_b').value);
    const C = parseFloat($('#r_c').value);
    if ([A,B,C].some(isNaN) || A===0){ alert('Informe A, B e C válidos (A ≠ 0).'); return; }
    const X = (B * C) / A;
    const out = $('#r_out'); out.innerHTML='';
    out.appendChild(h('div',{class:'chip badge'}, `X = ${X.toFixed(4)}`));
  });
}


/* ==========================================================================
   10) CONFIGURAÇÕES
   ========================================================================== */

function initConfig(){
  // Preenche
  if ($('#cfg_modulos')) $('#cfg_modulos').value = state.cad.modulos.join('\n');
  if ($('#cfg_motivos')) $('#cfg_motivos').value = state.cad.motivos.join('\n');
  if ($('#cfg_overdue')) $('#cfg_overdue').checked = !!state.ui.overdueHighlight;

  // Status (somente leitura)
  const st = ['Aberto','Em atendimento','Aguardando','Programação','Concluído','Postado'];
  const wrap = $('#cfg_status'); if (wrap){ wrap.innerHTML=''; }
  st.forEach(s=>{
    const cls = ({
      'Aberto':'open','Em atendimento':'active','Aguardando':'waiting',
      'Programação':'prog','Concluído':'done','Postado':'posted'
    })[s] || 'open';
    wrap && wrap.appendChild(h('span',{class:`pill ${cls}`}, s));
  });

  on($('#cfg_save_modmot'),'click', ()=>{
    const mods = ($('#cfg_modulos')?.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
    const mots = ($('#cfg_motivos')?.value || '').split('\n').map(s=>s.trim()).filter(Boolean);
    if (!mods.length || !mots.length){ alert('Informe ao menos 1 módulo e 1 motivo.'); return; }
    state.cad.modulos = mods;
    state.cad.motivos = mots;
    persist();
    alert('Configurações salvas.');
    if (state.ui.currentTab==='fila') renderKanban();
  });

  on($('#cfg_save'),'click', ()=>{
    state.ui.overdueHighlight = $('#cfg_overdue').checked;
    persist();
    alert('Preferências salvas.');
    if (state.ui.currentTab==='ordens') renderOrdens();
  });
}

/* ==========================================================================
   11) PERFIL (avatar + dados)
   ========================================================================== */
function openProfileModal(){
  $('#pf_nome').value = state.profile.nome || '';
  $('#pf_nasc').value = state.profile.nascimento || '';
  $('#pf_setor').value = state.profile.setor || '';
  const prev = $('#pf_preview');
  prev.src = state.profile.foto || $('#profileAvatar').src;
  modalShow('#profileModal', true);
}

function initProfileModal(){
  on($('#btnProfile'), 'click', openProfileModal);

  // Preview da foto ao escolher arquivo
  on($('#pf_foto'), 'change', (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('#pf_preview').src = reader.result; };
    reader.readAsDataURL(file);
  });

  on($('#pf_cancel'), 'click', ()=> modalShow('#profileModal', false));

  on($('#pf_save'), 'click', ()=>{
    state.profile.nome        = $('#pf_nome').value.trim();
    state.profile.nascimento  = $('#pf_nasc').value;
    state.profile.setor       = $('#pf_setor').value.trim();
    const previewSrc          = $('#pf_preview').src;
    state.profile.foto        = previewSrc || state.profile.foto;

    persist();
    applyHeaderProfile();
    modalShow('#profileModal', false);
  });
}


/* ==========================================================================
   12) BOOTSTRAP
   ========================================================================== */

/* Auto-data no campo t_data e exibição BR no input[type="date"] */
document.addEventListener('DOMContentLoaded', () => {
  const tData = document.getElementById('t_data');
  if (tData) {
    // Preenche com hoje (ISO para o input funcionar)
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm   = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd   = String(hoje.getDate()).padStart(2, '0');
    tData.value = `${yyyy}-${mm}-${dd}`;

    // Mantém um "espelho" dd/mm/aaaa via atributo data-br (CSS mostra)
    const updateBR = () => {
      if (!tData.value) { tData.removeAttribute('data-br'); return; }
      const [y, m, d] = tData.value.split('-');
      tData.setAttribute('data-br', `${d}/${m}/${y}`);
    };
    tData.addEventListener('input', updateBR);
    updateBR();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Header
  initClock();
  initThemeToggle();
  applyHeaderProfile();
  initProfileModal();

  // Navegação
  initSidebar();
  initTabs();

  // Módulos
  initCalendarForm();
  initClientesForm();
  initKanbanForm();
  initKanbanClicks();   // delegação global do Kanban
  initEditModal();
  initLaunchModal();
  initUtils();
  initCalcs();

  // Render inicial de acordo com a aba
  if (state.ui.currentTab === 'home')      renderHome();
  if (state.ui.currentTab === 'fila')      renderKanban();
  if (state.ui.currentTab === 'clientes')  renderClientes();
  if (state.ui.currentTab === 'ordens')    renderOrdens();
  if (state.ui.currentTab === 'dashboard') renderKPIs();
  if (state.ui.currentTab === 'config')    initConfig();
});

/* ==========================================================================
   MODAIS AUXILIARES (pequenos utilitários usados pelas modais)
   ========================================================================== */
function modalShow(sel, show){
  const el = $(sel);
  if (!el) return;
  el.hidden = !show;
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
}


/* ==========================================================================
   DASHBOARD (KPIs) — função simples usada na aba Dashboard
   ========================================================================== */

function renderKPIs(){
  const wrap = $('#kpis');
  if (!wrap) return;
  wrap.innerHTML = '';

  const k = (label, val) => h('div',{class:'kpi'}, [h('h3',{},label), h('div',{class:'num'}, String(val))]);

  const totalTickets = state.tickets.length;
  const concluidos   = state.tickets.filter(t=>t.col==='concluido').length;
  const ordens       = state.ordens.length;
  const atrasadas    = state.ordens.filter(o=> isAtrasada(o.previsto)).length;

  wrap.appendChild(k('Tickets (total)', totalTickets));
  wrap.appendChild(k('Tickets concluídos', concluidos));
  wrap.appendChild(k('Ordens', ordens));
  wrap.appendChild(k('Ordens atrasadas', atrasadas));
}
