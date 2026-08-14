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
    const currentMatchId = await flagClash.currentMatchId();
    await flagClash.connect(user1).backTeam(currentMatchId, 0, amount); // Back India

    const matchState = await flagClash.getMatchState(currentMatchId);
    expect(matchState.sIndia).to.equal(50); // 5 USDT / 0.1 USDT per point = 50
    expect(matchState.poolIndia).to.equal(amount);
  });

  it("Should declare winner and allow claiming", async function () {
    const user1Amount = ethers.parseUnits("5", 6);
    const user2Amount = ethers.parseUnits("10", 6);
    const currentMatchId = await flagClash.currentMatchId();

    await flagClash.connect(user1).backTeam(currentMatchId, 0, user1Amount); // User 1 backs India with 5
    await flagClash.connect(user2).backTeam(currentMatchId, 1, user2Amount); // User 2 backs SL with 10

    // Owner declares India as winner
    await expect(flagClash.declareWinner(currentMatchId, 0))
      .to.emit(flagClash, "WinnerDeclared")
      .withArgs(currentMatchId, 0, ethers.parseUnits("15", 6), ethers.parseUnits("14.25", 6)); // 15 total, 14.25 net (95%)

    // User 1 claims prize
    const balanceBefore = await usdt.balanceOf(user1.address);
    await expect(flagClash.connect(user1).claimPrize(currentMatchId))
      .to.emit(flagClash, "PrizeClaimed")
      .withArgs(currentMatchId, user1.address, ethers.parseUnits("14.25", 6)); // Gets entire net pool as sole backer

    const balanceAfter = await usdt.balanceOf(user1.address);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("14.25", 6));

    // User 2 cannot claim
    await expect(flagClash.connect(user2).claimPrize(currentMatchId)).to.be.revertedWith("No winning backing");
  });

  it("Should support pausing and unpausing", async function () {
    await flagClash.pause();
    const amount = ethers.parseUnits("5", 6);
    const currentMatchId = await flagClash.currentMatchId();
    await expect(flagClash.connect(user1).backTeam(currentMatchId, 0, amount)).to.be.revertedWithCustomError(flagClash, "EnforcedPause");

    await flagClash.unpause();
    await expect(flagClash.connect(user1).backTeam(currentMatchId, 0, amount)).to.emit(flagClash, "TeamBacked");
  });

  it("Should support consecutive matches", async function () {
    const amount = ethers.parseUnits("5", 6);
    let matchId = await flagClash.currentMatchId();
    await flagClash.connect(user1).backTeam(matchId, 0, amount);
    await flagClash.declareWinner(matchId, 0);
    await flagClash.startNewMatch();

    let newMatchId = await flagClash.currentMatchId();
    expect(newMatchId).to.equal(2n);
    await flagClash.connect(user2).backTeam(newMatchId, 1, amount);
    let matchState = await flagClash.getMatchState(newMatchId);
    expect(matchState.sSL).to.equal(50);
  });
});
