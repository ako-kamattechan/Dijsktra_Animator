/* App Parameters */
const NODE_RADIUS = 50;
const NODE_HIT_RADIUS = 58;
const NODE_DELETE_RADIUS = 58;
const EDGE_ENDPOINT_SKIP = 55;
const EDGE_HIT_TOLERANCE = 6;

window.Utils = (function(){

  /* Global editor state */
  let state = {
    nodes: [],
    edges: [],
    sourceId: null,

    animating: false,
    cancelAnim: null,

    hover: { node: null, edge: null },

    svg: null,
    tableEl: null,

    nextId: 0,
    maxNodes: 16,

    focusMode: false,
    modalOpen: false
  };


  /* Helpers */
  const byId = (arr, id) => arr.find(x => x.id === id);
  const buildPath = (prev, t) => { const p=[]; let cur=t; while(cur){ p.unshift(cur); cur=prev[cur]; } return p; };
  const formatDist = x => Number.isFinite(x) ? x : "∞";
  const sleep = ms => new Promise(r => state.cancelAnim = setTimeout(r, ms));

  const idFromIndex = i => {
    const A=65; let n=i, s="";
    do { s = String.fromCharCode(A + (n % 26)) + s; n = Math.floor(n/26) - 1; }
    while(n >= 0);
    return s;
  };

  function uniqueId(){
    return idFromIndex(state.nextId++);
  }


  function circleLayoutIfMissing(nodes, w=1200, h=800, r=280){
    const cx=w/2, cy=h/2;
    if (nodes.some(n => typeof n.x !== "number" || typeof n.y !== "number")) {
      nodes.forEach((n,i)=>{
        const t = 2*Math.PI*i/nodes.length;
        n.x = Math.round(cx + r*Math.cos(t));
        n.y = Math.round(cy + r*Math.sin(t));
      });
    }
  }

  function clearSVG(){
    state.svg.gEdges.innerHTML="";
    state.svg.gEdgeLabels.innerHTML="";
    state.svg.gNodes.innerHTML="";
    state.svg.gNodeLabels.innerHTML="";
  }


  /* SVG Rendering */
  function drawGraph(dist={}, prev={}, current=null, settled=new Set(), hiEdge=null){
    clearSVG();
    const {nodes,edges} = state;

    /* Edges */
    for (const e of edges){
      const A = byId(nodes,e.a), B = byId(nodes,e.b);
      if (!A || !B)
        continue;

      let cls = "edge";
      const isHi = hiEdge && ((hiEdge.a===e.a && hiEdge.b===e.b)||(hiEdge.a===e.b&&hiEdge.b===e.a));

      if (isHi)
        cls += " highlight";

      if (!state.animating && state.hover.edge === e)
        cls += " hover";

      const line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",A.x); line.setAttribute("y1",A.y);
      line.setAttribute("x2",B.x); line.setAttribute("y2",B.y);
      const [u,v] = (e.a < e.b) ? [e.a,e.b] : [e.b,e.a];
      line.setAttribute("id",`edge-${u}-${v}`);
      line.setAttribute("class",cls);

      line.style.pointerEvents = "stroke";

      line.addEventListener("dblclick",(ev)=>{
        ev.stopPropagation();
        EdgeEditor.open(ev.clientX,ev.clientY,e,(newW)=>{
          e.w=newW;
          const r = runDijkstra(state.nodes,state.edges,state.sourceId);
          drawGraph(r.dist,r.prev);
          renderTable(r.dist,r.prev);
        });
      });

      state.svg.gEdges.appendChild(line);

      /* Label */
      const mx = (A.x + B.x)/2 + 1;
      const my = (A.y + B.y)/2 + 13;

      const bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
      bg.setAttribute("class","edge-label-bg");
      state.svg.gEdgeLabels.appendChild(bg);

      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x", mx);
      t.setAttribute("y", my - 6);
      t.setAttribute("text-anchor","middle");
      t.setAttribute("class","edge-label");
      t.textContent = e.w;
      t.style.pointerEvents = "auto";

      t.addEventListener("mousedown",(ev)=>ev.stopPropagation());
      t.addEventListener("dblclick",(ev)=>{
        ev.stopPropagation();
        EdgeEditor.open(ev.clientX,ev.clientY,e,(newW)=>{
          e.w=newW;
          const r = runDijkstra(state.nodes,state.edges,state.sourceId);
          drawGraph(r.dist,r.prev,current,settled,hiEdge);
          renderTable(r.dist,r.prev,current,settled);
        });
      });

      state.svg.gEdgeLabels.appendChild(t);

      /* Resize background to fit */
      const bb = t.getBBox();
      bg.setAttribute("x", bb.x - 6);
      bg.setAttribute("y", bb.y - 4);
      bg.setAttribute("width", bb.width + 12);
      bg.setAttribute("height", bb.height + 8);
      bg.setAttribute("rx", 4);
    }


    /* Nodes */
    for (const n of nodes){
      let cls = "node";
      if (settled.has(n.id)) cls += " settled";
      if (current === n.id) cls += " current";
      if (!state.animating && state.hover.node === n) cls += " hover";

      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",n.x); c.setAttribute("cy",n.y);
      c.setAttribute("r", String(NODE_RADIUS));
      c.setAttribute("id",`node-${n.id}`);
      c.setAttribute("class",cls);
      state.svg.gNodes.appendChild(c);

      const lbl = document.createElementNS("http://www.w3.org/2000/svg","text");
      lbl.setAttribute("x",n.x);
      lbl.setAttribute("y",n.y - 18);
      lbl.setAttribute("class","node-label");
      lbl.setAttribute("text-anchor","middle");
      lbl.textContent = n.id;
      state.svg.gNodeLabels.appendChild(lbl);
    }
  }


  /* Table Rendering */
  function renderTable(dist, prev, current=null, settled=new Set()){
    const {nodes} = state;
    state.tableEl.innerHTML = nodes.map(n=>{
      const d = formatDist(dist[n.id]);
      const path = buildPath(prev,n.id).join("→");
      return `
        <tr class="${settled.has(n.id)?"settled":""} ${current===n.id?"current":""}">
          <td>${n.id}</td>
          <td>${d}</td>
          <td>${path}</td>
        </tr>`;
    }).join("");
  }


  /* Hover Detection */
  function attachHoverHandlers(svgRoot){
    let rafId = null;
    let last = { node:null, edge:null };

    const pump = ev => {
      if (state.animating || state.__lockHover)
        return;

      if (rafId)
        cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const pt = ScreenToSVG(svgRoot, ev.clientX, ev.clientY);

        const hitN = hitNode(pt, state.nodes, NODE_HIT_RADIUS);
        const hitE = hitN ? null : hitEdge(pt, state.nodes, state.edges, EDGE_HIT_TOLERANCE);

        if (last.node === hitN && last.edge === hitE)
          return;

        last = { node:hitN, edge:hitE };
        state.hover.node = hitN;
        state.hover.edge = hitE;

        const r = runDijkstra(state.nodes, state.edges, state.sourceId);
        drawGraph(r.dist,r.prev);
      });
    };

    svgRoot.addEventListener("mousemove", pump);

    svgRoot.addEventListener("mouseleave", ()=>{
      if (state.animating)
        return;
      last = { node:null, edge:null };
      state.hover.node = null;
      state.hover.edge = null;
      const r = runDijkstra(state.nodes, state.edges, state.sourceId);
      drawGraph(r.dist,r.prev);
    });
  }

  function setHoverLock(flag){
    state.__lockHover = !!flag;
  }


  /* Hit Geometry */
  function ScreenToSVG(svgRoot, x, y){
    const pt = svgRoot.createSVGPoint();
    pt.x = x; pt.y = y;
    const res = pt.matrixTransform(svgRoot.getScreenCTM().inverse());
    return {x:res.x, y:res.y};
  }

  const dist2 = (a,b)=> (a.x-b.x)**2 + (a.y-b.y)**2;

  function hitNode(pt,nodes,R){
    let best=null, bestD=1e9;
    for (const n of nodes){
      const d = Math.sqrt(dist2(pt,n));
      if (d<=R && d<bestD){
        best=n; bestD=d;
      }
    }
    return best;
  }

  function pointLineDist(p,a,b){
    const A = p.x - a.x, B = p.y - a.y;
    const C = b.x - a.x, D = b.y - a.y;
    const dot = A*C + B*D;
    const len2 = C*C + D*D;
    let t = dot/len2; t = Math.max(0,Math.min(1,t));
    const x = a.x + t*C, y = a.y + t*D;
    return Math.hypot(p.x - x, p.y - y);
  }

  function hitEdge(pt, nodes, edges, tol){
    for (const e of edges){
      const A = byId(nodes,e.a), B = byId(nodes,e.b);
      if (!A || !B) continue;

      const d1 = Math.hypot(pt.x - A.x, pt.y - A.y);
      const d2 = Math.hypot(pt.x - B.x, pt.y - B.y);
      if (d1 < 18 || d2 < 18) continue;

      if (pointLineDist(pt,A,B) < tol) return e;
    }
    return null;
  }

  /* Dijkstra */
  function runDijkstra(nodes,edges,sourceId){
    const dist={}, prev={}, visited=new Set();
    nodes.forEach(n => dist[n.id]=Infinity);
    if (sourceId && byId(nodes,sourceId)) dist[sourceId]=0;

    while (visited.size < nodes.length){
      let u=null, best=Infinity;
      for (const n of nodes)
        if (!visited.has(n.id) && dist[n.id] < best){
          best=dist[n.id];
          u=n.id;
        }
      if (!u)
        break;

      visited.add(u);

      for (const e of edges){
        if (!(e.a===u || e.b===u))
          continue;
        const v = (e.a===u ? e.b : e.a);
        if (visited.has(v))
          continue;

        const alt = dist[u] + Number(e.w);
        if (alt < dist[v]){
          dist[v] = alt;
          prev[v] = u;
        }
      }
    }

    return {dist, prev};
  }


  /* Animator */
  async function animateDijkstra(delay=600){

    if (!state.sourceId) {
      alert("Defina el origen.");
      return;
    }

    state.animating = true;

    const {nodes,edges} = state;
    const dist={}, prev={}, visited=new Set();
    nodes.forEach(n => dist[n.id]=Infinity);
    dist[state.sourceId] = 0;

    drawGraph(dist, prev, null, visited);
    renderTable(dist, prev, null, visited);

    while (visited.size < nodes.length && state.animating){

      let u=null, best=Infinity;
      for(const n of nodes)
        if(!visited.has(n.id) && dist[n.id]<best){
          best=dist[n.id]; u=n.id;
        }
      if(!u)
        break;

      drawGraph(dist, prev, u, visited);
      renderTable(dist, prev, u, visited);
      await sleep(delay); if(!state.animating) break;

      visited.add(u);
      drawGraph(dist, prev, null, visited);
      renderTable(dist, prev, null, visited);
      await sleep(Math.floor(delay*0.6)); if(!state.animating) break;

      for(const e of edges){
        if(!(e.a===u || e.b===u)) continue;
        const v = (e.a===u? e.b : e.a);
        if(visited.has(v)) continue;

        const alt = dist[u] + Number(e.w);
        if (alt < dist[v]){
          dist[v]=alt; prev[v]=u;
          drawGraph(dist,prev,v,visited,{a:u,b:v});
          renderTable(dist,prev,v,visited);
          await sleep(Math.floor(delay*0.6)); if(!state.animating) break;
        }
      }
    }

    state.animating = false;

    if (state.loop) {
      await sleep(300);
      if (state.loop)
        animateDijkstra(delay);
    }
  }

  const EdgeEditor = (function(){
    let el, input;
    let dragging=false, startY=0, base=0;
    let activeEdge=null, onCommitFn=null;
    let outsideHandlerBound=false;

    function ensure(){
      if (el) return;

      el = document.createElement("div");
      el.style.position="fixed";
      el.style.zIndex="9999";
      el.style.background="#0e0e0fcc";
      el.style.border="1px solid #2a2a2a";
      el.style.borderRadius="10px";
      el.style.boxShadow="0 8px 24px rgba(0,0,0,.35)";
      el.style.padding="8px 10px";
      el.style.backdropFilter="blur(6px)";
      el.style.userSelect="none";
      el.style.cursor="ns-resize";
      el.style.display="flex";
      el.style.flexDirection="column";
      el.style.alignItems="center";
      el.style.transition="opacity .12s ease, transform .12s ease";

      input = document.createElement("input");
      input.type="text";
      input.inputMode="numeric";
      input.style.width="60px";
      input.style.background="transparent";
      input.style.color="var(--text)";
      input.style.border="1px solid #3b3b3b";
      input.style.borderRadius="8px";
      input.style.padding="4px 6px";
      input.style.fontFamily="ui-monospace";
      input.style.textAlign="center";
      input.style.appearance="none";
      el.appendChild(input);

      document.body.appendChild(el);

      el.addEventListener("mousedown", ev=>{
        dragging=true;
        startY=ev.clientY;
        base=parseFloat(input.value)||0;
        document.body.style.cursor="ns-resize";
        document.body.style.userSelect="none";
        ev.preventDefault();
      });

      window.addEventListener("mousemove", ev=>{
        if(!dragging)return;
        const dy = startY - ev.clientY;
        const newVal = Math.max(1, Math.round(base + dy*0.5));
        input.value=newVal;
        if (activeEdge) activeEdge.w=newVal;
        const r = runDijkstra(state.nodes,state.edges,state.sourceId);
        drawGraph(r.dist,r.prev);
        renderTable(r.dist,r.prev);
      });

      window.addEventListener("mouseup",()=>{
        if(!dragging)return;
        dragging=false;
        document.body.style.cursor="default";
        document.body.style.userSelect="auto";
      });

      el.addEventListener("wheel", ev=>{
        ev.preventDefault();
        const cur = parseFloat(input.value)||0;
        const step = ev.shiftKey ? 5 : 1;
        const val = Math.max(1, cur + (ev.deltaY<0 ? step : -step));
        input.value=val;
        if (activeEdge) activeEdge.w=val;
        const r = runDijkstra(state.nodes,state.edges,state.sourceId);
        drawGraph(r.dist,r.prev);
        renderTable(r.dist,r.prev);
      },{passive:false});
    }

    function open(x,y,edgeRef,onCommit){
      ensure();
      activeEdge=edgeRef;
      onCommitFn=onCommit;
      input.value=edgeRef.w;

      el.style.left = (x+10)+"px";
      el.style.top  = (y+10)+"px";
      el.style.opacity="1";
      el.style.transform="scale(1)";
      input.focus(); input.select();

      if (!outsideHandlerBound){
        document.addEventListener("mousedown",onOutsideClick,true);
        outsideHandlerBound=true;
      }

      window.addEventListener("keydown", keyHandler);
    }

    function keyHandler(ev){
      if (ev.key==="Enter")
        close(true);
      if (ev.key==="Escape")
        close(false);
    }

    function onOutsideClick(ev){
      if (!el.contains(ev.target)){
        ev.stopPropagation();
        close(true);
      }
    }

    function close(commit){
      if(!el)return;
      el.style.opacity="0";
      el.style.transform="scale(.96)";

      if (commit && onCommitFn){
        const num = parseFloat(input.value);
        if (Number.isFinite(num)) onCommitFn(num);
      }

      window.removeEventListener("keydown", keyHandler);
      if (outsideHandlerBound){
        document.removeEventListener("mousedown",onOutsideClick,true);
        outsideHandlerBound=false;
      }
      activeEdge=null;
      onCommitFn=null;
    }

    return {open, close};
  })();

  /* Public API */
  return {
    state,
    setState(next){ Object.assign(state,next); },
    uniqueId,

    drawGraph,
    renderTable,
    runDijkstra,
    animateDijkstra,

    attachHoverHandlers,
    setHoverLock,

    ScreenToSVG,
    recomputeAndRender(){
      const r = runDijkstra(state.nodes,state.edges,state.sourceId);
      drawGraph(r.dist,r.prev);
      renderTable(r.dist,r.prev);
    },

    circleLayoutIfMissing
  };

})();
