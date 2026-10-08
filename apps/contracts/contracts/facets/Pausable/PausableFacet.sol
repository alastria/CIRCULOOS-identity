// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IPausable } from "./IPausable.sol";
import { LibPausable } from "../../libraries/LibPausable.sol";
import { LibOwnership } from "../../libraries/LibOwnership.sol";

/**
 * @title PausableFacet
 * @notice Diamond-wide emergency brake for credential status writes (see IPausable).
 *         No initializer: the owner comes from the Diamond's own ownership storage, so the
 *         facet can be cut into an already deployed Diamond without an init call.
 */
contract PausableFacet is IPausable {
    function pause() external override {
        LibPausable.enforcePauser(msg.sender);
        LibPausable.pause();
        emit Paused(msg.sender);
    }

    function unpause() external override {
        LibPausable.enforcePauser(msg.sender);
        LibPausable.unpause();
        emit Unpaused(msg.sender);
    }

    function paused() external view override returns (bool) {
        return LibPausable.paused();
    }

    function grantPauserRole(address account) external override {
        LibOwnership.enforceIsContractOwner();
        LibPausable.setPauser(account, true);
        emit PauserGranted(account, msg.sender);
    }

    function revokePauserRole(address account) external override {
        LibOwnership.enforceIsContractOwner();
        LibPausable.setPauser(account, false);
        emit PauserRevoked(account, msg.sender);
    }

    function isPauser(address account) external view override returns (bool) {
        return LibPausable.isPauser(account);
    }
}
