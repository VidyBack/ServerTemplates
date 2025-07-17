const jsonServer = require('json-server');
const clone = require('clone');
const data = require('./db.json');
const cors = require('cors');

const isProductionEnv = process.env.NODE_ENV === 'production';
const server = jsonServer.create();

server.use(cors({
  origin: '*',
  credentials:false
}));

const router = jsonServer.router(isProductionEnv ? clone(data) : 'db.json', {
  _isFake: isProductionEnv,
});

// const middlewares = jsonServer.defaults();
// server.use(middlewares);

// Only add custom headers once
server.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Proper cache for GET only
server.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600, immutable");

    // ETag implementation
    const originalSend = res.send;
    res.send = function (body) {
      const etag = `W/"${Buffer.byteLength(body)}-${require('crypto').createHash('sha1').update(body).digest('base64')}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304;
        return res.end();
      }

      return originalSend.call(this, body);
    };
  }
  next();
});

// Custom routes
server.put('/templates/:purpose/:id', (req, res) => {
  const id = req.params.id;
  const purpose = req.params.purpose;
  const updatedTemplate = req.body;
  const db = router.db;

  let template = db.get(purpose).find({ id: id }).assign(updatedTemplate).write();

  res.json(template);
});

server.post('/templates/:purpose', (req, res) => {
  const purpose = req.params.purpose;
  const newTemplate = req.body;
  const db = router.db;

  let template = db.get(purpose).push(newTemplate).write();

  res.status(201).json(template);
});

// Reset DB for prod non-GET
server.use((req, res, next) => {
  if (isProductionEnv && req.method !== 'GET') {
    router.db.setState(clone(data));
  }
  next();
});

server.use(router);

server.listen(process.env.PORT || 8000, () => {
  console.log('JSON Server is running at : http://localhost:8000');
});

module.exports = server;
