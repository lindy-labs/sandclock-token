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
 *
 * @notice In order to prevent users from circumventing the vesting logic,
 * we block outgoing transfer for any account that has redeemed vestedQUARTZ.
 * This prevents redeemers from redeeming in the middle of the period,
 * then sending remaining tokens to a separate wallet, where they'd be able to
 * redeem an extra share again (effectively being able to redeem 75% when only
 * 50% would be allowed)
 */
contract VestedRewards is ERC20, Ownable {
    IERC20 public quartz;
    uint256 public start;
    uint256 public duration;
    uint256 public gracePeriod;

    mapping(address => uint256) public withdrawals;
    mapping(address => bool) redeemers;

    // useful to keep 2 decimal precision when dealing with percentages
    uint256 constant MUL = 10000;

    // start                  50%                     100%
    // G 100
    // N 50

    /**
     * @param _quartz the address of the QUARTZ token contract
     * @param _start timestamp at which withdrawals are enabled
     * @param _duration time (in seconds) it takes for vesting to allow full withdrawals
     * @param _gracePeriod time (in seconds) after the original duration until
     * admin clawback actions are enabled
     */
    constructor(
        IERC20 _quartz,
        uint256 _start,
        uint256 _duration,
        uint256 _gracePeriod
    ) ERC20("Sandclock (vested rewards)", "vestedQUARTZ") {
        require(_start > block.timestamp, "start date cannot be in the past");
        require(_duration > 0, "duration cannot be 0");
        require(_gracePeriod > 0, "gracePeriod cannot be 0");

        quartz = _quartz;
        start = _start;
        duration = _duration;
        gracePeriod = _gracePeriod;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override(ERC20) {
        require(
            !redeemers[sender],
            "outgoing transfers are locked for this account"
        );

        super._transfer(sender, recipient, amount);
    }

    /**
     * Locks QUARTZ into the contract, in exchange for an equal amount of freshly minted vestedQUARTZ
     *
     * @notice Can only be called before the specified start date
     *
     * @param _amount Amount of QUARTZ to lock
     */
    function deposit(uint256 _amount) external onlyBeforeStart {
        require(
            quartz.transferFrom(_msgSender(), address(this), _amount),
            "deposit failed"
        );

        _mint(_msgSender(), _amount);
    }

    /**
     * Burns vestedQUARTZ from the sender's balance, and transfers him an
     * equal amount of QUARTZ
     *
     * @notice Can only be called after the specified start date
     *
     * @notice Amount to transfer is given the sender's current
     * vestedQUARTZ balance, and restricted by vesting rules
     *
     * @notice Marks the beneficiary as redeemer, which blocks future
     * outgoing transfers from him
     */
    function withdraw() external onlyAfterStart {
        _withdraw(_msgSender());
    }

    /**
     * Burns vestedQUARTZ from a given beneficiary's balance, and transfers him
     * an equal amount of QUARTZ
     *
     * @notice Can only be called after the specified start date
     *
     * @notice Amount to transfer is given the beneficiary's current
     * vestedQUARTZ balance, and restricted by vesting rules
     *
     * @notice Can only be called by the owner, to force rewards to be
     * redeemed if necessary @notice Marks the beneficiary as redeemer, which
     * blocks future outgoing transfers from him
     *
     * @param _beneficiary Beneficiary account to withdraw from
     */
    function withdrawFor(address _beneficiary)
        external
        onlyAfterStart
        onlyOwner
    {
        _withdraw(_beneficiary);
    }

    /**
     * Once grace period is over, allows owner to retrieve back any remaining quartz
     * and selfdestruct the contract
     */
    function clawback() external onlyAfterGracePeriod onlyOwner {
        uint256 balance = quartz.balanceOf(address(this));
        require(quartz.transfer(_msgSender(), balance), "withdrawal failed");

        selfdestruct(payable(_msgSender()));
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
        uint256 withdrawn = withdrawals[_beneficiary];

        uint256 unlocked = ((balance + withdrawn) * _durationPercent()) / MUL;

        if (unlocked < withdrawn) {
            unlocked = 0;
        } else {
            unlocked -= withdrawn;
        }

        if (unlocked > balance) {
            unlocked = balance;
        }

        return unlocked;
    }

    /**
     * Burns an amount of vestedQUARTZ from beneficiary, and sends him
     * a corresponding amount of QUARTZ
     *
     * @notice Marks the beneficiary as redeemer, which blocks future outgoing
     * transfers from him
     */
    function _withdraw(address _beneficiary) private {
        uint256 amount = withdrawable(_beneficiary);
        _burn(_beneficiary, amount);

        withdrawals[_beneficiary] += amount;
        redeemers[_beneficiary] = true;

        require(quartz.transfer(_beneficiary, amount), "withdrawal failed");
    }

    /**
     * Calculates the percentage of the timespan given by `start` and `duration`
     *
     * @notice Return value is multiplied by `MUL`, so as to keep precision.
     * Any calculation from this value must later be divided by `MUL` to
     * retrieve the original value
     */
    function _durationPercent() private view returns (uint256) {
        if (block.timestamp < start) {
            return 0;
        }

        if (block.timestamp > end()) {
            return MUL;
        }

        return ((block.timestamp - start) * MUL) / duration;
    }

    function end() private view returns (uint256) {
        return start + duration;
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

    modifier onlyAfterGracePeriod() {
        require(
            (end() + gracePeriod) <= block.timestamp,
            "grace period not over yet"
        );
        _;
    }
}
