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
  });

  it ("Changing period to 3", async () =>
  {
    await console.log("Pause for 4.5 seconds");
    sleep(4500);
    let instance = await adh_limit.deployed();
    await instance.updateCurrentPeriod({from: accounts[1]});
    assert.equal(await instance.current_period(), 3, "current_period should be 3");
    assert.equal((await instance.periods(3))[1], 3000, "limit should be 3000");
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

  it("Submit transaction for more tokens", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.submitTransaction(accounts[3], 1000, {from: accounts[1]});
    assert.equal(await instance.transaction_count(), 3, "transaction_count should be 3");
  });

  it("Confirm transaction 2", async () =>
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
    await console.log("Pause for 3 seconds");
    sleep(3000);
    let instance = await adh_limit.deployed();
    await instance.updateCurrentPeriod({from: accounts[1]});
    assert.equal(await instance.current_period(), 0, "current_period should be 0");
  });

  it("Now we can confirm transaction 2", async () =>
  {
    let instance = await adh_limit.deployed();
    await instance.confirmTransaction(2, {from: accounts[2]});
    assert.equal(await instance.getWalletBalance(), 5900, "Should be 5900");
    assert.equal(await instance.current_period(), 0, "current_period should be 0");
  });

})