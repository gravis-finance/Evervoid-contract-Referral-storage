//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../interfaces/IReferralStorage.sol";

contract ProgramMock {

    IReferralStorage public referralStorage;

    constructor(address referralStorage_) {
        referralStorage = IReferralStorage(referralStorage_);
    }

    function join(address referrer) external {
        referralStorage.refer(msg.sender, referrer);
    }
}