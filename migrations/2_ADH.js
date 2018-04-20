var A = artifacts.require("AdHiveToken");
var B = artifacts.require("MultiSigWalletTokenLimit");

module.exports = function(deployer) 
{
  // deployment steps
  deployer.deploy(A, web3.eth.accounts[0], "AdHive Token", "ADH", 50000, 0).then(function() 
    {
      let now_period = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
      return deployer.deploy(B, [web3.eth.accounts[1], web3.eth.accounts[2]], 2, [now_period + 20, now_period + 40, now_period + 60], [1000, 2000, 3000], A.address);
    });
};