var A = artifacts.require("AdHiveToken");
var B = artifacts.require("MultiSigWalletTokenLimit");

module.exports = function(deployer) 
{
  // deployment steps
  deployer.deploy(A, web3.eth.accounts[0], "AdHive Token", "ADH", 50000, 0).then(function() 
    {
      new_period = Math.round(new Date().getTime() / 1000 + 2);
      return deployer.deploy(B, [web3.eth.accounts[1], web3.eth.accounts[2]], 2, [new_period, new_period + 2, new_period + 5], [1000, 2000, 3000], A.address);
    });
};