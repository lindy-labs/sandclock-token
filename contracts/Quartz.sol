pragma solidity 0.7.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IQuartzGovernor.sol";
import "./libraries/SafeMath64.sol";

contract Quartz is ERC20("Sandclock", "QUARTZ"), Ownable {
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    event Staked(
        uint64 indexed id,
        address indexed owner,
        address indexed beneficiary,
        uint256 amount,
        uint64 maturationTime
    );

    event Unstaked(
        uint64 indexed id,
        address indexed owner,
        address indexed beneficiary,
        uint256 amount
    );

    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    struct StakeInfo {
        address owner; // Owner who staked tokens
        address beneficiary; // Beneficiary who received vote rep
        uint256 amount; // Staked Quartz amount
        uint64 period; // Stake period in seconds
        uint64 maturationTimestamp; // Stake maturation timestamp
        bool active; // Indicates active after maturation time
    }

    struct Checkpoint {
        uint32 fromBlock;
        uint256 votes;
    }

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );

    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    IQuartzGovernor public governor;

    mapping(address => uint256) public userVotesRep;
    mapping(address => address) public delegates;
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;
    mapping(address => uint32) public numCheckpoints;
    uint64 public stakeLength;
    // All stakes infos
    mapping(uint64 => StakeInfo) public stakes;
    // Stake ids of owner
    mapping(address => uint64[]) public ownerStakeIds;
    // Stake ids of beneficiary
    mapping(address => uint64[]) public beneficiaryIds;
    // Total staked amount
    uint256 public totalStaked;

    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }

    function setGovernor(IQuartzGovernor _governor) external onlyOwner {
        require(
            address(_governor) != address(0),
            "QUARTZ: Governor cannot be zero"
        );
        governor = _governor;
    }

    // Stake QUARTZ token to grant vote rep to beneficiary for a period.
    function stake(
        uint256 _amount,
        address _beneficiary,
        uint64 _period
    ) external {
        require(
            _beneficiary != address(0),
            "QUARTZ: Beneficiary cannot be 0x0"
        );
        require(_amount > 0, "QUARTZ: Amount must be greater than zero");

        _transfer(msg.sender, address(this), _amount);

        address _owner = msg.sender;
        uint64 _stakeId = stakeLength;
        uint64 _maturationTimestamp = _getBlockTimestamp().add(_period);
        StakeInfo memory stakeInfo =
            StakeInfo({
                owner: _owner,
                beneficiary: _beneficiary,
                amount: _amount,
                period: _period,
                maturationTimestamp: _maturationTimestamp,
                active: true
            });
        stakes[_stakeId] = stakeInfo;
        ownerStakeIds[_owner].push(_stakeId);
        beneficiaryIds[_beneficiary].push(_stakeId);

        userVotesRep[_beneficiary] = userVotesRep[_beneficiary].add(_amount);
        if (delegates[_beneficiary] == address(0)) {
            _delegate(_beneficiary, _beneficiary);
        } else {
            _moveDelegates(address(0), delegates[_beneficiary], _amount);
        }

        stakeLength = stakeLength.add(1);
        totalStaked = totalStaked.add(_amount);
        emit Staked(
            _stakeId,
            _owner,
            _beneficiary,
            _amount,
            _maturationTimestamp
        );
    }

    function unstake(uint64 _stakeId) external {
        require(_stakeId < stakeLength, "QUARTZ: Invalid id");
        StakeInfo storage stakeInfo = stakes[_stakeId];
        require(
            stakeInfo.maturationTimestamp <= _getBlockTimestamp(),
            "QUARTZ: Not ready to unstake"
        );
        require(stakeInfo.active, "QUARTZ: Already unstaked");
        require(stakeInfo.owner == msg.sender, "QUARTZ: Not owner");
        _transfer(address(this), msg.sender, stakeInfo.amount);

        stakeInfo.active = false;
        userVotesRep[stakeInfo.beneficiary] = userVotesRep[
            stakeInfo.beneficiary
        ]
            .sub(stakeInfo.amount);

        _moveDelegates(
            delegates[stakeInfo.beneficiary],
            address(0),
            stakeInfo.amount
        );

        totalStaked = totalStaked.sub(stakeInfo.amount);

        emit Unstaked(
            _stakeId,
            stakeInfo.owner,
            stakeInfo.beneficiary,
            stakeInfo.amount
        );
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    function moveVotesToGovernor(address user, uint256 amount) external {
        require(
            msg.sender == address(governor),
            "QUARTZ: only governor can call"
        );
        _moveDelegates(user, msg.sender, amount);
    }

    function moveVotesFromGovernor(address user, uint256 amount) external {
        require(
            msg.sender == address(governor),
            "QUARTZ: only governor can call"
        );
        _moveDelegates(msg.sender, user, amount);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) public view returns (uint256) {
        uint32 nCheckpoints = numCheckpoints[account];
        return
            nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    function _delegate(address delegator, address delegatee) internal {
        require(delegatee != address(0), "QUARTZ: delegatee cannot be 0x0");
        address currentDelegate = delegates[delegator];
        uint256 delegatorVotesRep = userVotesRep[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorVotesRep);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld =
                    srcRepNum > 0
                        ? checkpoints[srcRep][srcRepNum - 1].votes
                        : 0;
                if (srcRepOld < amount) {
                    governor.withdrawRequiredVotes(
                        srcRep,
                        amount.sub(srcRepOld),
                        dstRep == address(0)
                    );
                    srcRepNum = numCheckpoints[srcRep];
                    srcRepOld = srcRepNum > 0
                        ? checkpoints[srcRep][srcRepNum - 1].votes
                        : 0;
                }
                uint256 srcRepNew =
                    srcRepOld.sub(
                        amount,
                        "Quartz::_moveVotes: vote amount underflows"
                    );
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld =
                    dstRepNum > 0
                        ? checkpoints[dstRep][dstRepNum - 1].votes
                        : 0;
                uint256 dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    ) internal {
        uint32 blockNumber =
            safe32(
                block.number,
                "Quartz::_writeCheckpoint: block number exceeds 32 bits"
            );

        if (
            nCheckpoints > 0 &&
            checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(
                blockNumber,
                newVotes
            );
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint256 n, string memory errorMessage)
        internal
        pure
        returns (uint32)
    {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function _getBlockTimestamp() private view returns (uint64) {
        return uint64(block.timestamp);
    }

    function getOwnerStakeIdsLength(address user)
        external
        view
        returns (uint256)
    {
        return ownerStakeIds[user].length;
    }

    function getBeneficiaryIdsLength(address user)
        external
        view
        returns (uint256)
    {
        return beneficiaryIds[user].length;
    }
}
