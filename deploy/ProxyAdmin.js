const deployProxyAdmin = async function ({ deployments, getNamedAccounts }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('ProxyAdmin', {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports = deployProxyAdmin;
module.exports.tags = ['ProxyAdmin'];
