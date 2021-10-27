// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * Vesting contract for QUARTZ (Polygon chain)
 *
 * QUARTZ for Phase I token owners are meant to be vested,
 * and claims should be in batches.
 */
contract Vesting is Ownable {
    // QUARTZ token address
    IERC20 token;

    // how much each beneficiary has left to claim
    mapping(address => uint256) public claimable;

    // how much each beneficiary has claimed
    mapping(address => uint256) public claimed;

    // total amount of tokens to be claimed (includind the ones still locked)
    uint256 public totalClaimable;

    // total amount already claimed
    uint256 public totalClaimed;

    // starting date for the claim
    uint256 public start;

    // starting claim size
    uint256 public startAmount;

    // duration of each claim batch
    uint256 public batchDuration;

    // amount that can be claimed for each batch
    uint256 public batchSize;

    // emitted when a new claim is added
    event ClaimAdded(address indexed beneficiary, uint256 amount);

    // emitted when tokens are claimed
    event Claimed(address indexed beneficiary, uint256 amount);

    // emitted when the batch configuration is updated
    event ConfigurationChanged(
        uint256 start,
        uint256 startAmount,
        uint256 batchDuration,
        uint256 batchSize
    );

    constructor(
        IERC20 _token,
        uint256 _start,
        uint256 _startAmount,
        uint256 _batchDuration,
        uint256 _batchSize
    ) {
        require(block.timestamp <= _start, "start cannot be in the past");

        token = _token;
        start = _start;
        startAmount = _startAmount;
        batchDuration = _batchDuration;
        batchSize = _batchSize;
    }

    /**
     * Updates the batch parameters.
     *
     * @notice The new start date can only be in the future.
     * @notice After it starts, the new startAmount will never be less than the existing startAmount + nr of batches * batch size.
     *
     * @param _start The new start date.
     * @param _startAmount The new start amount.
     * @param _batchDuration The new batch duration.
     * @param _batchSize The new batch size.
     */
    function changeBatches(
        uint256 _start,
        uint256 _startAmount,
        uint256 _batchDuration,
        uint256 _batchSize
    ) external onlyOwner {
        require(block.timestamp <= _start, "start cannot be in the past");

        if (block.timestamp > start) {
            //slither-disable-next-line divide-before-multiply
            uint256 batches = (block.timestamp - start) / batchDuration;
            uint256 maxClaimable = batches * batchSize;

            startAmount = Math.max(startAmount + maxClaimable, _startAmount);
        } else {
            startAmount = _startAmount;
        }

        start = _start;
        batchDuration = _batchDuration;
        batchSize = _batchSize;

        emit ConfigurationChanged(start, startAmount, batchDuration, batchSize);
    }

    /**
     * Adds a given amount of tokens to be claimed by a beneficiary.
     * If the beneficiary already has a claim, this will simply increase the claimable amount.
     *
     * @notice This ensures the current token balance of the contract
     * is enough to fulfill all future claims.
     * Therefore, the required tokens need to be transfered before-hand.
     *
     * @param _beneficiary Address of the beneficiary
     * @param _amount Amount of tokens to add
     */

    function addClaimable(address _beneficiary, uint256 _amount)
        external
        onlyOwner
    {
        totalClaimable += _amount;
        claimable[_beneficiary] += _amount;

        emit ClaimAdded(_beneficiary, _amount);

        require(
            totalClaimable <= token.balanceOf(address(this)),
            "not enough tokens on contract"
        );
    }

    /**
     * Calculates amount that can be currently claimed by a beneficiary,
     * based on the vested amount, and how much has been already unlocked.
     *
     * @param _beneficiary The address of the beneficiary.
     * @return the beneficiary's claimable amount.
     */
    function currentlyClaimable(address _beneficiary)
        public
        view
        returns (uint256)
    {
        if (block.timestamp <= start) {
            return 0;
        }

        //slither-disable-next-line divide-before-multiply
        uint256 batches = (block.timestamp - start) / batchDuration;
        uint256 maxClaimable =
            batches * batchSize + startAmount - claimed[_beneficiary];

        return Math.min(claimable[_beneficiary], maxClaimable);
    }

    /**
     * Transfers the claimable amount to the beneficiary.
     *
     * @param _beneficiary The address of the beneficiary
     */
    function claim(address _beneficiary) external {
        uint256 amount = currentlyClaimable(_beneficiary);

        require(amount > 0, "no tokens to claim");

        claimable[_beneficiary] -= amount;
        claimed[_beneficiary] += amount;
        totalClaimable -= amount;
        totalClaimed += amount;
        emit Claimed(_beneficiary, amount);

        require(token.transfer(_beneficiary, amount), "transfer failed");
    }
}
