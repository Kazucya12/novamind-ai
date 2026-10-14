<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>NovaMind Admin</title>
<style>
:root{--bg:#0C0E12;--c:#14171C;--tx:#E9ECF1;--mu:#8D95A3;--bd:rgba(255,255,255,.12);--ac:#7C6CF6;color-scheme:dark light}
@media (prefers-color-scheme:light){:root{--bg:#F6F7F9;--c:#fff;--tx:#14181F;--mu:#667085;--bd:rgba(16,24,40,.14)}}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.6 system-ui,sans-serif;padding:16px}
.w{max-width:480px;margin:0 auto}h1{font-size:20px}h2{font-size:15px;margin:22px 0 8px}
.c{background:var(--c);border:1px solid var(--bd);border-radius:14px;padding:14px}
label{display:block;font-size:12.5px;color:var(--mu);margin:10px 0 4px}
input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--bd);background:transparent;color:inherit;font:inherit}
button{margin-top:12px;width:100%;padding:11px;border:0;border-radius:10px;background:var(--ac);color:#fff;font:600 15px inherit;cursor:pointer}
pre{white-space:pre-wrap;word-break:break-all;background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:10px;font-size:13px;min-height:20px}
</style></head><body><div class="w">
<h1>NovaMind Admin</h1>
<div class="c"><label>Rahasia admin (ADMIN_SECRET)</label><input type="password" id="s" autocomplete="off"></div>
<h2>Buat kode aktivasi Pro</h2>
<div class="c"><label>Jumlah kode</label><input id="n" type="number" value="1" min="1" max="50"><label>Masa aktif (hari)</label><input id="d" type="number" value="30" min="1" max="365"><button id="g">Buat kode</button><pre id="o1"></pre></div>
<h2>Aktifkan Pro langsung ke akun</h2>
<div class="c"><label>Email akun</label><input id="e" type="email"><label>Hari</label><input id="d2" type="number" value="30" min="1" max="365"><button id="k">Aktifkan</button><pre id="o2"></pre></div>
</div><script>
function post(b,o){var s=document.getElementById('s').value;o.textContent='…';
 fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-secret':s},body:JSON.stringify(b)})
 .then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){var j=x[1];
  o.textContent=!x[0]?(j.error||'Gagal'):j.codes?j.codes.join('\n')+'\n('+j.days+' hari/kode)':j.email+' → Pro sampai '+new Date(j.proUntil).toLocaleDateString('id-ID')})
 .catch(function(){o.textContent='Tidak bisa terhubung'})}
g.onclick=function(){post({a:'gen',count:+n.value,days:+d.value},o1)};
k.onclick=function(){post({a:'grant',email:e.value,days:+d2.value},o2)};
</script></body></html>
