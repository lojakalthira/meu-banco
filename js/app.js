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

  function brlToNumber(txt){
    let t = String(txt||"").trim();
    if(!t) return 0;
    t = t.replace(/[R$\s]/g,"");
    if(t.includes(",")) t = t.replace(/\./g,"").replace(",",".");
    t = t.replace(/[^0-9.]/g,"");
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  function todayISO(){
    return new Date().toISOString().slice(0,10);
  }

  function txid(){
    return "KB-" + Math.random().toString(16).slice(2,10).toUpperCase() + "-" + Date.now().toString().slice(-6);
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

  function initPix(){
    // render histórico e chaves (do JSON)
    const chaves = qs("#pixChaves");
    const hist = qs("#pixHist");

    const keys = state.db?.pix?.chaves ?? [];
    if(chaves){
      chaves.innerHTML = keys.map(k=>`
        <div class="pill" style="justify-content:space-between;margin-bottom:10px;">
          <span>${escapeHtml(k)}</span>
          <button class="btnIcon" data-copy="${escapeHtml(k)}">Copiar</button>
        </div>
      `).join("") || `<div class="muted">Sem chaves</div>`;
    }

    const h = (state.db?.pix?.historico ?? []).slice().sort((a,b)=>String(b.data).localeCompare(String(a.data)));
    if(hist){
      hist.innerHTML = h.map(p=>{
        const badge = p.tipo==="recebido"
          ? `<span class="badgeOk">+ ${brl(p.valor)}</span>`
          : `<span class="badgeBad">- ${brl(p.valor)}</span>`;
        return `
          <tr>
            <td>${escapeHtml(p.data)}</td>
            <td>${escapeHtml(p.nome)}</td>
            <td class="muted">${escapeHtml(p.descricao||"")}</td>
            <td>${badge}</td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="4" class="muted">Sem histórico.</td></tr>`;
    }

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

    // ===== Wizard: step1 -> loading -> success -> comprovante PDF
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

    let source = "conta"; // "conta" | "cartao"
    let lastTx = null;

    function showStep(n){
      if(step1) step1.style.display = (n===1) ? "block" : "none";
      if(step2) step2.style.display = (n===2) ? "block" : "none";
      if(step3) step3.style.display = (n===3) ? "block" : "none";
    }

    function setSource(s){
      source = s;
      if(srcConta && srcCartao){
        srcConta.classList.toggle("active", s==="conta");
        srcCartao.classList.toggle("active", s==="cartao");
      }
      if(srcHint){
        if(s==="conta"){
          srcHint.textContent = `Vai sair da Conta (saldo: ${brl(state.db?.contas?.saldo)})`;
        }else{
          const c0 = (state.db?.cartoes ?? [])[0];
          srcHint.textContent = c0
            ? `Vai sair do Cartão (${c0.nome} •••• ${c0.final})`
            : `Vai sair do Cartão (nenhum cartão no banco.json)`;
        }
      }
    }

    if(srcConta) srcConta.addEventListener("click", ()=> setSource("conta"));
    if(srcCartao) srcCartao.addEventListener("click", ()=> setSource("cartao"));

    if(btnVoltar2) btnVoltar2.addEventListener("click", ()=> showStep(1));
    if(btnVoltar3) btnVoltar3.addEventListener("click", ()=> showStep(1));

    function openFromHash(){
      // se veio do home com #enviar, abre step1 normalmente
      // (pode expandir depois pra tabs)
      showStep(1);
    }
    openFromHash();
    setSource("conta");

    if(btnEnviar){
      btnEnviar.addEventListener("click", ()=>{
        const d = (dest?.value || "").trim();
        const v = brlToNumber(valor?.value || "");
        if(!d){
          toast("Pix", "Digite Nome/CPF/CNPJ ou Chave Pix.");
          return;
        }
        if(!(v > 0)){
          toast("Pix", "Digite um valor válido.");
          return;
        }

        // cria transação em memória (não salva)
        lastTx = {
          id: txid(),
          data: todayISO(),
          hora: nowLabel(),
          destino: d,
          valor: v,
          origem: source === "conta" ? "Conta" : "Cartão",
          app: state.db?.meta?.appName ?? "Meu Banco"
        };

        // loading
        showStep(2);

        // simula envio
        setTimeout(()=>{
          showStep(3);
          if(pixResumo){
            pixResumo.innerHTML = `
              <div><b>${escapeHtml(lastTx.origem)}</b> → <b>${escapeHtml(lastTx.destino)}</b></div>
              <div style="margin-top:6px;">Valor: <b>${brl(lastTx.valor)}</b></div>
              <div class="muted" style="margin-top:6px;">ID: ${escapeHtml(lastTx.id)} • ${escapeHtml(lastTx.data)} ${escapeHtml(lastTx.hora)}</div>
            `;
          }
        }, 1700);
      });
    }

    if(btnComprovante){
      btnComprovante.addEventListener("click", ()=>{
        if(!lastTx){
          toast("Comprovante", "Nenhuma transação para gerar.");
          return;
        }

        // Gera PDF com jsPDF (funciona de verdade)
        try{
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();

          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.text(`${lastTx.app} • Comprovante Pix`, 14, 18);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(12);

          const lines = [
            `Status: ENVIADO`,
            `Data/Hora: ${lastTx.data} ${lastTx.hora}`,
            `ID: ${lastTx.id}`,
            `Origem: ${lastTx.origem}`,
            `Destino: ${lastTx.destino}`,
            `Valor: ${brl(lastTx.valor)}`
          ];

          let y = 32;
          for(const l of lines){
            doc.text(l, 14, y);
            y += 8;
          }

          doc.setFontSize(10);
          doc.text("Documento gerado pelo seu site (GitHub Pages).", 14, y + 10);

          const filename = `comprovante_pix_${lastTx.id}.pdf`;
          doc.save(filename);

          toast("Comprovante", "PDF baixado!");
        }catch(e){
          toast("Comprovante", "Falha ao gerar PDF (jsPDF).");
        }
      });
    }

    applyPrivacy();
  }

  function initExtrato(){
    // (mantém sua versão anterior do extrato)
    const list = qs("#extratoList");
    const q = qs("#q");
    const mes = qs("#mes");
    const tipo = qs("#tipo");
    const cat = qs("#cat");

    function monthKey(iso){
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
                <div style="font-weight:900;font-size:20px;">${brl(c.limite)}</div>
              </div>
              <div>
                <div class="muted">Fatura atual</div>
                <div style="font-weight:900;font-size:20px;">${brl(c.fatura)}</div>
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
