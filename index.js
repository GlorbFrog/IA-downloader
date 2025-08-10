const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing "url" query parameter');
  }

  try {
    const response = await fetch(targetUrl);
    const contentType = response.headers.get('content-type') || '';
    res.set('content-type', contentType);
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Error fetching URL: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});

