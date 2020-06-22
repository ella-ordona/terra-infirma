const express = require('express');
const path = require('path')
const app = express();
const port = process.env.PORT || 9000;
const server = require('http').createServer(app);

app.use(express.static(path.join(__dirname, '/public/')));
console.log(__dirname)

app.get('/', (req,res) => {
  res.sendFile(__dirname + '/public/index.html');
});

server.listen(port, () => {
  console.log('Listening on PORT ' + port)
});
