// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // Faucet for anyone to get test tokens
    function faucet(uint256 amount) external {
        // Mint up to 1000 USDT per call (1000 * 10^6)
        require(amount <= 1000 * 10**6, "Max 1000 USDT per faucet call");
        _mint(msg.sender, amount);
    }
}
