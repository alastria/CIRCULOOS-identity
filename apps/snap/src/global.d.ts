import { SnapsProvider } from '@metamask/snaps-sdk';

declare global {
    const snap: SnapsProvider;
    const ethereum: {
        request: (args: { method: string; params?: any[] }) => Promise<any>;
    } | undefined;
}

export { };
