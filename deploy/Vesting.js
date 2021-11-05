const { ethers } = require('hardhat');

module.exports = async function deployQuartz({
  deployments,
  getNamedAccounts,
}) {
  const chainId = await getChainId();

  if (chainId !== '80001') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const quartzAddress = (await deployments.get('QuartzToken')).address;

  const start = Math.floor(
    new Date('2021-11-06T12:00:00.000Z').getTime() / 1000,
  );
  const startAmount = ethers.utils.parseUnits('100', 18);
  const batchDuration = 60 * 60 * 24; // 24 hours
  const batchSize = ethers.utils.parseUnits('100', 18);

  await deploy('Vesting', {
    from: deployer,
    args: [quartzAddress, start, startAmount, batchDuration, batchSize],
    log: true,
  });
};

module.exports.tags = ['Vesting'];
