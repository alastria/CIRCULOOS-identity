import { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { saveVC } from './rpc/saveVC';
import { getVCs } from './rpc/getVCs';
import { createVP } from './rpc/createVP';
import { deleteVC } from './rpc/deleteVC';
import { updateVC } from './rpc/updateVC';
import { exportVCs } from './rpc/exportVCs';
import { clearAll } from './rpc/clearAll';

export { onHomePage } from './home';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as defined by `@metamask/snaps-sdk`.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of the RPC method.
 * @throws If the request method is not valid.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
    switch (request.method) {
        case 'save_vc':
            return await saveVC(request.params as { vc: any });

        case 'get_vcs':
            return await getVCs(request.params as { type?: string; holderAddress?: string });

        case 'create_vp':
            return await createVP(request.params as {
                vcIds: string[];
                holderAddress: string;
                expiresInMinutes?: number;
            });

        case 'delete_vc':
            return await deleteVC(request.params as { vcId: string });

        case 'update_vc':
            return await updateVC(request.params as {
                vcId: string;
                category?: 'work' | 'education' | 'identity' | 'finance' | 'other';
                tags?: string[];
                favorite?: boolean;
            });

        case 'export_vcs':
            return await exportVCs();

        case 'clear_all':
            return await clearAll();

        default:
            throw new Error(`Method not found: ${request.method}`);
    }
};
