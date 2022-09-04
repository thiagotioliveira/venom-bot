const venom = require('venom-bot');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {cors: {origin: "*"}});
const bodyParser = require('body-parser');
const port = 3101
const apiPort = 3100
const qrCodeImagePath = './images/out.png';
var qrCodeImageBuffer;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.use(express.static(__dirname + '/images'));

server.listen(port, () => console.log(`listening socket on port ${port}`));

//createHealthEndpoint(app);

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);
  
  socket.on('message', () => {
    startVenom(socket);
  });
});

function startVenom(socket) {
  venom.create(
    'whatsapp-bot#5',
    (base64Qr, asciiQR, attempts, urlCode) => {
      //console.log(asciiQR);
      var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
        response = {};

      if (matches.length !== 3) {
        return new Error('Invalid input string');
      }
      response.type = matches[1];
      response.data = new Buffer.from(matches[2], 'base64');

      var imageBuffer = response;

      qrCodeImageBuffer = imageBuffer['data'];
      socket.emit('ready', qrCodeImageBuffer);
    },
    undefined,
    { logQR: false }
  )
  .then((client) => {
    startServer(client);
  })
  .catch((erro) => {
    console.log(erro);
  });

  function startServer(client) {
    console.log('starting server');
    
    app.listen(apiPort, () => console.log(`listening api on port ${apiPort}`));

    client.onStateChange((state) => {
      console.log('state change to '+state);
      socket.emit('message', state);
    });

    app.get('/health', (req, res) => {
      client.isLoggedIn()
        .then((result) => {
          res.sendStatus(result ? 200 : 404);
        }).catch((erro) => {
          console.error('Error when try to get health: ', erro);
          res.sendStatus(404);
        });
    });

    app.post('/send', (req, res) => {
      client.sendText(req.body.to, req.body.content)
      .then((result) => {
          console.log('Result:', result);
          res.sendStatus(204);
      }).catch((erro) => {
          console.error('Error when sending: ', erro);
          res.sendStatus(500);
      });
    });
    
    app.get('/contacts', (req, res) => {
      client.getAllContacts()
      .then((result) => {
        res.send(result);
      }).catch((erro) => {
        console.error('Error when try to get contacts: ', erro);
        res.sendStatus(500);
      });
    });

    socket.emit('message', 'CONNECTED');//TODO
  }

  socket.on('ready', () => {
    setTimeout(function(){
      socket.emit('ready', qrCodeImageBuffer);
    }, 3000);
  });
}