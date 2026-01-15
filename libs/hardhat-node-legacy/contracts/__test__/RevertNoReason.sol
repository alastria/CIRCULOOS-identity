// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract RevertNoReason {
    function revertNow() external pure {
        revert(); // Reverts without data
    }
}

