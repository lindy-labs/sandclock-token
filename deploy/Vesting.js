const { ethers } = require('hardhat');

const config = {
  polygon: {
    start: new Date('2021-11-06T12:00:00.000Z').getTime() / 1000,
    startAmount: ethers.utils.parseUnits('100', 18),
    batchDuration: 60 * 60 * 24, // 24 hours
    batchSize: ethers.utils.parseUnits('100', 18),
  },
  mumbai: {
    start: new Date('2021-11-05T16:00:00.000Z').getTime() / 1000,
    startAmount: ethers.utils.parseUnits('100', 18),
    batchDuration: 60 * 10, // 10 minutes
    batchSize: ethers.utils.parseUnits('100', 18),
  },
};

module.exports = async function deployVesting({
  deployments,
  getNamedAccounts,
}) {
  const chainId = await getChainId();

  if (chainId !== '137' && chainId !== '80001') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const Quartz = await ethers.getContract('Quartz');

  const { start, startAmount, batchDuration, batchSize } =
    chainId == '137' ? config.polygon : config.mumbai;

  await deploy('Vesting', {
    from: deployer,
    args: [Quartz.address, start, startAmount, batchDuration, batchSize],
    log: true,
  });
};

module.exports.tags = ['Vesting'];
