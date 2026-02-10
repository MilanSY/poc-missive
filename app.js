import { CONFIG } from './config.js';

// Éléments DOM
let statusEl, infoEl, artworksSection, artworksList;

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    statusEl = document.getElementById('status');
    infoEl = document.getElementById('client-info');
    artworksSection = document.getElementById('artworks-section');
    artworksList = document.getElementById('artworks-list');

    // Initialiser l'intégration Missive
    initializeMissive();
});

/**
 * Récupère les œuvres associées à un client
 * @param {string} email - Email du client
 */
async function getClientArtworks(email) {
    if (!email) {
        artworksSection.style.display = 'none';
        return;
    }

    artworksSection.style.display = 'block';
    artworksList.innerHTML = '<div class="loading">🔍 Chargement des œuvres...</div>';

    const headers = CONFIG.DIRECTUS_TOKEN ? { 'Authorization': `Bearer ${CONFIG.DIRECTUS_TOKEN}` } : {};

    try {
        // 1. Trouver le client par email
        console.log('Recherche client:', email);
        const clientResponse = await fetch(
            `${CONFIG.DIRECTUS_URL}/items/clients?filter[email][_eq]=${encodeURIComponent(email)}`,
            { headers }
        );
        const clientData = await clientResponse.json();
        console.log('Client data:', clientData);

        if (!clientData.data || clientData.data.length === 0) {
            artworksList.innerHTML = '<div class="no-results">Client non trouvé</div>';
            return;
        }

        const clientId = clientData.data[0].id;
        console.log('Client ID:', clientId);

        // 2. Récupérer les œuvres liées au client avec toutes les infos
        const worksResponse = await fetch(
            `${CONFIG.DIRECTUS_URL}/items/clients_works?filter[clients_id][_eq]=${clientId}&fields=works_id.*,works_id.artist_id.name,works_id.category_id.name`,
            { headers }
        );
        const worksData = await worksResponse.json();
        console.log('Works data:', worksData);

        if (worksData.data && worksData.data.length > 0) {
            artworksList.innerHTML = worksData.data.map(item => {
                const work = item.works_id;
                if (!work) return '';

                return renderArtworkItem(work);
            }).filter(html => html).join('');
        } else {
            artworksList.innerHTML = '<div class="no-results">Aucune œuvre associée à ce contact</div>';
        }
    } catch (error) {
        console.error('Erreur récupération œuvres:', error);
        artworksList.innerHTML = '<div class="no-results">⚠️ Erreur lors du chargement des œuvres</div>';
    }
}

/**
 * Génère le HTML pour un item d'œuvre
 * @param {Object} work - Données de l'œuvre
 * @returns {string} HTML de l'item
 */
function renderArtworkItem(work) {
    // Parser les images JSON
    let images = [];
    try {
        images = work.images ? JSON.parse(work.images) : [];
    } catch (e) {
        images = [];
    }

    const imageUrl = images[0] || 'https://via.placeholder.com/120';
    const artistName = work.artist_id?.name || 'Artiste inconnu';
    const categoryName = work.category_id?.name || '';

    // SVG fallback pour les images manquantes
    const fallbackSvg = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect fill=%22%23ddd%22 width=%22120%22 height=%22120%22/%3E%3Ctext fill=%22%23999%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EImage%3C/text%3E%3C/svg%3E';

    return `
        <div class="artwork-item">
            <img src="${imageUrl}" 
                 alt="${work.name}" 
                 class="artwork-image" 
                 onerror="this.onerror=null; this.src='${fallbackSvg}';">
            <div class="artwork-info">
                <div class="artwork-title">${work.name}</div>
                <div class="artwork-artist">${artistName}</div>
                <div class="artwork-meta">
                    ${categoryName ? `📂 ${categoryName}` : ''}
                    ${work.date_created ? ` • 📅 ${work.date_created}` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Traite les données de conversation Missive
 * @param {Object} conv - Données de la conversation
 */
function handleConversationData(conv) {
    if (!conv) return;

    // Extraire email et nom
    const email = conv.contact?.emails?.[0] ||
        conv.messages?.[conv.messages.length - 1]?.from_field?.address ||
        'Non trouvé';
    const name = conv.contact?.name ||
        conv.messages?.[conv.messages.length - 1]?.from_field?.name ||
        'Non spécifié';

    // Afficher les informations du contact
    if (statusEl) {
        statusEl.innerText = "✅ Contact identifié";
        statusEl.style.color = "green";
    }

    infoEl.innerHTML = `
        <strong>Nom:</strong> ${name}<br>
        <strong>Email:</strong> ${email}<br>
    `;

    // Récupérer les œuvres du client
    getClientArtworks(email);
}

/**
 * Initialise l'intégration Missive
 */
function initializeMissive() {
    // Écouter les changements de conversation
    Missive.on('change:conversations', (conversations) => {
        if (!conversations || conversations.length === 0) return;

        // Si on reçoit un ID, récupérer les détails
        if (typeof conversations[0] === 'string') {
            const id = conversations[0];

            Missive.fetchConversation(id)
                .then(conv => handleConversationData(conv))
                .catch(err => {
                    console.error('Erreur:', err);
                });
        }
    });
}
