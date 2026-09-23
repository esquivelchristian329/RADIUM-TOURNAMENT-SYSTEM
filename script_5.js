
/* RADIUM NAVIGATION CORE — intentionally independent of tournament logic. */
(function(){
  const uiMemory=Object.create(null);
  function storageGet(k){return Object.prototype.hasOwnProperty.call(uiMemory,k)?uiMemory[k]:null}
  function storageSet(k,v){uiMemory[k]=String(v)}
  function setGroup(btn, collapsed){
    var cls=btn.getAttribute('data-nav-group');
    var group=document.querySelector('.nav-group.'+cls);
    if(!group)return;
    group.classList.toggle('collapsed', !!collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
    storageSet('RADIUM_NAV_COLLAPSED_'+cls, collapsed?'1':'0');
  }
  function init(){
    document.querySelectorAll('.nav-group-toggle[data-nav-group]').forEach(function(btn){
      var cls=btn.getAttribute('data-nav-group');
      var group=document.querySelector('.nav-group.'+cls);
      if(!group)return;
      var saved=storageGet('RADIUM_NAV_COLLAPSED_'+cls);
      setGroup(btn, saved==='1');
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        setGroup(btn, !group.classList.contains('collapsed'));
      });
      btn.addEventListener('keydown', function(e){
        if(e.key==='Enter' || e.key===' '){
          e.preventDefault();
          setGroup(btn, !group.classList.contains('collapsed'));
        }
      });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
