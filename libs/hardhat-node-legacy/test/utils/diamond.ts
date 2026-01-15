/* global ethers */
import { ethers } from 'hardhat'
import { Contract } from 'ethers'

export enum FacetCutAction { Add = 0, Replace = 1, Remove = 2 }

// get function selectors from ABI
export function getSelectors(contract: Contract) {
  const signatures = Object.keys(contract.interface.functions)
  const selectors = signatures.reduce((acc: string[], val) => {
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getSighash(val))
    }
    return acc
  }, []) as string[] & { get: (funcNames: string[]) => string[], remove: (funcNames: string[]) => string[] }

  selectors.contract = contract
  selectors.remove = remove
  selectors.get = get
  
  return selectors
}

// get function selector from function signature
export function getSelector(func: string) {
  const abiInterface = new ethers.utils.Interface([func])
  return abiInterface.getSighash(ethers.utils.Fragment.from(func))
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
export function remove(this: any, functionNames: string[]) {
  const selectors = this.filter((v: any) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return false
      }
    }
    return true
  })
  selectors.contract = this.contract
  selectors.remove = this.remove
  selectors.get = this.get
  return selectors
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
export function get(this: any, functionNames: string[]) {
  const selectors = this.filter((v: any) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return true
      }
    }
    return false
  })
  selectors.contract = this.contract
  selectors.remove = this.remove
  selectors.get = this.get
  return selectors
}
