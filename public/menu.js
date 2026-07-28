const socket = io();
let cart = [];

// Onthoudt per cocktail-id wat de geselecteerde sterkte is. Standaard altijd 'Sterk'.
const selectedStrengths = {
    daiquiri: 'Sterk', ginfizz: 'Sterk', sunrise: 'Sterk', goldrush: 'Sterk', bluelagoon: 'Sterk', longisland: 'Sterk'
};

// Luister naar live updates van de wachtrij
socket.on('queue-update', (count) => {
    const countSpan = document.getElementById('queue-count');
    if (countSpan) { countSpan.innerText = count; }
});

// NIEUW: Luister live of jouw drankje klaar is gemaakt door de bartender
socket.on('drink-ready-notification', (clientName) => {
    const currentUserName = localStorage.getItem('lounge_user_name');
    
    // Alleen als de bartender jóuw naam heeft afgevinkt
    if (clientName === currentUserName) {
        // Haal de opgeslagen geschiedenis op
        let history = JSON.parse(localStorage.getItem('lounge_order_history')) || [];
        
        // Verander de status van alle 'In de wachtrij' drankjes naar 'Klaar! 🥃'
        history.forEach(item => {
            if (item.status === 'In de wachtrij') {
                item.status = 'Klaar! 🥃';
            }
        });
        
        // Sla de geschiedenis weer op en ververs het lijstje op het scherm
        localStorage.setItem('lounge_order_history', JSON.stringify(history));
        renderHistoryList();
        
        // Geef een chique pop-up notificatie op het scherm van je vriend
        alert("Je bestelling staat klaar bij de bar! 🎉");
    }
});

// Check bij openen of er al een account en geschiedenis is opgeslagen
document.addEventListener("DOMContentLoaded", () => {
    let currentUserName = localStorage.getItem('lounge_user_name');
    if (currentUserName) {
        showMenuScreen(currentUserName);
        renderHistoryList(); // Laad de opgeslagen geschiedenis in bij openen
    }
});

function registerAccount() {
    const nameInput = document.getElementById('username-input').value;
    if (!nameInput.trim()) { alert('Vul alstublieft een naam in.'); return; }
    
    localStorage.setItem('lounge_user_name', nameInput.trim());
    showMenuScreen(nameInput.trim());
    renderHistoryList();
}

function showMenuScreen(userName) {
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('menu-panel').style.display = 'block';
    document.getElementById('display-name').innerText = userName;
}

function logout() {
    localStorage.removeItem('lounge_user_name');
    localStorage.removeItem('lounge_order_history'); // Wis ook geschiedenis bij uitloggen
    location.reload();
}

function setStrength(itemId, level) {
    selectedStrengths[itemId] = level;
    const container = document.getElementById(`item-${itemId}`);
    const buttons = container.getElementsByClassName('strength-btn');
    
    for (let btn of buttons) {
        if (btn.innerText.trim() === level) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

function addToCart(drinkName, itemId) {
    const strength = selectedStrengths[itemId];
    cart.push({ name: drinkName, strength: strength });
    updateCartUI();
}

function updateCartUI() {
    const preview = document.getElementById('cart-preview');
    if (cart.length === 0) { preview.innerText = "Geen drankjes"; return; }
    
    const counts = {};
    cart.forEach(item => {
        const key = `${item.name} (${item.strength})`;
        counts[key] = (counts[key] || 0) + 1;
    });
    preview.innerText = Object.entries(counts).map(([label, qty]) => `${qty}x ${label}`).join(', ');
}

function sendOrder() {
    const currentUserName = localStorage.getItem('lounge_user_name');
    if(cart.length === 0) { alert('Kies eerst een drankje!'); return; }
    
    const noteInput = document.getElementById('order-note').value;
    
    socket.emit('new-order', { 
        name: currentUserName, 
        drinks: cart, 
        note: noteInput.trim(),
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    });
    
    // --- NIEUW: Sla de bestelling permanent op in de browser ---
    let history = JSON.parse(localStorage.getItem('lounge_order_history')) || [];
    
    cart.forEach(item => {
        history.push({
            name: item.name,
            strength: item.strength,
            status: 'In de wachtrij'
        });
    });
    
    localStorage.setItem('lounge_order_history', JSON.stringify(history));
    renderHistoryList();
    // -------------------------------------------------------------
    
    alert('Bestelling succesvol verzonden!');
    cart = [];
    document.getElementById('order-note').value = "";
    updateCartUI();
}

// NIEUW: Functie om de opgeslagen geschiedenis netjes op het scherm te tekenen
function renderHistoryList() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    historyList.innerHTML = ''; // Maak de lijst eerst leeg
    
    const history = JSON.parse(localStorage.getItem('lounge_order_history')) || [];
    
    if (history.length === 0) {
        historyList.innerHTML = `<li id="no-orders-text" style="list-style: none; margin-left: -20px; font-style: italic; color: #666;">Je hebt nog geen drankjes besteld.</li>`;
        return;
    }
    
    // Groepeer drankjes op naam + sterkte + status voor een strak overzicht
    const counts = {};
    history.forEach(item => {
        const key = `${item.name} (${item.strength})|||${item.status}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    
    Object.entries(counts).forEach(([key, qty]) => {
        const [label, status] = key.split('|||');
        const li = document.createElement('li');
        li.style.marginBottom = "5px";
        
        // Geef een groene kleur aan 'Klaar!', en oranje aan 'In de wachtrij'
        const statusColor = status.includes('Klaar') ? '#28a745' : '#ff9f43';
        
        li.innerHTML = `<strong>${qty}x</strong> ${label} — <span style="color: ${statusColor}; font-weight: bold;">${status}</span>`;
        historyList.appendChild(li);
    });
}
