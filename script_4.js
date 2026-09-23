
(function(){
  function landing(){return document.getElementById('radiumLanding')}
  function showLanding(){var l=landing();if(l){l.hidden=false;l.scrollTop=0}}
  function hideLanding(){var l=landing();if(l)l.hidden=true}
  window.RADIUM_LANDING={show:showLanding,hide:hideLanding};
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('[data-radium-open-login]').forEach(function(b){b.addEventListener('click',function(){window.RADIUM_AUTH?.openLogin?.()})});
    document.addEventListener('click',function(e){var a=e.target.closest('#radiumLanding a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1),el=document.getElementById(id);if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'})}});
  });
})();
