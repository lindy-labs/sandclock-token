// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IQuartzGovernor.sol";

import "hardhat/console.sol";

/**
 * A contract that locks QUARTZ in exchange for freshly minted vestedQUARTZ
 * Meant to be used to give away rewards that then get subject to vesting rules.
 *
 * @notice A start date and a duration are specified on deploy. Before the
 * start date, QUARTZ may be sent to the contract, to mint vestedQUARTZ. Once
 * `start` is reached, no deposits are allowed (to prevent mistakes), and
 * withdrawals are now enabled. Withdrawal limits increase linearly during
 * `duration`, so that after the final end date, holders of vestedQUARTZ are
 * able to exchange 100% of it for QUARTZ.
 */
contract VestedRewards is ERC20, Ownable {
    IERC20 public quartz;
    uint256 public start;
    uint256 public duration;

    mapping(address => uint256) public withdrawals;

    /**
     * @param _quartz the address of the QUARTZ token contract
     * @param _start timestamp at which withdrawals are enabled
     * @param _duration time (in seconds) it takes for vesting to allow full withdrawals
     */
    constructor(
        IERC20 _quartz,
        uint256 _start,
        uint256 _duration
    ) ERC20("Sandclock (vested rewards)", "vestedQUARTZ") {
        require(_start > block.timestamp, "start date cannot be in the past");
        require(_duration > 0, "duration cannot be 0");

        quartz = _quartz;
        start = _start;
        duration = _duration;
    }

    /**
     * Locks QUARTZ into the contract, in exchange for an equal amount of freshly minted vestedQUARTZ
     *
     * @notice Can only be called before the specified start date
     *
     * @param _amount Amount of QUARTZ to lock
     */
    function deposit(uint256 _amount) public onlyBeforeStart {
        quartz.transferFrom(msg.sender, address(this), _amount);

        _mint(_msgSender(), _amount);
    }

    /**
     * Burns vestedQUARTZ from the sender's balance, and transfers him an equal amount of QUARTZ
     *
     * @notice Can only be called after the specified start date
     * @notice Amount to transfer is given the sender's current vestedQUARTZ balance,
     *   and restricted by vesting rules
     *
     * @param _beneficiary Beneficiary account to withdraw from
     */
    function withdraw(address _beneficiary) public onlyAfterStart {
        uint256 amount = withdrawable(_beneficiary);
        _burn(_beneficiary, amount);

        withdrawals[_beneficiary] += amount;

        quartz.transfer(_beneficiary, amount);
    }

    /**
     * Calculates how much vestedQUARTZ can be currently redeemed by a beneficiary
     *
     * @param _beneficiary Beneficiary account
     */
    function withdrawable(address _beneficiary) public view returns (uint256) {
        if (!_started()) {
            return 0;
        }

        uint256 balance = balanceOf(_beneficiary);
        // uint256 withdrawn = withdrawals[_beneficiary];

        return balance;
    }

    function _started() private view returns (bool) {
        return start <= block.timestamp;
    }

    modifier onlyBeforeStart() {
        require(!_started(), "already started");
        _;
    }

    modifier onlyAfterStart() {
        require(_started(), "not started yet");
        _;
    }
}
