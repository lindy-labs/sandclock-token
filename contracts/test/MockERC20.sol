// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20("MockERC20", "mockERC20") {
    constructor() {
        _mint(_msgSender(), 1e10);
    }
}
