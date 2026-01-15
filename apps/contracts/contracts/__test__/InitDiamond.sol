// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract InitDiamond {
    event InitCalled();
    function init() external {
        emit InitCalled();
    }
}

