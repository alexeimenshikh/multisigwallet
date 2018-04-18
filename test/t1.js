function sleep(miliseconds) 
{
  var currentTime = new Date().getTime();
  while (currentTime + miliseconds >= new Date().getTime()) 
  {
  }
}

var new_period;

var adh = artifacts.require("AdHiveToken");
var adh_limit = artifacts.require("MultiSigWalletTokenLimit");

contract("MultisSig Wallet Token Limit", async(accounts) => 
{
  it("Transfer ADH Tokens to Contract", async() =>
  {
    let adh_l = await adh_limit.deployed();
    let instance = await adh.deployed();
    let r = await instance.transfer(adh_l.address, 10000, {from: accounts[0]});
    console.log(await adh_l.periodCount());
  });

  it("Test wallet balance", async () =>
  {
    let instance = await adh_limit.deployed();
    assert.equal(await instance.wallet_balance(), 10000, "Amount is not 10000");
  });

  it("Submit transaction addOwner", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    let data = contract.addOwner.getData(accounts[3]);
    await instance.submitTransaction(data, {from: accounts[1]});
    assert.equal(await instance.transactionCount(), 1, "transactionCount should be 1");
  });

  it("Confirm transaction 0", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(0, {from: accounts[2]});
    assert.equal(await instance.isOwner(accounts[3]), true, "Should be true");
  });

  it("Submit transaction addPeriod (current time + 5 seconds, limit 1000)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    let d = Math.round(new Date().getTime() / 1000 + 5); //current timestamp + 5 seconds
    let data = contract.addPeriod.getData(d, 1000);
    await instance.submitTransaction(data, {from: accounts[1]});
    assert.equal(await instance.transactionCount(), 2, "transactionCount should be 2");
  });

  it("Confirm transaction 1", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(1, {from: accounts[3]});
    assert.equal(await instance.periodCount(), 4, "periodCount should be 4");
    assert.equal(await instance.current_period(), 3, "current_period should be 3");
  });

  it ("Changing period", async () =>
  {
    await console.log("Pause for 10 seconds");
    sleep(10000);
    let instance = await adh_limit.deployed();
    await instance.updateCurrentPeriod({from: accounts[3]});
    assert.equal(await instance.current_period(), 1, "current_period should be 1");
  });

  it("Submit transaction addPeriod (current time + 1000 seconds, limit 10000)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    new_period = Math.round(new Date().getTime() / 1000 + 1000); //current timestamp + 1000 seconds
    let data = contract.addPeriod.getData(new_period, 10000);
    await instance.submitTransaction(data, {from: accounts[2]});
    assert.equal(await instance.transactionCount(), 3, "transactionCount should be 3");
  });

  it("Confirm transaction 2", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(2, {from: accounts[3]});
    assert.equal(await instance.periodCount(), 5, "periodCount should be 5");
    assert.equal(await instance.current_period(), 4, "current_period should be 4");
  });

  it("Submit transaction deactivatePeriod (current time + 1000 seconds)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    let data = contract.deactivatePeriod.getData(new_period);
    await instance.submitTransaction(data, {from: accounts[1]});
    assert.equal(await instance.transactionCount(), 4, "transactionCount should be 4");
  });

  it("Confirm transaction 3", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(3, {from: accounts[2]});
    assert.equal(await instance.current_period(), 1, "current_period should be 1");
  });

  it("Submit transaction transfer (to: accounts[4], value: 4000)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    let data = contract.transfer.getData(accounts[4], 4000);
    await instance.submitTransaction(data, {from: accounts[1]});
    assert.equal(await instance.transactionCount(), 5, "transactionCount should be 5");
  });

  it("Confirm transaction 4", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(4, {from: accounts[2]});
    assert.equal(await instance.wallet_balance(), 6000, "Amount is not 6000");
    instance = await adh.deployed();
    assert.equal(await instance.balanceOf(accounts[4]), 4000, "Amount is not 4000");
  });

  it("Submit transaction addPeriod (current time + 2000 seconds, limit 5000)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    new_period = Math.round(new Date().getTime() / 1000 + 2000); //current timestamp + 1000 seconds
    let data = contract.addPeriod.getData(new_period, 5000);
    await instance.submitTransaction(data, {from: accounts[2]});
    assert.equal(await instance.transactionCount(), 6, "transactionCount should be 6");
  });

  it("Confirm transaction 5", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(5, {from: accounts[1]});
    assert.equal(await instance.periodCount(), 6, "periodCount should be 6");
    assert.equal(await instance.current_period(), 5, "current_period should be 5");
  });

  //wallet balance is now 6000, current transferred 4000, current limit is 5000
  it("Submit transaction transfer (to: accounts[5], value: 1000)", async () =>
  {
    let instance = await adh_limit.deployed();
    let contract = web3.eth.contract(instance.abi).at(instance.address);
    let data = contract.transfer.getData(accounts[5], 1000);
    await instance.submitTransaction(data, {from: accounts[2]});
    assert.equal(await instance.transactionCount(), 7, "transactionCount should be 7");
  });

  it("Confirm transaction 6", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(6, {from: accounts[1]});
    assert.equal(await instance.wallet_balance(), 5000, "Amount is not 5000");
    instance = await adh.deployed();
    assert.equal(await instance.balanceOf(accounts[5]), 1000, "Amount is not 1000");
  });

})