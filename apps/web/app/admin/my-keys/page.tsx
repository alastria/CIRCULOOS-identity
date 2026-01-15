"use client"

import { useState, useEffect } from "react"
import { useAccount, useWriteContract } from "wagmi"
import { useQuery } from "@tanstack/react-query"
import { Search, AlertTriangle, FileCheck, User, Calendar, Hash, Loader2, Ban, PauseCircle, PlayCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { config } from "@/config"

// ABI for CredentialStatusFacet (simplified for what we need)
const CREDENTIAL_STATUS_ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "vcHash",
                "type": "bytes32"
            }
        ],
        "name": "revokeCredential",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "vcHash",
                "type": "bytes32"
            },
            {
                "internalType": "bool",
                "name": "suspended",
                "type": "bool"
            }
        ],
        "name": "updateCredentialStatus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

export default function AdminMyKeysPage() {
    const { t } = useI18n()
    const { address } = useAccount()
    const [selectedCredential, setSelectedCredential] = useState<any>(null)
    const [actionType, setActionType] = useState<'revoke' | 'suspend' | 'unsuspend' | null>(null)
    const { writeContractAsync } = useWriteContract()

    // Fetch credentials issued by me
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['admin', 'my-keys', address],
        queryFn: () => api.admin.getBlockchainCredentials({ issuer: address, limit: 50 }),
        enabled: !!address
    })

    const handleAction = async () => {
        if (!selectedCredential || !actionType) return

        try {
            const vcHash = selectedCredential.credential_hash // Assuming API returns this

            if (actionType === 'revoke') {
                await writeContractAsync({
                    address: config.contracts.credentialStatus as `0x${string}`, // Need to ensure this is in config
                    abi: CREDENTIAL_STATUS_ABI,
                    functionName: 'revokeCredential',
                    args: [vcHash as `0x${string}`],
                })
                toast.success(t("admin.myKeys.messages.revokeSent"))
            } else if (actionType === 'suspend') {
                await writeContractAsync({
                    address: config.contracts.credentialStatus as `0x${string}`,
                    abi: CREDENTIAL_STATUS_ABI,
                    functionName: 'updateCredentialStatus',
                    args: [vcHash as `0x${string}`, true],
                })
                toast.success(t("admin.myKeys.messages.suspendSent"))
            } else if (actionType === 'unsuspend') {
                await writeContractAsync({
                    address: config.contracts.credentialStatus as `0x${string}`,
                    abi: CREDENTIAL_STATUS_ABI,
                    functionName: 'updateCredentialStatus',
                    args: [vcHash as `0x${string}`, false],
                })
                toast.success(t("admin.myKeys.messages.unsuspendSent"))
            }

            setSelectedCredential(null)
            setActionType(null)
            // Refetch after a delay to allow indexing (in a real app, we'd wait for tx receipt)
            setTimeout(() => refetch(), 5000)
        } catch (error) {
            console.error('Action failed:', error)
            toast.error(t("admin.myKeys.messages.error"))
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t("admin.myKeys.title")}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("admin.myKeys.subtitle")}</p>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : data?.credentials?.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {data.credentials.map((cred: any) => (
                            <div key={cred.credential_hash} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                            {cred.credential_hash.slice(0, 10)}...
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cred.is_revoked
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                            : cred.is_suspended // Assuming API returns this
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            }`}>
                                            {cred.is_revoked ? t("admin.myKeys.status.revoked") : cred.is_suspended ? t("admin.myKeys.status.suspended") : t("admin.myKeys.status.active")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {t("admin.myKeys.issued")}: {new Date(cred.timestamp * 1000).toLocaleString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!cred.is_revoked && (
                                        <>
                                            {cred.is_suspended ? (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setSelectedCredential(cred)
                                                    setActionType('unsuspend')
                                                }}>
                                                    <PlayCircle className="w-4 h-4 mr-2" />
                                                    {t("admin.myKeys.actions.unsuspend")}
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setSelectedCredential(cred)
                                                    setActionType('suspend')
                                                }}>
                                                    <PauseCircle className="w-4 h-4 mr-2" />
                                                    {t("admin.myKeys.actions.suspend")}
                                                </Button>
                                            )}

                                            <Button variant="destructive" size="sm" onClick={() => {
                                                setSelectedCredential(cred)
                                                setActionType('revoke')
                                            }}>
                                                <Ban className="w-4 h-4 mr-2" />
                                                {t("admin.myKeys.actions.revoke")}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        {t("admin.myKeys.noCredentials")}
                    </div>
                )}
            </div>

            {/* Action Dialog */}
            <AlertDialog open={!!selectedCredential} onOpenChange={(open) => !open && setSelectedCredential(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionType === 'revoke' ? t("admin.myKeys.dialogs.revokeTitle") : actionType === 'suspend' ? t("admin.myKeys.dialogs.suspendTitle") : t("admin.myKeys.dialogs.unsuspendTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionType === 'revoke'
                                ? t("admin.myKeys.dialogs.revokeDescription")
                                : actionType === 'suspend'
                                    ? t("admin.myKeys.dialogs.suspendDescription")
                                    : t("admin.myKeys.dialogs.unsuspendDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("admin.myKeys.dialogs.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className={actionType === 'revoke' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                            onClick={handleAction}
                        >
                            {t("admin.myKeys.dialogs.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
