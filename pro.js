/* NovaMind Pro + kuota harian. Dimuat otomatis oleh auth.js setelah login (tidak perlu mengubah index.html). */
(function(){
'use strict';
function tk(){try{return sessionStorage.getItem('kz_tok')||localStorage.getItem('kz_tok')}catch(e){return null}}
if(!tk()||!document.getElementById('side'))return;

var PRO_MODELS={'deepseek-v4-pro-0813':1,'gpt-5.6-luna':1}; /* model khusus Pro */
var Q=null;
function $(id){return document.getElementById(id)}
function api(body){
 return fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk()},body:JSON.stringify(body)})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,status:r.status,j:j}})},
        function(){return{ok:false,status:0,j:{}}})}
function tgl(ts){try{return new Date(ts).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}catch(e){return ''}}

/* ---------- gaya ---------- */
var st=document.createElement('style');
st.textContent=
'.qc{margin:0 14px 12px;padding:11px 12px;border:1px solid var(--bd);border-radius:14px;background:var(--gl2);font-size:12.5px}'
+'.qh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}'
+'.qtag{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid var(--bd);color:var(--mu)}'
+'.qtag.pro{background:linear-gradient(135deg,var(--ac),#ea8a3a);color:#1a1405;border:0}'
+'.qbar{height:6px;border-radius:6px;background:var(--bd);overflow:hidden}'
+'.qbar i{display:block;height:100%;background:linear-gradient(90deg,var(--ac3),var(--ac2));transition:width .4s}'
+'.qbar.low i{background:linear-gradient(90deg,#f59e0b,#ef4444)}'
+'.qm{color:var(--mu);margin-top:7px;font-size:11.5px}'
+'.qup{width:100%;margin-top:9px;padding:8px;border-radius:11px;font-weight:600;background:linear-gradient(135deg,var(--ac),#ea8a3a);color:#1a1405;border:0;cursor:pointer}'
+'#qnote{max-width:780px;margin:4px auto 0;text-align:center;font-size:12px;color:var(--mu)}'
+'#qnote b{color:var(--tx)}#qnote button{color:var(--ac);text-decoration:underline;background:none;border:0;cursor:pointer;font:inherit;padding:0 2px}'
+'#pro{display:none;position:fixed;inset:0;z-index:40;background:#000a;backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px}'
+'#pro.on{display:flex}'
+'.pm{background:var(--bg);border:1px solid var(--bd);border-radius:22px;padding:20px;width:100%;max-width:440px;max-height:92%;overflow-y:auto;color:var(--tx)}'
+'.pm h3{margin:0;font-size:18px}.pmh{display:flex;align-items:center;gap:12px;margin-bottom:14px}'
+'.pmg{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
+'.pc{border:1px solid var(--bd);border-radius:16px;padding:13px;background:var(--gl2);font-size:13px}'
+'.pc h4{margin:0 0 6px;font-size:14px}.pc ul{margin:0;padding-left:17px;color:var(--mu);font-size:12.5px}.pc li{margin:3px 0}'
+'.pc.pr{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent)}'
+'.pc .pp{font-weight:700;color:var(--ac);margin-bottom:6px;font-size:13px}'
+'.pst{margin:14px 0 4px;padding:10px 12px;border-radius:12px;background:var(--gl2);font-size:13px}'
+'.pm label{display:block;margin:14px 0 6px;font-size:13px;color:var(--mu)}'
+'.pm input[type=text]{width:100%;background:var(--gl2);border:1px solid var(--bd);border-radius:12px;padding:10px;text-transform:uppercase;letter-spacing:1px}'
+'.pr2{display:flex;gap:8px}.pr2 input{flex:1}'
+'.pbtn{padding:10px 14px;border-radius:12px;font-weight:600;border:1px solid var(--bd);background:var(--gl2);cursor:pointer;color:var(--tx)}'
+'.pbtn.go{background:linear-gradient(135deg,var(--ac),#ea8a3a);color:#1a1405;border:0;width:100%;margin-top:12px}'
+'#pmsg{min-height:20px;font-size:13px;margin-top:10px;text-align:center}#pmsg.er{color:#ff7a7a}#pmsg.ok{color:var(--ac3)}';
document.head.appendChild(st);

/* ---------- elemen ---------- */
var card=document.createElement('div');card.className='qc';card.id='qc';
$('side').insertBefore(card,$('list'));
var note=document.querySelector('#bar .note'),qn=document.createElement('div');qn.id='qnote';
if(note)note.parentNode.insertBefore(qn,note);

var ov=document.createElement('div');ov.id='pro';
ov.innerHTML='<div class="pm"><div class="pmh"><button class="pbtn" id="pbk" aria-label="Kembali">← Kembali</button><h3>NovaMind Pro</h3></div>'
+'<div class="pmg"><div class="pc"><h4>Gratis</h4><div class="pp" id="pfp"></div><ul><li>Chat dengan AI</li><li>Model standar</li><li>Chat tersimpan di akun</li></ul></div>'
+'<div class="pc pr"><h4>⭐ Pro</h4><div class="pp" id="ppp"></div><ul><li>Batas pesan jauh lebih besar</li><li>Model Pro: DeepSeek V4 Pro, GPT 5.6 Luna</li><li>Semua fitur gratis</li></ul></div></div>'
+'<div class="pst" id="pst"></div>'
+'<button class="pbtn go" id="pbuy">Beli Pro</button>'
+'<label>Sudah punya kode aktivasi?</label><div class="pr2"><input type="text" id="pcode" placeholder="NM-XXXX-XXXX" maxlength="14" autocomplete="off"><button class="pbtn" id="pact">Aktifkan</button></div>'
+'<div id="pmsg"></div></div>';
document.body.appendChild(ov);

/* ---------- tampilan ---------- */
function render(){
 if(!Q)return;
 var pro=Q.plan==='pro',pct=Math.max(0,Math.min(100,Math.round(Q.remaining/Q.limit*100)));
 card.innerHTML='<div class="qh"><b>Kuota hari ini</b><span class="qtag'+(pro?' pro':'')+'">'+(pro?'⭐ PRO':'GRATIS')+'</span></div>'
  +'<div class="qbar'+(pct<=20?' low':'')+'"><i style="width:'+pct+'%"></i></div>'
  +'<div class="qm">Sisa <b>'+Q.remaining+'</b> dari '+Q.limit+' pesan · reset 00.00 WIB'+(pro?'<br>Pro aktif sampai '+tgl(Q.proUntil):'')+'</div>'
  +(pro?'':'<button class="qup" data-up="1">Upgrade ke Pro</button>');
 qn.innerHTML='Sisa <b>'+Q.remaining+'/'+Q.limit+'</b> pesan hari ini'+(pro?' · ⭐ Pro':' · <button data-up="1">Upgrade Pro</button>');
 var p=Q.plans||{};
 $('pfp').textContent=p.free+' pesan / hari';$('ppp').textContent=p.pro+' pesan / hari · '+p.price+' / '+p.days+' hari';
 $('pst').textContent=pro?'Pro aktif sampai '+tgl(Q.proUntil)+'. Beli lagi untuk memperpanjang.':'Kamu memakai paket Gratis ('+Q.used+'/'+Q.limit+' pesan terpakai hari ini).';
 $('pbuy').textContent=(pro?'Perpanjang Pro':'Beli Pro')+' · '+p.price;
}
function refresh(){return api({a:'quota'}).then(function(r){if(r.ok&&r.j.quota){Q=r.j.quota;render()}})}
function msg(t,c){var m=$('pmsg');m.textContent=t||'';m.className=c||''}
function openPro(){msg('');render();ov.classList.add('on');refresh()}
function closePro(){ov.classList.remove('on')}
card.onclick=qn.onclick=function(e){if(e.target.dataset&&e.target.dataset.up)openPro()};
$('pbk').onclick=closePro;
ov.onclick=function(e){if(e.target===ov)closePro()};
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov.classList.contains('on'))closePro()});
$('pbuy').onclick=function(){var l=Q&&Q.plans&&Q.plans.link;if(l&&/^https?:\/\//i.test(l))window.open(l,'_blank','noopener');else msg('Pembelian belum dibuka. Hubungi admin untuk membeli Pro.','er')};
$('pact').onclick=function(){
 var c=$('pcode').value.trim();if(!c)return msg('Masukkan kode aktivasi','er');
 $('pact').disabled=true;msg('Memeriksa…');
 api({a:'redeem',code:c}).then(function(r){$('pact').disabled=false;
  if(!r.ok)return msg(r.j.error||'Gagal mengaktifkan','er');
  Q=r.j.quota;render();$('pcode').value='';msg('Pro aktif! +'+r.j.days+' hari. Selamat menikmati ⭐','ok')})};
$('pcode').addEventListener('keydown',function(e){if(e.key==='Enter')$('pact').click()});

/* ---------- hitung setiap permintaan AI ---------- */
var _call=window.call;
if(typeof _call==='function'){
 window.call=async function(msgs,sys,on,signal){
  var test=msgs&&msgs.length===1&&msgs[0]&&/Balas hanya dengan kata: OK/.test(String(msgs[0].content));
  if(!test){
   if(!Q)await refresh();
   var m=typeof model==='function'?model():'';
   if(PRO_MODELS[m]&&(!Q||Q.plan!=='pro')){setTimeout(openPro,250);throw new Error('Model ini khusus NovaMind Pro. Pilih model lain atau upgrade ke Pro.')}
   var r=await api({a:'use'});
   if(r.j&&r.j.quota){Q=r.j.quota;render()}
   if(r.status===429){setTimeout(openPro,250);throw new Error(r.j.error||'Kuota harian habis.')}
   if(r.status===401)throw new Error('Sesi berakhir. Muat ulang halaman lalu masuk lagi.');
  }
  return _call.apply(this,arguments);
 };
}

/* tandai model Pro di daftar model */
try{if(typeof DM!=='undefined'){DM.forEach(function(x){if(PRO_MODELS[x[0]]&&x[1].indexOf('⭐')<0)x[1]+=' ⭐'});if(typeof applySet==='function')applySet()}}catch(e){}

refresh();
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')refresh()});
window.NovaPro={open:openPro,refresh:refresh};
})();
