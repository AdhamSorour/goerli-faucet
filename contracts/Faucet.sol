//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;

contract Faucet {
  mapping (address => uint) private lastWithdrawal;
  uint public maxWithdrawal; // max withdrawal amount per transaction (in wei)
  uint public minWindow;     // min time between withdrawals for a given address (in seconds)
  address private owner;

  constructor(uint _maxWithdrawal, uint _minWindow) {
    maxWithdrawal = _maxWithdrawal;
    minWindow = _minWindow;
    owner = msg.sender;
  }
  
  error earlyWithdrawal(uint timeRemianing);

  // Follow the Checks-Effects-Interactions pattern to protect against reentrancy attacks
  function withdraw(uint amount) external {
    // Checks //
    uint timeSinceLastWithdrawal = block.timestamp - lastWithdrawal[msg.sender];
    if (timeSinceLastWithdrawal < minWindow) {
      revert earlyWithdrawal(300 - timeSinceLastWithdrawal);
    }

    require(amount <= maxWithdrawal, "Withdrawal limit exceeded");

    // contract must have sufficient funds
    require(address(this).balance > amount, "Insufficient funds in faucet");

    // Effects //
    lastWithdrawal[msg.sender] = block.timestamp; 

    // Interactions //
    (bool s, ) = msg.sender.call{ value: amount }("");
    require(s);
  }

  // fallback function
  receive() external payable {}

  modifier onlyOwner() {
    require(msg.sender == owner, "Not Owner");
    _;
  }

  function setMaxWithdrawal(uint newLimit) external onlyOwner {
    maxWithdrawal = newLimit;
  }

  function setMinWindow(uint newWindow) external onlyOwner {
    minWindow = newWindow;
  }
}