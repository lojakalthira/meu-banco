(function(){
  const state = {
    db: null,
    hidden: false // modo privado (não salva)
  };

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];

  function brl(v){
    return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
  }

  function pad2(n){ return String(n).padStart(2,"0"); }
  function nowLabel(){
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  async function loadDB(){
    const res = await fetch("./data/banco.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Falha ao carregar data/banco.json");
    return await res.json();
  }

  function toast(title, msg){
    let wrap = qs(".toastWrap");
    if(!wrap){
      wrap = document.createElement("div");
      wrap.className = "toastWrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `
      <div style="font-weight:900;margin-bottom:4px;">${escapeHtml(title)}</div>
      <div style="opacity:.85;font-size:13px;">${escapeHtml(msg)}</div>
    `;
    wrap.appendChild(el);
    setTimeout(()=> el.remove(), 3200);
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function setActiveNav(page){
    qsa("a.navlink").forEach(a=>{
      if(a.dataset.page === page) a.classList.add("active");
    });
  }

  function applyPrivacy(){
    const saldoEl = qs("#saldoText");
    const limiteEl = qs("#limiteText");
    const faturaEls = qsa("[data-money]");
    const eye = qs("#eyeBtn");

    if(eye){
      eye.innerHTML = state.hidden ? "👁‍🗨" : "👁";
      eye.title = state.hidden ? "Mostrar valores (P)" : "Esconder valores (P)";
    }

    if(saldoEl){
      saldoEl.textContent = state.hidden ? "R$ ••••" : brl(state.db?.contas?.saldo);
    }
    if(limiteEl){
      limiteEl.textContent = state.hidden ? "R$ ••••" : brl(state.db?.contas?.limite);
    }

    // elementos marcados
    faturaEls.forEach(el=>{
      const raw = el.getAttribute("data-money-raw");
      if(raw == null){
        el.setAttribute("data-money-raw", el.textContent);
      }
      el.textContent = state.hidden ? "R$ ••••" : brl(Number(el.getAttribute("data-money-raw-number") ?? raw));
    });
  }

  function togglePrivacy(){
    state.hidden = !state.hidden;
    applyPrivacy();
    toast("Privacidade", state.hidden ? "Valores ocultos" : "Valores visíveis");
  }

  function bindCommon(page){
    setActiveNav(page);

    const appName = qs("#appName");
    const userName = qs("#userName");
    if(appName) appName.textContent = state.db?.meta?.appName ?? "Meu Banco";
    if(userName) userName.textContent = state.db?.user?.nome ?? "Usuário";

    const timeText = qs("#timeText");
    if(timeText){
      timeText.textContent = `Atualizado às ${nowLabel()}`;
      setInterval(()=> timeText.textContent = `Atualizado às ${nowLabel()}`, 1000);
    }

    const eyeBtn = qs("#eyeBtn");
    if(eyeBtn) eyeBtn.addEventListener("click", togglePrivacy);

    document.addEventListener("keydown", (e)=>{
      if(e.key.toLowerCase() === "p"){
        togglePrivacy();
      }
    });
  }

  // ===== PÁGINAS =====

  function initHome(){
    const saldoEl = qs("#saldoText");
    const limiteEl = qs("#limiteText");

    if(saldoEl) saldoEl.textContent = brl(state.db?.contas?.saldo);
    if(limiteEl) limiteEl.textContent = brl(state.db?.contas?.limite);

    qsa("[data-action]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        toast("Ação", `${btn.dataset.action} (visual)`);
      });
    });

    applyPrivacy();
  }

  function initExtrato(){
    const list = qs("#extratoList");
    const q = qs("#q");
    const mes = qs("#mes");
    const tipo = qs("#tipo");
    const cat = qs("#cat");

    function monthKey(iso){
      // "YYYY-MM"
      return String(iso).slice(0,7);
    }

    const all = state.db?.extrato ?? [];
    const meses = Array.from(new Set(all.map(t=>monthKey(t.data)))).sort().reverse();
    mes.innerHTML = `<option value="">Todos os meses</option>` + meses.map(m=>`<option value="${m}">${m}</option>`).join("");

    const cats = Array.from(new Set(all.map(t=>t.categoria))).sort();
    cat.innerHTML = `<option value="">Todas categorias</option>` + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

    function render(){
      const qv = (q.value||"").trim().toLowerCase();
      const mv = mes.value;
      const tv = tipo.value;
      const cv = cat.value;

      let items = all.slice();

      if(mv) items = items.filter(i=>monthKey(i.data)===mv);
      if(tv) items = items.filter(i=>i.tipo===tv);
      if(cv) items = items.filter(i=>i.categoria===cv);
      if(qv){
        items = items.filter(i=>
          (i.titulo||"").toLowerCase().includes(qv) ||
          (i.categoria||"").toLowerCase().includes(qv)
        );
      }

      // totals
      const totalIn = items.filter(i=>i.tipo==="entrada").reduce((a,b)=>a+Number(b.valor||0),0);
      const totalOut = items.filter(i=>i.tipo==="saida").reduce((a,b)=>a+Number(b.valor||0),0);

      qs("#totalIn").textContent = brl(totalIn);
      qs("#totalOut").textContent = brl(totalOut);

      // table
      list.innerHTML = items.map(i=>{
        const badge = i.tipo==="entrada" ? `<span class="badgeOk">+ ${brl(i.valor)}</span>` : `<span class="badgeBad">- ${brl(i.valor)}</span>`;
        return `
          <tr>
            <td>${escapeHtml(i.data)}</td>
            <td>${escapeHtml(i.titulo)}</td>
            <td class="muted">${escapeHtml(i.categoria)}</td>
            <td>${badge}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="4" class="muted">Nada encontrado.</td></tr>`;

      // gráfico por categoria (saídas)
      const out = items.filter(i=>i.tipo==="saida");
      const map = new Map();
      out.forEach(i=>{
        map.set(i.categoria, (map.get(i.categoria)||0) + Number(i.valor||0));
      });
      const labels = [...map.keys()];
      const values = [...map.values()];

      const canvas = qs("#chart");
      if(canvas && window.Charts){
        Charts.drawBarChart(canvas, labels, values);
      }

      applyPrivacy();
    }

    [q, mes, tipo, cat].forEach(el=> el.addEventListener("input", render));
    render();
  }

  function initPix(){
    const chaves = qs("#pixChaves");
    const hist = qs("#pixHist");

    const keys = state.db?.pix?.chaves ?? [];
    chaves.innerHTML = keys.map(k=>`<div class="pill" style="justify-content:space-between;"><span>${escapeHtml(k)}</span><button class="btnIcon" data-copy="${escapeHtml(k)}">Copiar</button></div>`).join("") || `<div class="muted">Sem chaves</div>`;

    const h = (state.db?.pix?.historico ?? []).slice().sort((a,b)=>String(b.data).localeCompare(String(a.data)));
    hist.innerHTML = h.map(p=>{
      const badge = p.tipo==="recebido" ? `<span class="badgeOk">+ ${brl(p.valor)}</span>` : `<span class="badgeBad">- ${brl(p.valor)}</span>`;
      return `
        <tr>
          <td>${escapeHtml(p.data)}</td>
          <td>${escapeHtml(p.nome)}</td>
          <td class="muted">${escapeHtml(p.descricao||"")}</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="4" class="muted">Sem histórico.</td></tr>`;

    qsa("[data-copy]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        try{
          await navigator.clipboard.writeText(btn.dataset.copy);
          toast("PIX", "Copiado!");
        }catch{
          toast("PIX", "Não consegui copiar (permissão do navegador).");
        }
      });
    });

    applyPrivacy();
  }

  function initMetas(){
    const wrap = qs("#metasWrap");
    const metas = state.db?.metas ?? [];

    wrap.innerHTML = metas.map(m=>{
      const perc = Math.max(0, Math.min(100, (Number(m.atual||0) / Math.max(1, Number(m.meta||0))) * 100));
      return `
        <div class="card" style="margin-bottom:14px;">
          <div class="cardBody">
            <div class="row">
              <div style="font-weight:900;">${escapeHtml(m.nome)}</div>
              <div class="muted">${brl(m.atual)} / ${brl(m.meta)}</div>
            </div>
            <div style="margin-top:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:999px;overflow:hidden;">
              <div style="height:12px;width:${perc}%;background:rgba(255,255,255,.30);"></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <button class="btn" data-add="${m.id}">Adicionar valor (gera no Admin)</button>
              <span class="muted">${perc.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      `;
    }).join("") || `<div class="muted">Sem metas.</div>`;

    qsa("[data-add]").forEach(b=>{
      b.addEventListener("click", ()=>{
        toast("Metas", "Para alterar valores, use a página Admin e gere o banco.json.");
      });
    });

    applyPrivacy();
  }

  function initCartoes(){
    const wrap = qs("#cardsWrap");
    const cards = state.db?.cartoes ?? [];

    wrap.innerHTML = cards.map(c=>{
      const status = c.bloqueado ? `<span class="badgeBad">Bloqueado</span>` : `<span class="badgeOk">Ativo</span>`;
      return `
        <div class="card" style="margin-bottom:14px;">
          <div class="cardBody">
            <div class="row">
              <div style="font-weight:900;font-size:16px;">${escapeHtml(c.nome)} •••• ${escapeHtml(c.final)}</div>
              ${status}
            </div>
            <div class="muted" style="margin-top:6px;">Bandeira: ${escapeHtml(c.bandeira)} • Vencimento: dia ${escapeHtml(c.vencimentoDia)}</div>

            <hr class="sep"/>

            <div class="grid2">
              <div>
                <div class="muted">Limite</div>
                <div style="font-weight:900;font-size:20px;" data-money>${brl(c.limite)}</div>
                <span data-money-raw-number="${Number(c.limite)}" style="display:none;"></span>
              </div>
              <div>
                <div class="muted">Fatura atual</div>
                <div style="font-weight:900;font-size:20px;" data-money>${brl(c.fatura)}</div>
                <span data-money-raw-number="${Number(c.fatura)}" style="display:none;"></span>
              </div>
            </div>

            <div class="row" style="margin-top:12px;">
              <button class="btn" data-act="compra">Simular compra</button>
              <button class="btn" data-act="bloq">${c.bloqueado ? "Desbloquear (visual)" : "Bloquear (visual)"}</button>
            </div>
          </div>
        </div>
      `;
    }).join("") || `<div class="muted">Sem cartões.</div>`;

    qsa("[data-act]").forEach(b=>{
      b.addEventListener("click", ()=>{
        toast("Cartões", "Ação visual. Para alterar permanente, use Admin e gere o banco.json.");
      });
    });

    applyPrivacy();
  }

  function initConfig(){
    qsa("[data-theme]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        // tema visual só na hora, sem salvar.
        const t = btn.dataset.theme;
        if(t === "roxo"){
          document.documentElement.style.setProperty("--bg1", "#3a146a");
          document.documentElement.style.setProperty("--bg2", "#12081f");
        }
        if(t === "azul"){
          document.documentElement.style.setProperty("--bg1", "#0b2a6a");
          document.documentElement.style.setProperty("--bg2", "#071028");
        }
        if(t === "neon"){
          document.documentElement.style.setProperty("--bg1", "#001a13");
          document.documentElement.style.setProperty("--bg2", "#02040a");
          document.documentElement.style.setProperty("--brand", "#00ffcc");
          document.documentElement.style.setProperty("--brand2", "#00b3ff");
        }
        toast("Tema", "Aplicado (não salva)");
      });
    });
  }

  // ===== INIT =====
  async function init(page){
    state.db = await loadDB();
    bindCommon(page);

    if(page === "home") initHome();
    if(page === "extrato") initExtrato();
    if(page === "pix") initPix();
    if(page === "metas") initMetas();
    if(page === "cartoes") initCartoes();
    if(page === "config") initConfig();
  }

  window.App = { init, toast, brl, loadDB };
})();
