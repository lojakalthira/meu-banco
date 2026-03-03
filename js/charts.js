(function(){
  function drawBarChart(canvas, labels, values){
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = 260 * devicePixelRatio;

    ctx.clearRect(0,0,w,h);

    const pad = 18 * devicePixelRatio;
    const chartW = w - pad*2;
    const chartH = h - pad*2;

    const max = Math.max(1, ...values);
    const barCount = Math.max(1, values.length);
    const gap = 10 * devicePixelRatio;
    const barW = Math.max(12 * devicePixelRatio, (chartW - gap*(barCount-1)) / barCount);

    // axis bg
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.strokeRect(pad, pad, chartW, chartH);

    // bars
    for(let i=0;i<values.length;i++){
      const v = values[i];
      const bh = (v / max) * (chartH - 20*devicePixelRatio);
      const x = pad + i*(barW+gap);
      const y = pad + chartH - bh;

      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(x, y, barW, bh);

      // label (short)
      ctx.fillStyle = "rgba(255,255,255,.70)";
      ctx.font = `${12*devicePixelRatio}px system-ui`;
      const txt = String(labels[i]||"").slice(0,10);
      ctx.fillText(txt, x, pad + chartH + 14*devicePixelRatio);
    }
  }

  window.Charts = { drawBarChart };
})();
