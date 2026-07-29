const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Jouw Google Web-App URL staat hier permanent in ingebouwd
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwO2pvYCy-jJao_526bvZFJcuyt3FEBOlTJ-PS50KoMF2RKXheCHiHsAI0jISV3FWi8/exec";

let activeOrders = [];
let memberTotals = {};

const drinks = [
    {id:"daiquiri", n:"Strawberry Daiquiri"},
    {id:"ginfizz", n:"Passion For Fruit"},
    {id:"sunrise", n:"Tequila Sunrise"},
    {id:"goldrush", n:"Appletini"},
    {id:"bluelagoon", n:"Blue Lagoon"},
    {id:"longisland", n:"Long Island Iced Tea"}
];

let stockStatus = {
    daiquiri: true,
    ginfizz: true,
    sunrise: true,
    goldrush: true,
    bluelagoon: true,
    longisland: true
};

// Vraagt cel A1 op uit Google Sheets bij opstarten van de server
function loadDataFromSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL)
        .then(res => res.json())
        .then(data => {
            if (data.activeOrders) activeOrders = data.activeOrders;
            if (data.memberTotals) memberTotals = data.memberTotals;
            if (data.stockStatus && Object.keys(data.stockStatus).length > 0) stockStatus = data.stockStatus;
            console.log("➡️ Cloud-geheugen succesvol ingeladen uit Cel A1!");
            
            // Update direct alle verbonden telefoons en dashboards
            io.emit('queue', activeOrders.length);
            io.emit('init-totals', memberTotals);
            io.emit('stock-update', stockStatus);
        })
        .catch(err => console.log("Google Sheet leeg of nog geen data aanwezig: ", err));
}

// Pushed de complete status als JSON-string terug naar cel A1
function saveDataToSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            activeOrders: activeOrders,
            memberTotals: memberTotals,
            stockStatus: stockStatus
        })
    }).catch(err => console.log("Google Sheet Backup Fout: ", err));
}

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    socket.emit('init-totals', memberTotals);
    socket.emit('stock-update', stockStatus);

    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => {
            socket.emit('bar-order', order);
        });
    });

    socket.on('toggle-drink', (drinkId) => {
        if (stockStatus[drinkId] !== undefined) {
            stockStatus[drinkId] = !stockStatus[drinkId];
            io.emit('stock-update', stockStatus);
            saveDataToSheets(); // Back-up opslaan
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
        saveDataToSheets(); // Back-up opslaan
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
            });
            
            io.emit('update-totals', memberTotals);
        }

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
        saveDataToSheets(); // Back-up opslaan
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log('Bar live en stabiel!');
    loadDataFromSheets();
});
