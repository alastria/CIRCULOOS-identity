import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { credentialsService } from "../services/credentials-service"
import type {
  CredentialsListParams,
  IssueCredentialRequest,
  RevokeCredentialRequest,
  VerifyCredentialRequest,
} from "../types"

/**
 * Query Keys for Credentials
 */
export const credentialKeys = {
  all: ["credentials"] as const,
  lists: () => [...credentialKeys.all, "list"] as const,
  list: (params?: CredentialsListParams) => [...credentialKeys.lists(), params] as const,
  details: () => [...credentialKeys.all, "detail"] as const,
  detail: (id: string) => [...credentialKeys.details(), id] as const,
}

/**
 * Hook to get list of credentials
 */
export function useCredentials(params?: CredentialsListParams) {
  return useQuery({
    queryKey: credentialKeys.list(params),
    queryFn: () => credentialsService.list(params),
  })
}

/**
 * Hook to get a credential by ID
 */
export function useCredential(id: string) {
  return useQuery({
    queryKey: credentialKeys.detail(id),
    queryFn: () => credentialsService.getById(id),
    enabled: !!id,
  })
}

/**
 * Hook to issue credential
 */
export function useIssueCredential() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: IssueCredentialRequest) => credentialsService.issue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.lists() })
    },
  })
}

/**
 * Hook to verify credential
 */
export function useVerifyCredential() {
  return useMutation({
    mutationFn: (data: VerifyCredentialRequest) => credentialsService.verify(data),
  })
}

/**
 * Hook to revoke credential
 */
export function useRevokeCredential() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RevokeCredentialRequest) => credentialsService.revoke(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: credentialKeys.detail(variables.credentialId),
      })
    },
  })
}
