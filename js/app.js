(function(){
  const STORAGE_KEY = "kbank_db_v1";

  const state = {
    db: null,
    hidden: false
  };

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];

  const brl = (v)=> new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));

  const pad2 = (n)=> String(n).padStart(2,"0");
  const nowLabel = ()=>{
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  const todayISO = ()=> new Date().toISOString().slice(0,10);

  const escapeHtml = (str)=> String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const brlToNumber = (txt)=>{
    let t = String(txt||"").trim();
    if(!t) return 0;
    t = t.replace(/[R$\s]/g,"");
    if(t.includes(",")) t = t.replace(/\./g,"").replace(",",".");
    t = t.replace(/[^0-9.]/g,"");
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  };

  const uid = (prefix)=> prefix + "-" + Math.random().toString(16).slice(2,10).toUpperCase() + "-" + Date.now().toString().slice(-6);

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
    setTimeout(()=> el.remove(), 3800);
  }

  async function loadDefaultJSON(){
    const res = await fetch("./data/banco.json", { cache:"no-store" });
    if(!res.ok) throw new Error("Falha ao carregar data/banco.json");
    return await res.json();
  }

  function saveDB(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
  }

  function getDBFromStorage(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    try{ return JSON.parse(raw); } catch { return null; }
  }

  async function ensureDB(){
    const stored = getDBFromStorage();
    if(stored){
      state.db = stored;
      return;
    }
    state.db = await loadDefaultJSON();
    saveDB();
  }

  function resetDB(){
    localStorage.removeItem(STORAGE_KEY);
  }

  function setTheme(theme){
    state.db.meta.theme = theme;
    saveDB();

    // só muda variáveis principais
    if(theme === "roxo"){
      document.documentElement.style.setProperty("--bg1", "#1a0f2e");
      document.documentElement.style.setProperty("--bg2", "#0b0813");
      document.documentElement.style.setProperty("--brand", "#7c3aed");
      document.documentElement.style.setProperty("--brand2", "#a855f7");
    }
    if(theme === "azul"){
      document.documentElement.style.setProperty("--bg1", "#0b2a6a");
      document.documentElement.style.setProperty("--bg2", "#071028");
      document.documentElement.style.setProperty("--brand", "#2563eb");
      document.documentElement.style.setProperty("--brand2", "#60a5fa");
    }
    if(theme === "neon"){
      document.documentElement.style.setProperty("--bg1", "#001a13");
      document.documentElement.style.setProperty("--bg2", "#02040a");
      document.documentElement.style.setProperty("--brand", "#00ffcc");
      document.documentElement.style.setProperty("--brand2", "#00b3ff");
    }
  }

  function applyPrivacy(){
    const saldoEl = qs("#saldoText");
    const limiteEl = qs("#limiteText");
    const eye = qs("#eyeBtn");

    if(eye){
      eye.innerHTML = state.hidden ? "👁‍🗨" : "👁";
      eye.title = state.hidden ? "Mostrar valores (P)" : "Esconder valores (P)";
    }

    if(saldoEl) saldoEl.textContent = state.hidden ? "R$ ••••" : brl(state.db?.contas?.saldo);
    if(limiteEl) limiteEl.textContent = state.hidden ? "R$ ••••" : brl(state.db?.contas?.limite);
  }

  function togglePrivacy(){
    state.hidden = !state.hidden;
    applyPrivacy();
    toast("Privacidade", state.hidden ? "Valores ocultos" : "Valores visíveis");
  }

  function setActiveNav(page){
    qsa("a.navlink").forEach(a=>{
      if(a.dataset.page === page) a.classList.add("active");
    });
  }

  function bindCommon(page){
    setActiveNav(page);

    // theme
    setTheme(state.db?.meta?.theme || "roxo");

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
      if(e.key.toLowerCase() === "p") togglePrivacy();
    });
  }

  // ====== Mutations (atualizam e salvam) ======

  function addExtrato({ tipo, titulo, categoria, valor, data=todayISO() }){
    state.db.extrato.unshift({
      id: uid("T"),
      data,
      tipo,
      titulo,
      categoria,
      valor: Number(valor||0)
    });
  }

  function addPixHistorico({ tipo, nome, valor, descricao, data=todayISO() }){
    state.db.pix.historico.unshift({
      id: uid("KB"),
      data,
      tipo, // "enviado" | "recebido"
      nome,
      valor: Number(valor||0),
      descricao: descricao || (tipo==="recebido" ? "Pix recebido" : "Pix enviado")
    });
  }

  function sendPix({ destino, valor, origem }){ // origem: "conta" | "cartao"
    const v = Number(valor||0);

    if(origem === "conta"){
      if(state.db.contas.saldo < v){
        return { ok:false, msg:"Saldo insuficiente." };
      }
      state.db.contas.saldo = Number(state.db.contas.saldo) - v;
    }else{
      const card = state.db.cartoes?.[0];
      if(!card) return { ok:false, msg:"Não tem cartão cadastrado." };
      if(card.bloqueado) return { ok:false, msg:"Cartão está bloqueado." };

      const limiteDisp = Number(card.limite) - Number(card.fatura);
      if(limiteDisp < v) return { ok:false, msg:"Limite do cartão insuficiente." };
      card.fatura = Number(card.fatura) + v;
    }

    addPixHistorico({
      tipo:"enviado",
      nome: destino,
      valor: v,
      descricao: `Pix enviado (${origem === "conta" ? "Conta" : "Cartão"})`
    });

    addExtrato({
      tipo:"saida",
      titulo:"Pix enviado",
      categoria:"Pix",
      valor: v
    });

    saveDB();
    return { ok:true };
  }

  function receivePix({ nome, valor }){
    const v = Number(valor||0);
    state.db.contas.saldo = Number(state.db.contas.saldo) + v;

    addPixHistorico({
      tipo:"recebido",
      nome,
      valor: v,
      descricao:"Pix recebido"
    });

    addExtrato({
      tipo:"entrada",
      titulo:"Pix recebido",
      categoria:"Pix",
      valor: v
    });

    saveDB();
  }

  function addMetaValue(metaId, valor){
    const v = Number(valor||0);
    const m = state.db.metas.find(x=>x.id === metaId);
    if(!m) return { ok:false, msg:"Meta não encontrada." };
    if(state.db.contas.saldo < v) return { ok:false, msg:"Saldo insuficiente." };

    state.db.contas.saldo = Number(state.db.contas.saldo) - v;
    m.atual = Number(m.atual) + v;

    addExtrato({
      tipo:"saida",
      titulo:`Aporte em meta`,
      categoria:"Metas",
      valor: v
    });

    saveDB();
    return { ok:true };
  }

  function cardPurchase(valor, titulo="Compra no cartão", categoria="Cartão"){
    const v = Number(valor||0);
    const card = state.db.cartoes?.[0];
    if(!card) return { ok:false, msg:"Não tem cartão cadastrado." };
    if(card.bloqueado) return { ok:false, msg:"Cartão bloqueado." };
    const limiteDisp = Number(card.limite) - Number(card.fatura);
    if(limiteDisp < v) return { ok:false, msg:"Limite insuficiente." };

    card.fatura = Number(card.fatura) + v;

    addExtrato({
      tipo:"saida",
      titulo,
      categoria,
      valor: v
    });

    saveDB();
    return { ok:true };
  }

  function payCardBill(){
    const card = state.db.cartoes?.[0];
    if(!card) return { ok:false, msg:"Não tem cartão." };
    const f = Number(card.fatura||0);
    if(f <= 0) return { ok:false, msg:"Fatura já está zerada." };
    if(state.db.contas.saldo < f) return { ok:false, msg:"Saldo insuficiente." };

    state.db.contas.saldo = Number(state.db.contas.saldo) - f;
    card.fatura = 0;

    addExtrato({
      tipo:"saida",
      titulo:"Pagamento de fatura",
      categoria:"Cartão",
      valor: f
    });

    saveDB();
    return { ok:true };
  }

  // ===== Pages =====

  function initHome(){
    qs("#saldoText").textContent = brl(state.db.contas.saldo);
    qs("#limiteText").textContent = brl(state.db.contas.limite);

    qsa("[data-action]").forEach(el=>{
      el.addEventListener("click", ()=>{
        toast("Ação", `${el.dataset.action} (em breve)`);
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

    const all = state.db.extrato || [];

    const monthKey = (iso)=> String(iso).slice(0,7);

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

      const totalIn = items.filter(i=>i.tipo==="entrada").reduce((a,b)=>a+Number(b.valor||0),0);
      const totalOut = items.filter(i=>i.tipo==="saida").reduce((a,b)=>a+Number(b.valor||0),0);

      qs("#totalIn").textContent = brl(totalIn);
      qs("#totalOut").textContent = brl(totalOut);

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

      // chart por categoria (saídas)
      const out = items.filter(i=>i.tipo==="saida");
      const map = new Map();
      out.forEach(i=> map.set(i.categoria, (map.get(i.categoria)||0) + Number(i.valor||0)));

      const labels = [...map.keys()];
      const values = [...map.values()];
      const canvas = qs("#chart");
      if(canvas && window.Charts){
        Charts.drawBarChart(canvas, labels, values);
      }
    }

    [q, mes, tipo, cat].forEach(el=> el.addEventListener("input", render));
    render();
    applyPrivacy();
  }

  function initPix(){
    const histBody = qs("#pixHist");
    const chaves = qs("#pixChaves");

    function renderChaves(){
      const keys = state.db.pix.chaves || [];
      chaves.innerHTML = keys.map((k,idx)=>`
        <div class="pill" style="justify-content:space-between;margin-bottom:10px;">
          <span>${escapeHtml(k)}</span>
          <div style="display:flex;gap:8px;">
            <button class="btnIcon" data-copy="${escapeHtml(k)}">Copiar</button>
            <button class="btnIcon" data-del="${idx}">✖</button>
          </div>
        </div>
      `).join("") || `<div class="muted">Sem chaves</div>`;

      qsa("[data-copy]").forEach(btn=>{
        btn.onclick = async ()=>{
          try{ await navigator.clipboard.writeText(btn.dataset.copy); toast("PIX", "Copiado!"); }
          catch{ toast("PIX", "Sem permissão para copiar."); }
        };
      });

      qsa("[data-del]").forEach(btn=>{
        btn.onclick = ()=>{
          const idx = Number(btn.dataset.del);
          state.db.pix.chaves.splice(idx,1);
          saveDB();
          toast("PIX", "Chave removida.");
          renderChaves();
        };
      });
    }

    function renderHist(){
      const h = (state.db.pix.historico || []).slice();
      histBody.innerHTML = h.map(p=>{
        const isIn = p.tipo==="recebido";
        const badge = isIn ? `<span class="badgeOk">+ ${brl(p.valor)}</span>` : `<span class="badgeBad">- ${brl(p.valor)}</span>`;
        const detalhe = p.descricao || (isIn ? "Pix recebido" : "Pix enviado");
        return `
          <tr>
            <td>${escapeHtml(p.data)}</td>
            <td>${escapeHtml(p.nome)}</td>
            <td class="muted">${escapeHtml(detalhe)}</td>
            <td>${badge}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="4" class="muted">Sem histórico.</td></tr>`;
    }

    // Wizard
    const step1 = qs("#pixStep1");
    const step2 = qs("#pixStep2");
    const step3 = qs("#pixStep3");

    const dest = qs("#pixDest");
    const valor = qs("#pixValor");

    const srcConta = qs("#srcConta");
    const srcCartao = qs("#srcCartao");
    const srcHint = qs("#srcHint");

    const btnEnviar = qs("#btnEnviar");
    const btnVoltar2 = qs("#btnVoltar2");
    const btnVoltar3 = qs("#btnVoltar3");

    const pixResumo = qs("#pixResumo");
    const btnComprovante = qs("#btnComprovante");

    const btnSimRecebido = qs("#btnSimRecebido");
    const btnAddKey = qs("#btnAddKey");
    const keyInput = qs("#pixKey");

    let source = "conta";
    let lastTx = null;

    const showStep = (n)=>{
      step1.style.display = n===1 ? "block" : "none";
      step2.style.display = n===2 ? "block" : "none";
      step3.style.display = n===3 ? "block" : "none";
    };

    const setSource = (s)=>{
      source = s;
      srcConta.classList.toggle("active", s==="conta");
      srcCartao.classList.toggle("active", s==="cartao");

      if(s==="conta"){
        srcHint.textContent = `Vai sair da Conta (saldo: ${brl(state.db.contas.saldo)})`;
      }else{
        const c0 = state.db.cartoes?.[0];
        srcHint.textContent = c0
          ? `Vai sair do Cartão (${c0.nome} •••• ${c0.final})`
          : `Vai sair do Cartão (nenhum cartão cadastrado)`;
      }
    };

    srcConta.onclick = ()=> setSource("conta");
    srcCartao.onclick = ()=> setSource("cartao");

    btnVoltar2.onclick = ()=> showStep(1);
    btnVoltar3.onclick = ()=> showStep(1);

    btnEnviar.onclick = ()=>{
      const d = (dest.value||"").trim();
      const v = brlToNumber(valor.value||"");

      if(!d){ toast("Pix", "Digite Nome/CPF/CNPJ ou Chave Pix."); return; }
      if(!(v>0)){ toast("Pix", "Digite um valor válido."); return; }

      showStep(2);

      setTimeout(()=>{
        const r = sendPix({ destino:d, valor:v, origem:source });
        if(!r.ok){
          showStep(1);
          toast("Pix", r.msg);
          return;
        }

        lastTx = { destino:d, valor:v, origem:source, data:todayISO(), hora:nowLabel(), id: uid("KB") };

        toast("Pix enviado", `${d} • - ${brl(v)} (${source==="conta"?"Conta":"Cartão"})`);

        renderHist();
        setSource(source); // atualiza hint com novo saldo/fatura

        pixResumo.innerHTML = `
          <div><b>${escapeHtml(source==="conta"?"Conta":"Cartão")}</b> → <b>${escapeHtml(d)}</b></div>
          <div style="margin-top:6px;">Valor: <b>${brl(v)}</b></div>
          <div class="muted" style="margin-top:6px;">${escapeHtml(lastTx.data)} ${escapeHtml(lastTx.hora)}</div>
        `;

        showStep(3);
      }, 1400);
    };

    btnComprovante.onclick = ()=>{
      if(!lastTx){ toast("Comprovante", "Nada para gerar."); return; }
      try{
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`${state.db.meta.appName} • Comprovante Pix`, 14, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        const lines = [
          `Status: ENVIADO`,
          `Data/Hora: ${lastTx.data} ${lastTx.hora}`,
          `Origem: ${lastTx.origem === "conta" ? "Conta" : "Cartão"}`,
          `Destino: ${lastTx.destino}`,
          `Valor: ${brl(lastTx.valor)}`
        ];

        let y = 34;
        for(const l of lines){ doc.text(l, 14, y); y += 8; }

        doc.setFontSize(10);
        doc.text("Gerado pelo seu app (localStorage).", 14, y + 10);

        doc.save(`comprovante_pix_${Date.now()}.pdf`);
        toast("Comprovante", "PDF baixado!");
      }catch{
        toast("Comprovante", "Falha ao gerar PDF.");
      }
    };

    btnSimRecebido.onclick = ()=>{
      const nome = (prompt("Nome de quem enviou?")||"").trim();
      if(!nome){ toast("Pix recebido", "Cancelado."); return; }
      const v = brlToNumber(prompt("Valor recebido? (ex: 50,00)")||"");
      if(!(v>0)){ toast("Pix recebido", "Valor inválido."); return; }

      receivePix({ nome, valor:v });
      toast("Pix recebido", `${nome} • + ${brl(v)}`);

      renderHist();
      setSource(source); // atualiza hint com novo saldo
    };

    btnAddKey.onclick = ()=>{
      const k = (keyInput.value||"").trim();
      if(!k){ toast("PIX", "Digite uma chave."); return; }
      state.db.pix.chaves.unshift(k);
      keyInput.value = "";
      saveDB();
      toast("PIX", "Chave adicionada.");
      renderChaves();
    };

    // init
    showStep(1);
    renderHist();
    renderChaves();
    setSource("conta");
    applyPrivacy();
  }

  function initMetas(){
    const wrap = qs("#metasWrap");
    const metas = state.db.metas || [];

    function render(){
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
                <button class="btn primary" data-add="${escapeHtml(m.id)}">Adicionar valor</button>
                <span class="muted">${perc.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        `;
      }).join("") || `<div class="muted">Sem metas.</div>`;

      qsa("[data-add]").forEach(btn=>{
        btn.onclick = ()=>{
          const id = btn.dataset.add;
          const v = brlToNumber(prompt("Quanto você quer adicionar? (sai do saldo)")||"");
          if(!(v>0)) return toast("Metas", "Valor inválido.");
          const r = addMetaValue(id, v);
          if(!r.ok) return toast("Metas", r.msg);
          toast("Metas", `Aporte de ${brl(v)} feito!`);
          render();
        };
      });

      applyPrivacy();
    }

    render();
  }

  function initCartoes(){
    const wrap = qs("#cardsWrap");
    const cards = state.db.cartoes || [];

    function render(){
      wrap.innerHTML = cards.map(c=>{
        const status = c.bloqueado ? `<span class="badgeBad">Bloqueado</span>` : `<span class="badgeOk">Ativo</span>`;
        const disp = Number(c.limite) - Number(c.fatura);
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
                  <div style="font-weight:900;font-size:20px;">${brl(c.limite)}</div>
                  <div class="muted">Disponível: ${brl(disp)}</div>
                </div>
                <div>
                  <div class="muted">Fatura atual</div>
                  <div style="font-weight:900;font-size:20px;">${brl(c.fatura)}</div>
                  <button class="btn" data-pay="1" style="margin-top:10px;">Pagar fatura</button>
                </div>
              </div>

              <div class="row" style="margin-top:12px;">
                <button class="btn primary" data-buy="1">Simular compra</button>
                <button class="btn" data-lock="1">${c.bloqueado ? "Desbloquear" : "Bloquear"}</button>
              </div>
            </div>
          </div>
        `;
      }).join("") || `<div class="muted">Sem cartões.</div>`;

      qsa("[data-lock]").forEach(btn=>{
        btn.onclick = ()=>{
          const c = cards[0];
          c.bloqueado = !c.bloqueado;
          saveDB();
          toast("Cartões", c.bloqueado ? "Cartão bloqueado." : "Cartão desbloqueado.");
          render();
        };
      });

      qsa("[data-buy]").forEach(btn=>{
        btn.onclick = ()=>{
          const v = brlToNumber(prompt("Valor da compra?")||"");
          if(!(v>0)) return toast("Cartões", "Valor inválido.");
          const r = cardPurchase(v, "Compra no cartão", "Cartão");
          if(!r.ok) return toast("Cartões", r.msg);
          toast("Compra", `Aprovada: - ${brl(v)}`);
          render();
        };
      });

      qsa("[data-pay]").forEach(btn=>{
        btn.onclick = ()=>{
          const r = payCardBill();
          if(!r.ok) return toast("Fatura", r.msg);
          toast("Fatura", "Paga com sucesso.");
          render();
        };
      });

      applyPrivacy();
    }

    render();
  }

  function initConfig(){
    qs("#themeNow").textContent = state.db.meta.theme || "roxo";

    qsa("[data-theme]").forEach(btn=>{
      btn.onclick = ()=>{
        const t = btn.dataset.theme;
        setTheme(t);
        qs("#themeNow").textContent = t;
        toast("Tema", `Tema ${t} aplicado.`);
      };
    });

    qs("#btnExport").onclick = ()=>{
      const blob = new Blob([JSON.stringify(state.db, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "backup_kbank.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Backup", "Arquivo baixado.");
    };

    qs("#btnImport").onclick = async ()=>{
      const input = qs("#importFile");
      const f = input.files?.[0];
      if(!f) return toast("Importar", "Escolha um arquivo .json.");
      try{
        const txt = await f.text();
        const data = JSON.parse(txt);
        state.db = data;
        saveDB();
        toast("Importar", "Backup importado! Recarregando…");
        setTimeout(()=> location.reload(), 700);
      }catch{
        toast("Importar", "JSON inválido.");
      }
    };

    qs("#btnReset").onclick = ()=>{
      if(confirm("Resetar tudo para o banco.json original?")){
        resetDB();
        toast("Reset", "Feito! Recarregando…");
        setTimeout(()=> location.reload(), 700);
      }
    };
  }

  function initAdmin(){
    // “Admin” agora vira painel de edição dentro do app (salvando no navegador)
    qs("#nome").value = state.db.user.nome || "";
    qs("#app").value = state.db.meta.appName || "";
    qs("#saldo").value = String(state.db.contas.saldo || 0).replace(".", ",");
    qs("#limite").value = String(state.db.contas.limite || 0).replace(".", ",");

    qs("#btnSaveMain").onclick = ()=>{
      state.db.user.nome = (qs("#nome").value||"").trim() || state.db.user.nome;
      state.db.meta.appName = (qs("#app").value||"").trim() || state.db.meta.appName;
      state.db.contas.saldo = brlToNumber(qs("#saldo").value);
      state.db.contas.limite = brlToNumber(qs("#limite").value);
      saveDB();
      toast("Salvo", "Dados atualizados!");
      setTimeout(()=> location.reload(), 500);
    };

    qs("#btnAddTrans").onclick = ()=>{
      const titulo = (qs("#tTitulo").value||"").trim() || "Transação";
      const categoria = (qs("#tCat").value||"").trim() || "Outros";
      const tipo = qs("#tTipo").value;
      const valor = brlToNumber(qs("#tValor").value);
      const data = (qs("#tData").value||"").trim() || todayISO();
      if(!(valor>0)) return toast("Extrato", "Valor inválido.");

      addExtrato({ tipo, titulo, categoria, valor, data });

      if(tipo === "entrada") state.db.contas.saldo += valor;
      else state.db.contas.saldo -= valor;

      saveDB();
      toast("Extrato", "Adicionado!");
      qs("#tTitulo").value = "";
      qs("#tCat").value = "";
      qs("#tValor").value = "";
      renderAdminLists();
    };

    qs("#btnAddMeta").onclick = ()=>{
      const nome = (qs("#mNome").value||"").trim() || "Nova meta";
      const meta = brlToNumber(qs("#mMeta").value);
      const atual = brlToNumber(qs("#mAtual").value);
      state.db.metas.unshift({ id: uid("M"), nome, meta, atual });
      saveDB();
      toast("Metas", "Meta adicionada!");
      qs("#mNome").value = "";
      qs("#mMeta").value = "";
      qs("#mAtual").value = "";
      renderAdminLists();
    };

    qs("#btnAddKey").onclick = ()=>{
      const k = (qs("#pixKey").value||"").trim();
      if(!k) return toast("Pix", "Digite uma chave.");
      state.db.pix.chaves.unshift(k);
      saveDB();
      toast("Pix", "Chave adicionada!");
      qs("#pixKey").value = "";
      renderAdminLists();
    };

    qs("#btnAddCard").onclick = ()=>{
      const nome = (qs("#cNome").value||"").trim() || "Cartão";
      const bandeira = qs("#cBand").value;
      let final = (qs("#cFinal").value||"").trim().replace(/[^0-9]/g,"").slice(0,4);
      if(final.length !== 4) return toast("Cartões", "Final precisa ter 4 dígitos.");
      const limite = brlToNumber(qs("#cLimite").value);
      const fatura = brlToNumber(qs("#cFatura").value);
      const vencimentoDia = Math.max(1, Math.min(31, Number(qs("#cVenc").value||10)));

      state.db.cartoes.unshift({
        id: uid("C"),
        nome, bandeira, final,
        limite, fatura,
        vencimentoDia,
        bloqueado: false
      });
      saveDB();
      toast("Cartões", "Cartão adicionado!");
      renderAdminLists();
    };

    function renderAdminLists(){
      // extrato
      const ex = state.db.extrato.slice(0,10);
      qs("#prevTrans").innerHTML = ex.map(t=>`
        <tr>
          <td>${escapeHtml(t.data)}</td>
          <td>${escapeHtml(t.titulo)}</td>
          <td class="muted">${escapeHtml(t.categoria)}</td>
          <td>${t.tipo==="entrada" ? `<span class="badgeOk">+ ${brl(t.valor)}</span>` : `<span class="badgeBad">- ${brl(t.valor)}</span>`}</td>
        </tr>
      `).join("") || `<tr><td colspan="4" class="muted">Sem transações</td></tr>`;

      // metas
      const ms = state.db.metas.slice(0,10);
      qs("#prevMetas").innerHTML = ms.map(m=>`
        <tr>
          <td>${escapeHtml(m.nome)}</td>
          <td>${brl(m.atual)}</td>
          <td>${brl(m.meta)}</td>
          <td></td>
        </tr>
      `).join("") || `<tr><td colspan="4" class="muted">Sem metas</td></tr>`;

      // chaves
      const keys = state.db.pix.chaves.slice(0,8);
      qs("#prevKeys").innerHTML = keys.map(k=>`
        <div class="pill" style="justify-content:space-between;">
          <span>${escapeHtml(k)}</span>
        </div>
      `).join("") || `<div class="muted">Sem chaves</div>`;

      // cards
      const cs = state.db.cartoes.slice(0,6);
      qs("#prevCards").innerHTML = cs.map(c=>`
        <tr>
          <td>${escapeHtml(c.nome)}</td>
          <td>•••• ${escapeHtml(c.final)}</td>
          <td>${c.bloqueado ? "Bloqueado" : "Ativo"}</td>
          <td></td>
        </tr>
      `).join("") || `<tr><td colspan="4" class="muted">Sem cartões</td></tr>`;
    }

    renderAdminLists();
    applyPrivacy();
  }

  async function init(page){
    await ensureDB();
    // garante estrutura
    state.db.pix = state.db.pix || { chaves:[], historico:[] };
    state.db.pix.chaves = state.db.pix.chaves || [];
    state.db.pix.historico = state.db.pix.historico || [];
    state.db.extrato = state.db.extrato || [];
    state.db.metas = state.db.metas || [];
    state.db.cartoes = state.db.cartoes || [];
    state.db.contas = state.db.contas || { saldo:0, limite:0 };
    state.db.user = state.db.user || { nome:"Usuário" };
    state.db.meta = state.db.meta || { appName:"Meu Banco", theme:"roxo" };

    bindCommon(page);

    if(page==="home") initHome();
    if(page==="extrato") initExtrato();
    if(page==="pix") initPix();
    if(page==="metas") initMetas();
    if(page==="cartoes") initCartoes();
    if(page==="config") initConfig();
    if(page==="admin") initAdmin();
  }

  window.App = { init, toast, brl };
})();
