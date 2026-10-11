/* NovaMind login/register (server). Pasang SEBELUM script utama:  <script src="auth.js"></script> di <head> */
(function(){
'use strict';
var LS=null;try{LS=window.localStorage}catch(e){}
var G=Storage.prototype.getItem,S_=Storage.prototype.setItem,R=Storage.prototype.removeItem;
var uk=null,DATA='nm2',API='/api/account';
function mk(st,k){return(st===LS&&k===DATA&&uk)?DATA+'_'+uk:k}
function st(x){try{return x?sessionStorage:localStorage}catch(e){return null}}
function get(k,x){var s=st(x);try{return s?G.call(s,k):null}catch(e){return null}}
function set(k,v,x){var s=st(x);try{if(s)S_.call(s,k,v)}catch(e){}}
function del(k,x){var s=st(x);try{if(s)R.call(s,k)}catch(e){}}
function emailOk(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)}
function api(body,t){
 var h={'Content-Type':'application/json'};if(t)h.Authorization='Bearer '+t;
 return fetch(API,{method:'POST',headers:h,body:JSON.stringify(body),keepalive:true}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,status:r.status,j:j}})},function(){return{ok:false,status:0,j:{error:'Tidak bisa terhubung ke server. Periksa internet.'}}})}

var tok=get('kz_tok',1)||get('kz_tok'),usr=null;
try{usr=JSON.parse(get('kz_usr',1)||get('kz_usr')||'null')}catch(e){}
if(tok&&usr&&usr.email)uk=usr.email;else{tok=null;usr=null}

/* sinkron: setiap simpan data v2 -> kirim ke server (ditunda 1.5 dtk) */
var pend=null,tm=0,mts=0;
function flush(){
 if(pend===null||!tok)return;var v=pend,ts=mts;pend=null;clearTimeout(tm);
 api({a:'save',data:v,ts:ts},tok).then(function(r){if(r.status===401)expire()})}
function queue(v){pend=v;mts=Date.now();set('kz_ts_'+uk,String(mts));clearTimeout(tm);tm=setTimeout(flush,1500)}
Storage.prototype.getItem=function(k){return G.call(this,mk(this,k))};
Storage.prototype.setItem=function(k,v){var r=S_.call(this,mk(this,k),v);if(this===LS&&k===DATA&&uk)queue(v);return r};
Storage.prototype.removeItem=function(k){return R.call(this,mk(this,k))};
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush()});
window.addEventListener('pagehide',flush);

function clearSess(){del('kz_tok');del('kz_tok',1);del('kz_usr');del('kz_usr',1)}
function expire(){clearSess();location.reload()}
function logout(){flush();try{if(uk)R.call(LS,DATA+'_'+uk)}catch(e){}clearSess();location.reload()}
function startSession(j,remember){
 clearSess();var x=!remember;set('kz_tok',j.token,x);set('kz_usr',JSON.stringify(j.user),x);
 try{if(j.data!=null){S_.call(LS,DATA+'_'+j.user.email,j.data);S_.call(LS,'kz_ts_'+j.user.email,String(j.ts||0))}else{R.call(LS,DATA+'_'+j.user.email)}}catch(e){}
 location.reload()}

var CSS='#kzg{position:fixed;inset:0;z-index:99999;background:var(--bg,#0d0f1f);color:var(--tx,#eceefb);overflow-y:auto;display:grid;place-items:center;padding:20px;font:15px/1.6 Sora,system-ui,sans-serif}'
+'#kzg *{box-sizing:border-box}'
+'.kzc{width:100%;max-width:400px;background:var(--gl,#141733);border:1px solid var(--bd,#2a2e5c);border-radius:22px;padding:26px 22px;box-shadow:0 20px 60px #0006;backdrop-filter:blur(20px)}'
+'.kzc h1{font-size:21px;margin:12px 0 2px;text-align:center}.kzs{color:var(--mu,#9296bd);font-size:13px;text-align:center;margin:0 0 18px}'
+'.kzl{width:54px;height:54px;border-radius:16px;margin:0 auto;display:grid;place-items:center;font-size:26px;color:#14152b;background:linear-gradient(135deg,var(--ac,#f2b84b),var(--ac2,#8f7cff))}'
+'.kzt{display:grid;grid-template-columns:1fr 1fr;background:var(--gl2,#ffffff10);border-radius:12px;padding:4px;margin-bottom:14px}'
+'.kzt button{padding:9px;border-radius:9px;color:var(--mu,#9296bd);font-weight:600;font-size:14px;border:0;background:none;cursor:pointer;font-family:inherit}.kzt button.on{background:var(--bg,#0d0f1f);color:var(--ac,#f2b84b)}'
+'#kzg label{display:block;font-size:12px;color:var(--mu,#9296bd);margin:11px 0 5px}'
+'.kzf{position:relative}.kzf input{width:100%;padding:11px 13px;border-radius:11px;border:1.5px solid var(--bd,#2a2e5c);background:var(--gl2,#ffffff10);color:inherit;outline:0;font:inherit}.kzf input:focus{border-color:var(--ac2,#8f7cff)}'
+'.kzf .ey{position:absolute;right:6px;top:50%;transform:translateY(-50%);padding:6px;font-size:16px;border:0;background:none;cursor:pointer}'
+'.kzb{height:5px;border-radius:5px;background:var(--bd,#2a2e5c);margin-top:7px;overflow:hidden}.kzb i{display:block;height:100%;width:0;transition:.3s}'
+'.kzh{font-size:12px;color:var(--mu,#9296bd);min-height:16px;margin-top:3px}'
+'.kzk{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--mu,#9296bd);margin-top:12px}#kzg .kzk label{margin:0;display:flex;gap:8px;align-items:center}'
+'.kze{color:#ff7a7a;font-size:13px;text-align:center;min-height:18px;margin-top:10px}'
+'.kzp{width:100%;margin-top:12px;padding:12px;border:0;border-radius:12px;font:600 15px inherit;font-family:inherit;color:#1a1405;background:linear-gradient(135deg,var(--ac,#f2b84b),#ea8a3a);cursor:pointer}.kzp:disabled{opacity:.6}'
+'.kzu{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--bd,#2a2e5c)}'
+'.kza{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--ac,#f2b84b),var(--ac2,#8f7cff));display:grid;place-items:center;font-weight:700;color:#14152b;flex-shrink:0}'
+'.kzn{flex:1;min-width:0;line-height:1.3}.kzn b,.kzn small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kzn small{color:var(--mu,#9296bd);font-size:11px}'
+'.kzu button{padding:6px 10px;font-size:12px;border-radius:10px;border:1px solid var(--bd,#2a2e5c);background:var(--gl2,#ffffff10);color:inherit;cursor:pointer;font-family:inherit}'
+'.kzlnk{background:none!important;border:0!important;color:var(--ac2,#8f7cff)!important;cursor:pointer;font:inherit;font-size:12px!important;padding:4px 0!important}.kzlnk:disabled{opacity:.5;cursor:default}';

var GATE='<div class="kzc"><div class="kzl">✦</div><h1 id="kzh1">Masuk ke NovaMind</h1><p class="kzs" id="kzsub">Chat dan pengaturanmu tersimpan per akun</p>'
+'<div class="kzt"><button id="kzTL" class="on">Masuk</button><button id="kzTR">Daftar</button></div>'
+'<form id="kzFL" onsubmit="return false" novalidate><label>Email</label><div class="kzf"><input type="email" id="kzlE" placeholder="nama@email.com" autocomplete="username"></div>'
+'<label>Kata sandi</label><div class="kzf"><input type="password" id="kzlP" placeholder="••••••••" autocomplete="current-password"><button type="button" class="ey" data-t="kzlP">👁️</button></div>'
+'<div class="kzk"><label><input type="checkbox" id="kzlR" checked> Ingat saya</label></div><div class="kze" id="kzeL"></div><button class="kzp" id="kzbL">Masuk</button></form>'
+'<form id="kzFR" style="display:none" onsubmit="return false" novalidate><label>Nama lengkap</label><div class="kzf"><input type="text" id="kzrN" placeholder="Nama kamu" autocomplete="name"></div>'
+'<label>Email</label><div class="kzf"><input type="email" id="kzrE" placeholder="nama@email.com" autocomplete="email"></div>'
+'<label>Kata sandi</label><div class="kzf"><input type="password" id="kzrP" placeholder="Minimal 8 karakter" autocomplete="new-password"><button type="button" class="ey" data-t="kzrP">👁️</button></div>'
+'<div class="kzb"><i id="kzsb"></i></div><div class="kzh" id="kzsh"></div>'
+'<label>Ulangi kata sandi</label><div class="kzf"><input type="password" id="kzrC" placeholder="Ketik ulang" autocomplete="new-password"><button type="button" class="ey" data-t="kzrC">👁️</button></div>'
+'<div class="kzk"><label><input type="checkbox" id="kzrA"> Saya setuju dengan syarat &amp; ketentuan</label></div><div class="kze" id="kzeR"></div><button class="kzp" id="kzbR">Buat Akun</button></form>'
+'<form id="kzFV" style="display:none" onsubmit="return false" novalidate><p class="kzs" id="kzvm"></p><label>Kode verifikasi (6 digit)</label><div class="kzf"><input type="text" id="kzvC" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div><div class="kze" id="kzeV"></div><button class="kzp" id="kzbV">Verifikasi &amp; Buat Akun</button><div class="kzk" style="justify-content:space-between"><button type="button" id="kzRs" class="kzlnk">Kirim ulang kode</button><button type="button" id="kzBk" class="kzlnk">Ganti email</button></div></form>'
+'</div>';

function $(id){return document.getElementById(id)}
function tab(r){
 $('kzTL').className=r?'':'on';$('kzTR').className=r?'on':'';
 $('kzFL').style.display=r?'none':'';$('kzFR').style.display=r?'':'none';
 $('kzh1').textContent=r?'Buat akun NovaMind':'Masuk ke NovaMind';
 $('kzsub').textContent=r?'Daftar gratis dalam hitungan detik':'Chat dan pengaturanmu tersimpan per akun';
 $('kzFV').style.display='none';$('kzeL').textContent=$('kzeR').textContent=''}

var pendEmail='',cdT=0;
function startCd(n){clearInterval(cdT);var b=$('kzRs'),c=n;b.disabled=true;b.textContent='Kirim ulang ('+c+')';
 cdT=setInterval(function(){c--;if(c<=0){clearInterval(cdT);b.disabled=false;b.textContent='Kirim ulang kode'}else b.textContent='Kirim ulang ('+c+')'},1000)}
function showVerify(email){
 pendEmail=email;$('kzFL').style.display='none';$('kzFR').style.display='none';$('kzFV').style.display='';
 document.querySelector('.kzt').style.display='none';
 $('kzh1').textContent='Verifikasi email';$('kzsub').textContent='';
 $('kzvm').textContent='Kode 6 digit sudah dikirim ke '+email+'. Cek juga folder spam.';
 $('kzvC').value='';$('kzeV').textContent='';startCd(60);$('kzvC').focus()}
function buildGate(){
 var g=document.createElement('div');g.id='kzg';g.innerHTML=GATE;document.body.appendChild(g);
 $('kzTL').onclick=function(){tab(false)};$('kzTR').onclick=function(){tab(true)};
 g.querySelectorAll('.ey').forEach(function(b){b.onclick=function(){var i=$(b.dataset.t);i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'👁️':'🙈'}});
 $('kzrP').oninput=function(e){var p=e.target.value,n=0;
  if(p.length>=8)n++;if(p.length>=12)n++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))n++;if(/\d/.test(p))n++;if(/[^\w\s]/.test(p))n++;
  var L=[['Terlalu lemah','#dc2626'],['Lemah','#ea580c'],['Cukup','#ca8a04'],['Bagus','#65a30d'],['Kuat','#16a34a'],['Sangat kuat','#16a34a']][p?n:0];
  $('kzsb').style.width=p?(n/5*100)+'%':'0';$('kzsb').style.background=L[1];$('kzsh').textContent=p?L[0]:''};
 $('kzbR').onclick=function(){
  var n=$('kzrN').value.trim(),e=$('kzrE').value.trim().toLowerCase(),p=$('kzrP').value,er=$('kzeR');
  if(n.length<2)return er.textContent='Nama minimal 2 karakter';
  if(!emailOk(e))return er.textContent='Format email tidak valid';
  if(p.length<8)return er.textContent='Kata sandi minimal 8 karakter';
  if(p!==$('kzrC').value)return er.textContent='Konfirmasi kata sandi tidak cocok';
  if(!$('kzrA').checked)return er.textContent='Centang persetujuan terlebih dahulu';
  /* akun baru selalu mulai kosong: chat lama di browser TIDAK ikut diunggah */
  $('kzbR').disabled=true;er.textContent='Mengirim kode…';
  api({a:'register',name:n,email:e,pass:p}).then(function(r){$('kzbR').disabled=false;
   if(!r.ok)return er.textContent=r.j.error||'Gagal mendaftar';
   er.textContent='';showVerify(e)})};
 $('kzbV').onclick=function(){
  var c=$('kzvC').value.replace(/\D/g,''),er=$('kzeV');
  if(c.length!==6)return er.textContent='Masukkan 6 digit kode';
  $('kzbV').disabled=true;er.textContent='';
  api({a:'verify',email:pendEmail,code:c}).then(function(r){$('kzbV').disabled=false;
   if(!r.ok)return er.textContent=r.j.error||'Kode salah';
   startSession(r.j,true)})};
 $('kzRs').onclick=function(){
  var er=$('kzeV');er.textContent='';
  api({a:'resend',email:pendEmail}).then(function(r){
   if(!r.ok){if(r.j.wait)startCd(r.j.wait);return er.textContent=r.j.error||'Gagal kirim ulang'}
   er.textContent='Kode baru sudah dikirim';startCd(60)})};
 $('kzBk').onclick=function(){clearInterval(cdT);document.querySelector('.kzt').style.display='';tab(true)};
 $('kzbL').onclick=function(){
  var e=$('kzlE').value.trim().toLowerCase(),p=$('kzlP').value,er=$('kzeL');
  if(!emailOk(e)||!p)return er.textContent='Isi email dan kata sandi dengan benar';
  $('kzbL').disabled=true;er.textContent='';
  api({a:'login',email:e,pass:p}).then(function(r){$('kzbL').disabled=false;
   if(!r.ok)return er.textContent=r.j.error||'Gagal masuk';
   startSession(r.j,$('kzlR').checked)})};
 [['kzlE','kzbL'],['kzlP','kzbL'],['kzrC','kzbR'],['kzvC','kzbV']].forEach(function(x){$(x[0]).addEventListener('keydown',function(ev){if(ev.key==='Enter')$(x[1]).click()})});
}

function buildBar(){
 var side=document.getElementById('side');if(!side)return;
 var d=document.createElement('div');d.className='kzu';
 d.innerHTML='<div class="kza"></div><div class="kzn"><b></b><small></small></div><button id="kzLo">Keluar</button><button id="kzDel" title="Hapus akun" aria-label="Hapus akun">🗑</button>';
 d.querySelector('.kza').textContent=usr.name.charAt(0).toUpperCase();
 d.querySelector('b').textContent=usr.name;d.querySelector('small').textContent=usr.email;
 side.appendChild(d);
 $('kzLo').onclick=logout;
 $('kzDel').onclick=function(){
  if(!confirm('Hapus akun beserta semua chat secara permanen? Ini juga menghapus data di server.'))return;
  api({a:'delete'},tok).then(function(r){if(!r.ok&&r.status!==401)return alert(r.j.error||'Gagal menghapus akun');pend=null;logout()})};
}

function pull(){
 api({a:'load'},tok).then(function(r){
  if(r.status===401)return expire();
  if(!r.ok||r.j.data==null)return;
  var lts=+get('kz_ts_'+uk)||0;
  if((r.j.ts||0)>lts&&pend===null){try{S_.call(LS,DATA+'_'+uk,r.j.data);S_.call(LS,'kz_ts_'+uk,String(r.j.ts))}catch(e){}location.reload()}})}

function init(){
 var s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 if(usr){buildBar();pull()}else buildGate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
