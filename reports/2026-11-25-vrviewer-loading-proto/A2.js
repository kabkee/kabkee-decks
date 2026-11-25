window.buildBg=(el,I)=>{ // ③ 은 flat 의 250px 저해상 preview 를 44px 로 뭉개 쓴다(해상도 부족이 드러나지 않음)
  el.innerHTML=`<img class="${I.bg?'':'lowres'}" src="${I.bg||I.flatPrev}">`}
