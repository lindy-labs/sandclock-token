// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vesting is Ownable {
    IERC20 token;
    uint256 start;
    mapping(address => uint256) public claimable;
    uint256 public totalClaimable;
    uint256 public totalClaimed;

    event ClaimAdded(address indexed beneficiary, uint256 amount);
    event Claimed(address indexed beneficiary, uint256 amount);

    constructor(IERC20 _token, uint256 _start) {
        token = _token;
        start = _start;
    }

    function addClaimable(address _beneficiary, uint256 _amount)
        public
        onlyOwner
    {
        totalClaimable += _amount;
        claimable[_beneficiary] += _amount;

        emit ClaimAdded(_beneficiary, _amount);

        require(
            totalClaimable <= token.balanceOf(address(this)),
            "not enough tokens on contract"
        );
    }

    /**
     * @notice Calculates amount that can be currently claimed by an address,
     *   based on his own vested amount, and how much has been already unlocked;
     * @param _beneficiary The address to calculate for
     * TODO check for how much time has passed, and truncate amount accordingly
     */
    function currentlyClaimable(address _beneficiary)
        public
        view
        returns (uint256)
    {
        if (block.timestamp <= start) {
            return 0;
        }

        return claimable[_beneficiary];
    }

    function claim(address _beneficiary) public {
        uint256 amount = currentlyClaimable(_beneficiary);

        require(amount > 0, "no tokens to claim");

        claimable[_beneficiary] -= amount;
        totalClaimable -= amount;
        totalClaimed += amount;
        emit Claimed(_beneficiary, amount);

        token.transfer(_beneficiary, amount);
    }
}
