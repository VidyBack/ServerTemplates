const jsonServer = require('json-server')
const clone = require('clone')
const data = require('./db.json')
const cors = require('cors');

const isProductionEnv = process.env.NODE_ENV === 'production';
const server = jsonServer.create()
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
    })
    const middlewares = jsonServer.defaults()
    
    server.use(middlewares)
    server.use(customHeadersMiddleware);  

server.use((req, res, next) => {
    if (req.path !== '/')
        router.db.setState(clone(data))
    next()
})

server.use(router)
server.listen(process.env.PORT || 8000, () => {
    console.log('JSON Server is running')
})

// Export the Server API
module.exports = server