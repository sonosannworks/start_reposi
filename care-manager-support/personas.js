/* =====================================================
   ペルソナ(架空事例)15件の認定情報ビューア
   ・「クリア」ボタンの左隣に「ペルソナの認定情報を見る」ボタンを追加
   ・押すと窓が開き、左の一覧から選んだペルソナの認定情報PDFを表示
   ・PDFは同じフォルダの personas/ に置く(ファイル名は下の一覧と合わせる)
   ・どのHTMLでも、このファイルを <script src="personas.js"></script> で読み込むだけで使える
   ===================================================== */
(function(){
  const DIR='personas/';
  /* PDFとデータ(personas/*.js)のバージョン。中身を作り直したら、この値を変える(ブラウザに残った古いファイルを使わせないため) */
  const VER='20261030';
  const PERSONAS=[
    {no:1,  name:'森田 静江', kana:'もりた しずえ', age:80, sex:'女性', level:'要介護1', app:'新規申請', family:'夫(83歳)と二人暮らし(老老世帯)', file:'persona_01_morita_shizue.pdf'},
    {no:2,  name:'岡本 輝夫', kana:'おかもと てるお', age:76, sex:'男性', level:'要介護1', app:'更新申請(前回:要介護1)', family:'独居、長女は県外', file:'persona_02_okamoto_teruo.pdf'},
    {no:3,  name:'石井 秀雄', kana:'いしい ひでお', age:78, sex:'男性', level:'要介護2', app:'更新申請(前回:要介護2)', family:'妻(75歳)と二人暮らし', file:'persona_03_ishii_hideo.pdf'},
    {no:4,  name:'大野 千代', kana:'おおの ちよ', age:85, sex:'女性', level:'要介護2', app:'新規申請', family:'長男夫婦と同居、日中独居', file:'persona_04_ono_chiyo.pdf'},
    {no:5,  name:'西川 正弘', kana:'にしかわ まさひろ', age:74, sex:'男性', level:'要介護3', app:'区分変更申請(前回:要介護2)', family:'妻と二人暮らし', file:'persona_05_nishikawa_masahiro.pdf'},
    {no:6,  name:'松尾 ヨシ', kana:'まつお よし', age:88, sex:'女性', level:'要介護3', app:'更新申請(前回:要介護2)', family:'50代の未婚の長男と同居(8050)', file:'persona_06_matsuo_yoshi.pdf'},
    {no:7,  name:'北村 武雄', kana:'きたむら たけお', age:82, sex:'男性', level:'要介護4', app:'更新申請(前回:要介護3)', family:'妻(80歳)と二人暮らし', file:'persona_07_kitamura_takeo.pdf'},
    {no:8,  name:'藤田 ミツ', kana:'ふじた みつ', age:90, sex:'女性', level:'要介護4', app:'更新申請(前回:要介護3)', family:'長女夫婦と同居', file:'persona_08_fujita_mitsu.pdf'},
    {no:9,  name:'青木 和子', kana:'あおき かずこ', age:79, sex:'女性', level:'要介護5', app:'新規申請', family:'夫と長女が介護', file:'persona_09_aoki_kazuko.pdf'},
    {no:10, name:'坂口 勝治', kana:'さかぐち かつじ', age:86, sex:'男性', level:'要介護5', app:'更新申請(前回:要介護5)', family:'妻(84歳)と二人暮らし、長男が近居', file:'persona_10_sakaguchi_katsuji.pdf'},
    {no:11, name:'山下 キヨ',   kana:'やました きよ', age:82, sex:'女性', level:'要介護1', app:'更新申請(前回:要介護1)', family:'独居、長女が週1回訪問', file:'persona_11_yamashita_kiyo.pdf'},
    {no:12, name:'木村 正一',   kana:'きむら しょういち', age:78, sex:'男性', level:'要介護1', app:'新規申請', family:'妻と二人暮らし', file:'persona_12_kimura_shoichi.pdf'},
    {no:13, name:'中村 ハル子', kana:'なかむら はるこ', age:79, sex:'女性', level:'要介護2', app:'新規申請(退院前)', family:'長男家族と同居', file:'persona_13_nakamura_haruko.pdf'},
    {no:14, name:'小田 茂',     kana:'おだ しげる', age:84, sex:'男性', level:'要介護3', app:'区分変更申請(前回:要介護1)', family:'妻と二人暮らし', file:'persona_14_oda_shigeru.pdf'},
    {no:15, name:'林 トミ',     kana:'はやし とみ', age:88, sex:'女性', level:'要介護5', app:'更新申請(前回:要介護5)', family:'長男夫婦と同居', file:'persona_15_hayashi_tomi.pdf'}
  ];

  const CSS=`
  #pvBtn{white-space:nowrap;}
  #pvDlg{border:none; padding:0; border-radius:12px; width:min(1500px,98vw); height:96vh; max-width:none; max-height:none; box-shadow:0 20px 60px rgba(0,0,0,.25); color:var(--ink,#22302C); font-family:var(--gothic,sans-serif); background:#fff;}
  #pvDlg::backdrop{background:rgba(20,30,28,.45);}
  #pvDlg .pv-wrap{display:grid; grid-template-columns:240px 1fr; grid-template-rows:auto 1fr; height:100%;}
  #pvDlg .pv-head{grid-column:1 / 3; display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:2px solid var(--teal,#0E6B5C);}
  #pvDlg .pv-head h2{font-size:16px; color:var(--teal-deep,#0A5044); margin:0;}
  #pvDlg .pv-head .pv-tag{font-size:11.5px; border:1px solid var(--amber-line,#E4C077); background:var(--amber-bg,#FBF1DC); color:var(--amber,#9A5B0B); border-radius:999px; padding:1px 10px;}
  #pvDlg .pv-close{margin-left:auto; font-size:20px; line-height:1; padding:4px 12px;}
  #pvDlg .pv-list{overflow:auto; border-right:1px solid var(--line,#DAD8CF); background:var(--paper,#F5F4EF); padding:8px;}
  #pvDlg .pv-item{display:block; width:100%; text-align:left; border:1px solid transparent; background:transparent; border-radius:8px; padding:8px 10px; margin-bottom:4px; cursor:pointer; font-family:inherit;}
  #pvDlg .pv-item:hover{background:#fff; border-color:var(--line,#DAD8CF);}
  #pvDlg .pv-item[aria-current="true"]{background:#fff; border-color:var(--teal,#0E6B5C); box-shadow:inset 4px 0 0 var(--teal,#0E6B5C);}
  #pvDlg .pv-item .n{font-size:14px; font-weight:600; color:var(--ink,#22302C);}
  #pvDlg .pv-item .n small{font-weight:400; color:var(--ink-3,#8A968F); margin-right:6px;}
  #pvDlg .pv-item .m{font-size:12px; color:var(--ink-2,#5C6B66); margin-top:2px;}
  #pvDlg .pv-item .lv{display:inline-block; font-size:11.5px; background:var(--teal-pale,#E4F0EC); color:var(--teal-deep,#0A5044); border-radius:4px; padding:0 6px; margin-right:4px;}
  #pvDlg .pv-main{display:flex; flex-direction:column; min-width:0; min-height:0;}
  #pvDlg .pv-bar{display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid var(--line,#DAD8CF);}
  #pvDlg .pv-bar .t{font-size:14px; font-weight:600; margin-right:auto;}
  #pvDlg .pv-bar a{font-size:13.5px; text-decoration:none; color:var(--ink,#22302C); border:1px solid var(--line-2,#C4C2B8); border-radius:8px; padding:6px 12px; background:#fff;}
  #pvDlg .pv-bar a:hover{background:#F3F2EC;}
  #pvDlg .pv-bar a.primary{background:var(--teal,#0E6B5C); color:#fff; border-color:var(--teal,#0E6B5C); font-weight:600;}
  #pvDlg .pv-note{font-size:12px; color:var(--ink-2,#5C6B66); padding:6px 14px; background:#FAFAF6; border-bottom:1px solid var(--line,#DAD8CF);}
  #pvDlg iframe{flex:1; width:100%; border:0; background:#ECEAE2; position:static; inset:auto; height:auto;}
  #pvDlg .pv-noinline{flex:1; display:flex; align-items:flex-start; justify-content:center; padding:24px 18px; background:#ECEAE2;}
  #pvDlg .pv-noinline p{max-width:30em; margin:0; font-size:14px; line-height:1.8; color:var(--ink,#22302C); background:#fff; border:1px solid var(--line,#DAD8CF); border-radius:10px; padding:14px 16px;}
  #pvDlg .pv-noinline[hidden]{display:none;}
  #pvDlg .pv-sel{display:none;}
  #pvDlg.pv-wide .pv-wrap{grid-template-columns:1fr;}
  #pvDlg.pv-wide .pv-head{grid-column:1;}
  #pvDlg.pv-wide .pv-list{display:none;}
  #pvDlg.pv-wide .pv-sel{display:block; width:auto; font-size:13.5px; padding:6px 8px; border-radius:8px; border:1px solid var(--line-2,#C4C2B8); margin:0;}
  #pvDlg .pv-toggle{font-size:13px; padding:6px 12px;}
  @media (max-width:720px){
    #pvDlg{width:100vw; height:100vh; border-radius:0;}
    #pvDlg .pv-wrap{grid-template-columns:1fr;}
    #pvDlg .pv-head{grid-column:1; flex-wrap:wrap; row-gap:6px;}
    #pvDlg .pv-head h2{white-space:nowrap;}
    #pvDlg .pv-head::after{content:""; order:1; flex-basis:100%;}   /* ラベルを見出しの下の段へ(×は右上に残す) */
    #pvDlg .pv-head .pv-tag{order:2; white-space:nowrap;}
    #pvDlg .pv-head .pv-close{order:1;}
    #pvDlg .pv-list{display:none;}
    #pvDlg .pv-toggle{display:none;}
    #pvDlg .pv-sel{display:block; width:100%; font-size:14px; padding:8px; border-radius:8px; border:1px solid var(--line-2,#C4C2B8); margin:0 0 4px;}
  }`;

  /* 開いたり保存したりするときのファイル名(氏名は入れない)。例:ペルソナ01_要介護1_架空事例.pdf */
  function pubName(p){ return 'ペルソナ'+String(p.no).padStart(2,'0')+'_'+p.level+'_架空事例.pdf'; }
  /* PDFを画面の中に表示できるか(AndroidのChromeなどは false) */
  const CAN_INLINE = navigator.pdfViewerEnabled!==undefined ? navigator.pdfViewerEnabled : !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  function esc(t){ return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function mount(){
    const clear=document.getElementById('btnClear');
    if(!clear || document.getElementById('pvBtn')) return;
    const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

    const btn=document.createElement('button');
    btn.type='button'; btn.id='pvBtn'; btn.textContent='ペルソナの認定情報を見る';
    const prow=document.getElementById('personaRow');   // 「ペルソナで試す」の列があれば、その列の最後に置く
    if(prow) prow.appendChild(btn); else clear.parentNode.insertBefore(btn, clear);

    const dlg=document.createElement('dialog'); dlg.id='pvDlg'; dlg.setAttribute('aria-label','ペルソナの認定情報');
    dlg.innerHTML=
      '<div class="pv-wrap">'
      +'<div class="pv-head"><h2>ペルソナの認定情報(15件)</h2><span class="pv-tag">すべて架空の事例です</span>'
      +'<button type="button" class="pv-close" aria-label="閉じる">×</button></div>'
      +'<div class="pv-list" role="list">'
      + PERSONAS.map((p,i)=>'<button type="button" class="pv-item" role="listitem" data-i="'+i+'">'
          +'<div class="n"><small>'+String(p.no).padStart(2,'0')+'</small>'+esc(p.name)+'さん</div>'
          +'<div class="m"><span class="lv">'+esc(p.level)+'</span>'+p.age+'歳・'+p.sex+'</div>'
          +'<div class="m">'+esc(p.family)+(p.app?'<br>'+esc(p.app):'')+'</div></button>').join('')
      +'</div>'
      +'<div class="pv-main">'
      +'<div class="pv-bar"><select class="pv-sel" aria-label="ペルソナを選ぶ">'
      + PERSONAS.map((p,i)=>'<option value="'+i+'">'+String(p.no).padStart(2,'0')+' '+esc(p.name)+'さん('+esc(p.level)+')</option>').join('')
      +'</select><span class="t" id="pvTitle"></span>'
      +'<button type="button" class="pv-toggle" id="pvToggle">一覧を隠して大きく表示</button>'
      +'<button type="button" id="pvUse" hidden>この人の評価結果を入力</button>'
      +'<a id="pvOpen" target="_blank" rel="noopener">別タブで開く</a>'
      +'<a id="pvDl" class="primary" download>PDFを保存(AIに添付用)</a></div>'
      +'<div class="pv-note">このPDFをAIに添付して、課題整理総括表・ケアプランのSkillを試せます。ペルソナはすべて架空の人物で、実在の方とは関係ありません。</div>'
      +'<div class="pv-note" id="pvMsg" hidden></div>'
      +'<iframe id="pvFrame" title="認定情報PDF"></iframe>'
      +'<div class="pv-noinline" id="pvNoInline" hidden><p>スマホでは、この画面の中にPDFを表示できません。『別タブで開く』から見るか、『PDFを保存』で保存してください。</p></div>'
      +'</div></div>';
    document.body.appendChild(dlg);

    if(!CAN_INLINE){   // PDFを画面の中に表示できないブラウザ(AndroidのChromeなど)
      document.getElementById('pvFrame').hidden=true;
      document.getElementById('pvNoInline').hidden=false;
      document.getElementById('pvOpen').classList.add('primary');
    }
    const items=[...dlg.querySelectorAll('.pv-item')];
    const sel=dlg.querySelector('.pv-sel');
    let cur=-1;
    function pick(i){
      const p=PERSONAS[i]; if(!p) return;
      cur=i;
      items.forEach((b,k)=>b.setAttribute('aria-current', k===i ? 'true':'false'));
      sel.value=String(i);
      document.getElementById('pvTitle').textContent=String(p.no).padStart(2,'0')+' '+p.name+'さん('+p.level+'・'+p.age+'歳・'+p.sex+')';
      const fr=document.getElementById('pvFrame'), op=document.getElementById('pvOpen'), dl=document.getElementById('pvDl');
      fr.removeAttribute('src'); op.removeAttribute('href'); dl.removeAttribute('href');
      setNote('読み込んでいます…');
      loadPdf(p).then(url=>{
        if(cur!==i) return;   // 読み込み中に別の人を選んだとき
        if(CAN_INLINE) fr.src=url+'#navpanes=0&pagemode=none&view=FitH';
        op.href=url;
        dl.href=url; dl.setAttribute('download', pubName(p));
        setNote('');
      }).catch(()=>{ if(cur===i) setNote('PDFを読み込めませんでした。personas フォルダが、このHTMLと同じ場所にあるか確認してください。',true); });
      try{ localStorage.setItem('cmPersonaLast', String(i)); }catch(e){}
    }
    /* PDFは personas/〇〇.js にデータとして入れてあり、ブラウザの中でPDFに戻して表示する。
       パソコン上のファイルを直接開いた場合(file://)でも、窓の中・別タブで表示できるようにするため */
    const blobUrls={};
    function loadPdf(p){
      // サイトで公開しているときは、意味の分かる名前のPDFファイルをそのまま使う(別タブ・保存でもこの名前になる)
      if(/^https?:$/.test(location.protocol)) return Promise.resolve(DIR+encodeURIComponent(pubName(p))+'?v='+VER);
      if(blobUrls[p.file]) return Promise.resolve(blobUrls[p.file]);
      const make=()=>{
        const b64=(window.cmPersonaPdf||{})[p.file]; if(!b64) throw new Error('no data');
        const bin=atob(b64), u8=new Uint8Array(bin.length);
        for(let k=0;k<bin.length;k++) u8[k]=bin.charCodeAt(k);
        delete window.cmPersonaPdf[p.file];   // 元データはメモリから外す
        return (blobUrls[p.file]=URL.createObjectURL(new Blob([u8],{type:'application/pdf'})));
      };
      if((window.cmPersonaPdf||{})[p.file]) return Promise.resolve(make());
      return new Promise((ok,ng)=>{
        const s=document.createElement('script');
        s.src=DIR+p.file.replace(/\.pdf$/,'.js')+'?v='+VER;
        s.onload=()=>{ try{ ok(make()); }catch(e){ ng(e); } };
        s.onerror=ng;
        document.head.appendChild(s);
      });
    }
    function setNote(msg,err){
      const n=document.getElementById('pvMsg'); n.textContent=msg; n.hidden=!msg; n.style.color=err?'#9B2C2C':'';
    }
    items.forEach((b,i)=>b.addEventListener('click',()=>pick(i)));
    /* 「この人の評価結果を入力」:ペルソナの入力欄(samples.js)と同じ番号の事例を読み込む */
    const sid=p=>p.no<=10 ? 'v3-'+String(p.no).padStart(2,'0') : 'v2-'+String(p.no-10).padStart(2,'0');
    const use=document.getElementById('pvUse');
    use.addEventListener('click',()=>{ const p=PERSONAS[cur]; if(!p || !window.cmPickSample) return; dlg.close(); window.cmPickSample(sid(p)); });
    function setupUse(){   // ペルソナの入力欄が使えるときだけ表示(窓を開くたびに確認)
      const ok=!!(window.cmPickSample && (window.CM_SAMPLES||[]).length);
      use.hidden=!ok;
      if(ok) use.textContent=(typeof OWN_KEY!=='undefined' && OWN_KEY==='plan')?'この人のケアプラン案を入力':'この人の評価結果を入力';
    }
    const tg=document.getElementById('pvToggle');
    function setWide(on){ dlg.classList.toggle('pv-wide',on); tg.textContent=on?'一覧を表示':'一覧を隠して大きく表示'; try{ localStorage.setItem('cmPersonaWide',on?'1':''); }catch(e){} }
    tg.addEventListener('click',()=>setWide(!dlg.classList.contains('pv-wide')));
    try{ if(localStorage.getItem('cmPersonaWide')) setWide(true); }catch(e){}
    sel.addEventListener('change',()=>pick(+sel.value));
    dlg.querySelector('.pv-close').addEventListener('click',()=>dlg.close());
    dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); });   // 窓の外をクリックで閉じる
    btn.addEventListener('click',()=>{
      if(cur<0){ let last=0; try{ last=+(localStorage.getItem('cmPersonaLast')||0); }catch(e){} pick(PERSONAS[last]?last:0); }
      setupUse(); dlg.showModal();
    });
  }
  window.cmPersonas=PERSONAS;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
