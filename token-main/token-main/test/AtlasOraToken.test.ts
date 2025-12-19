import { expect } from "chai";
import { ethers } from "hardhat";
import { AtlasOraToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("AtlasOraToken", function () {
  // Test configuration
  const TOKEN_NAME = "AtlasOra Token";
  const TOKEN_SYMBOL = "AOT";
  const DECIMALS = 18;
  const MAX_SUPPLY = ethers.parseUnits("200000000", DECIMALS); // 200M tokens
  const INITIAL_SUPPLY = ethers.parseUnits("30000000", DECIMALS); // 30M (15%)
  const REGULAR_EMISSION = ethers.parseUnits("20000000", DECIMALS); // 20M (10%)
  const FINAL_EMISSION = ethers.parseUnits("10000000", DECIMALS); // 10M (5%)
  const EMISSION_INTERVAL = 180 * 24 * 60 * 60; // 180 days in seconds

  async function deployTokenFixture() {
    const [owner, foundation, addr1, addr2] = await ethers.getSigners();

    const AtlasOraToken = await ethers.getContractFactory("AtlasOraToken");
    const token = await AtlasOraToken.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      owner.address,
      foundation.address
    );

    const deploymentTime = await time.latest();

    return { token, owner, foundation, addr1, addr2, deploymentTime };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.decimals()).to.equal(DECIMALS);
    });

    it("Should set the correct maximum supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("Should assign the initial supply (15%) to the owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the correct owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should set the correct foundation address", async function () {
      const { token, foundation } = await loadFixture(deployTokenFixture);

      expect(await token.foundationAddress()).to.equal(foundation.address);
    });

    it("Should initialize with cycle 0", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.currentCycle()).to.equal(0);
    });

    it("Should set totalMinted to initial supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.totalMinted()).to.equal(INITIAL_SUPPLY);
    });

    it("Should revert with zero address as owner", async function () {
      const [, foundation] = await ethers.getSigners();
      const AtlasOraToken = await ethers.getContractFactory("AtlasOraToken");

      await expect(
        AtlasOraToken.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          ethers.ZeroAddress,
          foundation.address
        )
      ).to.be.revertedWithCustomError(
        { interface: (await ethers.getContractFactory("AtlasOraToken")).interface },
        "OwnableInvalidOwner"
      );
    });

    it("Should revert with zero address as foundation", async function () {
      const [owner] = await ethers.getSigners();
      const AtlasOraToken = await ethers.getContractFactory("AtlasOraToken");

      await expect(
        AtlasOraToken.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          owner.address,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid foundation address");
    });

    it("Should emit EmissionMinted event on deployment", async function () {
      const [owner, foundation] = await ethers.getSigners();
      const AtlasOraToken = await ethers.getContractFactory("AtlasOraToken");

      const token = await AtlasOraToken.deploy(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        owner.address,
        foundation.address
      );

      const filter = token.filters.EmissionMinted();
      const events = await token.queryFilter(filter);

      expect(events.length).to.equal(1);
      expect(events[0].args.cycle).to.equal(0);
      expect(events[0].args.to).to.equal(owner.address);
      expect(events[0].args.amount).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("ERC20 Functionality", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );

      const transferAmount = ethers.parseUnits("50", DECIMALS);

      await expect(
        token.transfer(addr1.address, transferAmount)
      ).to.changeTokenBalances(token, [owner, addr1], [-transferAmount, transferAmount]);

      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.changeTokenBalances(
        token,
        [addr1, addr2],
        [-transferAmount, transferAmount]
      );
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should approve and transferFrom tokens", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );

      const approveAmount = ethers.parseUnits("100", DECIMALS);
      const transferAmount = ethers.parseUnits("50", DECIMALS);

      await token.approve(addr1.address, approveAmount);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount
      );

      await expect(
        token
          .connect(addr1)
          .transferFrom(owner.address, addr2.address, transferAmount)
      ).to.changeTokenBalances(
        token,
        [owner, addr2],
        [-transferAmount, transferAmount]
      );

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount - transferAmount
      );
    });
  });

  describe("Burning", function () {
    it("Should allow token holders to burn their tokens", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const burnAmount = ethers.parseUnits("1000", DECIMALS);
      const initialSupply = await token.totalSupply();
      const initialTotalMinted = await token.totalMinted();

      await expect(token.burn(burnAmount)).to.changeTokenBalance(
        token,
        owner,
        -burnAmount
      );

      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      // totalMinted should not change after burning
      expect(await token.totalMinted()).to.equal(initialTotalMinted);
    });

    it("Should not affect emission schedule when tokens are burned", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const burnAmount = ethers.parseUnits("10000000", DECIMALS); // 10M tokens
      await token.burn(burnAmount);

      // Remaining mintable should still be based on emission schedule, not total supply
      const remainingMintable = await token.remainingMintableSupply();
      expect(remainingMintable).to.equal(MAX_SUPPLY - INITIAL_SUPPLY);
    });

    it("Should allow burning from approved allowance", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const approveAmount = ethers.parseUnits("100", DECIMALS);
      const burnAmount = ethers.parseUnits("50", DECIMALS);

      await token.approve(addr1.address, approveAmount);

      const initialSupply = await token.totalSupply();
      await token.connect(addr1).burnFrom(owner.address, burnAmount);

      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approveAmount - burnAmount
      );
    });
  });

  describe("Emission Schedule - Time-Based Minting", function () {
    it("Should not allow minting before first cycle", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      await expect(token.mint()).to.be.revertedWith(
        "Next emission not yet available"
      );
    });

    it("Should allow minting after 6 months (cycle 1)", async function () {
      const { token, foundation } = await loadFixture(deployTokenFixture);

      await time.increase(EMISSION_INTERVAL);

      const tx = await token.mint();
      const receipt = await tx.wait();

      expect(await token.currentCycle()).to.equal(1);
      expect(await token.balanceOf(foundation.address)).to.equal(REGULAR_EMISSION);
      expect(await token.totalMinted()).to.equal(INITIAL_SUPPLY + REGULAR_EMISSION);
    });

    it("Should not allow minting twice in same cycle", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      await time.increase(EMISSION_INTERVAL);
      await token.mint();

      await expect(token.mint()).to.be.revertedWith(
        "Next emission not yet available"
      );
    });

    it("Should allow minting cycles 1-8 (10% each)", async function () {
      const { token, foundation } = await loadFixture(deployTokenFixture);

      for (let cycle = 1; cycle <= 8; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();

        expect(await token.currentCycle()).to.equal(cycle);
        expect(await token.balanceOf(foundation.address)).to.equal(
          REGULAR_EMISSION * BigInt(cycle)
        );
      }

      const expectedTotalMinted = INITIAL_SUPPLY + (REGULAR_EMISSION * 8n);
      expect(await token.totalMinted()).to.equal(expectedTotalMinted);
    });

    it("Should allow final emission in cycle 9 (5%)", async function () {
      const { token, foundation } = await loadFixture(deployTokenFixture);

      // Mint cycles 1-8
      for (let cycle = 1; cycle <= 8; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      // Fast forward to cycle 9
      await time.increase(EMISSION_INTERVAL);

      // Mint final cycle (9)
      await token.mint();

      expect(await token.currentCycle()).to.equal(9);
      expect(await token.totalMinted()).to.equal(MAX_SUPPLY);
      expect(await token.balanceOf(foundation.address)).to.equal(
        REGULAR_EMISSION * 8n + FINAL_EMISSION
      );
    });

    it("Should not allow minting after all cycles complete", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      // Complete all cycles
      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      await expect(token.mint()).to.be.revertedWith("All emissions completed");
    });

    it("Should require multiple calls to catch up on skipped cycles", async function () {
      const { token, foundation } = await loadFixture(deployTokenFixture);

      // Skip to cycle 3 (18 months)
      await time.increase(EMISSION_INTERVAL * 3);

      // Must call mint() 3 times to catch up cycles 1, 2, and 3
      await token.mint(); // Cycle 1
      expect(await token.currentCycle()).to.equal(1);
      expect(await token.balanceOf(foundation.address)).to.equal(REGULAR_EMISSION);

      await token.mint(); // Cycle 2
      expect(await token.currentCycle()).to.equal(2);
      expect(await token.balanceOf(foundation.address)).to.equal(REGULAR_EMISSION * 2n);

      await token.mint(); // Cycle 3
      expect(await token.currentCycle()).to.equal(3);
      expect(await token.balanceOf(foundation.address)).to.equal(REGULAR_EMISSION * 3n);

      // Can't mint cycle 4 yet - need to wait for more time
      await expect(token.mint()).to.be.revertedWith(
        "Next emission not yet available"
      );
    });

    it("Should not allow minting to exceed max supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      // Complete all 9 cycles
      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      expect(await token.totalMinted()).to.equal(MAX_SUPPLY);
      await expect(token.mint()).to.be.revertedWith("All emissions completed");
    });
  });

  describe("Emission Schedule - View Functions", function () {
    it("Should return correct next emission timestamp", async function () {
      const { token, deploymentTime } = await loadFixture(deployTokenFixture);

      const nextTimestamp = await token.nextEmissionTimestamp();
      expect(nextTimestamp).to.equal(deploymentTime + EMISSION_INTERVAL);
    });

    it("Should return 0 for next emission timestamp after all cycles", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      expect(await token.nextEmissionTimestamp()).to.equal(0);
    });

    it("Should return correct next emission amount", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      // Cycle 1-8 should be 10%
      expect(await token.nextEmissionAmount()).to.equal(REGULAR_EMISSION);

      // Fast forward through cycles 1-8
      for (let cycle = 1; cycle <= 8; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      // Cycle 9 should be 5%
      expect(await token.nextEmissionAmount()).to.equal(FINAL_EMISSION);
    });

    it("Should return 0 for next emission amount after all cycles", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      expect(await token.nextEmissionAmount()).to.equal(0);
    });

    it("Should return correct remaining mintable supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.remainingMintableSupply()).to.equal(
        MAX_SUPPLY - INITIAL_SUPPLY
      );

      await time.increase(EMISSION_INTERVAL);
      await token.mint();

      expect(await token.remainingMintableSupply()).to.equal(
        MAX_SUPPLY - INITIAL_SUPPLY - REGULAR_EMISSION
      );
    });

    it("Should correctly report if emission is available", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.isEmissionAvailable()).to.be.false;

      await time.increase(EMISSION_INTERVAL);

      expect(await token.isEmissionAvailable()).to.be.true;

      await token.mint();

      expect(await token.isEmissionAvailable()).to.be.false;
    });

    it("Should return detailed emission info", async function () {
      const { token, deploymentTime } = await loadFixture(deployTokenFixture);

      const info = await token.getEmissionInfo();

      expect(info.cycle).to.equal(0);
      expect(info.totalMinted_).to.equal(INITIAL_SUPPLY);
      expect(info.totalSupply_).to.equal(INITIAL_SUPPLY);
      expect(info.remainingEmissions).to.equal(MAX_SUPPLY - INITIAL_SUPPLY);
      expect(info.nextTimestamp).to.equal(deploymentTime + EMISSION_INTERVAL);
      expect(info.nextAmount).to.equal(REGULAR_EMISSION);
    });

    it("Should return correct emission info after burning", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const burnAmount = ethers.parseUnits("5000000", DECIMALS);
      await token.burn(burnAmount);

      const info = await token.getEmissionInfo();

      expect(info.totalMinted_).to.equal(INITIAL_SUPPLY);
      expect(info.totalSupply_).to.equal(INITIAL_SUPPLY - burnAmount);
      expect(info.remainingEmissions).to.equal(MAX_SUPPLY - INITIAL_SUPPLY);
    });
  });

  describe("Ownership", function () {
    it("Should only allow owner to mint emissions", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);

      await time.increase(EMISSION_INTERVAL);

      await expect(
        token.connect(addr1).mint()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to transfer ownership", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.transferOwnership(addr1.address))
        .to.emit(token, "OwnershipTransferred")
        .withArgs(owner.address, addr1.address);

      expect(await token.owner()).to.equal(addr1.address);
    });

    it("Should allow new owner to mint after ownership transfer", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);

      await token.transferOwnership(addr1.address);
      await time.increase(EMISSION_INTERVAL);

      await expect(token.connect(addr1).mint()).to.not.be.reverted;
    });

    it("Should allow owner to renounce ownership", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      await expect(token.renounceOwnership())
        .to.emit(token, "OwnershipTransferred")
        .withArgs(owner.address, ethers.ZeroAddress);

      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle burning and minting correctly", async function () {
      const { token, owner, foundation } = await loadFixture(deployTokenFixture);

      // Burn 10M tokens from initial supply
      const burnAmount = ethers.parseUnits("10000000", DECIMALS);
      await token.burn(burnAmount);

      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
      expect(await token.totalMinted()).to.equal(INITIAL_SUPPLY);

      // Mint next emission
      await time.increase(EMISSION_INTERVAL);
      await token.mint();

      expect(await token.totalSupply()).to.equal(
        INITIAL_SUPPLY - burnAmount + REGULAR_EMISSION
      );
      expect(await token.totalMinted()).to.equal(INITIAL_SUPPLY + REGULAR_EMISSION);

      // Verify total supply is less than totalMinted due to burn
      expect(await token.totalSupply()).to.be.lessThan(await token.totalMinted());
    });

    it("Should complete full emission schedule correctly", async function () {
      const { token, owner, foundation } = await loadFixture(deployTokenFixture);

      // Fast forward and mint all emissions
      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      expect(await token.currentCycle()).to.equal(9);
      expect(await token.totalMinted()).to.equal(MAX_SUPPLY);

      // Foundation should have 8 * 10% + 1 * 5% = 85% of max supply
      const foundationBalance = await token.balanceOf(foundation.address);
      const expectedFoundationBalance = (MAX_SUPPLY * 85n) / 100n;
      expect(foundationBalance).to.equal(expectedFoundationBalance);

      // Owner should have 15%
      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY);

      // Total supply should equal max supply (no burns)
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should maintain correct percentages after full emission", async function () {
      const { token, owner, foundation } = await loadFixture(deployTokenFixture);

      // Complete all emissions
      for (let cycle = 1; cycle <= 9; cycle++) {
        await time.increase(EMISSION_INTERVAL);
        await token.mint();
      }

      const ownerPct = (await token.balanceOf(owner.address)) * 100n / MAX_SUPPLY;
      const foundationPct = (await token.balanceOf(foundation.address)) * 100n / MAX_SUPPLY;

      expect(ownerPct).to.equal(15n);
      expect(foundationPct).to.equal(85n);
    });
  });
});
