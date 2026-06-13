// shortcuts.js — Global keyboard shortcut manager for 斯诺德跑团
(function(){
  document.addEventListener('keydown',function(e){
    var tag=e.target.tagName;
    var isInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||e.target.isContentEditable;

    // ESC — priority: blur search input > navigate back
    if(e.key==='Escape'){
      // 1. If search input is focused, blur it first
      var sr=document.querySelector('input[type="search"]:focus, .search-widget-input:focus');
      if(sr&&isInput){e.preventDefault();sr.blur();return;}
    }

    // ESC → go back (when nothing else to do)
    if(e.key==='Escape'&&!isInput){
      var overlay=document.querySelector('#searchOverlay:not(.hidden), .nav-overlay.show, .nav-drawer.open, #_shortcutHelp');
      if(overlay)return;
      var back=document.querySelector('.back-link, .back-btn');
      if(back){
        var href=back.getAttribute('href');
        if(href)location.href=href; else back.click();
        e.preventDefault();
      }
      return;
    }

    // SPACE → open search on homepage
    if(e.key===' '&&!isInput){
      // Click the search float button if it exists (triggers openOverlay + loadAllData)
      var sbtn=document.querySelector('.search-float-btn, #floatSearchBtn');
      if(sbtn){e.preventDefault();sbtn.click();return;}
      // Fallback: try to open the overlay directly
      var searchOverlay=document.querySelector('#searchOverlay');
      if(searchOverlay){e.preventDefault();searchOverlay.classList.remove('hidden');if(typeof loadAllData==='function')loadAllData();var inp=searchOverlay.querySelector('input');if(inp)inp.focus();return;}
    }

    // / → focus search box on class pages
    if(e.key==='/'&&!isInput){
      var search=document.querySelector('input[type="search"]:not(#searchOverlay input), .search-widget-input');
      if(search){
        e.preventDefault();
        search.focus();
      }
      return;
    }

    // ? → show keyboard shortcuts help (Shift+/)
    if((e.key==='?'||e.code==='Slash'&&e.shiftKey)&&!isInput){
      e.preventDefault();
      showShortcutHelp();
      return;
    }
  });

  function showShortcutHelp(){
    var old=document.getElementById('_shortcutHelp');
    if(old){old.remove();return;}
    var d=document.createElement('div');
    d.id='_shortcutHelp';
    d.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--panel,#fffdf8);border:2px solid var(--accent,#a46d1f);border-radius:12px;padding:24px 28px;box-shadow:0 16px 48px rgba(0,0,0,.25);max-width:380px;width:90%;font-size:14px;color:var(--ink,#1f2522);line-height:2';
    d.innerHTML='<div style="font-size:18px;font-weight:bold;margin-bottom:14px;text-align:center">⌨️ 快捷键</div>'
      +'<b>ESC</b> &nbsp; 返回上一页<br>'
      +'<b>Space</b> &nbsp; 全局搜索（首页）<br>'
      +'<b>/</b> &nbsp; 聚焦搜索框<br>'
      +'<b>?</b> &nbsp; 显示/隐藏本面板<br>'
      +'<div style="margin-top:14px;text-align:center;font-size:12px;color:var(--muted)">按 ESC 或点外部关闭</div>';
    document.body.appendChild(d);
    // Click outside to close
    function close(e){if(!d.contains(e.target)){d.remove();document.removeEventListener('click',close);}}
    setTimeout(function(){document.addEventListener('click',close);},100);
  }
})();
