pragma solidity ^0.8.9;

import "../Quartz.sol";

contract Echidna_Quartz is Quartz {
    constructor() Quartz(3600 * 24 * 30) {}

    function echidna_totalStakeEqualsBalance() public returns (bool) {
        uint256 balance = balanceOf(address(this));

        return balance == totalStaked;
    }

    function echidna_totalStakeEqualsSumOfActiveStakes() public returns (bool) {
        uint256 sum;

        for (uint256 i = 0; i < stakeLength; ++i) {
            if (!stakes[i].active) {
                continue;
            }
            sum += stakes[i].amount;
        }

        return sum == totalStaked;
    }

    function echidna_cantUnstakeBeforeMaturationPeriod() public returns (bool) {
        for (uint256 i = 0; i < stakeLength; ++i) {
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
