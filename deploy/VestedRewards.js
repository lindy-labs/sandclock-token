const globalConfig = require('./config.json');

const config = globalConfig['vestedRewards'];

const deployVestedRewards = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '1' && chainId !== '4') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const quartz = await deployments.get('QuartzToken');

  await deploy('VestedRewards', {
    from: deployer,
    args: [quartz.address, config.start, config.duration, config.gracePeriod],
    log: true,
  });
};

module.exports = deployVestedRewards;
module.exports.tags = ['VestedRewards'];
