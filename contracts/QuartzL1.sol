pragma solidity 0.7.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract QuartzL1 is ERC20("Sandclock", "QUARTZ") {
    constructor() {
        _mint(msg.sender, 100000000 * 1e18);
    }
}
