const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('new-order', (orderData) => {
        io.emit('bar-receive-order', orderData);
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
