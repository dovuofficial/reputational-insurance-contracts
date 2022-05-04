/// @author Matt Smithies (DOVU Global Limited)

/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Import Hedera-specific HTS interop contracts
import "./libraries/hashgraph/HederaTokenService.sol";
import "./libraries/hashgraph/HederaResponseCodes.sol";

import "./StakableFees.sol";

/**
* This contract of the most basic approach to:
*   1) Projects being able to be created to be staked against
*   2) Uses been able to claim demo tokens to stack towards a project
*   3) Uses being able to withdraw tokens from the project and then deposit them into another.
*
* Question? Should we used ReentrancyGuard for anything that calls HTS?
*/
contract TimelockStakableProject is HederaTokenService, Ownable {

    // TODO: Become external, so that it can be imported
    struct Project {
        int64 balance;
        int64 verified_kgs; // We might add some claimable carbon
        bool created;
    }

    struct StakedPosition {
        int64 amount;
        int64 amount_on_end;
        uint number_of_days;
        uint unlock_time;
        bool open;
    }

    /** @notice Events **/

    // When a user has staked to a project
    event StakeComplete(address indexed sender, string projectRef, int64 amount);

    // When a user has unstaked.
    event Unstaked(address indexed sender, string projectRef, int64 amount);

    // When the staking pool has been updated with tokens (fees, penalties, etc)
    event TreasuryDeposit(address indexed sender, int64 amount);

    // This is the basic fees contract
    StakableFees internal fees = new StakableFees();

    // Links a Dynamic NFT (dNFT) HTS token id to a project within the contract
    mapping (string => Project) projects;

    // Keep track of the number of projects that have been added to the contract
    uint numberOfProjects = 0;

    // This is the token address for a demo token, that can be claimed and staked/unstaked
    address tokenAddress;

    // This represents a given state position towards a project
    mapping (string => mapping (address => StakedPosition)) stakedProjectPositions;

    // Total claimed tokens by user, TODO: add note on why it doesn't reduce.
    // As a user can externally receive tokens for staking
    mapping (address => int64) totalClaimedTokensByUser;

    // This is the quantity of demo tokens in the contract treasury
    int64 treasuryTokens = 0;

    // This is the amount of claimable tokens that a user can claim with (doesn't stop HTS transfers)
    // 10 tokens with 8 decimals places. (updating claimable tokens requires calculation for owner calls)
    int64 maximumClaimableTokens = 10 * 10 ** 8;

    /** Modifier Methods **/

    modifier hasTokensInTreasury() {
        require(treasuryTokens >= maximumClaimableTokens, "Token Treasury does not have enough value");
        _;
    }

    modifier hasProject(string memory dnft_id_) {
        require(projects[dnft_id_].created, "Project does not exist from id");
        _;
    }

    constructor(address tokenAddress_) {
        tokenAddress = tokenAddress_;

        // Associate token as part of the constructor, If this fails hell has frozen over.
        HederaTokenService.associateToken(address(this), tokenAddress);
    }

    /**
        @notice increase limit for tokens that can be claimed
    **/
    function updateClaimableTokens(int64 amount_) external onlyOwner {
        require(amount_ > 0);

        maximumClaimableTokens = amount_;
    }

    /**
        @notice import treasury tokens from a owner to contract, will fail if owner's token balance is not high enough
    **/
    function addTokensToTreasury(int64 tokenAmount_) external onlyOwner {
        treasuryTokens += tokenAmount_;

        int response = HederaTokenService.transferToken(tokenAddress, msg.sender, address(this), tokenAmount_);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
        emit TreasuryDeposit(msg.sender, tokenAmount_);
    }

    /**
        @notice add a project to the contract (through the owner)

        @param dnft_id_: the id of the hedera entity/project (this could be HTS id, Account id, or DID)
        @param verified_kg_: the amount of kgs to add to a project
    **/
    function addProject(string memory dnft_id_, int64 verified_kg_) external onlyOwner {
        require(!projects[dnft_id_].created, "Project already exists from id");

        projects[dnft_id_] = Project(0, verified_kg_, true);
    }

    /**
        @notice add verified carbon from a given project (Eventually to be multisig/DAO driven)

        @param dnft_id_: the id of the hedera entity/project
        @param verified_kg_: the amount of kgs add to a project
    **/
    function addVerifiedCarbon(string memory dnft_id_, int64 verified_kg_) external onlyOwner {
        projects[dnft_id_].verified_kgs += verified_kg_;
    }

    /**
        @notice remove verified carbon from a given project (Eventually to be multisig/DAO driven)

        @param dnft_id_: the id of the hedera entity/project
        @param verified_kg_: the amount of kgs to "unverify" from a project
    **/
    function removeVerifiedCarbon(string memory dnft_id_, int64 verified_kg_) external onlyOwner {
        require(projects[dnft_id_].verified_kgs - verified_kg_ >= 0, "Unable to remove verified carbon");

        projects[dnft_id_].verified_kgs -= verified_kg_;
    }

    /**
        @notice claim tokens from the contract to use for staking

        @param amount_: the amount of tokens to claim for using in the contract (limit is "maximumClaimableTokens")
    **/
    function claimDemoTokensForStaking(int64 amount_) external hasTokensInTreasury {
        require(totalClaimedTokensByUser[msg.sender] + amount_ <= maximumClaimableTokens);

        totalClaimedTokensByUser[msg.sender] += amount_;
        treasuryTokens -= amount_;

        // Don't care if this fails (needs testing)
        HederaTokenService.associateToken(address(this), tokenAddress);

        int response = HederaTokenService.transferToken(tokenAddress, address(this), msg.sender, amount_);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
    }

    /**
        @notice stake tokens from a contract back to the account of a user

        @param dnft_id_: the id of the entity that reputation energy (tokens) staked on it
        @param amount_: the amount of tokens to remove (will revert if the balance of the user is too low)
    **/
    function stakeTokensToProject(string memory dnft_id_, int64 amount_, uint numberOfDays_) external hasProject(dnft_id_) {
        require(numberOfDays_ > 0, "You need to set a duration longer than zero days.");
        require(!stakedProjectPositions[dnft_id_][msg.sender].open, "You need closed or empty staked position");

        int64 _fee = amount_ * fees.getPreStakeFee() / 100;
        int64 _staked = amount_ - _fee;

        // Update token state for different projects
        projects[dnft_id_].balance += _staked;

        // Create a new "position" for staking on a project
        stakedProjectPositions[dnft_id_][msg.sender] = StakedPosition(_staked, 0, numberOfDays_, block.timestamp + numberOfDays_ * 1 days, true);

        treasuryTokens += _fee;

        // This sends tokens into the Treasury, however we could have a separate account.
        int response = HederaTokenService.transferToken(tokenAddress, msg.sender, address(this), amount_);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed, do you have enough balance to pay?");
        }

        emit StakeComplete(msg.sender, dnft_id_, _staked);
    }

    /**
        @notice end the stake tokens from a contract back to the account of a user

        There are two outcomes using this method:
        1) If a user unstakes and their "timelock" has not expired they will lose 80% of capital
        2) If a user exits after an unlock they gain all the capital back with interest

        @param dnft_id_: the id of the entity that reputation energy (tokens) staked on it
    **/
    function endStakeToProject(string memory dnft_id_) external hasProject(dnft_id_) {

        StakedPosition storage _position = stakedProjectPositions[dnft_id_][msg.sender];

        require(_position.open, "The staking position must be open in order to end it");

        bool isLocked = _position.unlock_time > block.timestamp;

        // Get from fees contract
        int64 _penaltyFee = fees.getPenaltyFee(isLocked);
        int64 _fee = (_position.amount * _penaltyFee) / 100;
        int64 _unstakeValue = _position.amount - _fee;

        // The unstake value is removed from the project balance and fee retained (to be distributed later)
        projects[dnft_id_].balance -= _unstakeValue;
        treasuryTokens += _fee;

        // Calculate additional interest. (this is basic for now - will be dynamic - from treasury)
        // TODO: base APY is static 25%, the more penalty fees and the treasury bonuses are dropped in this will increase the APY -- will be dynamic
        if (!isLocked) {
            _unstakeValue += _unstakeValue * 25 / 100;
        }

        // close the position (ref the storage object)
        _position.open = false;
        _position.amount_on_end = _unstakeValue;

        // Send tokens back to user
        int response = HederaTokenService.transferToken(tokenAddress, address(this), msg.sender, _unstakeValue);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer failed to unstake tokens");
        }

        emit Unstaked(msg.sender, dnft_id_, _unstakeValue);
    }

    /** @notice Demo application only, not in prod **/
    function removeTimelockForProject(string memory dnft_id_) external {
        stakedProjectPositions[dnft_id_][msg.sender].unlock_time = 0;
    }

    /** @notice View Methods for reading state **/

    /**
        @notice The amount of tokens remaining in the treasury.
    **/
    function getTreasuryBalance() external view returns (int64) {
        return treasuryTokens;
    }

    /**
        @notice the amount of tokens a user has claimed through the contract, a user/entity
            may be able to receive tokens externally through HTS, in order to use this contract.
    **/
    function getTotalTokensClaimed() external view returns (int64) {
        return totalClaimedTokensByUser[msg.sender];
    }

    /**
        @notice return the amount of verified carbon in kgs that has been assigned to an entity/project
    **/
    function getVerifiedCarbonForProject(string memory dnft_id_) external view hasProject(dnft_id_) returns (int64)  {
        return projects[dnft_id_].verified_kgs;
    }

    /**
        TODO: TO be rewritten.

        @notice work in progress (need to figure out the best way to handle this)
            - For now just expect that the division will happen on the dapp.

        (Note) this for division (balance / kgs):
            - Value is less then 1, there is 100% risk for liquidation
            - Value is more then 1, there less then 100% risk for liquidation

        @param dnft_id_ the token id of the hedera asset
        @return tuple(
            - current staked balance of pool
            - current kgs of verified carbon
        )
    **/
    function getCollateralRisk(string memory dnft_id_) external view hasProject(dnft_id_) returns (int64, int64)  {
        Project memory _project = projects[dnft_id_];

        return (_project.balance, _project.verified_kgs);
    }

    /**
        @notice retrieve the number of tokens that a entity has staked to it
    **/
    function numberOfTokensStakedToProject(string memory dnft_id_) external view hasProject(dnft_id_) returns (int64)  {
        return projects[dnft_id_].balance;
    }

    // Return the current staked position for a given project for a given user.
    function getStakedPosition(string memory dnft_id_) external view hasProject(dnft_id_) returns (int64, int64, uint, uint, bool) {
        StakedPosition memory position = stakedProjectPositions[dnft_id_][msg.sender];

        return (
            position.amount,
            position.amount_on_end,
            position.number_of_days,
            position.unlock_time,
            position.open
        );
    }

    // Modify fees
    function updateEntryStakeFee(int64 fee_) external onlyOwner {
        fees.setStakeFee(fee_);
    }

    // get project details (duplicate of risk collateral with all details)
    function getProjectDetails(string memory dnft_id_) external view hasProject(dnft_id_) returns (int64, int64, bool) {
        Project memory _project = projects[dnft_id_];

        return (_project.balance, _project.verified_kgs, _project.created);
    }

    function getMaximumClaimableTokens() external view returns (int64) {
        return maximumClaimableTokens;
    }
}
