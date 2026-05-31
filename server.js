const http=require('http'),fs=require('fs'),path=require('path');
const PORT=8765,ROOT=__dirname;
const MIME={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.xlsx':'application/octet-stream'};
http.createServer((req,res)=>{
  let u=req.url.split('?')[0];if(u==='/')u='/斯诺德跑团/角色面板.html';
  if(!u.startsWith('/'))u='/'+u;
  let fp=path.join(ROOT,u);
  if(!fs.existsSync(fp)||!fs.statSync(fp).isFile()){res.writeHead(404);res.end('404');return}
  let ext=path.extname(fp),mime=MIME[ext]||'text/plain';
  fs.readFile(fp,(e,d)=>{if(e){res.writeHead(500);res.end()}else{res.writeHead(200,{'Content-Type':mime});res.end(d)}});
}).listen(PORT,()=>console.log(`Server: http://localhost:${PORT}`));
