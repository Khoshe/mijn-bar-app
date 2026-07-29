const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let queueCount = 0;

io.on('connection', (socket) => {
    socket.emit('queue', queueCount);

    socket.on('order', (data) => {
        queueCount++;
        io.emit('bar-order', data);
        io.emit('queue', queueCount);
    });

    socket.on('done', (name) => {
        if (queueCount > 0) queueCount--;
        io.emit('queue', queueCount);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live!'));
