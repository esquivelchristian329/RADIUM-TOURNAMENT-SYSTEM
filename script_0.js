
/* RADIUM V14 ONLINE-ONLY MODE */
(function(){
  "use strict";
  window.RADIUM_ONLINE_ONLY = true;
  window.RADIUM_REQUIRE_ONLINE = function(){
    if (navigator.onLine === false) {
      alert("Internet connection is required. Please reconnect and try again.");
      return false;
    }
    return true;
  };
  window.addEventListener("offline", function(){
    console.warn("RADIUM is online-only. Internet connection lost.");
  });
})();
