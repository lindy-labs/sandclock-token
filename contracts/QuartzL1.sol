pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract QuartzL1 is ERC20("Sandclock", "QUARTZ") {
    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
