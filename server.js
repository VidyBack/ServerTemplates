const jsonServer = require('json-server');
const clone = require('clone');
const data = require('./db.json');
const cors = require('cors');

const isProductionEnv = process.env.NODE_ENV === 'production';
const server = jsonServer.create();
server.use(cors({
    origin: '*',
}));
server.use((req, res, next) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
});
const customHeadersMiddleware = (req, res, next) => {
    // Set custom headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', '*');

    // Continue with the next middleware or route handler
    next();
};

// For mocking the POST request, POST request won't make any changes to the DB in production environment
const router = jsonServer.router(isProductionEnv ? clone(data) : 'db.json', {
    _isFake: isProductionEnv
});
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(customHeadersMiddleware);

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

server.use((req, res, next) => {
    if (req.path !== '/')
        router.db.setState(clone(data));
    next();
});

server.use(router);
server.listen(process.env.PORT || 8000, () => {
    console.log('JSON Server is running at : http://localhost:8000');
});

// Export the Server API
module.exports = server;
