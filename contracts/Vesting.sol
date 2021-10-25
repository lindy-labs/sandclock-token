// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Vesting contract for QUARTZ (Polygon chain)
 *
 * QUARTZ for Phase I token owners are meant to be vested,
 * and claims should follow a configurable rate limit logic
 */
contract Vesting is Ownable {
    // QUARTZ token address
    IERC20 token;

    // how much each beneficiary has left to claim
    mapping(address => uint256) public claimable;

    // total amount of tokens to be claimed (includind the ones still locked)
    uint256 public totalClaimable;

    // total amount already claimed
    uint256 public totalClaimed;

    // emitted when a new claim is added
    event ClaimAdded(address indexed beneficiary, uint256 amount);

    // emitted when tokens are claimed
    event Claimed(address indexed beneficiary, uint256 amount);

    constructor(IERC20 _token, uint256 _start) {
        token = _token;
        start = _start;
    }

    /**
     * Adds a given amount of tokens to be claimed by a beneficiary
     * If beneficiary already has a claim, this will simply increase his claimable amount
     *
     * @notice This ensures the current token balance of the contract
     * is enough to fulfill all future claims.
     * Therefore, the required tokens need to be transfered before-hand
     *
     * @param _beneficiary Address of the beneficiary
 *   * @param _amount Amount of tokens to add

    function addClaimable(address _beneficiary, uint256 _amount)
        public
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
     * Calculates amount that can be currently claimed by an address,
     * based on his own vested amount, and how much has been already unlocked;
     *
     * @param _beneficiary The address to calculate for
     * TODO check for how much time has passed, and truncate amount accordingly
     */
    function currentlyClaimable(address _beneficiary)
        public
        view
        returns (uint256)
    {
        if (block.timestamp <= start) {
            return 0;
        }

        return claimable[_beneficiary];
    }

    function claim(address _beneficiary) public {
        uint256 amount = currentlyClaimable(_beneficiary);

        require(amount > 0, "no tokens to claim");

        claimable[_beneficiary] -= amount;
        totalClaimable -= amount;
        totalClaimed += amount;
        emit Claimed(_beneficiary, amount);

        token.transfer(_beneficiary, amount);
    }
}
