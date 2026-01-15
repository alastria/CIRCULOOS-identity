// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibDiamondStorage } from "../storage/LibDiamondStorage.sol";

library LibOwnership {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setContractOwner(address _newOwner) internal {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address contractOwner_) {
        contractOwner_ = LibDiamondStorage.diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        require(msg.sender == LibDiamondStorage.diamondStorage().contractOwner, "LibOwnership: Must be contract owner");
    }
}

