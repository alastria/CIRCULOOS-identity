/**
 * Expiration utilities for Verifiable Credentials
 */

export interface ExpirationStatus {
    isExpired: boolean;
    isExpiringSoon: boolean; // < 7 days
    daysUntilExpiration: number | null;
    expirationDate: Date | null;
}

/**
 * Check expiration status of a VC
 */
export function getExpirationStatus(vc: any): ExpirationStatus {
    if (!vc.expirationDate) {
        return {
            isExpired: false,
            isExpiringSoon: false,
            daysUntilExpiration: null,
            expirationDate: null,
        };
    }

    const now = new Date();
    const expirationDate = new Date(vc.expirationDate);

    if (isNaN(expirationDate.getTime())) {
        // Invalid date
        return {
            isExpired: false,
            isExpiringSoon: false,
            daysUntilExpiration: null,
            expirationDate: null,
        };
    }

    const msUntilExpiration = expirationDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(msUntilExpiration / (1000 * 60 * 60 * 24));

    return {
        isExpired: daysUntilExpiration < 0,
        isExpiringSoon: daysUntilExpiration >= 0 && daysUntilExpiration <= 7,
        daysUntilExpiration,
        expirationDate,
    };
}

/**
 * Format expiration status for display
 */
export function formatExpirationStatus(status: ExpirationStatus): string {
    if (!status.expirationDate) {
        return 'No expiration';
    }

    const expirationDateString = status.expirationDate.toLocaleDateString();

    if (status.isExpired) {
        return `EXPIRED on ${expirationDateString}`;
    }

    if (status.isExpiringSoon) {
        const days = status.daysUntilExpiration!;
        return `Expires in ${days} day${days !== 1 ? 's' : ''} on ${expirationDateString}`;
    }

    // If not expired and not expiring soon, it's valid
    return `Expires on ${expirationDateString}`;
}

export function getExpirationEmoji(status: ExpirationStatus): string {
    if (!status.expirationDate) return '';
    if (status.isExpired) return 'EXPIRED';
    if (status.isExpiringSoon) return 'EXPIRING SOON';
    return 'VALID';
}
