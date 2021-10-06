import "../QuartzGovernor.sol";
import "../Quartz.sol";

contract Echidna_Quartz is Quartz {
    constructor() Quartz(3600 * 24 * 30) {}

    // this is meant to allow echidna to set up a governor for Quartz,
    // and unlock new flows
    function createGovernor() public {
        QuartzGovernor governor =
            new QuartzGovernor(
                IQuartz(address(this)),
                9999799,
                1000000,
                2500,
                200000000000000000,
                100000000000000000000,
                100000000000000000000000,
                2592000
            );

        this.setGovernor(IQuartzGovernor(address(governor)));
    }

    function echidna_totalStakeEqualsSumOfActiveStakes() public returns (bool) {
        uint256 sum;

        for (uint64 i = 0; i < stakeLength; ++i) {
            if (!stakes[i].active) {
                continue;
            }
            sum += stakes[i].amount;
        }

        return sum == totalStaked;
    }

    function echidna_cantUnstakeBeforeMaturationPeriod() public returns (bool) {
        for (uint64 i = 0; i < stakeLength; ++i) {
            StakeInfo storage stake = stakes[i];

            // if a stake exists with a maturationTime in the future, but already inactive, something went wrong
            if (
                stake.maturationTimestamp > block.timestamp && !stakes[i].active
            ) {
                return false;
            }
        }

        return true;
    }
}
