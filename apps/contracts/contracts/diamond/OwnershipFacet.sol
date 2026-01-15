// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IERC173 } from "../interfaces/IERC173.sol";
import { LibOwnership } from "../libraries/LibOwnership.sol";

contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        LibOwnership.enforceIsContractOwner();
        LibOwnership.setContractOwner(_newOwner);
    }

    function owner() external view override returns (address owner_) {
        owner_ = LibOwnership.contractOwner();
    }
}
