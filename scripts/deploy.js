const ethers = require('ethers');
require('dotenv').config();

async function main() {
  const factory = await ethers.getContractFactory("Faucet");
  const faucet = await factory.deploy();
  await faucet.deployed();
  console.log("Faucet address:", faucet.address);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
