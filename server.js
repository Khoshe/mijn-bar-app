const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwO2pvYCy-jJao_526bvZFJcuyt3FEBOlTJ-PS50KoMF2RKXheCHiHsAI0jISV3FWi8/exec";

let activeOrders = [];
let memberTotals = {};
let completedOrders = []; // NIEUW: Houdt tijdelijk namen bij die klaar zijn bij de bar

const drinks = [
    {id:"daiquiri", n:"Strawberry Daiquiri"},
    {id:"ginfizz", n:"Passion For Fruit"},
    {id:"sunrise", n:"Tequila Sunrise"},
    {id:"goldrush", n:"Appletini"},
    {id:"bluelagoon", n:"Blue Lagoon"},
    {id:"longisland", n:"Long Island Iced Tea"}
];

let stockStatus = { daiquiri: true, ginfizz: true, sunrise: true, goldrush: true, bluelagoon: true, longisland: true };

function loadDataFromSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL)
        .then(res => res.json())
        .then(data => {
            if (data.activeOrders) activeOrders = data.activeOrders;
            if (data.memberTotals) memberTotals = data.memberTotals;
            if (data.stockStatus && Object.keys(data.stockStatus).length > 0) stockStatus = data.stockStatus;
            console.log("➡️ Cloud-geheugen succesvol ingeladen uit Cel Z1!");
            
            io.emit('queue', activeOrders.length);
            io.emit('init-totals', memberTotals);
            io.emit('stock-update', stockStatus);
            io.emit('status-update', { active: activeOrders, completed: completedOrders }); // NIEUW
        })
        .catch(err => console.log("Google Sheet leeg of nog geen data aanwezig: ", err));
}

function saveDataToSheets() {
    if (!GOOGLE_SHEET_URL) return;
    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeOrders: activeOrders, memberTotals: memberTotals, stockStatus: stockStatus })
    }).catch(err => console.log("Google Sheet Backup Fout: ", err));
}

io.on('connection', (socket) => {
    socket.emit('queue', activeOrders.length);
    socket.emit('init-totals', memberTotals);
    socket.emit('stock-update', stockStatus);
    socket.emit('status-update', { active: activeOrders, completed: completedOrders }); // NIEUW: Geef direct status bij laden page

    socket.on('request-existing-orders', () => {
        activeOrders.forEach(order => { socket.emit('bar-order', order); });
    });

    socket.on('toggle-drink', (drinkId) => {
        if (stockStatus[drinkId] !== undefined) {
            stockStatus[drinkId] = !stockStatus[drinkId];
            io.emit('stock-update', stockStatus);
            saveDataToSheets();
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
        io.emit('status-update', { active: activeOrders, completed: completedOrders }); // NIEUW: Update statusscherm
        saveDataToSheets();
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

            // NIEUW: Voeg naam toe aan 'Klaar bij de bar' lijst
            const cleanName = memberName;
            if (!completedOrders.includes(cleanName)) {
                completedOrders.push(cleanName);
                
                // Verwijder de naam automatisch na 20 seconden uit de 'Klaar' lijst
                setTimeout(() => {
                    completedOrders = completedOrders.filter(n => n !== cleanName);
                    io.emit('status-update', { active: activeOrders, completed: completedOrders });
                }, 20000);
            }
        }

        activeOrders = activeOrders.filter(order => order.id !== orderId);
        io.emit('queue', activeOrders.length);
        io.emit('ready', name.trim().toLowerCase());
        io.emit('status-update', { active: activeOrders, completed: completedOrders }); // NIEUW: Update statusscherm
        saveDataToSheets();
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log('Bar live en stabiel met live statusscherm support!');
    loadDataFromSheets();
});
