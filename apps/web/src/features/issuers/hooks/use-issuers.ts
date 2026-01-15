import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { issuersService } from "../services/issuers-service"
import type { IssuersListParams, RegisterIssuerRequest } from "../types"

/**
 * Query Keys for Issuers
 */
export const issuerKeys = {
  all: ["issuers"] as const,
  lists: () => [...issuerKeys.all, "list"] as const,
  list: (params?: IssuersListParams) => [...issuerKeys.lists(), params] as const,
  details: () => [...issuerKeys.all, "detail"] as const,
  detail: (id: string) => [...issuerKeys.details(), id] as const,
}

/**
 * Hook to get list of issuers
 */
export function useIssuers(params?: IssuersListParams) {
  return useQuery({
    queryKey: issuerKeys.list(params),
    queryFn: () => issuersService.list(params),
  })
}

/**
 * Hook to get an issuer by ID
 */
export function useIssuer(id: string) {
  return useQuery({
    queryKey: issuerKeys.detail(id),
    queryFn: () => issuersService.getById(id),
    enabled: !!id,
  })
}

/**
 * Hook to register issuer
 */
export function useRegisterIssuer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RegisterIssuerRequest) => issuersService.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issuerKeys.lists() })
    },
  })
}

/**
 * Hook to deactivate issuer
 */
export function useDeactivateIssuer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => issuersService.deactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: issuerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: issuerKeys.detail(id) })
    },
  })
}
