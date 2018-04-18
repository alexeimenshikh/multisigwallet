pragma solidity ^0.4.21;

/// @title Multisignature wallet - Allows multiple parties to agree on transactions before execution.
/// @author Based on code by Stefan George - <stefan.george@consensys.net>

contract Receiver {
    function tokenFallback(address from, uint value, bytes data) public;
}

/*
 * ERC20 interface
 * see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 {
  uint public totalSupply;
  function balanceOf(address who) public constant returns (uint);
  function allowance(address owner, address spender) public constant returns (uint);

  function transfer(address to, uint value) public returns (bool ok);
  function transferFrom(address from, address to, uint value) public returns (bool ok);
  function approve(address spender, uint value) public returns (bool ok);
  event Transfer(address indexed from, address indexed to, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);
}

contract MultiSigWallet {

    /*
     *  Events
     */

    event Confirmation(address indexed sender, uint indexed transactionId);
    event Revocation(address indexed sender, uint indexed transactionId);
    event Submission(uint indexed transactionId);
    event Execution(uint indexed transactionId);
    event ExecutionFailure(uint indexed transactionId);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint required);

    /*
     *  Constants
     */
    uint constant public MAX_OWNER_COUNT = 50;

    /*
     *  Storage
     */

    mapping (uint => Transaction) public transactions;
    mapping (uint => mapping (address => bool)) public confirmations;
    mapping (address => bool) public isOwner;
    address[] public owners;
    uint public required;
    uint public transactionCount;

    struct Transaction {
        bytes data;
        bool executed;
    }

    /*
     *  Modifiers
     */
    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(!isOwner[owner]);
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner]);
        _;
    }

    modifier transactionExists(uint transactionId) {
        require(transactions[transactionId].data.length > 0);
        _;
    }

    modifier confirmed(uint transactionId, address owner) {
        require(confirmations[transactionId][owner]);
        _;
    }

    modifier notConfirmed(uint transactionId, address owner) {
        require(!confirmations[transactionId][owner]);
        _;
    }

    modifier notExecuted(uint transactionId) {
        require(!transactions[transactionId].executed);
        _;
    }

    modifier notNull(address _address) {
        require(_address != 0);
        _;
    }

    modifier validRequirement(uint ownerCount, uint _required) {
        require(ownerCount <= MAX_OWNER_COUNT
            && _required <= ownerCount
            && _required != 0
            && ownerCount != 0);
        _;
    }

    /// @dev Fallback function: don't accept ETH
    function()
      public
      payable
    {
      revert();
    }

    /*
     * Public functions
     */
    /// @dev Contract constructor sets initial owners and required number of confirmations
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    function MultiSigWallet(address[] _owners, uint _required)
        public
        validRequirement(_owners.length, _required)
    {
        for (uint i=0; i<_owners.length; i++) {
            require(!isOwner[_owners[i]] && _owners[i] != 0);
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        required = _required;
    }

    /// @dev Allows to add a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of new owner.
    function addOwner(address owner)
        public
        onlyWallet
        ownerDoesNotExist(owner)
        notNull(owner)
        validRequirement(owners.length + 1, required)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /// @dev Allows to remove an owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner.
    function removeOwner(address owner)
        public
        onlyWallet
        ownerExists(owner)
    {
        isOwner[owner] = false;
        for (uint i=0; i<owners.length - 1; i++)
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        owners.length -= 1;
        if (required > owners.length)
            changeRequirement(owners.length);
        emit OwnerRemoval(owner);
    }

    /// @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
    /// @param owner Address of owner to be replaced.
    /// @param newOwner Address of new owner.
    function replaceOwner(address owner, address newOwner)
        public
        onlyWallet
        ownerExists(owner)
        ownerDoesNotExist(newOwner)
    {
        for (uint i=0; i<owners.length; i++)
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        isOwner[owner] = false;
        isOwner[newOwner] = true;
        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
    /// @param _required Number of required confirmations.
    function changeRequirement(uint _required)
        public
        onlyWallet
        validRequirement(owners.length, _required)
    {
        required = _required;
        emit RequirementChange(_required);
    }

    /// @dev Allows an owner to submit and confirm a transaction.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function submitTransaction(bytes data)
        public
        returns (uint transactionId)
    {
        transactionId = addTransaction(data);
        confirmTransaction(transactionId);
    }

    /// @dev Allows an owner to confirm a transaction.
    /// @param transactionId Transaction ID.
    function confirmTransaction(uint transactionId)
        public
        ownerExists(msg.sender)
        transactionExists(transactionId)
        notConfirmed(transactionId, msg.sender)
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
        executeTransaction(transactionId);
    }

    /// @dev Allows an owner to revoke a confirmation for a transaction.
    /// @param transactionId Transaction ID.
    function revokeConfirmation(uint transactionId)
        public
        ownerExists(msg.sender)
        confirmed(transactionId, msg.sender)
        notExecuted(transactionId)
    {
        confirmations[transactionId][msg.sender] = false;
        emit Revocation(msg.sender, transactionId);
    }

    function executeTransaction(uint transactionId)
        public
        ownerExists(msg.sender)
        confirmed(transactionId, msg.sender)
        notExecuted(transactionId)
    {
        if (isConfirmed(transactionId)) {
            Transaction storage txn = transactions[transactionId];
            txn.executed = true;
            if (address(this).call(txn.data))
                emit Execution(transactionId);
            else {
                emit ExecutionFailure(transactionId);
                txn.executed = false;
            }
        }
    }

    /// @dev Returns the confirmation status of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Confirmation status.
    function isConfirmed(uint transactionId)
        public
        constant
        returns (bool)
    {
        uint count = 0;
        for (uint i=0; i<owners.length; i++) {
            if (confirmations[transactionId][owners[i]])
                count += 1;
            if (count == required)
                return true;
        }
    }

    /*
     * Internal functions
     */
    /// @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
    /// @param data Transaction data payload.
    /// @return Returns transaction ID.
    function addTransaction(bytes data)
        internal
        returns (uint transactionId)
    {
        transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            data: data,
            executed: false
        });
        transactionCount += 1;
        emit Submission(transactionId);
    }

    /*
     * Web3 call functions
     */
    /// @dev Returns number of confirmations of a transaction.
    /// @param transactionId Transaction ID.
    /// @return Number of confirmations.
    function getConfirmationCount(uint transactionId)
        public
        constant
        returns (uint count)
    {
        for (uint i=0; i<owners.length; i++)
            if (confirmations[transactionId][owners[i]])
                count += 1;
    }

    /// @dev Returns total number of transactions after filers are applied.
    /// @param pending Include pending transactions.
    /// @param executed Include executed transactions.
    /// @return Total number of transactions after filters are applied.
    function getTransactionCount(bool pending, bool executed)
        public
        constant
        returns (uint count)
    {
        for (uint i=0; i<transactionCount; i++)
            if (   pending && !transactions[i].executed
                || executed && transactions[i].executed)
                count += 1;
    }

    /// @dev Returns list of owners.
    /// @return List of owner addresses.
    function getOwners()
        public
        constant
        returns (address[])
    {
        return owners;
    }

    /// @dev Returns array with owner addresses, which confirmed transaction.
    /// @param transactionId Transaction ID.
    /// @return Returns array of owner addresses.
    function getConfirmations(uint transactionId)
        public
        constant
        returns (address[] _confirmations)
    {
        address[] memory confirmationsTemp = new address[](owners.length);
        uint count = 0;
        uint i;
        for (i=0; i<owners.length; i++)
            if (confirmations[transactionId][owners[i]]) {
                confirmationsTemp[count] = owners[i];
                count += 1;
            }
        _confirmations = new address[](count);
        for (i=0; i<count; i++)
            _confirmations[i] = confirmationsTemp[i];
    }

    /// @dev Returns list of transaction IDs in defined range.
    /// @param from Index start position of transaction array.
    /// @param to Index end position of transaction array.
    /// @param pending Include pending transactions.
    /// @param executed Include executed transactions.
    /// @return Returns array of transaction IDs.
    function getTransactionIds(uint from, uint to, bool pending, bool executed)
        public
        constant
        returns (uint[] _transactionIds)
    {
        uint[] memory transactionIdsTemp = new uint[](transactionCount);
        uint count = 0;
        uint i;
        for (i=0; i<transactionCount; i++)
            if (   pending && !transactions[i].executed
                || executed && transactions[i].executed)
            {
                transactionIdsTemp[count] = i;
                count += 1;
            }
        _transactionIds = new uint[](to - from);
        for (i=from; i<to; i++)
            _transactionIds[i - from] = transactionIdsTemp[i];
    }
}

contract MultiSigWalletToken is Receiver, MultiSigWallet 
{
  //Events
  event TokensReceived(address indexed from, uint value);

  //Storage
  uint public wallet_balance;  //balance of the wallet
  address public tokens_address;  //address of the ERC20 tokens contract

  /// @dev Fallback function which is called by tokens contract after transferring tokens to this wallet.
  /// @param from Source address of the transfer.
  /// @param value Amount of received ERC20 tokens.
  function tokenFallback(address from, uint value, bytes)
    public
  {
    require(msg.sender == tokens_address);
    wallet_balance += value;
    emit TokensReceived(from, value);
  }

  /// @dev Contract constructor sets initial owners, required number of confirmations and tokens_address.
  /// @param _owners List of initial owners.
  /// @param _required Number of required confirmations.
  function MultiSigWalletToken(address[] _owners, uint _required, address _tokens_address)
    public MultiSigWallet(_owners, _required)
  {
    tokens_address = _tokens_address;
  }

  /// @dev Transfers ERC20 tokens from wallet. Transaction has to be sent by wallet.
  /// @param to Address to transfer tokens.
  /// @param value Amount of ERC20 tokens to transfer.
  function transfer(address to, uint value) 
    public
    onlyWallet
  {
    if (ERC20(tokens_address).transfer(to, value)) 
      wallet_balance -= value;
  }

}

contract MultiSigWalletTokenLimit is MultiSigWalletToken
{
  //Events
  event Transfer(address indexed to, uint indexed value);
  event CurrentPeriodChanged(uint indexed current_period, uint indexed current_transferred, uint indexed current_limit);
  event AddPeriod(uint indexed timestamp, uint indexed limit);
  event DeactivatePeriod(uint indexed timestamp);

  //Modifiers
  modifier inFuture(uint t)
  {
    require (t > now);
    _;
  }

  modifier ownerOrWallet(address owner)
  {
    require (msg.sender == address(this) || isOwner[owner]);
    _;
  }

  //Storage
  struct Period
  {
    uint timestamp;
    uint limit;
    bool active;
  }
  mapping (uint => Period) public periods;
  uint public periodCount;
  uint public current_period;
  uint public current_transferred;  //amount of transferred tokens in the current period

  /// @dev Contract constructor sets initial owners, required number of confirmations, initial periods' parameters and token address.
  /// @param _owners List of initial owners.
  /// @param _required Number of required confirmations.
  /// @param _timestamps Timestamps of initial periods.
  /// @param _limits Limits of initial periods. The length of _limits must be the same as _timestamps.
  /// @param _tokens_address Address of the ERC20 tokens contract.
  function MultiSigWalletTokenLimit(address[] _owners, uint _required, uint[] _timestamps, uint[] _limits, address _tokens_address)
    public MultiSigWalletToken(_owners, _required, _tokens_address)
  {
    periods[0].timestamp = 2**256 - 1;
    periods[0].limit = 2**256 - 1;
    periods[0].active = true;
    for (uint i = 0; i < _timestamps.length; i++)
    {
      periods[i + 1].timestamp = _timestamps[i];
      periods[i + 1].limit = _limits[i];
      periods[i + 1].active = true;
    }
    periodCount = 1 + _timestamps.length;
    current_period = 0;
    if (_timestamps.length > 0)
      current_period = 1;
    current_transferred = 0;
  }

  /// @dev Updates current perriod: looking for a period with a minimmum date(timestamp) that is greater than now.
  function updateCurrentPeriod()
    public
    ownerOrWallet(msg.sender)
  {
    uint new_period = 0;
    for (uint i = 1; i < periodCount; i++)
      if (periods[i].active && periods[i].timestamp > now && periods[i].timestamp < periods[new_period].timestamp)
        new_period = i;
    if (new_period != current_period)
    {
      if (now > periods[current_period].timestamp)
        current_transferred = 0;
      current_period = new_period;
      emit CurrentPeriodChanged(current_period, current_transferred, periods[current_period].limit);
    }
  }
  
  /// @dev Adds new period. Transaction has to be sent by wallet.
  /// @param timestamp Till the date period acts.
  /// @param limit Max amount of tokens which can be transferred.
  function addPeriod(uint timestamp, uint limit)
    public
    onlyWallet
    inFuture(timestamp)
  {
    bool is_set = false;
    for (uint i = 1; i < periodCount; i++)
      if (periods[i].timestamp == timestamp)
      {
        periods[i].limit = limit;
        periods[i].active = true;
        is_set = true;
        break;
      }
    if (!is_set)
    {
      periods[periodCount].timestamp = timestamp;
      periods[periodCount].limit = limit;
      periods[periodCount].active = true;
      ++periodCount;
    }
    emit AddPeriod(timestamp, limit);
    updateCurrentPeriod();
  }

  /// @dev Deactivates existing period.
  /// @param timestamp Till the date period acts.
  function deactivatePeriod(uint timestamp)
    public
    onlyWallet
    inFuture(timestamp)
  {
    for (uint i = 1; i < periodCount; i++)
      if (periods[i].timestamp == timestamp)
      {
        periods[i].active = false;
        emit DeactivatePeriod(timestamp);
        updateCurrentPeriod();
        return;
      }
  }

  /// @dev Transfers ERC20 tokens from th wallet to a given address
  /// @param to Address to transfer.
  /// @param value Amount of tokens to transfer.
  function transfer(address to, uint value) 
    public
    onlyWallet
  {
    updateCurrentPeriod();
    require(value <= wallet_balance && current_transferred + value <= periods[current_period].limit);

    if (ERC20(tokens_address).transfer(to, value)) 
    {
      wallet_balance -= value;
      current_transferred += value;
      emit Transfer(to, value);
    }
  }

}
