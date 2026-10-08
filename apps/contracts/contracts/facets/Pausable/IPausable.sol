// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IPausable
 * @notice Emergency brake for the credential status registry. While paused, every credential
 *         status write (record, revoke, suspend) reverts with EnforcedPause; reads and trusted
 *         issuer management keep working, so the owner can remove a compromised key.
 *         The Diamond owner is always a pauser; other accounts get the role from the owner.
 */
interface IPausable {
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event PauserGranted(address indexed account, address indexed grantedBy);
    event PauserRevoked(address indexed account, address indexed revokedBy);

    error NotPauser(address caller);
    error EnforcedPause();
    error AlreadyPaused();
    error NotPaused();

    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);

    function grantPauserRole(address account) external;
    function revokePauserRole(address account) external;
    function isPauser(address account) external view returns (bool);
}
