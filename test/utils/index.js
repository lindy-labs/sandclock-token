const { BigNumber } = require('ethers');
const { time } = require('@openzeppelin/test-helpers');

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
