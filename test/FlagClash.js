import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("FlagClash", function () {
  let usdt, flagClash, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy();

    const FlagClash = await ethers.getContractFactory("FlagClash");
    flagClash = await FlagClash.deploy(await usdt.getAddress());

    // Give users some test USDT
    await usdt.connect(user1).faucet(ethers.parseUnits("100", 6));
    await usdt.connect(user2).faucet(ethers.parseUnits("100", 6));

    // Approve FlagClash to spend USDT
    await usdt.connect(user1).approve(await flagClash.getAddress(), ethers.parseUnits("1000", 6));
    await usdt.connect(user2).approve(await flagClash.getAddress(), ethers.parseUnits("1000", 6));
  });

  it("Should allow backing a team", async function () {
    const amount = ethers.parseUnits("5", 6); // 5 USDT
    await flagClash.connect(user1).backTeam(0, amount); // Back India

    expect(await flagClash.scoreIndia()).to.equal(50); // 5 USDT / 0.1 USDT per point = 50
    expect(await flagClash.totalPoolIndia()).to.equal(amount);
  });

  it("Should declare winner and allow claiming", async function () {
    const user1Amount = ethers.parseUnits("5", 6);
    const user2Amount = ethers.parseUnits("10", 6);

    await flagClash.connect(user1).backTeam(0, user1Amount); // User 1 backs India with 5
    await flagClash.connect(user2).backTeam(1, user2Amount); // User 2 backs SL with 10

    // Owner declares India as winner
    await expect(flagClash.declareWinner(0))
      .to.emit(flagClash, "WinnerDeclared")
      .withArgs(0, ethers.parseUnits("15", 6), ethers.parseUnits("14.25", 6)); // 15 total, 14.25 net (95%)

    // User 1 claims prize
    const balanceBefore = await usdt.balanceOf(user1.address);
    await expect(flagClash.connect(user1).claimPrize())
      .to.emit(flagClash, "PrizeClaimed")
      .withArgs(user1.address, ethers.parseUnits("14.25", 6)); // Gets entire net pool as sole backer

    const balanceAfter = await usdt.balanceOf(user1.address);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("14.25", 6));

    // User 2 cannot claim
    await expect(flagClash.connect(user2).claimPrize()).to.be.revertedWith("No winning backing");
  });
});
