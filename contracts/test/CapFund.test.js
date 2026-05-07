const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CapFund", function () {
  let capFund;
  let owner, contributor1, contributor2, other;

  // Helpers
  const ONE_ETH  = ethers.parseEther("1.0");
  const TWO_ETH  = ethers.parseEther("2.0");
  const HALF_ETH = ethers.parseEther("0.5");

  async function deploy() {
    [owner, contributor1, contributor2, other] = await ethers.getSigners();
    const CapFund = await ethers.getContractFactory("CapFund");
    capFund = await CapFund.deploy();
    await capFund.waitForDeployment();
  }

  /** Returns a deadline `secondsFromNow` seconds in the future */
  async function futureDeadline(secondsFromNow = 3600) {
    const now = await time.latest();
    return now + secondsFromNow;
  }

  // ─────────────────────────────────────────────────
  //  DEPLOYMENT
  // ─────────────────────────────────────────────────
  describe("Deployment", function () {
    it("starts with campaignCount = 0", async function () {
      await deploy();
      expect(await capFund.campaignCount()).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────
  //  CREATE CAMPAIGN
  // ─────────────────────────────────────────────────
  describe("createCampaign", function () {
    beforeEach(deploy);

    it("creates a campaign and increments campaignCount", async function () {
      const deadline = await futureDeadline();
      await expect(capFund.connect(owner).createCampaign(ONE_ETH, deadline))
        .to.emit(capFund, "CampaignCreated")
        .withArgs(0, owner.address, ONE_ETH, deadline);

      expect(await capFund.campaignCount()).to.equal(1);
    });

    it("reverts if fundingCap is zero", async function () {
      const deadline = await futureDeadline();
      await expect(
        capFund.createCampaign(0, deadline)
      ).to.be.revertedWith("CapFund: Funding cap must be greater than zero");
    });

    it("reverts if deadline is in the past", async function () {
      const pastDeadline = (await time.latest()) - 1;
      await expect(
        capFund.createCampaign(ONE_ETH, pastDeadline)
      ).to.be.revertedWith("CapFund: Deadline must be in the future");
    });
  });

  // ─────────────────────────────────────────────────
  //  CONTRIBUTE
  // ─────────────────────────────────────────────────
  describe("contribute", function () {
    let campaignId;

    beforeEach(async function () {
      await deploy();
      const deadline = await futureDeadline();
      const tx = await capFund.connect(owner).createCampaign(ONE_ETH, deadline);
      const receipt = await tx.wait();
      campaignId = 0n;
    });

    it("accepts a valid contribution and emits ContributionMade", async function () {
      await expect(
        capFund.connect(contributor1).contribute(campaignId, { value: HALF_ETH })
      )
        .to.emit(capFund, "ContributionMade")
        .withArgs(campaignId, contributor1.address, HALF_ETH);

      const [, , totalFunds] = await capFund.getCampaign(campaignId);
      expect(totalFunds).to.equal(HALF_ETH);
    });

    it("rejects if campaign is fully funded", async function () {
      // Fill the campaign
      await capFund.connect(contributor1).contribute(campaignId, { value: ONE_ETH });
      // Now it's full
      await expect(
        capFund.connect(contributor2).contribute(campaignId, { value: HALF_ETH })
      ).to.be.revertedWith("CapFund: Campaign is fully funded");
    });

    it("rejects after deadline", async function () {
      await time.increase(3601); // Move past deadline
      await expect(
        capFund.connect(contributor1).contribute(campaignId, { value: HALF_ETH })
      ).to.be.revertedWith("CapFund: Campaign deadline has passed");
    });

    it("rejects zero-value contributions", async function () {
      await expect(
        capFund.connect(contributor1).contribute(campaignId, { value: 0 })
      ).to.be.revertedWith("CapFund: Contribution must be greater than zero");
    });

    // ── MAX CAP ENFORCEMENT ────────────────────────────────────────────────
    it("enforces cap: total funds NEVER exceed fundingCap", async function () {
      // Contribute more than the cap (1.5 ETH when cap is 1 ETH)
      await capFund.connect(contributor1).contribute(campaignId, {
        value: ethers.parseEther("1.5"),
      });

      const [, , totalFunds] = await capFund.getCampaign(campaignId);
      expect(totalFunds).to.equal(ONE_ETH); // capped at 1 ETH
    });

    it("refunds the overage when contribution exceeds cap", async function () {
      const balanceBefore = await ethers.provider.getBalance(contributor1.address);

      const tx = await capFund.connect(contributor1).contribute(campaignId, {
        value: ethers.parseEther("1.5"), // 0.5 should be refunded
      });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(contributor1.address);
      // Net cost ≈ 1 ETH + gas (0.5 ETH refunded)
      const netCost = balanceBefore - balanceAfter - gasCost;
      expect(netCost).to.equal(ONE_ETH);
    });

    it("emits RefundIssued when overage is refunded", async function () {
      await expect(
        capFund.connect(contributor1).contribute(campaignId, {
          value: ethers.parseEther("1.5"),
        })
      ).to.emit(capFund, "RefundIssued");
    });
  });

  // ─────────────────────────────────────────────────
  //  WITHDRAW
  // ─────────────────────────────────────────────────
  describe("withdraw", function () {
    let campaignId;

    beforeEach(async function () {
      await deploy();
      const deadline = await futureDeadline();
      await capFund.connect(owner).createCampaign(ONE_ETH, deadline);
      campaignId = 0n;
      // Fully fund the campaign
      await capFund.connect(contributor1).contribute(campaignId, { value: ONE_ETH });
    });

    it("allows owner to withdraw when goal is reached", async function () {
      await expect(capFund.connect(owner).withdraw(campaignId))
        .to.emit(capFund, "FundsWithdrawn")
        .withArgs(campaignId, owner.address, ONE_ETH);
    });

    it("reverts if non-owner tries to withdraw", async function () {
      await expect(
        capFund.connect(other).withdraw(campaignId)
      ).to.be.revertedWith("CapFund: Only owner can withdraw");
    });

    it("reverts if funds already withdrawn", async function () {
      await capFund.connect(owner).withdraw(campaignId);
      await expect(
        capFund.connect(owner).withdraw(campaignId)
      ).to.be.revertedWith("CapFund: Funds already withdrawn");
    });

    it("reverts if goal not reached", async function () {
      const d2 = await futureDeadline();
      await capFund.connect(owner).createCampaign(TWO_ETH, d2); // id=1
      await expect(
        capFund.connect(owner).withdraw(1)
      ).to.be.revertedWith("CapFund: Funding goal not reached");
    });
  });

  // ─────────────────────────────────────────────────
  //  CLAIM REFUND
  // ─────────────────────────────────────────────────
  describe("claimRefund", function () {
    let campaignId;

    beforeEach(async function () {
      await deploy();
      const deadline = await futureDeadline(3600); // 1 hour
      await capFund.connect(owner).createCampaign(ONE_ETH, deadline);
      campaignId = 0n;
      // Partial contribution — goal NOT reached
      await capFund.connect(contributor1).contribute(campaignId, { value: HALF_ETH });
    });

    it("allows contributor to claim refund after failed campaign", async function () {
      await time.increase(3601); // Past deadline
      const balBefore = await ethers.provider.getBalance(contributor1.address);

      const tx = await capFund.connect(contributor1).claimRefund(campaignId);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(contributor1.address);
      // Should receive back HALF_ETH minus gas
      expect(balAfter - balBefore + gasCost).to.equal(HALF_ETH);
    });

    it("emits RefundIssued", async function () {
      await time.increase(3601);
      await expect(capFund.connect(contributor1).claimRefund(campaignId))
        .to.emit(capFund, "RefundIssued")
        .withArgs(campaignId, contributor1.address, HALF_ETH);
    });

    it("reverts if campaign still active", async function () {
      await expect(
        capFund.connect(contributor1).claimRefund(campaignId)
      ).to.be.revertedWith("CapFund: Campaign is still active");
    });

    it("reverts if goal was reached", async function () {
      await capFund.connect(contributor2).contribute(campaignId, { value: HALF_ETH });
      await time.increase(3601);
      await expect(
        capFund.connect(contributor1).claimRefund(campaignId)
      ).to.be.revertedWith("CapFund: Goal was reached — no refunds available");
    });

    it("reverts double refund", async function () {
      await time.increase(3601);
      await capFund.connect(contributor1).claimRefund(campaignId);
      await expect(
        capFund.connect(contributor1).claimRefund(campaignId)
      ).to.be.revertedWith("CapFund: No contribution to refund");
    });
  });
});
