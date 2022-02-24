// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Quartz token on Ethereum blockchain
 *
 * @notice This token will be bridged to an instance of `Quartz` deployed on
 * Polygon network.  Governance happens on the Polygon chain. As such, no
 * additional logic is needed on this contract
 *
 * @notice Bridging to polygon is done via Polygon PoS
 */
contract QuartzToken is ERC20("Sandclock", "QUARTZ") {
    constructor() {
        _mint(msg.sender, 1e8 ether);
    }
}
