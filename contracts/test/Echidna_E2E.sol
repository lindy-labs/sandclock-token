pragma solidity ^0.8.9;

import "../QuartzGovernor.sol";
import "../Quartz.sol";

contract EOAMock {
    Quartz private quartz;

    constructor(Quartz _quartz) {
        quartz = _quartz;
    }

    function stake(
        uint256 _amount,
        address _beneficiary,
        uint64 _period
    ) public {
        quartz.stake(_amount, _beneficiary, _period);
    }

    function unstake(uint64 _stakeId) public {
        quartz.unstake(_stakeId);
    }
}

contract Echidna_E2E {
    Quartz private quartz;
    QuartzGovernor governor;

    address constant DEPLOYER =
        address(0x00a329C0648769a73afAC7F9381e08fb43DBEA70);
    address constant SENDER1 = address(0x10000);
    address constant SENDER2 = address(0x20000);

    EOAMock deployer;
    EOAMock sender1;
    EOAMock sender2;

    mapping(address => EOAMock) users;

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

        users[DEPLOYER] = new EOAMock(quartz);
        users[SENDER1] = new EOAMock(quartz);
        users[SENDER2] = new EOAMock(quartz);

        quartz.transfer(address(users[DEPLOYER]), 100000 ether);
        quartz.transfer(address(users[SENDER1]), 100000 ether);
        quartz.transfer(address(users[SENDER2]), 100000 ether);
    }

    //
    // functions to fuzz
    //

    function stake(
        address _beneficiary,
        uint256 _amount,
        uint64 _period
    ) external {
        assert(false);
        EOAMock eoa = users[msg.sender];

        require(quartz.balanceOf(msg.sender) >= _amount);

        uint256 totalBefore = quartz.totalStaked();
        uint256 countBefore = quartz.stakeLength();

        quartz.stake(_amount, _beneficiary, _period);

        uint256 totalAfter = quartz.totalStaked();
        uint256 countAfter = quartz.stakeLength();

        assert(false);
        assert(totalAfter == totalBefore + _amount);
        assert(countAfter == countBefore + 1);
    }

    function unstake(uint64 _stakeId) external {
        assert(false);
        EOAMock eoa = users[msg.sender];

        // uint256 totalBefore = quartz.totalStaked();
        uint256 countBefore = quartz.stakeLength();

        eoa.unstake(_stakeId);

        // uint256 totalAfter = quartz.totalStaked();
        uint256 countAfter = quartz.stakeLength();

        // assert(totalAfter == totalBefore - _amount);
        assert(countAfter == countBefore - 1);
    }

    //
    // invariants
    //

    function echidna_abstainProposalIsNotExecuted() public returns (bool) {
        (, , QuartzGovernor.ProposalStatus status, , , ) =
            governor.getProposal(governor.ABSTAIN_PROPOSAL_ID());

        // return false;
        return status != QuartzGovernor.ProposalStatus.Executed;
    }

    function echidna_noExecutedProposalsWithNegativeVotes()
        public
        returns (bool)
    {
        for (uint256 i = 0; i < governor.proposalCounter(); i++) {
            (
                QuartzGovernor.Vote memory positiveVotes,
                QuartzGovernor.Vote memory negativeVotes,
                QuartzGovernor.ProposalStatus status,
                ,
                ,

            ) = governor.getProposal(i);

            // this invariant only applies to executed proposals
            if (status != QuartzGovernor.ProposalStatus.Executed) {
                continue;
            }

            // check if positive conviction outweights negative
            if (positiveVotes.convictionLast <= negativeVotes.convictionLast) {
                return false;
            }
        }

        return true;
    }
}
