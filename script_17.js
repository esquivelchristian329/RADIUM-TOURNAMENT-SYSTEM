
(function(){
  function openSupabaseBracketDisplay(){
    try{
      var id='';
      if(window.RADIUM_CLOUD && typeof window.RADIUM_CLOUD.getId==='function') id=window.RADIUM_CLOUD.getId()||'';
      var url='bracket-display.html';
      if(id) url+='?tournament='+encodeURIComponent(id)+'&role='+encodeURIComponent(String(window.RADIUM_AUTH?.role||''));
      var w=window.open(url,'RADIUM_BRACKET_DISPLAY');
      if(!w) window.location.href=url;
      else { try{w.focus();}catch(e){} }
    }catch(e){
      window.open('bracket-display.html','RADIUM_BRACKET_DISPLAY');
    }
  }
  window.openSupabaseBracketDisplay=openSupabaseBracketDisplay;
  document.addEventListener('DOMContentLoaded',function(){
    // BRACKETS opens the authoritative Live Bracket for Table Officials;
    // Admin/Tournament Manager retain the dashboard button for the same live view.
    ['openBracketsNav','openBracketsDashboard'].forEach(function(id){
      var b=document.getElementById(id);
      if(b) b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();
        if(window.RADIUM_AUTH?.isOfficial?.()) openSupabaseBracketDisplay();
        else showPage('bracketPage');
      });
    });
    var display=document.getElementById('openBracketsPage');
    if(display) display.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openSupabaseBracketDisplay();});
  });
})();
