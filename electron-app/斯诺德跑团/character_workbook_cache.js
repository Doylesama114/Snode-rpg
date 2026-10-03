/* Local-only source workbook retention. Character JSON stores a key, not binary data. */
var SNOWD_CHARACTER_WORKBOOK_CACHE=(function(){
 function open(){return new Promise(function(resolve,reject){if(typeof indexedDB==="undefined"){reject(new Error("本机工作簿缓存不可用"));return;}var req=indexedDB.open("snowd-character-workbooks-v1",1);req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains("workbooks"))req.result.createObjectStore("workbooks");};req.onerror=function(){reject(req.error);};req.onsuccess=function(){resolve(req.result);};});}
 async function put(buffer){var db=await open(),key="workbook-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);try{await new Promise(function(resolve,reject){var tx=db.transaction("workbooks","readwrite");tx.objectStore("workbooks").put(buffer,key);tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error);};});return key;}finally{db.close();}}
 async function get(key){if(!key)return null;var db;try{db=await open();return await new Promise(function(resolve,reject){var q=db.transaction("workbooks").objectStore("workbooks").get(key);q.onsuccess=function(){resolve(q.result||null);};q.onerror=function(){reject(q.error);};});}catch(e){return null;}finally{if(db)db.close();}}
 return {put:put,get:get};
})();
