const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// PLAK HIERONDER JOUW GOOGLE WEB-APP URL TUSSEN DE QUOTES:
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxizF1chLZuYrX_gwS9N12lK5GcP8YU0dKHGGbGATW160wLcyWnvo7B3PiIgApKVFjkaA/exec";

let activeOrders = [];
let memberTotals = {};

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
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
            
            if (!memberTotals[memberName]) {
                memberTotals[memberName] = {};
            }

            completedOrder.drinks.forEach(drink => {
                const drinkKey = `${drink.name} [${drink.strength}]`;
                memberTotals[memberName][drinkKey] = (memberTotals[memberName][drinkKey] || 0) + 1;

                // NIEUW: Stuur dit drankje live en permanent naar Google Sheets
                if (GOOGLE_SHEET_URL !== "https://script.google.com/macros/s/AKfycbxizF1chLZuYrX_gwS9N12lK5GcP8YU0dKHGGbGATW160wLcyWnvo7B3PiIgApKVFjkaA/exec") {
                    fetch(GOOGLE_SHEET_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: memberName, drink: drinkKey })
                    }).catch(err => console.log("Google Sheet Error: ", err));
                }
            });
            
            io.emit('update-totals', memberTotals);
        }

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
    });
});

http.listen(process.env.PORT || 3000, () => console.log('Bar Live met Excel Geheugen!'));
