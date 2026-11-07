(function(){
  function countLines(text, maxChars) {
    if (maxChars < 1) return Infinity;
    let lines = 1;
    let cur = 0;
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (len > maxChars) {
        if (cur > 0) lines++;
        lines += Math.ceil(len / maxChars) - 1;
        cur = len % maxChars || maxChars;
        continue;
      }
      if (cur === 0) cur = len;
      else if (cur + 1 + len <= maxChars) cur += 1 + len;
      else {
        lines++;
        cur = len;
      }
    }
    return lines;
  }
  function fitFontSize(boxW, boxH, text, minPx = 8, maxPx = 28, scale = 1) {
    const lo = Math.max(4, Math.round(minPx * scale));
    const hi = Math.max(lo, Math.round(maxPx * scale));
    for (let size = hi; size >= lo; size--) {
      const maxChars = Math.floor(boxW / (size * 0.52));
      const lines = countLines(text, maxChars);
      if (lines * size * 1.15 <= boxH) return size;
    }
    return lo;
  }
  const HOST_ID = "mangaflow-root";
  class OverlayRenderer {
    host;
    layers = /* @__PURE__ */ new Map();
    ro;
    raf = 0;
    showOriginal = false;
    fontScale = 1;
    onWindow = () => this.schedule();
    constructor() {
      this.host = document.createElement("div");
      this.host.id = HOST_ID;
      Object.assign(this.host.style, { position: "absolute", top: "0", left: "0", width: "0", height: "0", zIndex: "2147483000", pointerEvents: "none" });
      document.documentElement.appendChild(this.host);
      this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.schedule()) : void 0;
      window.addEventListener("resize", this.onWindow, { passive: true });
      window.addEventListener("scroll", this.onWindow, { passive: true });
      window.visualViewport?.addEventListener("resize", this.onWindow);
    }
    get layerCount() {
      return this.layers.size;
    }
    has(img) {
      return this.layers.has(img);
    }
    setShowOriginal(v) {
      this.showOriginal = v;
      this.host.style.display = v ? "none" : "";if(!v)this.schedule();
    }
    setFontScale(s) {
      this.fontScale = s;
      for (const l of this.layers.values()) l.lastW = -1;
      this.schedule();
    }
    render(img, bubbles) {
      this.remove(img);
      if (bubbles.length === 0 || !img.isConnected) return;
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.overflow = "hidden";
      const spans = bubbles.map((b) => {
        const d = document.createElement("div");
        Object.assign(d.style, {
          position: "absolute",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2px 3px",
          background: b.bg ?? "#ffffff",
          color: "#111111",
          fontFamily: '"Comic Neue","Comic Sans MS",system-ui,sans-serif',
          fontWeight: "700",
          lineHeight: "1.15",
          wordBreak: "break-word",
          overflow: "hidden",
          borderRadius: "6px"
        });
        d.textContent = b.tr;
        d.title = b.text+' (çift tıklayarak düzelt)';d.style.pointerEvents='auto';if(b.confidence<65)d.style.outline='1px dashed #e98b20';d.ondblclick=()=>{const tr=prompt('Türkçe metni düzelt:',b.tr);if(tr!==null){b.tr=tr;d.textContent=tr;this.setFontScale(this.fontScale);}};
        el.appendChild(d);
        return d;
      });
      this.host.appendChild(el);
      const layer = { img, el, bubbles, spans, lastW: -1, lastH: -1 };
      this.layers.set(img, layer);
      this.ro?.observe(img);
      this.position(layer);
    }
    remove(img) {
      const l = this.layers.get(img);
      if (!l) return;
      l.el.remove();
      this.layers.delete(img);
      this.ro?.unobserve(img);
    }
    clear() {
      for (const img of [...this.layers.keys()]) this.remove(img);
    }
    destroy() {
      this.clear();
      cancelAnimationFrame(this.raf);
      this.ro?.disconnect();
      window.removeEventListener("resize", this.onWindow);
      window.removeEventListener("scroll", this.onWindow);
      window.visualViewport?.removeEventListener("resize", this.onWindow);
      this.host.remove();
    }
    schedule() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        if (this.showOriginal) return;
        const vh = window.innerHeight;
        for (const [img, l] of [...this.layers]) {
          if (!img.isConnected) {
            this.remove(img);
            continue;
          }
          const r = img.getBoundingClientRect();
          if (r.bottom < -vh || r.top > vh * 2) continue;
          this.position(l);
        }
      });
    }
    position(l) {
      const r = l.img.getBoundingClientRect();
      let W=r.width,H=r.height;let ox=0,oy=0;const cs=getComputedStyle(l.img);const nw=l.img.naturalWidth,nh=l.img.naturalHeight;
      if(['contain','cover','scale-down','none'].includes(cs.objectFit)){let scale=cs.objectFit==='cover'?Math.max(W/nw,H/nh):Math.min(W/nw,H/nh);if(cs.objectFit==='none')scale=1;if(cs.objectFit==='scale-down')scale=Math.min(1,scale);W=nw*scale;H=nh*scale;const pos=cs.objectPosition.split(' ');const frac=v=>v?.endsWith('%')?parseFloat(v)/100:0.5;ox=(r.width-W)*frac(pos[0]);oy=(r.height-H)*frac(pos[1]);}

      l.el.style.left = `${r.left + window.scrollX}px`;
      l.el.style.top = `${r.top + window.scrollY}px`;
      if (W === l.lastW && H === l.lastH) return;
      l.lastW = W;
      l.lastH = H;
      l.el.style.width = `${r.width}px`;
      l.el.style.height = `${r.height}px`;
      l.bubbles.forEach((b, i) => {
        const d = l.spans[i];
        if (!d) return;
        const padX = b.box.w * W * 0.06;
        const padY = b.box.h * H * 0.12;
        const w = b.box.w * W + padX * 2;
        const h = b.box.h * H + padY * 2;
        d.style.left = `${ox + b.box.x * W - padX}px`;
        d.style.top = `${oy + b.box.y * H - padY}px`;
        d.style.width = `${w}px`;
        d.style.height = `${h}px`;
        d.style.fontSize = `${fitFontSize(w - 6, h - 4, b.tr, 8, 28, this.fontScale)}px`;
      });
    }
  }

 globalThis.MangaFlowOverlay={OverlayRenderer,HOST_ID};
})();
