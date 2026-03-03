(function(){
  function drawBarChart(canvas, labels, values){
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = 220 * devicePixelRatio;
    ctx.clearRect(0,0,w,h);

    const pad = 18 * devicePixelRatio;
    const max = Math.max(1, ...values);
    const barW = (w - pad*2) / Math.max(1, values.length);

    // eixo base
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    ctx.fillRect(pad, h - pad, w - pad*2, 1 * devicePixelRatio);
    ctx.globalAlpha = 1;

    for(let i=0;i<values.length;i++){
      const v = values[i];
      const x = pad + i * barW + (barW*0.16);
      const bw = barW * 0.68;
      const bh = ((h - pad*2) * (v / max));
      const y = (h - pad) - bh;

      // barra (sem cor fixa: usa branco com alpha)
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, bw, bh);

      // topo destacado
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, bw, 2 * devicePixelRatio);

      // rótulo
      ctx.globalAlpha = 0.75;
      ctx.font = `${12*devicePixelRatio}px system-ui`;
      ctx.fillText(labels[i].slice(0,10), x, (h - pad + 14*devicePixelRatio));
    }
    ctx.globalAlpha = 1;
  }

  window.Charts = { drawBarChart };
})();
