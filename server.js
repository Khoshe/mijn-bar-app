const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// NIEUW: Een array (lijst) om de actieve bestellingen in te bewaren
let activeOrders = [];

io.on('connection', (socket) => {
    // Stuur direct de actuele wachtrij-teller naar de verbonden gebruiker
    socket.emit('queue', activeOrders.length);

    // NIEUW: Als het bar-dashboard opstart, sturen we direct alle gemiste openstaande orders door
    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => {
            socket.emit('bar-order', order);
        });
    });

    socket.on('order', (data) => {
        // Genereer een uniek ID voor deze specifieke bestelling zodat we hem later kunnen terugvinden
        data.id = Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Sla de bestelling op in het servergeheugen
        activeOrders.push(data);

        io.emit('bar-order', data);
        io.emit('queue', activeOrders.length);
    });

    // VERANDERD: We zoeken de bestelling nu op via zijn unieke ID om hem uit het geheugen te wissen
    socket.on('done', (orderId, name) => {
        // Verwijder de bestelling uit de actieve lijst op de server
        activeOrders = activeOrders.filter(order => order.id !== orderId);

        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live met Geheugen!'));
