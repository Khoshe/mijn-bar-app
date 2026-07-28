const socket = io();

document.addEventListener("DOMContentLoaded", () => {
    const orderList = document.getElementById('order-list');
    const sound = document.getElementById('notification-sound');

    socket.on('bar-receive-order', (data) => {
        sound.play().catch(e => console.log("Muted"));

        const counts = {};
        data.drinks.forEach(item => {
            const key = `${item.name}|||${item.strength}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        const drinkItemsHtml = Object.entries(counts)
            .map(([key, qty]) => {
                const [name, strength] = key.split('|||');
                const badgeClass = strength === 'Sterk' ? 'sterk' : 'medium';
                return `<li><strong>${qty}x</strong> ${name} <span class="badge ${badgeClass}">${strength}</span></li>`;
            })
            .join('');

        let noteHtml = '';
        if (data.note && data.note.trim() !== "") {
            noteHtml = `<div style="background: #2d2d3a; border-left: 3px solid #ff9f43; padding: 8px 12px; margin-top: 12px; border-radius: 4px; font-size: 14px; font-style: italic; color: #ff9f43;">📝 "${data.note}"</div>`;
        }

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-details">
                <h3>Bestelling van: <span style="color: var(--gold); font-weight:bold;">${data.name}</span></h3>
                <ul class="drink-list">${drinkItemsHtml}</ul>
                ${noteHtml}
                <span class="time-stamp">${data.time}</span>
            </div>
            <button class="done-btn">Klaar</button>
        `;

        const doneBtn = card.querySelector('.done-btn');
        doneBtn.addEventListener('click', () => {
            // VERANDERD: Stuur de naam van de klant mee naar de server!
            socket.emit('order-completed', data.name);
            card.remove();
        });
        
        orderList.insertBefore(card, orderList.firstChild);
    });
});
