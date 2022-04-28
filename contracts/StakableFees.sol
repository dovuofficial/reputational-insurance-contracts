/// @author Matt Smithies (DOVU Global Limited)

/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StakableFees {

    // This is the current stake fee when a user stakes to an entity
    // Inferred as 100 / 5
    int64 internal _stakeFee = 20;

    function setStakeFee(int64 fee_) public {
        _stakeFee = fee_;
    }

    function getPreStakeFee() public view returns (int64) {
        return _stakeFee;
    }
}
