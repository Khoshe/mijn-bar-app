const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Een teller om het aantal openstaande bestellingen bij te houden
let openOrdersCount = 0;

io.on('connection', (socket) => {
    console.log('Gebruiker verbonden');
    
    // Stuur direct de huidige wachtrij-stand naar de nieuwe gebruiker
    socket.emit('queue-update', openOrdersCount);

    // Als er een nieuwe bestelling binnenkomt
    socket.on('new-order', (orderData) => {
        openOrdersCount++;
        // Stuur de bestelling naar het bar-dashboard
        io.emit('bar-receive-order', orderData);
        // Stuur de nieuwe wachtrij-stand naar álle telefoons van je vrienden
        io.emit('queue-update', openOrdersCount);
    });

    // Als de bartender een bestelling afhandelt (op 'Klaar' klikt)
    socket.on('order-completed', () => {
        if (openOrdersCount > 0) {
            openOrdersCount--;
        }
        // Stuur de vernieuwde lagere wachtrij-stand naar iedereen
        io.emit('queue-update', openOrdersCount);
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
