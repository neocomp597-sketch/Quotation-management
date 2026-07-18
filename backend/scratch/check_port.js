const net = require('net');
const server = net.createServer();

server.once('error', function(err) {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 4003 is already in use (active).');
  } else {
    console.log('Error checking port 4003:', err.message);
  }
  process.exit(0);
});

server.once('listening', function() {
  console.log('Port 4003 is FREE (not in use).');
  server.close();
  process.exit(0);
});

server.listen(4003);
