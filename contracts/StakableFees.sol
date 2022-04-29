/// @author Matt Smithies (DOVU Global Limited)

/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StakableFees {

    // This is the current stake fee when a user stakes to an entity
    // Inferred as percentages
    int64 internal _stakeFee = 5;

    int64 internal _penaltyFee = 80;

    function setStakeFee(int64 fee_) public {
        _stakeFee = fee_;
    }

    function getPreStakeFee() public view returns (int64) {
        return _stakeFee;
    }

    function setPenaltyFee(int64 fee_) public {
        _penaltyFee = fee_;
    }

    // If there is a request for a penalty, like a stake position is closed before ending.
    function getPenaltyFee(bool hasPenalty_) public view returns (int64) {
        return hasPenalty_ ? _penaltyFee : 0;
    }
}
