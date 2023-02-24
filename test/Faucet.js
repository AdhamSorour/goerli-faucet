const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
	time,
	loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
  

describe("Faucet", function () {
	async function deployContractFixture() {
		const MAX_WITHDRAWAL = 1000;
		const MIN_WINDOW = 24 * 60 * 60; // 24 hours in seconds

		const factory = await ethers.getContractFactory("Faucet");
		const faucet = await factory.deploy(MAX_WITHDRAWAL, MIN_WINDOW);
		
		// Contracts are deployed using the first signer/account by default
		const [owner, otherAccount] = await ethers.getSigners();

		return { faucet, MAX_WITHDRAWAL, MIN_WINDOW, owner, otherAccount };
	}

	async function deployContractWithFundsFixture() {
		const MAX_WITHDRAWAL = 1000;
		const MIN_WINDOW = 24 * 60 * 60; // 24 hours in seconds

		const factory = await ethers.getContractFactory("Faucet");
		const faucet = await factory.deploy(MAX_WITHDRAWAL, MIN_WINDOW);

		// Contracts are deployed using the first signer/account by default
		const [owner, otherAccount] = await ethers.getSigners();

		const totalFunds = 1_000_000_000;
		await owner.sendTransaction({
			to: faucet.address,
			value: totalFunds,
			data: "0x" // data must be empty to invoke receive fallback
		});
	
		return { faucet, MAX_WITHDRAWAL, MIN_WINDOW, owner, otherAccount, totalFunds };
	}

	describe("Deployment", function() {
		it("Should set the correct state parameters", async function() {
			const { faucet, MAX_WITHDRAWAL, MIN_WINDOW } = await loadFixture(deployContractFixture);

			expect(await faucet.maxWithdrawal()).to.equal(MAX_WITHDRAWAL);
			expect(await faucet.minWindow()).to.equal(MIN_WINDOW);
		});
	});

	describe("Fallback", function() {
		it("Should deposit the funds to the contract balance", async function() {
			const { faucet, owner } = await loadFixture(deployContractFixture);
			const ONE_GWEI = 1_000_000_000;
			const tx = owner.sendTransaction({
				to: faucet.address,
				value: ONE_GWEI,
				data: "0x" // data must be empty to invoke receive fallback
			});
			await expect(tx).to.changeEtherBalances(
				[owner, faucet],
				[-ONE_GWEI, ONE_GWEI]
			);
		});
	});

	describe("Withdrawals", function() {
		describe("Validatons", function() {
			it("Should revert with right error if no funds are available", async function() {
				const { faucet, MAX_WITHDRAWAL } = await loadFixture(deployContractFixture);
				await expect(faucet.withdraw(MAX_WITHDRAWAL)).to.be.revertedWith(
					"Insufficient funds in faucet"
				);
			});

			it("Should revert if the amount requested is larger than withdrawal limit", async function() {
				const { faucet, MAX_WITHDRAWAL } = await loadFixture(deployContractWithFundsFixture);
				await expect(faucet.withdraw(MAX_WITHDRAWAL*2)).to.be.revertedWith(
					"Withdrawal limit exceeded"
				);
			});

			it("Should revert if called too soon", async function() {
				const { faucet, MAX_WITHDRAWAL } = await loadFixture(deployContractWithFundsFixture);
				await faucet.withdraw(MAX_WITHDRAWAL);
				await expect(faucet.withdraw(MAX_WITHDRAWAL)).to.be.revertedWithCustomError(
					faucet,
					"earlyWithdrawal"
				);
			});

			it("Shouldn't fail if enough time has passed", async function() {
				const { faucet, MAX_WITHDRAWAL, MIN_WINDOW } = await loadFixture(deployContractWithFundsFixture);
				await faucet.withdraw(MAX_WITHDRAWAL);

				await time.increase(MIN_WINDOW);

				await expect(faucet.withdraw(MAX_WITHDRAWAL)).to.not.be.reverted;
			});

			it("Should handle multiple addresses", async function() {
				const { faucet, otherAccount, MAX_WITHDRAWAL } = await loadFixture(deployContractWithFundsFixture);
				await faucet.withdraw(MAX_WITHDRAWAL);
				await expect(faucet.connect(otherAccount).withdraw(MAX_WITHDRAWAL)).not.to.be.reverted;
			});
		});

		describe("Transfers", function() {
			it("Should transfer the funds to the sender", async function() {
				const { faucet, owner, MAX_WITHDRAWAL } = await loadFixture(deployContractWithFundsFixture);
				await expect(faucet.withdraw(MAX_WITHDRAWAL)).to.changeEtherBalances(
					[owner, faucet],
					[MAX_WITHDRAWAL, -MAX_WITHDRAWAL]
				);
			});
		});

		describe("Cash Out", function() {
			it("Should transfer all funds to the owner", async function() {
				const { faucet, owner, totalFunds } = await loadFixture(deployContractWithFundsFixture);
				await expect(faucet.withdrawAll()).to.changeEtherBalances(
					[owner, faucet],
					[totalFunds, -totalFunds]
				);
			});

			it("Should fail if not owner", async function() {
				const { faucet, otherAccount } = await loadFixture(deployContractWithFundsFixture);
				await expect(faucet.connect(otherAccount).withdrawAll()).to.be.revertedWith(
					"Not Owner"
				);
			})
		});
	});

	describe("Setters", function() {
		it("Should set a new withdrawal limit", async function() {
			const { faucet, MAX_WITHDRAWAL } = await loadFixture(deployContractFixture);
			expect(await faucet.maxWithdrawal()).to.equal(MAX_WITHDRAWAL);

			await faucet.setMaxWithdrawal(2*MAX_WITHDRAWAL);
			expect(await faucet.maxWithdrawal()).to.equal(2*MAX_WITHDRAWAL);
		});

		it("Should set a new time window", async function() {
			const { faucet, MIN_WINDOW } = await loadFixture(deployContractFixture);
			expect(await faucet.minWindow()).to.equal(MIN_WINDOW);

			await faucet.setMinWindow(2*MIN_WINDOW);
			expect(await faucet.minWindow()).to.equal(2*MIN_WINDOW);
		});

		it("Should fail to change limit if not owner", async function() {
			const { faucet, otherAccount, MAX_WITHDRAWAL } = await loadFixture(deployContractFixture);
			await expect(faucet.connect(otherAccount).setMaxWithdrawal(MAX_WITHDRAWAL*2))
			.to.be.revertedWith("Not Owner");
		});

		it("Should fail to change window if not owner", async function() {
			const { faucet, otherAccount, MIN_WINDOW } = await loadFixture(deployContractFixture);
			await expect(faucet.connect(otherAccount).setMinWindow(MIN_WINDOW*2))
			.to.be.revertedWith("Not Owner");
		});
	});

	describe("Destruct", function() {
		it("Should send funds back to owner", async function() {
			const { faucet, owner, totalFunds } = await loadFixture(deployContractWithFundsFixture);
			await expect(faucet.destroy()).to.changeEtherBalances(
				[owner, faucet],
				[totalFunds, -totalFunds]
			);
		});

		it("Should delete the byte code", async function() {
			const { faucet } = await loadFixture(deployContractFixture);
			expect(await ethers.provider.getCode(faucet.address)).to.not.be.equal("0x");
			await faucet.destroy();
			expect(await ethers.provider.getCode(faucet.address)).to.equal("0x");
		});
	});
});