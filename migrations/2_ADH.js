var A = artifacts.require("AdHiveToken");
var B = artifacts.require("MultiSigWalletTokenLimit");

module.exports = function(deployer) 
{
  // deployment steps
  deployer.deploy(A, web3.eth.accounts[0], "AdHive Token", "ADH", 50000, 0).then(function() 
    {
      return deployer.deploy(B, [web3.eth.accounts[1], web3.eth.accounts[2]], 2, [1526659181, 1526659981], [10000, 20000], A.address);
    });
};