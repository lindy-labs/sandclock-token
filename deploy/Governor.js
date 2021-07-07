const config = require('./config.json');

const deployGovernor = async function ({ deployments, getNamedAccounts }) {
  const chainId = await getChainId();
  if (chainId !== '137' && chainId !== '80001') {
    throw Error('Unsupported chain');
  }

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const quartzAddress = (await deployments.get('Quartz')).address;

  await deploy('QuartzGovernor', {
    from: deployer,
    args: [
      quartzAddress,
      config.decay,
      config.maxRatio,
      config.weight,
      config.minThresholdStakePercentage,
      config.minVotesToPass,
    ],
    log: true,
  });
};

module.exports = deployGovernor;
module.exports.tags = ['QuartzGovernor'];
