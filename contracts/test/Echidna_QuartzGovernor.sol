pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "../Quartz.sol";
import "../QuartzGovernor.sol";

contract Echidna_QuartzGovernor is QuartzGovernor {
    // function echidna_test() public returns (bool) {
    //     return true;
    // }
    constructor()
        QuartzGovernor(
            IQuartz(address(new Quartz(3600 * 24 * 30))),
            9999799,
            1000000,
            2500,
            200000000000000000,
            100000000000000000000,
            100000000000000000000000,
            2592000
        )
    {}

    function echidna_abstainProposalCannotBeExecuted() public returns (bool) {
        return
            proposals[ABSTAIN_PROPOSAL_ID].proposalStatus !=
            ProposalStatus.Executed;
    }

    function echidna_cannotExecuteProposalWithNegativeNetVotes()
        public
        returns (bool)
    {
        for (uint256 i = 0; i < proposalCounter; i++) {
            Proposal storage proposal = proposals[i];

            // this invariant only applies to executed proposals
            if (proposal.proposalStatus != ProposalStatus.Executed) {
                continue;
            }

            Vote storage positiveVotes = proposal.positiveVotes;
            Vote storage negativeVotes = proposal.negativeVotes;

            // check if positive conviction outweights negative
            if (positiveVotes.convictionLast <= negativeVotes.convictionLast) {
                return false;
            }

            // check if net convition is above threshold
            // TODO I guess this can actually be broken though?
            // We would need to know the threshold at the time this was executed,
            // and not the current one
            if (
                positiveVotes.convictionLast - negativeVotes.convictionLast <
                calculateThreshold()
            ) {
                return false;
            }
        }

        return true;
    }
}
