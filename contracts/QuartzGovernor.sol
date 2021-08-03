pragma solidity 0.7.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IQuartz.sol";
import "./libraries/SafeMath64.sol";

contract QuartzGovernor is AccessControl {
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPDATE_SETTINGS_ROLE =
        keccak256("UPDATE_SETTINGS_ROLE");
    bytes32 public constant CANCEL_PROPOSAL_ROLE =
        keccak256("CANCEL_PROPOSAL_ROLE");

    uint256 public constant D = 10000000;
    uint256 public constant ONE_HUNDRED_PERCENT = 1e18;
    uint256 private constant TWO_128 = 0x100000000000000000000000000000000; // 2^128
    uint256 private constant TWO_127 = 0x80000000000000000000000000000000; // 2^127
    uint256 private constant TWO_64 = 0x10000000000000000; // 2^64
    uint256 public constant ABSTAIN_PROPOSAL_ID = 1;
    uint64 public constant MAX_STAKED_PROPOSALS = 10;

    string private constant ERROR_PROPOSAL_DOES_NOT_EXIST =
        "QG_PROPOSAL_DOES_NOT_EXIST";
    string private constant ERROR_PROPOSAL_NOT_ACTIVE =
        "QG_PROPOSAL_NOT_ACTIVE";
    string private constant ERROR_CANNOT_EXECUTE_ABSTAIN_PROPOSAL =
        "QG_CANNOT_EXECUTE_ABSTAIN_PROPOSAL";
    string private constant ERROR_INSUFFICIENT_CONVICTION =
        "QG_INSUFFICIENT_CONVICTION";
    string private constant ERROR_SENDER_CANNOT_CANCEL =
        "QG_SENDER_CANNOT_CANCEL";
    string private constant ERROR_CANNOT_CANCEL_ABSTAIN_PROPOSAL =
        "QG_CANNOT_CANCEL_ABSTAIN_PROPOSAL";
    string private constant ERROR_AMOUNT_OVER_MAX_RATIO =
        "QG_AMOUNT_OVER_MAX_RATIO";
    string private constant ERROR_AMOUNT_CAN_NOT_BE_ZERO =
        "QG_AMOUNT_CAN_NOT_BE_ZERO";
    string private constant ERROR_VOTES_MORE_THAN_AVAILABLE =
        "QG_VOTES_MORE_THAN_AVAILABLE";
    string private constant ERROR_ALREADY_POSITIVE_VOTED =
        "QG_ALREADY_POSITIVE_VOTED";
    string private constant ERROR_ALREADY_NEGATIVE_VOTED =
        "QG_ALREADY_NEGATIVE_VOTED";
    string private constant ERROR_MAX_PROPOSALS_REACHED =
        "QG_MAX_PROPOSALS_REACHED";
    string private constant ERROR_WITHDRAW_MORE_THAN_VOTED =
        "QG_WITHDRAW_MORE_THAN_VOTED";
    string private constant ERROR_ONLY_QUARTZ = "QG_ONLY_QUARTZ";
    string private constant ERROR_AUTH_FAILED = "QG_AUTH_FAILED";
    string private constant ERROR_NOT_ENOUGH_INACTIVE_VOTES =
        "QG_NOT_ENOUGH_INACTIVE_VOTES";
    string private constant ERROR_NO_ENOUGH_VOTES = "QG_NO_ENOUGH_VOTES";
    string private constant ERROR_MIN_VOTES_TO_PASS_CAN_NOT_BE_ZERO =
        "QG_MIN_VOTES_TO_PASS_CAN_NOT_BE_ZERO";
    string private constant ERROR_PROPOSAL_THRESHOLD_CAN_NOT_BE_ZERO =
        "QG_PROPOSAL_THRESHOLD_CAN_NOT_BE_ZERO";
    string private constant ERROR_PROPOSAL_ACTIVE_PERIOD_CAN_NOT_BE_ZERO =
        "QG_PROPOSAL_ACTIVE_PERIOD_CAN_NOT_BE_ZERO";

    enum ProposalStatus {Cancelled, Active, Executed}

    struct Vote {
        uint256 id;
        uint256 totalVotes;
        uint256 convictionLast;
        uint256 blockLast;
    }

    struct Proposal {
        Vote positiveVotes;
        Vote negativeVotes;
        ProposalStatus proposalStatus;
        address submitter;
        uint64 expiration;
    }

    mapping(uint256 => mapping(address => uint256)) public userVotes;
    uint256 public lastVoteId;

    IQuartz public immutable quartz;
    uint256 public decay;
    uint256 public maxRatio;
    uint256 public weight;
    uint256 public minThresholdStakePercentage;
    uint256 public minVotesToPass;
    uint256 public proposalCounter;
    uint256 public totalVotes;
    uint256 public proposalThreshold;
    uint64 public proposalActivePeriod;

    mapping(uint256 => Proposal) internal proposals;
    mapping(uint256 => uint256) internal stakedForProposal;
    mapping(address => uint256) internal totalUserVotes;
    mapping(address => uint256[]) internal voterCastedProposals;
    mapping(address => mapping(uint256 => uint256))
        internal userVotedProposalIds;
    mapping(address => uint256[]) internal userProposals;
    mapping(address => mapping(uint256 => uint256)) internal userProposalIds;

    event ConvictionSettingsChanged(
        uint256 decay,
        uint256 maxRatio,
        uint256 weight,
        uint256 minThresholdStakePercentage,
        uint256 minVotesToPass,
        uint256 proposalThreshold,
        uint64 proposalActivePeriod
    );
    event ProposalAdded(
        address indexed entity,
        uint256 indexed id,
        string title,
        bytes link,
        string description,
        uint64 expiration
    );
    event VoteCasted(
        address indexed entity,
        uint256 indexed id,
        uint256 amount,
        uint256 conviction,
        bool support
    );
    event VoteWithdrawn(
        address indexed entity,
        uint256 indexed id,
        uint256 amount,
        uint256 conviction,
        bool support
    );
    event ProposalExecuted(
        uint256 indexed id,
        uint256 positiveConviction,
        uint256 negativeConviction
    );
    event ProposalCancelled(uint256 indexed id);

    modifier auth(bytes32 _role) {
        require(hasRole(_role, msg.sender), ERROR_AUTH_FAILED);
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(
            _proposalId == ABSTAIN_PROPOSAL_ID ||
                proposals[_proposalId].submitter != address(0),
            ERROR_PROPOSAL_DOES_NOT_EXIST
        );
        _;
    }

    modifier onlyQuartz() {
        require(msg.sender == address(quartz), ERROR_ONLY_QUARTZ);
        _;
    }

    constructor(
        IQuartz _quartz,
        uint256 _decay,
        uint256 _maxRatio,
        uint256 _weight,
        uint256 _minThresholdStakePercentage,
        uint256 _minVotesToPass,
        uint256 _proposalThreshold,
        uint64 _proposalActivePeriod
    ) {
        _setRoleAdmin(UPDATE_SETTINGS_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CANCEL_PROPOSAL_ROLE, ADMIN_ROLE);
        _setupRole(ADMIN_ROLE, msg.sender);

        quartz = _quartz;
        proposalCounter = ABSTAIN_PROPOSAL_ID.add(1); // First proposal should be #2, #1 is reserved for abstain proposal, #0 is not used for better UX.
        decay = _decay;
        maxRatio = _maxRatio;
        weight = _weight;
        minThresholdStakePercentage = _minThresholdStakePercentage;
        require(_minVotesToPass > 0, ERROR_MIN_VOTES_TO_PASS_CAN_NOT_BE_ZERO);
        minVotesToPass = _minVotesToPass;
        require(
            _proposalThreshold > 0,
            ERROR_PROPOSAL_THRESHOLD_CAN_NOT_BE_ZERO
        );
        proposalThreshold = _proposalThreshold;
        require(
            _proposalActivePeriod > 0,
            ERROR_PROPOSAL_ACTIVE_PERIOD_CAN_NOT_BE_ZERO
        );
        proposalActivePeriod = _proposalActivePeriod;

        Vote memory abstainVote1 =
            Vote({id: 1, totalVotes: 0, convictionLast: 0, blockLast: 0});
        Vote memory abstainVote2 =
            Vote({id: 2, totalVotes: 0, convictionLast: 0, blockLast: 0});

        proposals[ABSTAIN_PROPOSAL_ID] = Proposal({
            positiveVotes: abstainVote1,
            negativeVotes: abstainVote2,
            proposalStatus: ProposalStatus.Active,
            submitter: address(0),
            expiration: 0
        });

        lastVoteId = 2;

        emit ProposalAdded(
            address(0),
            ABSTAIN_PROPOSAL_ID,
            "Abstain proposal",
            "",
            "",
            0
        );
    }

    /**
     * @notice Update the conviction voting parameters
     * @param _decay The rate at which conviction is accrued or lost from a proposal
     * @param _maxRatio Proposal threshold parameter
     * @param _weight Proposal threshold parameter
     * @param _minThresholdStakePercentage The minimum percent of stake token max supply that is used for calculating
        conviction
     * @param _minVotesToPass The minimum votes to be passed
     * @param _proposalThreshold Vote rep which will be staked to create proposal
     * @param _proposalActivePeriod Proposal active period
     */
    function setConvictionCalculationSettings(
        uint256 _decay,
        uint256 _maxRatio,
        uint256 _weight,
        uint256 _minThresholdStakePercentage,
        uint256 _minVotesToPass,
        uint256 _proposalThreshold,
        uint64 _proposalActivePeriod
    ) public auth(UPDATE_SETTINGS_ROLE) {
        decay = _decay;
        maxRatio = _maxRatio;
        weight = _weight;
        minThresholdStakePercentage = _minThresholdStakePercentage;

        require(_minVotesToPass > 0, ERROR_MIN_VOTES_TO_PASS_CAN_NOT_BE_ZERO);
        minVotesToPass = _minVotesToPass;
        require(
            _proposalThreshold > 0,
            ERROR_PROPOSAL_THRESHOLD_CAN_NOT_BE_ZERO
        );
        proposalThreshold = _proposalThreshold;
        require(
            _proposalActivePeriod > 0,
            ERROR_PROPOSAL_ACTIVE_PERIOD_CAN_NOT_BE_ZERO
        );
        proposalActivePeriod = _proposalActivePeriod;

        emit ConvictionSettingsChanged(
            _decay,
            _maxRatio,
            _weight,
            _minThresholdStakePercentage,
            _minVotesToPass,
            _proposalThreshold,
            _proposalActivePeriod
        );
    }

    /**
     * @notice Add proposal
     * @param _title Title of the proposal
     * @param _link IPFS or HTTP link with proposal's description
     * @param _description Succinct description about proposal
     */
    function addProposal(
        string memory _title,
        bytes memory _link,
        string memory _description
    ) external {
        Vote memory emptyVote1 =
            Vote({
                id: lastVoteId.add(1),
                totalVotes: 0,
                convictionLast: 0,
                blockLast: 0
            });
        Vote memory emptyVote2 =
            Vote({
                id: lastVoteId.add(2),
                totalVotes: 0,
                convictionLast: 0,
                blockLast: 0
            });

        uint64 expiration = uint64(block.timestamp).add(proposalActivePeriod);
        proposals[proposalCounter] = Proposal({
            positiveVotes: emptyVote1,
            negativeVotes: emptyVote2,
            proposalStatus: ProposalStatus.Active,
            submitter: msg.sender,
            expiration: expiration
        });

        lastVoteId = lastVoteId.add(2);

        quartz.moveVotesToGovernor(msg.sender, proposalThreshold);
        stakedForProposal[proposalCounter] = proposalThreshold;
        userProposals[msg.sender].push(proposalCounter);
        userProposalIds[msg.sender][proposalCounter] = userProposals[msg.sender]
            .length;

        emit ProposalAdded(
            msg.sender,
            proposalCounter,
            _title,
            _link,
            _description,
            expiration
        );
        proposalCounter = proposalCounter.add(1);
    }

    /**
     * @notice Cast votes on proposal
     * @param _proposalId Proposal id
     * @param _amount Amount of votes to cast
     * @param _support Positive or negative
     */
    function castVotes(
        uint256 _proposalId,
        uint256 _amount,
        bool _support
    ) external {
        _castVotes(_proposalId, _amount, msg.sender, _support);
    }

    /**
     * @notice Cast all available votes to proposal
     * @param _proposalId Proposal id
     * @param _support Positive or negative
     */
    function castAllVotes(uint256 _proposalId, bool _support) external {
        _castVotes(
            _proposalId,
            quartz.getCurrentVotes(msg.sender),
            msg.sender,
            _support
        );
    }

    /**
     * @notice Withdraw votes from proposal
     * @param _proposalId Proposal id
     * @param _amount Amount of votes to withdraw
     * @param _support Positive or negative
     */
    function withdrawVotes(
        uint256 _proposalId,
        uint256 _amount,
        bool _support
    ) external proposalExists(_proposalId) {
        _withdrawVotesFromProposal(_proposalId, _amount, msg.sender, _support);
    }

    /**
     * @notice Withdraw all votes from executed or cancelled proposal
     */
    function withdrawAllInactiveVotes()
        external
        returns (uint256 withdrawnAmount)
    {
        withdrawnAmount = _withdrawInactiveVotes(0, msg.sender);
    }

    /**
     * @dev Withdraw votes from executed or cancelled proposals until a target amount is reached.
     * @param _targetAmount Target at which to stop withdrawing tokens
     * @param _from Account to withdraw from
     */
    function _withdrawInactiveVotes(uint256 _targetAmount, address _from)
        internal
        returns (uint256 withdrawnAmount)
    {
        uint256 i;
        uint256[] memory voterCastedProposalsCopy = voterCastedProposals[_from];

        while (
            i < voterCastedProposalsCopy.length &&
            (_targetAmount == 0 || withdrawnAmount < _targetAmount)
        ) {
            uint256 proposalId = voterCastedProposalsCopy[i];
            Proposal storage proposal = proposals[proposalId];

            if (proposal.proposalStatus != ProposalStatus.Active) {
                uint256 toWithdraw =
                    userVotes[proposal.positiveVotes.id][_from].add(
                        userVotes[proposal.negativeVotes.id][_from]
                    );
                if (toWithdraw > 0) {
                    _withdrawVotesFromProposal(
                        proposalId,
                        toWithdraw,
                        _from,
                        userVotes[proposal.positiveVotes.id][_from] > 0
                            ? true
                            : false
                    );
                    withdrawnAmount = withdrawnAmount.add(toWithdraw);
                }
            }
            i += 1;
        }
    }

    /**
     * @dev Withdraw votes from active proposals until a target amount is reached.
     * @param _targetAmount Target at which to stop withdrawing tokens
     * @param _from Account to withdraw from
     */
    function _withdrawActiveVotes(uint256 _targetAmount, address _from)
        internal
        returns (uint256 withdrawnAmount)
    {
        uint256 i;
        uint256[] memory voterCastedProposalsCopy = voterCastedProposals[_from];

        while (
            i < voterCastedProposalsCopy.length &&
            withdrawnAmount < _targetAmount
        ) {
            uint256 proposalId = voterCastedProposalsCopy[i];
            Proposal storage proposal = proposals[proposalId];

            if (proposal.proposalStatus == ProposalStatus.Active) {
                // In active proposals, we only subtract the needed amount to reach the target
                uint256 toWithdraw =
                    Math.min(
                        _targetAmount.sub(withdrawnAmount),
                        userVotes[proposal.positiveVotes.id][_from].add(
                            userVotes[proposal.negativeVotes.id][_from]
                        )
                    );
                if (toWithdraw > 0) {
                    _withdrawVotesFromProposal(
                        proposalId,
                        toWithdraw,
                        _from,
                        userVotes[proposal.positiveVotes.id][_from] > 0
                            ? true
                            : false
                    );
                    withdrawnAmount = withdrawnAmount.add(toWithdraw);
                }
            }
            i += 1;
        }
    }

    /**
     * @dev Cancel proposals to force withdraw staked votes.
     * @param _targetAmount Target at which to stop withdrawing tokens
     * @param _from Account to withdraw from
     */
    function _withdrawStakedFromProposals(uint256 _targetAmount, address _from)
        internal
        returns (uint256 withdrawnAmount)
    {
        uint256[] storage userProposalsList = userProposals[_from];
        uint256 i = userProposalsList.length.sub(1);

        while (withdrawnAmount < _targetAmount && i >= 0) {
            uint256 proposalId = userProposalsList[i];
            withdrawnAmount = withdrawnAmount.add(
                stakedForProposal[proposalId]
            );
            cancelProposal(userProposalsList[i]);
            if (i == 0) {
                break;
            }
            i = i.sub(1);
        }
    }

    /**
     * @notice Withdraw all votes from proposal
     * @param _proposalId Proposal id
     * @param _support Positive or negative
     */
    function withdrawAllVotesFromProposal(uint256 _proposalId, bool _support)
        external
        proposalExists(_proposalId)
    {
        _withdrawVotesFromProposal(
            _proposalId,
            _support
                ? userVotes[proposals[_proposalId].positiveVotes.id][msg.sender]
                : userVotes[proposals[_proposalId].negativeVotes.id][
                    msg.sender
                ],
            msg.sender,
            _support
        );
    }

    /**
     * @notice Execute proposal #`_proposalId`
     * @param _proposalId Proposal id
     */
    function executeProposal(uint256 _proposalId)
        external
        proposalExists(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId];

        require(
            _proposalId != ABSTAIN_PROPOSAL_ID,
            ERROR_CANNOT_EXECUTE_ABSTAIN_PROPOSAL
        );
        require(
            proposal.proposalStatus == ProposalStatus.Active,
            ERROR_PROPOSAL_NOT_ACTIVE
        );
        Vote storage positiveVotes = proposal.positiveVotes;
        Vote storage negativeVotes = proposal.negativeVotes;
        _calculateAndSetConviction(positiveVotes, positiveVotes.totalVotes);
        _calculateAndSetConviction(negativeVotes, negativeVotes.totalVotes);

        require(
            positiveVotes.convictionLast > negativeVotes.convictionLast &&
                positiveVotes.convictionLast.sub(
                    negativeVotes.convictionLast
                ) >=
                calculateThreshold(),
            ERROR_INSUFFICIENT_CONVICTION
        );

        proposal.proposalStatus = ProposalStatus.Executed;
        quartz.moveVotesFromGovernor(
            proposal.submitter,
            stakedForProposal[_proposalId]
        );
        stakedForProposal[_proposalId] = 0;
        uint256 proposalIdx = userProposalIds[proposal.submitter][_proposalId];
        uint256 lastProposalId =
            userProposals[proposal.submitter][
                userProposals[proposal.submitter].length.sub(1)
            ];
        userProposals[proposal.submitter][proposalIdx.sub(1)] = lastProposalId;
        userProposalIds[proposal.submitter][_proposalId] = 0;
        userProposalIds[proposal.submitter][lastProposalId] = proposalIdx;
        userProposals[proposal.submitter].pop();

        emit ProposalExecuted(
            _proposalId,
            proposal.positiveVotes.convictionLast,
            proposal.negativeVotes.convictionLast
        );
    }

    /**
     * @notice Cancel proposal #`_proposalId`
     * @param _proposalId Proposal id
     */
    function cancelProposal(uint256 _proposalId)
        public
        proposalExists(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId];

        require(
            _proposalId != ABSTAIN_PROPOSAL_ID,
            ERROR_CANNOT_CANCEL_ABSTAIN_PROPOSAL
        );
        require(
            proposal.proposalStatus == ProposalStatus.Active,
            ERROR_PROPOSAL_NOT_ACTIVE
        );

        if (proposal.expiration > uint64(block.timestamp)) {
            bool senderHasPermission =
                hasRole(CANCEL_PROPOSAL_ROLE, msg.sender);
            require(
                proposal.submitter == msg.sender ||
                    senderHasPermission ||
                    msg.sender == address(quartz),
                ERROR_SENDER_CANNOT_CANCEL
            );
        }

        proposal.proposalStatus = ProposalStatus.Cancelled;
        quartz.moveVotesFromGovernor(
            proposal.submitter,
            stakedForProposal[_proposalId]
        );
        stakedForProposal[_proposalId] = 0;
        uint256 proposalIdx = userProposalIds[proposal.submitter][_proposalId];
        uint256 lastProposalId =
            userProposals[proposal.submitter][
                userProposals[proposal.submitter].length.sub(1)
            ];
        userProposals[proposal.submitter][proposalIdx.sub(1)] = lastProposalId;
        userProposalIds[proposal.submitter][_proposalId] = 0;
        userProposalIds[proposal.submitter][lastProposalId] = proposalIdx;
        userProposals[proposal.submitter].pop();

        emit ProposalCancelled(_proposalId);
    }

    /**
     * @dev Get proposal details
     * @param _proposalId Proposal id
     * @return positiveVotes Positive votes info
     * @return negativeVotes Negative votes info
     * @return proposalStatus ProposalStatus defining the state of the proposal
     * @return submitter Submitter of the proposal
     */
    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            Vote memory positiveVotes,
            Vote memory negativeVotes,
            ProposalStatus proposalStatus,
            address submitter,
            uint64 expiration,
            uint256 staked
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.positiveVotes,
            proposal.negativeVotes,
            proposal.proposalStatus,
            proposal.submitter,
            proposal.expiration,
            stakedForProposal[_proposalId]
        );
    }

    /**
     * @notice Get stake of voter `_voter` on proposal #`_proposalId`
     * @param _proposalId Proposal id
     * @param _voter Voter address
     * @return Positive user votes
     * @return Negative user votes
     */
    function getProposalUserVotes(uint256 _proposalId, address _voter)
        external
        view
        returns (uint256, uint256)
    {
        return (
            userVotes[proposals[_proposalId].positiveVotes.id][_voter],
            userVotes[proposals[_proposalId].negativeVotes.id][_voter]
        );
    }

    /**
     * @notice Get the total votes of voter `_voter` on all proposals
     * @param _voter Voter address
     * @return Total user votes
     */
    function getTotalUserVotes(address _voter) external view returns (uint256) {
        return totalUserVotes[_voter];
    }

    /**
     * @notice Get all proposal ID's voter `_voter` has currently voted
     * @param _voter Voter address
     * @return Voter proposals
     */
    function getVoterCastedProposals(address _voter)
        external
        view
        returns (uint256[] memory)
    {
        return voterCastedProposals[_voter];
    }

    /**
     * @dev Calculate conviction and store it on the proposal
     * @param _vote Vote
     * @param _oldVote Amount of votes on a proposal until now
     */
    function _calculateAndSetConviction(Vote storage _vote, uint256 _oldVote)
        internal
    {
        uint256 blockNumber = block.number;
        assert(_vote.blockLast <= blockNumber);
        if (_vote.blockLast == blockNumber) {
            return; // Conviction already stored
        }
        // calculateConviction and store it
        uint256 conviction =
            calculateConviction(
                blockNumber - _vote.blockLast, // we assert it doesn't overflow above
                _vote.convictionLast,
                _oldVote
            );
        _vote.blockLast = blockNumber;
        _vote.convictionLast = conviction;
    }

    /**
     * @dev Stake an amount of tokens on a proposal
     * @param _proposalId Proposal id
     * @param _amount Amount of staked tokens
     * @param _from Account from which we stake
     */
    function _castVotes(
        uint256 _proposalId,
        uint256 _amount,
        address _from,
        bool _support
    ) internal proposalExists(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        require(_amount > 0, ERROR_AMOUNT_CAN_NOT_BE_ZERO);
        require(
            proposal.proposalStatus == ProposalStatus.Active,
            ERROR_PROPOSAL_NOT_ACTIVE
        );

        quartz.moveVotesToGovernor(_from, _amount);

        Vote storage votes;

        if (_support) {
            require(
                userVotes[proposal.negativeVotes.id][_from] == 0,
                ERROR_ALREADY_NEGATIVE_VOTED
            );
            votes = proposal.positiveVotes;
        } else {
            require(
                userVotes[proposal.positiveVotes.id][_from] == 0,
                ERROR_ALREADY_POSITIVE_VOTED
            );
            votes = proposal.negativeVotes;
        }
        uint256 previousVote = votes.totalVotes;
        votes.totalVotes = previousVote.add(_amount);
        userVotes[votes.id][_from] = userVotes[votes.id][_from].add(_amount);
        totalUserVotes[_from] = totalUserVotes[_from].add(_amount);
        totalVotes = totalVotes.add(_amount);

        if (votes.blockLast == 0) {
            votes.blockLast = block.number;
        } else {
            _calculateAndSetConviction(votes, previousVote);
        }

        _updateVoterCastedProposals(_proposalId, _from);

        emit VoteCasted(
            _from,
            _proposalId,
            _amount,
            votes.convictionLast,
            _support
        );
    }

    function _updateVoterCastedProposals(
        uint256 _proposalId,
        address _submitter
    ) internal {
        uint256[] storage voterCastedProposalsArray =
            voterCastedProposals[_submitter];

        if (userVotedProposalIds[_submitter][_proposalId] == 0) {
            require(
                voterCastedProposalsArray.length < MAX_STAKED_PROPOSALS,
                ERROR_MAX_PROPOSALS_REACHED
            );
            voterCastedProposalsArray.push(_proposalId);
            userVotedProposalIds[_submitter][
                _proposalId
            ] = voterCastedProposalsArray.length;
        }
    }

    /**
     * @dev Withdraw an amount of tokens from a proposal
     * @param _proposalId Proposal id
     * @param _amount Amount of withdrawn tokens
     * @param _from Account to withdraw from
     * @param _support Positive or negative
     */
    function _withdrawVotesFromProposal(
        uint256 _proposalId,
        uint256 _amount,
        address _from,
        bool _support
    ) internal {
        Proposal storage proposal = proposals[_proposalId];
        Vote storage votes =
            _support ? proposal.positiveVotes : proposal.negativeVotes;

        require(
            userVotes[votes.id][_from] >= _amount,
            ERROR_WITHDRAW_MORE_THAN_VOTED
        );
        require(_amount > 0, ERROR_AMOUNT_CAN_NOT_BE_ZERO);

        quartz.moveVotesFromGovernor(_from, _amount);
        uint256 previousVote = votes.totalVotes;

        votes.totalVotes = previousVote.sub(_amount);
        userVotes[votes.id][_from] = userVotes[votes.id][_from].sub(_amount);
        totalUserVotes[_from] = totalUserVotes[_from].sub(_amount);
        totalVotes = totalVotes.sub(_amount);

        if (userVotes[votes.id][_from] == 0) {
            uint256 index = userVotedProposalIds[_from][_proposalId].sub(1);
            userVotedProposalIds[_from][_proposalId] = 0;
            uint256 lastIndex = voterCastedProposals[_from].length.sub(1);
            uint256 lastProposalId = voterCastedProposals[_from][lastIndex];
            voterCastedProposals[_from][index] = lastProposalId;
            userVotedProposalIds[_from][lastProposalId] = index.add(1);

            voterCastedProposals[_from].pop();
        }

        if (proposal.proposalStatus == ProposalStatus.Active) {
            _calculateAndSetConviction(votes, previousVote);
        }

        emit VoteWithdrawn(
            _from,
            _proposalId,
            _amount,
            votes.convictionLast,
            _support
        );
    }

    /**
     * @dev Conviction formula: a^t * y(0) + x * (1 - a^t) / (1 - a)
     * Solidity implementation: y = (2^128 * a^t * y0 + x * D * (2^128 - 2^128 * a^t) / (D - aD) + 2^127) / 2^128
     * @param _timePassed Number of blocks since last conviction record
     * @param _lastConv Last conviction record
     * @param _oldAmount Amount of tokens staked until now
     * @return Current conviction
     */
    function calculateConviction(
        uint256 _timePassed,
        uint256 _lastConv,
        uint256 _oldAmount
    ) public view returns (uint256) {
        uint256 t = uint256(_timePassed);
        // atTWO_128 = 2^128 * a^t
        uint256 atTWO_128 = _pow((decay << 128).div(D), t);
        // solium-disable-previous-line
        // conviction = (atTWO_128 * _lastConv + _oldAmount * D * (2^128 - atTWO_128) / (D - aD) + 2^127) / 2^128
        return
            (
                atTWO_128.mul(_lastConv).add(
                    _oldAmount.mul(D).mul(TWO_128.sub(atTWO_128)).div(D - decay)
                )
            )
                .add(TWO_127) >> 128;
    }

    /**
     * @dev Formula: ρ * totalStaked / (1 - a) / (β - minVotesToPass / total)**2
     * For the Solidity implementation we amplify ρ and β and simplify the formula:
     * weight = ρ * D
     * maxRatio = β * D
     * decay = a * D
     * threshold = weight * totalStaked * D ** 2 * funds ** 2 / (D - decay) / (maxRatio * funds - minVotesToPass * D) ** 2
     * @return _threshold Threshold a proposal's conviction should surpass in order to be able to
     * executed it.
     */
    function calculateThreshold() public view returns (uint256 _threshold) {
        uint256 funds = quartz.totalStaked();
        require(
            maxRatio.mul(funds) > minVotesToPass.mul(D),
            ERROR_AMOUNT_OVER_MAX_RATIO
        );
        // denom = maxRatio * 2 ** 64 / D  - minVotesToPass * 2 ** 64 / funds
        uint256 denom =
            (maxRatio << 64).div(D).sub((minVotesToPass << 64).div(funds));
        // _threshold = (weight * 2 ** 128 / D) / (denom ** 2 / 2 ** 64) * totalStaked * D / 2 ** 128
        _threshold =
            ((weight << 128).div(D).div(denom.mul(denom) >> 64))
                .mul(D)
                .div(D.sub(decay))
                .mul(_totalVotes()) >>
            64;
    }

    function _totalVotes() internal view returns (uint256) {
        uint256 minTotalVotes =
            (quartz.totalStaked().mul(minThresholdStakePercentage)).div(
                ONE_HUNDRED_PERCENT
            );
        return totalVotes < minTotalVotes ? minTotalVotes : totalVotes;
    }

    /**
     * @dev Withdraw required votes to move delegates
     */
    function withdrawRequiredVotes(
        address _from,
        uint256 _amount,
        bool force
    ) external onlyQuartz {
        uint256 inactiveWithdrawn = _withdrawInactiveVotes(_amount, _from);
        if (inactiveWithdrawn < _amount) {
            require(force, ERROR_NOT_ENOUGH_INACTIVE_VOTES);
            uint256 activeWithdrawn =
                _withdrawActiveVotes(_amount.sub(inactiveWithdrawn), _from);
            uint256 stakedWithdrawn;
            if (inactiveWithdrawn.add(activeWithdrawn) < _amount) {
                stakedWithdrawn = _withdrawStakedFromProposals(
                    _amount.sub(inactiveWithdrawn).sub(activeWithdrawn),
                    _from
                );
            }
            require(
                inactiveWithdrawn.add(activeWithdrawn).add(stakedWithdrawn) >=
                    _amount,
                ERROR_NO_ENOUGH_VOTES
            );
        }
    }

    /**
     * Multiply _a by _b / 2^128.  Parameter _a should be less than or equal to
     * 2^128 and parameter _b should be less than 2^128.
     * @param _a left argument
     * @param _b right argument
     * @return _result _a * _b / 2^128
     */
    function _mul(uint256 _a, uint256 _b)
        internal
        pure
        returns (uint256 _result)
    {
        require(_a <= TWO_128, "_a should be less than or equal to 2^128");
        require(_b < TWO_128, "_b should be less than 2^128");
        return _a.mul(_b).add(TWO_127) >> 128;
    }

    /**
     * Calculate (_a / 2^128)^_b * 2^128.  Parameter _a should be less than 2^128.
     *
     * @param _a left argument
     * @param _b right argument
     * @return _result (_a / 2^128)^_b * 2^128
     */
    function _pow(uint256 _a, uint256 _b)
        internal
        pure
        returns (uint256 _result)
    {
        require(_a < TWO_128, "_a should be less than 2^128");
        uint256 a = _a;
        uint256 b = _b;
        _result = TWO_128;
        while (b > 0) {
            if (b & 1 == 0) {
                a = _mul(a, a);
                b >>= 1;
            } else {
                _result = _mul(_result, a);
                b -= 1;
            }
        }
    }
}
