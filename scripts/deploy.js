require('dotenv').config();
const { maxWithdrawal, minWindow } = require('../faucet.json');

async function main() {
  const factory = await ethers.getContractFactory("Faucet");
  const faucet = await factory.deploy(maxWithdrawal, minWindow);
  await faucet.deployed();

  console.log("Faucet deployed at address:", faucet.address);
  console.log(`Withdrawal limit: ${maxWithdrawal} wei`);
  console.log(`Time limit: ${minWindow} seconds`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
