// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamondCut } from "../libraries/LibDiamondCut.sol";
import { LibDiamondStorage } from "../storage/LibDiamondStorage.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";

/**
 * @title LibDiamondCutWrapper
 * @notice Wrapper contract to expose internal LibDiamondCut functions for testing
 * @dev This contract is ONLY for testing purposes and should NOT be deployed to production
 */
contract LibDiamondCutWrapper {
    
    function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) external {
        LibDiamondCut.addFunctions(_facetAddress, _functionSelectors);
    }

    function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) external {
        LibDiamondCut.replaceFunctions(_facetAddress, _functionSelectors);
    }

    function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) external {
        LibDiamondCut.removeFunctions(_facetAddress, _functionSelectors);
    }

    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) external {
        LibDiamondCut.diamondCut(_diamondCut, _init, _calldata);
    }

    function initializeDiamondCut(address _init, bytes memory _calldata) external {
        LibDiamondCut.initializeDiamondCut(_init, _calldata);
    }

    // Helper to check storage state
    function getFacetAddress(bytes4 selector) external view returns (address) {
        return LibDiamondStorage.diamondStorage().selectorToFacetAndPosition[selector].facetAddress;
    }

    function getFacetSelectors(address facet) external view returns (bytes4[] memory) {
        return LibDiamondStorage.diamondStorage().facetFunctionSelectors[facet].functionSelectors;
    }

    function getAllFacetAddresses() external view returns (address[] memory) {
        return LibDiamondStorage.diamondStorage().facetAddresses;
    }
}

