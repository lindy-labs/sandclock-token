const { BigNumber } = require('ethers');
const { expect } = require('chai');
const {
  time, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const getCurrentTime = async () => {
  return BigNumber.from((await time.latest()).toString());
};

const getCurrentBlock = async () => {
  return BigNumber.from((await time.latestBlock()).toString());
};

module.exports = {
  getCurrentTime,
  getCurrentBlock,
};
