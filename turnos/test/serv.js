const http=require('http'),{crear}=require('./mock'),{seed}=require('./seed');
const m=crear(seed()); m.setAhora(Date.now());
http.createServer((q,s)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{s.setHeader('Access-Control-Allow-Origin','*');s.setHeader('Content-Type','application/json');try{s.end(JSON.stringify(m.llamar(JSON.parse(b||'{}'))))}catch(e){s.end('{"ok":false}')}})}).listen(8802);
