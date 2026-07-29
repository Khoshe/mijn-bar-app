const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// PLAK HIERONDER JOUW GOOGLE WEB-APP URL TUSSEN DE QUOTES:
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxizF1chLZuYrX_gwS9N12lK5GcP8YU0dKHGGbGATW160wLcyWnvo7B3PiIgApKVFjkaA/exec";

let activeOrders = [];
let memberTotals = {};

// NIEUW: Object om de voorraadstatus van de cocktails live bij te houden (standaard allemaal true)
let stockStatus = {
    daiquiri: true,
    ginfizz: true,
    sunrise: true,
    goldrush: true,
    bluelagoon: true,
    longisland: true
};

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    socket.emit('init-totals', memberTotals);
    
    // NIEUW: Stuur direct de actuele voorraadstatus naar elk scherm dat verbinding maakt
    socket.emit('stock-update', stockStatus);

    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => {
            socket.emit('bar-order', order);
        });
    });

    // NIEUW: Luister naar het dashboard wanneer de bar een cocktail in- of uitschakelt
    socket.on('toggle-drink', (drinkId) => {
        if (stockStatus[drinkId] !== undefined) {
            stockStatus[drinkId] = !stockStatus[drinkId]; // Draai status om (true <-> false)
            io.emit('stock-update', stockStatus); // Push live naar álle klanten en dashboards
        }
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
            
            if (!memberTotals[memberName]) {
                memberTotals[memberName] = {};
            }

            completedOrder.drinks.forEach(drink => {
                const drinkKey = `${drink.name} [${drink.strength}]`;
                memberTotals[memberName][drinkKey] = (memberTotals[memberName][drinkKey] || 0) + 1;

                // GEFIXT: De check controleert nu simpelweg of de string niet leeg is
                if (GOOGLE_SHEET_URL !== "") {
                    fetch(GOOGLE_SHEET_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: memberName, drink: drinkKey })
                    }).catch(err => console.log("Google Sheet Error: ", err));
                }
            }); // GEFIXT: Sluiting van completedOrder.drinks.forEach
            
            io.emit('update-totals', memberTotals);
        } // GEFIXT: Sluiting van if (completedOrder)

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live met Excel Geheugen!'));
