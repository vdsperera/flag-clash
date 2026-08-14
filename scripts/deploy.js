import hre from "hardhat";

async function main() {
  console.log("Deploying MockUSDT...");
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`MockUSDT deployed to: ${usdtAddress}`);

  console.log("Deploying FlagClash...");
  const FlagClash = await hre.ethers.getContractFactory("FlagClash");
  const flagClash = await FlagClash.deploy(usdtAddress);
  await flagClash.waitForDeployment();
  const flagClashAddress = await flagClash.getAddress();
  console.log(`FlagClash deployed to: ${flagClashAddress}`);

  console.log("\nDeployment successful! Update these addresses in flag-clash.html:");
  console.log(`const USDT_ADDRESS = "${usdtAddress}";`);
  console.log(`const FLAG_CLASH_ADDRESS = "${flagClashAddress}";`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
