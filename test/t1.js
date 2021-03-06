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
  });

  it("Test wallet balance", async () =>
  {
    let instance = await adh_limit.deployed();
    assert.equal(await instance.getWalletBalance(), 10000, "Amount is not 10000");
  });


  it("Submit transaction for 100 tokens", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.submitTransaction(accounts[3], 100, {from: accounts[1]});
    assert.equal(await instance.transaction_count(), 1, "transaction_count should be 1");
  });

  it("Confirm transaction 0", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(0, {from: accounts[2]});
    assert.equal(await instance.getWalletBalance(), 9900, "Should be 9900");
    assert.equal(await instance.current_period(), 1, "Should be 1");
    assert.equal((await instance.periods(1))[1], 1000, "current_limit should be 1000");
    assert.equal((await instance.periods(1))[2], 1000, "limit should be 1000");
  });

  it ("Changing period to 3", async () =>
  {
    await console.log("Shift block timestamp for 50 seconds");
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [50], id: 0});
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});

    let instance = await adh_limit.deployed();
    await instance.updateCurrentPeriod({from: accounts[1]});
    assert.equal(await instance.current_period(), 3, "current_period should be 3");
    assert.equal((await instance.periods(3))[1], 3000, "current_limit should be 3000");
    assert.equal((await instance.periods(3))[2], 6000, "limit should be 6000");
  });

  it("Submit transaction for 3000 tokens", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.submitTransaction(accounts[3], 3000, {from: accounts[1]});
    assert.equal(await instance.transaction_count(), 2, "transaction_count should be 2");
  });

  it("Confirm transaction 1", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(1, {from: accounts[2]});
    assert.equal(await instance.getWalletBalance(), 6900, "Should be 6900");
    assert.equal(await instance.current_period(), 3, "current_period should be 3");
  });

  it("Test balance of account 3", async() =>
  {
    let instance = await adh.deployed();
    assert(await instance.balanceOf(accounts[3]), 3100, "Should be 3100");
  });

  it("Submit transaction for more 2901 tokens", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.submitTransaction(accounts[3], 2901, {from: accounts[1]});
    assert.equal(await instance.transaction_count(), 3, "transaction_count should be 3");
  });

  it("Confirm transaction 2. Should throw error.", async () =>
  {
    let instance = await adh_limit.deployed();
    try
    {
      await instance.confirmTransaction(2, {from: accounts[2]});
      assert.fail("Expected throw not received.");
    } catch(err)
    {
      assert(err.toString().search('revert') >= 0, "Expected throw revert.");
    }
  });

  it ("Changing period to 0", async () =>
  {
    await console.log("Shift block timestamp for 30 seconds");
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [30], id: 0});
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});

    let instance = await adh_limit.deployed();
    await instance.updateCurrentPeriod({from: accounts[1]});
    assert.equal(await instance.current_period(), 0, "current_period should be 0");
  });

  it("Now we can confirm transaction 2", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(2, {from: accounts[2]});
    assert.equal(await instance.getWalletBalance(), 3999, "Should be 3999");
    assert.equal(await instance.current_period(), 0, "current_period should be 0");
  });

  it("Submit transaction for zero tokens", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.submitTransaction(accounts[3], 0, {from: accounts[1]});
    assert.equal(await instance.transaction_count(), 4, "transaction_count should be 4");
  });

  it("Confirm transaction 3", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(3, {from: accounts[2]});
    assert.equal(await instance.getWalletBalance(), 3999, "Should be 3999");
    assert.equal(await instance.current_period(), 0, "current_period should be 0");
  });

  it("Submit transaction to zero address. Should throw error.", async () =>
  {
    let instance = await adh_limit.deployed();
    try
    {
      await instance.submitTransaction(0, 10, {from: accounts[1]});
      assert.fail("Expected throw not received.");
    } catch(err)
    {
      assert(err.toString().search('revert') >= 0, "Expected throw revert.");
    }
  });

})