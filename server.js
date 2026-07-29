const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxizF1chLZuYrX_gwS9N12lK5GcP8YU0dKHGGbGATW160wLcyWnvo7B3PiIgApKVFjkaA/exec";

let activeOrders = [];
let memberTotals = {};
let stockStatus = { daiquiri: true, ginfizz: true, sunrise: true, goldrush: true, bluelagoon: true, longisland: true };

const drinks = [
    {id:"daiquiri", n:"Strawberry Daiquiri"},
    {id:"ginfizz", n:"Passion For Fruit"},
    {id:"sunrise", n:"Tequila Sunrise"},
    {id:"goldrush", n:"Appletini"},
    {id:"bluelagoon", n:"Blue Lagoon"},
    {id:"longisland", n:"Long Island Iced Tea"}
];

// NIEUW: Haal bij het opstarten direct de data op uit Google Sheets
function loadDataFromSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL)
        .then(res => res.json())
        .then(data => {
            if (data.activeOrders) activeOrders = data.activeOrders;
            if (data.memberTotals) memberTotals = data.memberTotals;
            if (data.stockStatus && Object.keys(data.stockStatus).length > 0) stockStatus = data.stockStatus;
            console.log("➡️ Succesvol data hersteld uit Google Sheets!");
        })
        .catch(err => console.log("Fout bij ophalen Google Sheet Data: ", err));
}

// NIEUW: Stuur de complete status door naar Google Sheets
function saveDataToSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: "sync_all",
            activeOrders: activeOrders,
            memberTotals: memberTotals,
            stockStatus: stockStatus
        })
    }).catch(err => console.log("Google Sheet Sync Error: ", err));
}

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    socket.emit('init-totals', memberTotals);
    socket.emit('stock-update', stockStatus);

    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => { socket.emit('bar-order', order); });
    });

    socket.on('toggle-drink', (drinkId) => {
        if (stockStatus[drinkId] !== undefined) {
            stockStatus[drinkId] = !stockStatus[drinkId];
            io.emit('stock-update', stockStatus);
            saveDataToSheets(); // Sla op in de cloud
        }
    });

    socket.on('order', (data) => {
        for (let orderedDrink of data.drinks) {
            const drinkDefinition = drinks.find(d => d.n === orderedDrink.name);
            if (drinkDefinition && stockStatus[drinkDefinition.id] === false) {
                socket.emit('ready', "FOUT: Dit drankje is helaas net opgeraakt!");
                return; 
            }
        }
        data.id = Date.now() + Math.random().toString(36).substr(2, 9);
        activeOrders.push(data);
        io.emit('bar-order', data);
        io.emit('queue', activeOrders.length);
        saveDataToSheets(); // Sla op in de cloud
    });

    socket.on('done', (orderId, name) => {
        const completedOrder = activeOrders.find(order => order.id === orderId);
        if (completedOrder) {
            const memberName = completedOrder.name.trim();
            if (!memberTotals[memberName]) memberTotals[memberName] = {};

            completedOrder.drinks.forEach(drink => {
                const drinkKey = `${drink.name} [${drink.strength}]`;
                memberTotals[memberName][drinkKey] = (memberTotals[memberName][drinkKey] || 0) + 1;
            });
            io.emit('update-totals', memberTotals);
        }
        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
        saveDataToSheets(); // Sla op in de cloud
    });
});

// Start de server en laad de data in
http.listen(process.env.PORT || 3000, () => {
    console.log('Bar Live met Google Sheets crashbeveiliging!');
    loadDataFromSheets();
});
