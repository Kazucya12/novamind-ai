/* NovaMind login/register. Pasang SEBELUM script utama:  <script src="auth.js"></script> di <head> */
(function(){
'use strict';
var LS=null;try{LS=window.localStorage}catch(e){}
var G=Storage.prototype.getItem,S_=Storage.prototype.setItem,R=Storage.prototype.removeItem;
var uk=null,DATA='nm2';
function mk(st,k){return(st===LS&&k===DATA&&uk)?DATA+'_'+uk:k}
Storage.prototype.getItem=function(k){return G.call(this,mk(this,k))};
Storage.prototype.setItem=function(k,v){return S_.call(this,mk(this,k),v)};
Storage.prototype.removeItem=function(k){return R.call(this,mk(this,k))};
function st(x){try{return x?sessionStorage:localStorage}catch(e){return null}}
function get(k,x){var s=st(x);try{return s?G.call(s,k):null}catch(e){return null}}
function set(k,v,x){var s=st(x);try{if(s)S_.call(s,k,v)}catch(e){}}
function del(k,x){var s=st(x);try{if(s)R.call(s,k)}catch(e){}}
function users(){try{return JSON.parse(get('kz_users')||'{}')}catch(e){return{}}}
function saveU(u){set('kz_users',JSON.stringify(u))}
function hash(p,sl){
 if(window.crypto&&crypto.subtle){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(sl+p)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
 var x=0,s=sl+p;for(var i=0;i<s.length;i++)x=(x*31+s.charCodeAt(i))|0;return Promise.resolve('f'+x)}
function salt(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function emailOk(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)}

var sess=get('kz_sess',1)||get('kz_sess'),me=sess&&users()[sess]||null;
if(me)uk=me.email;

function logout(){del('kz_sess');del('kz_sess',1);location.reload()}

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
+'.kzu button{padding:6px 10px;font-size:12px;border-radius:10px;border:1px solid var(--bd,#2a2e5c);background:var(--gl2,#ffffff10);color:inherit;cursor:pointer;font-family:inherit}';

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
+'<div class="kzh" style="text-align:center;margin-top:14px">Data tersimpan di perangkat ini. Kata sandi di-hash SHA-256.</div></div>';

function $(id){return document.getElementById(id)}
function tab(r){
 $('kzTL').className=r?'':'on';$('kzTR').className=r?'on':'';
 $('kzFL').style.display=r?'none':'';$('kzFR').style.display=r?'':'none';
 $('kzh1').textContent=r?'Buat akun NovaMind':'Masuk ke NovaMind';
 $('kzsub').textContent=r?'Daftar gratis dalam hitungan detik':'Chat dan pengaturanmu tersimpan per akun';
 $('kzeL').textContent=$('kzeR').textContent=''}

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
  var u=users();if(u[e])return er.textContent='Email sudah terdaftar, silakan masuk';
  $('kzbR').disabled=true;var sl=salt();
  hash(p,sl).then(function(h){
   u[e]={name:n,email:e,salt:sl,hash:h,created:Date.now()};saveU(u);
   if(!get('kz_legacy')){var old=LS&&G.call(LS,DATA);if(old)S_.call(LS,DATA+'_'+e,old);set('kz_legacy','1')}
   del('kz_sess');set('kz_sess',e,1);location.reload()})};
 var fails=0,lock=0;
 $('kzbL').onclick=function(){
  var e=$('kzlE').value.trim().toLowerCase(),p=$('kzlP').value,er=$('kzeL');
  if(Date.now()<lock)return er.textContent='Terlalu banyak percobaan. Tunggu '+Math.ceil((lock-Date.now())/1000)+' detik';
  if(!emailOk(e)||!p)return er.textContent='Isi email dan kata sandi dengan benar';
  var a=users()[e];$('kzbL').disabled=true;
  (a?hash(p,a.salt):Promise.resolve('')).then(function(h){
   $('kzbL').disabled=false;
   if(!a||h!==a.hash){if(++fails>=5){lock=Date.now()+30000;fails=0}return er.textContent='Email atau kata sandi salah'}
   del('kz_sess');del('kz_sess',1);set('kz_sess',e,!$('kzlR').checked);location.reload()})};
 [['kzlE','kzbL'],['kzlP','kzbL'],['kzrC','kzbR']].forEach(function(x){$(x[0]).addEventListener('keydown',function(ev){if(ev.key==='Enter')$(x[1]).click()})});
}

function buildBar(){
 var side=document.getElementById('side');if(!side)return;
 var d=document.createElement('div');d.className='kzu';
 d.innerHTML='<div class="kza"></div><div class="kzn"><b></b><small></small></div><button id="kzLo">Keluar</button><button id="kzDel" title="Hapus akun" aria-label="Hapus akun">🗑</button>';
 d.querySelector('.kza').textContent=me.name.charAt(0).toUpperCase();
 d.querySelector('b').textContent=me.name;d.querySelector('small').textContent=me.email;
 side.appendChild(d);
 $('kzLo').onclick=logout;
 $('kzDel').onclick=function(){
  if(!confirm('Hapus akun beserta semua chat secara permanen?'))return;
  var u=users();delete u[me.email];saveU(u);try{R.call(LS,DATA+'_'+me.email)}catch(e){}logout()};
}

function init(){
 var s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 if(me)buildBar();else buildGate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
