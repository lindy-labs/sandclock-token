// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Linear vesting contract for QUARTZ (Polygon chain)
 *
 * This contract allow any body to create vesting for other guy with QUARTZ token.
 * Vesting start time and vesting period will be determined by vesting creator.
 */
contract LinearVesting {
    using SafeERC20 for IERC20;

    // emitted when a new vesting is added
    event VestingAdded(
        address indexed beneficiary,
        uint64 startTime,
        uint64 period,
        uint256 amount
    );

    // emitted when tokens are claimed
    event Claimed(address indexed beneficiary, uint256 amount);

    struct VestingInfo {
        uint64 startTime;
        uint64 period;
        uint256 amount;
        uint256 claimed;
    }

    // QUARTZ token address
    IERC20 public immutable token;

    // Vesting info
    mapping(address => VestingInfo) public vestings;

    constructor(IERC20 _token) {
        require(address(_token) != address(0), "token is 0x");
        token = _token;
    }

    /**
     * Add new vesting.
     *
     * @notice if beneficiary already has unclaimed vesting, it is impossible create another vesting.
     *
     * @param beneficiary beneficiary who can claim vesting linearly.
     * @param startTime the epoch timestamp that vesting starts.
     * @param period the period of the vesting.
     * @param amount the token amount which will be vested.
     */
    function addVesting(
        address beneficiary,
        uint64 startTime,
        uint64 period,
        uint256 amount
    ) external {
        require(amount != 0, "amount is 0");
        require(period != 0, "period is 0");
        require(startTime != 0, "startTime is 0");
        require(beneficiary != address(0), "beneficiary is 0x");

        VestingInfo storage vestingInfo = vestings[beneficiary];
        require(vestingInfo.amount - vestingInfo.claimed == 0, "vesting exist");

        token.safeTransferFrom(msg.sender, address(this), amount);

        vestings[beneficiary] = VestingInfo({
            startTime: startTime,
            period: period,
            amount: amount,
            claimed: 0
        });

        emit VestingAdded(beneficiary, startTime, period, amount);
    }

    /**
     * Calculate claimable amounts for beneficiary.
     *
     * @param beneficiary The address of the beneficiary.
     * @return the beneficiary's claimable amount.
     */
    function getPendingAmount(address beneficiary)
        public
        view
        returns (uint256)
    {
        VestingInfo memory vestingInfo = vestings[beneficiary];

        if (
            block.timestamp <= vestingInfo.startTime || vestingInfo.period == 0
        ) {
            return 0;
        }

        uint256 totalClaimable =
            (vestingInfo.amount * (block.timestamp - vestingInfo.startTime)) /
                vestingInfo.period;
        if (totalClaimable > vestingInfo.amount) {
            totalClaimable = vestingInfo.amount;
        }

        return totalClaimable - vestingInfo.claimed;
    }

    /**
     * Claim available amounts.
     */
    function claim() external {
        uint256 pending = getPendingAmount(msg.sender);
        require(pending > 0, "nothing to claim");

        VestingInfo storage vestingInfo = vestings[msg.sender];

        vestingInfo.claimed += pending;

        token.safeTransfer(msg.sender, pending);

        emit Claimed(msg.sender, pending);
    }
}
