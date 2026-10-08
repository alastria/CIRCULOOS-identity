// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { LibPausableStorage } from "../storage/LibPausableStorage.sol";
import { LibOwnership } from "./LibOwnership.sol";
import { IPausable } from "../facets/Pausable/IPausable.sol";

library LibPausable {
    function enforceNotPaused() internal view {
        if (LibPausableStorage.layout().paused) revert IPausable.EnforcedPause();
    }

    function isPauser(address account) internal view returns (bool) {
        return account == LibOwnership.contractOwner() || LibPausableStorage.layout().pausers[account];
    }

    function enforcePauser(address caller) internal view {
        if (!isPauser(caller)) revert IPausable.NotPauser(caller);
    }

    function pause() internal {
        LibPausableStorage.Layout storage l = LibPausableStorage.layout();
        if (l.paused) revert IPausable.AlreadyPaused();
        l.paused = true;
    }

    function unpause() internal {
        LibPausableStorage.Layout storage l = LibPausableStorage.layout();
        if (!l.paused) revert IPausable.NotPaused();
        l.paused = false;
    }

    function paused() internal view returns (bool) {
        return LibPausableStorage.layout().paused;
    }

    function setPauser(address account, bool enabled) internal {
        LibPausableStorage.layout().pausers[account] = enabled;
    }
}
