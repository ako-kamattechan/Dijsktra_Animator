(() => {

  const svg = document.getElementById("stage");
  const svgNS = "http://www.w3.org/2000/svg";

  const S = () => Utils.state;

  let draggingNode = null;
  let connectingFrom = null;
  let tempLine = null;

  const safeToSVG = (e) => {
    try { return Utils.ScreenToSVG(svg, e.clientX, e.clientY); }
    catch { return {x:0,y:0}; }
  };

  const nodeAt = (x,y,R=NODE_HIT_RADIUS) =>
      (S().nodes||[]).find(n => Math.hypot(x-n.x, y-n.y) < R);


  /* Mouse Down Listener */
  svg.addEventListener("mousedown",(e)=>{

    if (Utils.state.modalOpen) {
      e.preventDefault();
      return;
    }

    if (S().animating)
      return;

    const p = safeToSVG(e);
    const st = S();

    /* Delete Shift+Click */
    if (e.shiftKey) {
      const edgeHit = (() => {
        for (const ed of (st.edges||[])){
          const A = st.nodes.find(n=>n.id===ed.a);
          const B = st.nodes.find(n=>n.id===ed.b);
          if(!A||!B)continue;

          const d1=Math.hypot(p.x-A.x,p.y-A.y);
          const d2=Math.hypot(p.x-B.x,p.y-B.y);
          if(d1<EDGE_ENDPOINT_SKIP||d2<EDGE_ENDPOINT_SKIP)continue;

          const Ax=p.x-A.x, Ay=p.y-A.y, Bx=B.x-A.x, By=B.y-A.y;
          const dot=Ax*Bx + Ay*By, len2=Bx*Bx + By*By;
          let t=dot/len2; t=Math.max(0,Math.min(1,t));
          const cx=A.x+t*Bx, cy=A.y+t*By;

          if (Math.hypot(p.x-cx,p.y-cy) < 10)
            return ed;
        }
        return null;
      })();

      if (edgeHit){
        st.edges = st.edges.filter(ed => ed !== edgeHit);
        Utils.recomputeAndRender();
        window.dispatchEvent(new CustomEvent("graph-changed"));
      }
      return;
    }


    /* Move Nove Ctrl+Drag */
    const n = nodeAt(p.x,p.y);
    if (n && e.ctrlKey) {
      draggingNode = n;
      svg.style.cursor="grabbing";
      Utils.setHoverLock(true);
      e.preventDefault();
      return;
    }

    /* Union */
    if (n && !e.ctrlKey) {
      connectingFrom = n;
      const g = document.createElementNS(svgNS,"line");
      g.setAttribute("class","temp-edge");
      g.setAttribute("x1",n.x); g.setAttribute("y1",n.y);
      g.setAttribute("x2",n.x); g.setAttribute("y2",n.y);
      svg.appendChild(g);
      tempLine = g;

      Utils.setHoverLock(true);
      e.preventDefault();
      return;
    }

    /* Create Node */
    const hitEdge = (() => {
      try {
        return (st.edges||[]).find(eObj=>{
          const A = st.nodes.find(n=>n.id===eObj.a);
          const B = st.nodes.find(n=>n.id===eObj.b);
          if(!A||!B)return false;

          const d1=Math.hypot(p.x-A.x,p.y-A.y);
          const d2=Math.hypot(p.x-B.x,p.y-B.y);
          if(d1<18||d2<18)return false;

          const Ax=p.x-A.x, Ay=p.y-A.y, Bx=B.x-A.x, By=B.y-A.y;
          const dot=Ax*Bx + Ay*By, len2=Bx*Bx + By*By;
          let t=dot/len2; t=Math.max(0,Math.min(1,t));
          const cx=A.x+t*Bx, cy=A.y+t*By;
          return Math.hypot(p.x-cx,p.y-cy) < 12;
        });
      } catch { return null; }
    })();

    if (!n && !hitEdge) {

      if (st.nodes.length >= Utils.state.maxNodes) {
        const badge = document.querySelector(".badge");
        badge.textContent="Límite de nodos alcanzado";
        badge.style.color="#f88";
        setTimeout(()=>{
          badge.textContent="ESC → regresar";
          badge.style.color="var(--muted)";
        },1400);
        Utils.setHoverLock(false);
        return;
      }

      st.nodes.push({ id:Utils.uniqueId(), x:p.x, y:p.y });

      if (!st.sourceId)
        st.sourceId = st.nodes[0].id;

      Utils.recomputeAndRender();
      Utils.setHoverLock(false);
      window.dispatchEvent(new CustomEvent("graph-changed"));
    }
  });

  /* Mouse Move Listener */
  svg.addEventListener("mousemove", (e)=>{
    if (Utils.state.modalOpen) return;

    const p = safeToSVG(e);

    if (draggingNode){
      draggingNode.x=p.x;
      draggingNode.y=p.y;
      Utils.recomputeAndRender();
    }
    else if (connectingFrom && tempLine){
      tempLine.setAttribute("x2",p.x);
      tempLine.setAttribute("y2",p.y);
    }
  });


  /* Mouse Up Listener */
  window.addEventListener("mouseup",(e)=>{
    if (Utils.state.modalOpen) 
      return;

    const p = safeToSVG(e);
    const st = S();

    svg.style.cursor="crosshair";

    if(draggingNode){
      draggingNode=null;
      Utils.setHoverLock(false);
      return;
    }

    if(connectingFrom){
      const n2=nodeAt(p.x,p.y);
      if (n2 && n2!==connectingFrom){
        const exists = (st.edges||[]).some(ed =>
            (ed.a===connectingFrom.id && ed.b===n2.id) ||
            (ed.a===n2.id && ed.b===connectingFrom.id)
        );
        if(!exists)
          st.edges.push({a:connectingFrom.id,b:n2.id,w:1});

        window.dispatchEvent(new CustomEvent("graph-changed"));
      }

      if(tempLine) tempLine.remove();
      tempLine=null;
      connectingFrom=null;

      Utils.recomputeAndRender();
      Utils.setHoverLock(false);
    }
  });


  /* Delete Listener Shift+Click */
  svg.addEventListener("click",(e)=>{
    if (!e.shiftKey || S().animating)
      return;

    const p = safeToSVG(e);
    const st = S();

    const n = (st.nodes||[]).find(n => Math.hypot(p.x-n.x,p.y-n.y) < NODE_DELETE_RADIUS);
    if (!n) return;

    st.nodes = st.nodes.filter(x => x !== n);
    st.edges = (st.edges||[]).filter(eObj => eObj.a !== n.id && eObj.b !== n.id);

    if (st.sourceId === n.id)
      st.sourceId = st.nodes[0]?.id || null;

    Utils.recomputeAndRender();
    window.dispatchEvent(new CustomEvent("graph-changed"));
  });


  svg.style.userSelect="none";
  svg.style.pointerEvents="auto";

})();
