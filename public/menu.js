// EERST de verbinding maken met de server
const socket = io();
let cart = [];

// Onthoudt per cocktail-id wat de geselecteerde sterkte is. Standaard altijd 'Sterk'.
const selectedStrengths = {
    daiquiri: 'Sterk', ginfizz: 'Sterk', sunrise: 'Sterk', goldrush: 'Sterk', bluelagoon: 'Sterk', longisland: 'Sterk'
};

// NU pas luisteren naar de live updates van de wachtrij
socket.on('queue-update', (count) => {
    const countSpan = document.getElementById('queue-count');
    if (countSpan) {
        countSpan.innerText = count;
    }
});

// Check bij openen of er al een account is opgeslagen
document.addEventListener("DOMContentLoaded", () => {
    let currentUserName = localStorage.getItem('lounge_user_name');
    if (currentUserName) {
        showMenuScreen(currentUserName);
    }
});

function registerAccount() {
    const nameInput = document.getElementById('username-input').value;
    if (!nameInput.trim()) { alert('Vul alstublieft een naam in.'); return; }
    
    localStorage.setItem('lounge_user_name', nameInput.trim());
    showMenuScreen(nameInput.trim());
}

function showMenuScreen(userName) {
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('menu-panel').style.display = 'block';
    document.getElementById('display-name').innerText = userName;
}

function logout() {
    localStorage.removeItem('lounge_user_name');
    location.reload();
}

// Wisselen van sterkte via de knoppen
function setStrength(itemId, level) {
    selectedStrengths[itemId] = level;
    const container = document.getElementById(`item-${itemId}`);
    const buttons = container.getElementsByClassName('strength-btn');
    
    // Reset actieve klassen en zet de juiste aan
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
    
    alert('Bestelling succesvol verzonden!');
    cart = [];
    document.getElementById('order-note').value = "";
    updateCartUI();
}
