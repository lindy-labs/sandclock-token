pragma solidity ^0.8.9;

import "../QuartzGovernor.sol";

contract Echidna_QuartzGovernor is QuartzGovernor {
    uint256 lastTimestamp;

    constructor()
        QuartzGovernor(
            IQuartz(address(this)),
            9999799,
            1000000,
            2500,
            200000000000000000,
            100000000000000000000,
            100000000000000000000000,
            2592000
        )
    {
        lastTimestamp = block.timestamp;
    }

    // successively wait for periods of equal time
    // conviction should always grow, but less than in the previous period
    function test_convictionContinuousGrowth(
        uint256 _initialConv,
        uint256 _amount,
        uint8 _periods
    ) external {
        require(_amount > 0);
        require(_periods > 0);

        uint256 period = block.timestamp - lastTimestamp;
        require(period > 0);
        lastTimestamp = block.timestamp;

        uint256 currentGrowth = type(uint256).max;
        uint256 currentConv = _initialConv;
        uint256 nextConv;

        for (uint256 i = 0; i < _periods; ++i) {
            uint256 nextConv =
                calculateConviction(period, currentConv, _amount);
            assert(nextConv > currentConv);
            uint256 nextGrowth = nextConv - currentConv;

            assert(nextGrowth < currentGrowth);

            currentConv = nextConv;
            currentGrowth = nextGrowth;
        }
    }

    // starting from an initial amount and convition,
    // a given number of votes is removed.
    // At that point, conviction should drop continuously following a curve
    // where each period has less conviciton than the previous, with the drop
    // being steeper at the beginning
    function test_removingVotesContinuouslyDropsConviction(
        uint256 _initialConv,
        uint256 _initialAmount,
        uint256 _amountToRemove,
        uint8 _periods
    ) external {
        require(_initialAmount > 0);
        require(_amountToRemove > 0);
        require(_amountToRemove >= _initialAmount);
        require(_periods > 0);

        uint256 period = block.timestamp - lastTimestamp;
        require(period > 0);
        lastTimestamp = block.timestamp;

        uint256 currentDecay = 0;
        uint256 currentConv = _initialConv;
        uint256 nextConv;

        uint256 finalAmount = _initialAmount - _amountToRemove;

        for (uint256 i = 0; i < _periods; ++i) {
            uint256 nextConv =
                calculateConviction(period, currentConv, finalAmount);
            assert(nextConv < currentConv);
            uint256 nextDecay = currentConv - nextConv;

            assert(nextDecay < currentDecay);

            currentConv = nextConv;
            currentDecay = nextDecay;
        }
    }

    function test_pow(uint256 _a, uint256 _b) external pure {
        uint256 result = _pow(_a, _b);

        if (_b == 0) {
            assert(result == 1);
        } else if (_a <= 1 || _b == 1) {
            assert(result == _a);
        } else {
            assert(result > _a);
        }
    }
}
