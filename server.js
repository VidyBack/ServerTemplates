const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const data = require('./db.json')
const middlewares = jsonServer.defaults();
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);


server.use(middlewares);
server.use(jsonServer.bodyParser);

server.post('/your-endpoint', (req, res) => {
    // Process the request body and add/update data in db.json using lowdb
    // For example:
    const newData = req.body;
   // Add a new post
  db.get('posts').push(newData).write();
  
  console.log('Added new post:', newData);
  
  
    res.status(200).json(newData);
  });

server.use((req, res, next) => {
    if (req.path !== '/')
        router.db.setState(clone(data))
    next()
})

server.use(router);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`JSON Server is running on http://localhost:${port}`);
});
