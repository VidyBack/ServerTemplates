const jsonServer = require('json-server');
const clone = require('clone');
const data = require('./db.json');
const cors = require('cors');

const isProductionEnv = process.env.NODE_ENV === 'production';
const server = jsonServer.create();

server.use(cors({
    origin: '*',
}));

// For mocking the POST request, POST request won't make any changes to the DB in production environment
const router = jsonServer.router(isProductionEnv ? clone(data) : 'db.json', {
    _isFake: isProductionEnv
});

const middlewares = jsonServer.defaults();
server.use(middlewares);

// Custom headers middleware
const customHeadersMiddleware = (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
};

server.use(customHeadersMiddleware);

// Cache middleware - MUST come after defaults to override json-server's cache headers
server.use((req, res, next) => {
    if (req.method === 'GET') {
        // Set Cache-Control headers for Vercel caching
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
        res.removeHeader("Pragma");
        res.removeHeader("Expires");
        
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

// Custom route to update a template
server.put('/templates/:purpose/:id', (req, res) => {
    const id = req.params.id;
    const purpose = req.params.purpose;
    const updatedTemplate = req.body;
    const db = router.db; // Get the lowdb instance

    // Find the template by id and update it
    let template = db.get(purpose)
        .find({ id: id })
        .assign(updatedTemplate)
        .write();

    res.json(template);
});

// Custom route to add a new template
server.post('/templates/:purpose', (req, res) => {
    const purpose = req.params.purpose;
    const newTemplate = req.body;
    const db = router.db; // Get the lowdb instance

    // Add the new template to the database
    let template = db.get(purpose)
        .push(newTemplate)
        .write();

    res.status(201).json(template);
});

// Database reset middleware - only for non-GET requests in production
server.use((req, res, next) => {
    if (isProductionEnv && req.method !== 'GET' && req.path !== '/') {
        router.db.setState(clone(data));
    }
    next();
});

server.use(router);

server.listen(process.env.PORT || 8000, () => {
    console.log('JSON Server is running at : http://localhost:8000');
});

// Export the Server API
module.exports = server;