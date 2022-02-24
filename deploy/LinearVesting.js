const { ethers } = require('hardhat');

module.exports = async function deploy({
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

  await deploy('LinearVesting', {
    from: deployer,
    args: [Quartz.address],
    log: true,
  });
};

module.exports.tags = ['LinearVesting'];
