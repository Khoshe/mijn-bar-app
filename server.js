const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Jouw Google Web-App URL staat hier permanent ingebouwd
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxizF1chLZuYrX_gwS9N12lK5GcP8YU0dKHGGbGATW160wLcyWnvo7B3PiIgApKVFjkaA/exec";

let activeOrders = [];
let memberTotals = {};

// De drankenlijst op de server om binnenkomende namen te mappen naar IDs voor de voorraadcontrole
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

// Functie om bij het opstarten direct de data op te halen uit Google Sheets (doGet)
function loadDataFromSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL)
        .then(res => res.json())
        .then(data => {
            if (data.activeOrders) activeOrders = data.activeOrders;
            if (data.memberTotals) memberTotals = data.memberTotals;
            if (data.stockStatus && Object.keys(data.stockStatus).length > 0) stockStatus = data.stockStatus;
            console.log("➡️ Succesvol data hersteld uit Google Sheets!");
            
            // Update eventuele al verbonden clients direct met de herstelde data
            io.emit('queue', activeOrders.length);
            io.emit('init-totals', memberTotals);
            io.emit('stock-update', stockStatus);
        })
        .catch(err => console.log("Fout of leeg bij ophalen Google Sheet Data: ", err));
}

// Functie om de complete status door te sturen naar de tabbladen in Google Sheets (doPost)
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
    // Stuur direct de actuele stand van zaken naar het verbonden scherm
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
            stockStatus[drinkId] = !stockStatus[drinkId]; // Draai status om (true <-> false)
            io.emit('stock-update', stockStatus); // Push direct live naar alle klanten en dashboards
            saveDataToSheets(); // Synchroniseer met de cloud
        }
    });

    // Server-side controle op de live voorraadstatus om misbruik te voorkomen
    socket.on('order', (data) => {
        for (let orderedDrink of data.drinks) {
            const drinkDefinition = drinks.find(d => d.n === orderedDrink.name);
            
            if (drinkDefinition && stockStatus[drinkDefinition.id] === false) {
                console.log(`[BLOKKADE] ${data.name} probeerde een uitverkocht drankje te bestellen: ${orderedDrink.name}`);
                socket.emit('ready', "FOUT: Een van de gekozen drankjes is helaas net opgeraakt! Probeer het opnieuw.");
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
        saveDataToSheets(); // Update de wachtrij en totalen in de cloud
    });
});

// Start de server en laad direct de back-up data uit de sheet in
http.listen(process.env.PORT || 3000, () => {
    console.log('Bar Live met Google Sheets crashbeveiliging!');
    loadDataFromSheets();
});
