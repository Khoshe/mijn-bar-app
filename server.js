const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// NIEUW: Een array (lijst) om de actieve bestellingen in te bewaren
let activeOrders = [];

io.on('connection', (socket) => {
    // Stuur directconst express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let activeOrders = [];
// NIEUW: Een object om de levenslange totalen van de avond in bij te houden
let lifetimeTotals = {};

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    
    // Stuur bij het opstarten van de bar direct de openstaande orders EN de totalen mee
    socket.emit('init-totals', lifetimeTotals);

    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => {
            socket.emit('bar-order', order);
        });
    });

    socket.on('order', (data) => {
        data.id = Date.now() + Math.random().toString(36).substr(2, 9);
        activeOrders.push(data);
        io.emit('bar-order', data);
        io.emit('queue', activeOrders.length);
    });

    // VERANDERD: Als een order klaar is, tellen we de drankjes op bij de geschiedenis
    socket.on('done', (orderId, name) => {
        // Zoek de order op voordat we hem uit de actieve lijst wissen
        const completedOrder = activeOrders.find(order => order.id === orderId);
        
        if (completedOrder) {
            // Loop door alle drankjes in deze bestelling en tel ze op bij het totaal
            completedOrder.drinks.forEach(drink => {
                const key = drink.name; // We groeperen puur op de naam van de cocktail
                lifetimeTotals[key] = (lifetimeTotals[key] || 0) + 1;
            });
            
            // Stuur de gloednieuwe totalen direct live naar het bar dashboard
            io.emit('update-totals', lifetimeTotals);
        }

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live met Statistieken!'));
 de actuele wachtrij-teller naar de verbonden gebruiker
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
