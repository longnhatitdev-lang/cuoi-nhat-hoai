const fs=require('node:fs');const path=require('node:path');
module.exports=(req,res)=>{try{const html=fs.readFileSync(path.join(process.cwd(),'client','access.html'),'utf8');res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(html)}catch{res.statusCode=503;res.end('Không tải được trang xác thực.')}};
