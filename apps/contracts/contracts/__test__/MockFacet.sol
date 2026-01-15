// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract MockFacet {
    event MockEvent();

    function mockFunc1() external {
        emit MockEvent();
    }

    function mockFunc2() external {}

    function mockFunc3() external {}

    function revertFunc() external pure {
        revert("MockFacet: Revert");
    }
}

