pragma solidity 0.7.3;

interface IQuartz {
    function moveVotesToGovernor(address user, uint256 amount) external;

    function moveVotesFromGovernor(address user, uint256 amount) external;

    function getCurrentVotes(address account) external view returns (uint256);

    function totalStaked() external view returns (uint256);
}
