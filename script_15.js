
/* RADIUM FINAL NAVIGATION PATCH
   The group headers use delegated capture handling so Setup & Registration and
   Competition remain reliably collapsible even if another module rebinds nav items. */
(function(){
  'use strict';
  function applySavedNavState(){
    document.querySelectorAll('.nav-group[data-nav-state-ready]').forEach(function(g){g.removeAttribute('data-nav-state-ready')});
    document.querySelectorAll('.nav-group-toggle[data-nav-group]').forEach(function(btn){
      var cls=btn.getAttribute('data-nav-group');
      var group=document.querySelector('.nav-group.'+cls);
      if(!group)return;
      var saved=null;
      saved=storageGet('RADIUM_NAV_COLLAPSED_'+cls);
      if(saved==='1') group.classList.add('collapsed');
      else if(saved==='0') group.classList.remove('collapsed');
      btn.setAttribute('aria-expanded',String(!group.classList.contains('collapsed')));
      group.setAttribute('data-nav-state-ready','1');
    });
  }
  function toggleGroup(btn){
    var cls=btn.getAttribute('data-nav-group');
    if(!cls)return;
    var group=document.querySelector('.nav-group.'+cls);
    if(!group)return;
    var collapsed=!group.classList.contains('collapsed');
    group.classList.toggle('collapsed',collapsed);
    btn.setAttribute('aria-expanded',String(!collapsed));
    storageSet('RADIUM_NAV_COLLAPSED_'+cls,collapsed?'1':'0');
  }
  document.addEventListener('click',function(e){
    var btn=e.target && e.target.closest ? e.target.closest('.nav-group-toggle') : null;
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    toggleGroup(btn);
  },true);
  function init(){applySavedNavState();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('pageshow',applySavedNavState);
})();
