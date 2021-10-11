// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract QuartzL1 is ERC20("Sandclock", "QUARTZ") {
    constructor() {
        _mint(msg.sender, 1e8 ether);
    }
}
