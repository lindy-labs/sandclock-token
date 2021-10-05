pragma solidity ^0.8.9;

import "../QuartzGovernor.sol";
import "../Quartz.sol";

contract Echidna_QuartzStaking {
    Quartz private quartz;
    QuartzGovernor governor;

    constructor() {
        quartz = new Quartz(3600 * 24 * 30);
        governor = new QuartzGovernor(
            IQuartz(address(this)),
            9999799,
            1000000,
            2500,
            200000000000000000,
            100000000000000000000,
            100000000000000000000000,
            2592000
        );

        quartz.setGovernor(IQuartzGovernor(address(governor)));
    }

    //
    // functions to fuzz
    //

    function test_stake(
        address _from,
        address _beneficiary,
        uint256 _amount,
        uint64 _period
    ) external {
        require(quartz.balanceOf(_from) >= _amount);

        uint256 totalBefore = quartz.totalStaked();
        uint256 countBefore = quartz.stakeLength();

        quartz.stake(_amount, _beneficiary, _period);

        uint256 totalAfter = quartz.totalStaked();
        uint256 countAfter = quartz.stakeLength();

        assert(totalAfter == totalBefore + _amount);
        assert(countAfter == countBefore + 1);
    }
}
