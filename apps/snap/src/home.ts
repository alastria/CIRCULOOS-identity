import { panel, heading, text, divider, copyable } from '@metamask/snaps-sdk';
import type { Component } from '@metamask/snaps-sdk';
import { getState } from './utils/storage';
import { getExpirationStatus, formatExpirationStatus } from './utils/expiration';

/**
 * Home page handler - displays when user opens the Snap from MetaMask
 */
export async function onHomePage() {
    const state = await getState();
    const vcCount = state.vcs.length;

    if (vcCount === 0) {
        // Empty state
        return {
            content: panel([
                heading('No Credentials Yet'),
                text('You haven\'t stored any Verifiable Credentials in this Snap.'),
                divider(),
                text('**How to add credentials:**'),
                text('1 Go to the Circuloos web app'),
                text('2 Claim a credential'),
                text('3 Click "Save to MetaMask Snap"'),
                divider(),
                text('Your credentials will be stored securely and encrypted.'),
            ]),
        };
    }

    // Calculate statistics
    let activeCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let favoriteCount = 0;

    state.vcs.forEach((storedVC) => {
        const expirationStatus = getExpirationStatus(storedVC.vc);
        if (expirationStatus.isExpired) {
            expiredCount++;
        } else if (expirationStatus.isExpiringSoon) {
            expiringSoonCount++;
        } else {
            activeCount++;
        }
        if (storedVC.favorite) {
            favoriteCount++;
        }
    });

    // Build home page content
    const elements: Component[] = [
        heading(`Your Credentials (${vcCount})`),
        text(`You have **${vcCount}** credential${vcCount > 1 ? 's' : ''} stored securely.`),
        divider(),
        text('**Statistics:**'),
        text(`├─ Active: ${activeCount}`),
        text(`├─ Expiring soon: ${expiringSoonCount}`),
        text(`├─ Expired: ${expiredCount}`),
        text(`└─ Favorites: ${favoriteCount}`),
        divider(),
    ];

    // Display each VC with enhanced info
    state.vcs.forEach((storedVC, index) => {
        const vc = storedVC.vc;
        const issuer = storedVC.issuer;
        const credType = storedVC.type.find((t: string) => t !== 'VerifiableCredential') || 'Credential';
        const issuedDate = new Date(storedVC.issuedAt).toLocaleDateString();
        const expirationStatus = getExpirationStatus(vc);

        // Category emoji
        const categoryEmoji = getCategoryEmoji(storedVC.category);

        // Favorite star
        const favoriteIcon = storedVC.favorite ? '★ ' : '';

        elements.push(
            heading(`${favoriteIcon}${categoryEmoji} #${index + 1}: ${credType}`),
            text(`**Issuer:** ${issuer.substring(0, 35)}${issuer.length > 35 ? '...' : ''}`),
            text(`**Status:** ${formatExpirationStatus(expirationStatus)}`),
            text(`**Saved:** ${issuedDate}`),
        );

        // Show category and tags if present
        if (storedVC.category) {
            text(`**Category:** ${storedVC.category}`);
        }
        if (storedVC.tags && storedVC.tags.length > 0) {
            elements.push(text(`**Tags:** ${storedVC.tags.join(', ')}`));
        }

        // Show ID (copyable)
        elements.push(copyable(storedVC.id));

        if (index < vcCount - 1) {
            elements.push(divider());
        }
    });

    // Add warning if credentials expiring soon
    if (expiringSoonCount > 0) {
        elements.push(divider());
        elements.push(text(`**${expiringSoonCount}** credential${expiringSoonCount > 1 ? 's' : ''} expiring soon! Consider renewing.`));
    }

    return {
        content: panel(elements),
    };
}

/**
 * Get emoji for category
 */
function getCategoryEmoji(category?: string): string {
    switch (category) {
        case 'work':
            return '';
        case 'education':
            return '';
        case 'identity':
            return '';
        case 'finance':
            return '';
        case 'other':
        default:
            return '';
    }
}
