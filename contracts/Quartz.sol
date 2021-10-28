// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IQuartzGovernor.sol";
import "./interfaces/IQuartz.sol";
import "./interfaces/IChildToken.sol";

contract Quartz is
    ERC20("Sandclock", "QUARTZ"),
    AccessControl,
    IQuartz,
    IChildToken
{
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
    event DelegateVotesChanged(address indexed delegate, uint256 newBalance);
    event GovernorChanged(address indexed governor);
    event MinStakePeriodChanged(uint64 minStakePeriod);

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

    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    IQuartzGovernor public governor;

    mapping(address => uint256) public userVotesRep;
    mapping(address => address) public delegates;
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;
    mapping(address => uint32) public numCheckpoints;
    uint64 public minStakePeriod;
    uint64 public stakeLength;
    // All stakes infos
    mapping(uint64 => StakeInfo) public stakes;
    // Total staked amount
    uint256 public override totalStaked;

    constructor(uint64 _minStakePeriod, address _childChainManager) {
        minStakePeriod = _minStakePeriod;
        emit MinStakePeriodChanged(_minStakePeriod);

        require(
            _childChainManager != address(0),
            "QUARTZ: Child chain manager cannot be zero"
        );
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, _childChainManager);
    }

    function setGovernor(IQuartzGovernor _governor)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            address(_governor) != address(0),
            "QUARTZ: Governor cannot be zero"
        );
        governor = _governor;
        emit GovernorChanged(address(_governor));
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
        require(
            _period >= minStakePeriod,
            "QUARTZ: Period must be greater than minimum"
        );

        _transfer(msg.sender, address(this), _amount);

        address _owner = msg.sender;
        uint64 _stakeId = stakeLength;
        uint64 _maturationTimestamp = _getBlockTimestamp() + _period;
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

        userVotesRep[_beneficiary] += _amount;
        if (delegates[_beneficiary] == address(0)) {
            _delegate(_beneficiary, _beneficiary);
        } else {
            _moveDelegates(address(0), delegates[_beneficiary], _amount);
        }

        stakeLength += 1;
        totalStaked += _amount;
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
        //slither-disable-next-line timestamp
        require(
            stakeInfo.maturationTimestamp <= _getBlockTimestamp(),
            "QUARTZ: Not ready to unstake"
        );
        require(stakeInfo.active, "QUARTZ: Already unstaked");
        require(stakeInfo.owner == msg.sender, "QUARTZ: Not owner");

        stakeInfo.active = false;
        userVotesRep[stakeInfo.beneficiary] -= stakeInfo.amount;
        totalStaked -= stakeInfo.amount;

        _moveDelegates(
            delegates[stakeInfo.beneficiary],
            address(0),
            stakeInfo.amount
        );

        _transfer(address(this), msg.sender, stakeInfo.amount);

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

    function moveVotesToGovernor(address user, uint256 amount)
        external
        override
    {
        require(
            msg.sender == address(governor),
            "QUARTZ: only governor can call"
        );
        _moveDelegates(user, msg.sender, amount);
    }

    function moveVotesFromGovernor(address user, uint256 amount)
        external
        override
    {
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
    function getCurrentVotes(address account)
        external
        view
        override
        returns (uint256)
    {
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
                        amount - srcRepOld,
                        dstRep == address(0)
                    );
                    srcRepNum = numCheckpoints[srcRep];
                    srcRepOld = srcRepNum > 0
                        ? checkpoints[srcRep][srcRepNum - 1].votes
                        : 0;
                }
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld =
                    dstRepNum > 0
                        ? checkpoints[dstRep][dstRepNum - 1].votes
                        : 0;
                uint256 dstRepNew = dstRepOld + amount;
                _writeCheckpoint(dstRep, dstRepNum, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint256 newVotes
    ) internal {
        uint32 blockNumber =
            safe32(
                block.number,
                "Quartz::_writeCheckpoint: block number exceeds 32 bits"
            );
        if (
            //slither-disable-next-line incorrect-equality
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

        emit DelegateVotesChanged(delegatee, newVotes);
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

    function setMinStakePeriod(uint64 _minStakePeriod)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        minStakePeriod = _minStakePeriod;
        emit MinStakePeriodChanged(_minStakePeriod);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param _user user address for whom deposit is being done
     * @param _depositData abi encoded amount
     */
    function deposit(address _user, bytes calldata _depositData)
        external
        override
        onlyRole(DEPOSITOR_ROLE)
    {
        uint256 amount = abi.decode(_depositData, (uint256));
        _mint(_user, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param _amount amount of tokens to withdraw
     */
    function withdraw(uint256 _amount) external override {
        _burn(_msgSender(), _amount);
    }
}
