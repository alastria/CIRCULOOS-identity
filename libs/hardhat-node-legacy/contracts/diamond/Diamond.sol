// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamondStorage } from "../storage/LibDiamondStorage.sol";
import { LibDiamondCut } from "../libraries/LibDiamondCut.sol";
import { LibOwnership } from "../libraries/LibOwnership.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";

contract Diamond {
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        LibOwnership.setContractOwner(_contractOwner);
        
        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
        LibDiamondCut.diamondCut(cut, address(0), "");
    }

    // Find facet for function that is called and execute the
    // function if it is found.
    fallback() external payable {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
        address facetAddress = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facetAddress != address(0), "Diamond: Function does not exist");
        assembly {
            // Copy function call data into free memory for use as delegatecall data
            calldatacopy(0, 0, calldatasize())
            // Delegatecall into facet
            let result := delegatecall(gas(), facetAddress, 0, calldatasize(), 0, 0)
            // Revert if delegatecall failed
            switch result
            case 0 {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
            // Return data from delegatecall
            default {
                returndatacopy(0, 0, returndatasize())
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}
