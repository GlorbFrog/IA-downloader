// Node.js express proxy. Save as server.js
// Usage:
//   npm init -y
//   npm install express node-fetch express-rate-limit
//   node server.js

const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic rate limit
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 requests per minute per IP
app.use(limiter);

// Serve the static frontend
app.use(express.static('.'));

// Allowed hostnames (restrict so this isn't an open proxy)
const ALLOWED_HOSTS = new Set(['archive.org','www.archive.org','web.archive.org','wayback.archive.org']);
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB max streamed

function isAllowed(url){
  try{
    const h = new URL(url).hostname.toLowerCase();
    return Array.from(ALLOWED_HOSTS).some(ah => h === ah || h.endsWith('.' + ah));
  }catch(e){ return false; }
}

app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if(!target) return res.status(400).send('Missing url parameter');
  if(!isAllowed(target)) return res.status(403).send('Host not allowed');

  let upstream;
  try{
    upstream = await fetch(target, { headers: { 'User-Agent': 'IA-proxy-demo/1.0 (+https://example.local)' } });
  }catch(err){
    return res.status(502).send('Error fetching target: ' + err.message);
  }

  // forward status and headers
  res.status(upstream.status);
  upstream.headers.forEach((v,k) => {
    // avoid leaking hop-by-hop headers
    if(['transfer-encoding','keep-alive','connection'].includes(k.toLowerCase())) return;
    res.setHeader(k, v);
  });

  // stream but enforce max size
  const reader = upstream.body.getReader();
  let streamed = 0;

  const encoder = new TextEncoder();

  async function pump(){
    try{
      while(true){
        const {done, value} = await reader.read();
        if(done) break;
        streamed += value.length || value.byteLength || 0;
        if(streamed > MAX_BYTES){
          // abort
          res.write('\n-- aborted by proxy: max size exceeded --');
          return res.end();
        }
        res.write(Buffer.from(value));
      }
      return res.end();
    }catch(err){
      console.error('stream error',err);
      try{ res.end(); }catch(e){}
    }
  }

  pump();
});

app.listen(PORT, ()=>console.log('Proxy server listening on port',PORT));
