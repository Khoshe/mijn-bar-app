const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let activeOrders = [];
// Houdt de geschiedenis per persoon bij: { "Naam": { "Drankje [Sterkte]": Aantal } }
let memberTotals = {};

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    // Stuur direct de complete turflijst mee bij het opstarten van het dashboard
    socket.emit('init-totals', memberTotals);

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

    socket.on('done', (orderId, name) => {
        const completedOrder = activeOrders.find(order => order.id === orderId);
        
        if (completedOrder) {
            const memberName = completedOrder.name.trim();
            
            // Als dit lid nog niet in de lijst staat, maak hem aan
            if (!memberTotals[memberName]) {
                memberTotals[memberName] = {};
            }

            // Loop door de drankjes en tel ze specifiek op voor dit lid, inclusief sterkte
            completedOrder.drinks.forEach(drink => {
                const drinkKey = `${drink.name} [${drink.strength}]`;
                memberTotals[memberName][drinkKey] = (memberTotals[memberName][drinkKey] || 0) + 1;
            });
            
            // Stuur de vernieuwde turflijst live naar het dashboard
            io.emit('update-totals', memberTotals);
        }

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live met Turflijst!'));
