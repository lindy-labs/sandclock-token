const { BigNumber } = require('ethers');
const { expect } = require('chai');
const {
  time, // Big Number support
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
