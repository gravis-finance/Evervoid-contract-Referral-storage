const { ethers, upgrades } = require("hardhat");
const { AddressZero } = ethers.constants;
const { expect } = require("chai");
const { both } = require("./Utils");

describe("Test Referral Storage", function () {
    beforeEach(async function () {
        [owner, other, third, ...accounts] = await hre.ethers.getSigners();

        // Deploy contracts
        NFT = await ethers.getContractFactory("MintableTypedNFT");
        ships = await NFT.deploy(5);
        captains = await NFT.deploy(3);
        veterans = await NFT.deploy(2);
        vouchers = await NFT.deploy(3);
        skins = await NFT.deploy(2);

        ERC20 = await ethers.getContractFactory("MintableToken");
        grvx = await ERC20.deploy("GRVX", "GRVX");
        scrap = await ERC20.deploy("Scrap", "SCRAP");

        ReferralStorage = await ethers.getContractFactory("ReferralStorage");
        storage = await upgrades.deployProxy(ReferralStorage, [
            [
                { tokenType: 0, token: scrap.address, typeId: 0, amount: 10 },
                { tokenType: 1, token: ships.address, typeId: 1, amount: 1 },
            ],
            [1, 2],
        ]);

        Mining = await ethers.getContractFactory("MiningV2");
        mining = await upgrades.deployProxy(Mining, [
            grvx.address,
            vouchers.address,
            scrap.address,
            veterans.address,
            skins.address,
            storage.address,
            ethers.constants.AddressZero,
        ]);

        ProgramMock = await ethers.getContractFactory("ProgramMock");
        programMock = await ProgramMock.deploy(storage.address);

        await storage.setProgram(mining.address, true);
        await storage.setProgram(programMock.address, true);

        ship1 = (await both(ships, "mint", [owner.address, 1, 1])).reply.sub(1);
        ship2 = (await both(ships, "mint", [owner.address, 1, 1])).reply.sub(1);
        await ships.setApprovalForAll(mining.address, true);

        await grvx.grantRole(await grvx.MINTER_ROLE(), mining.address);
        await scrap.grantRole(await scrap.MINTER_ROLE(), mining.address);
        await scrap.grantRole(await scrap.MINTER_ROLE(), storage.address);
        await mining.setShipType(
            ships.address,
            1,
            ethers.utils.parseUnits("10"),
            50,
            1,
            2
        );
        await veterans.transferOwnership(mining.address);
        await vouchers.transferOwnership(mining.address);
        await ships.transferOwnership(storage.address);
    });

    it("Zero referrer doesn't change anything", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            AddressZero
        );
        expect(await storage.referrers(owner.address)).to.equal(AddressZero);
    });

    it("Passing a referrer works correct", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            other.address
        );

        expect(await storage.referrers(owner.address)).to.equal(other.address);
        expect(await storage.getInviteesCount(other.address)).to.equal(1);
        expect(
            await storage.getInvitees(other.address)
        ).to.have.ordered.members([owner.address]);
    });

    it("One address can't be invited twice in one program", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            other.address
        );
        await mining.stake(
            ships.address,
            ship2,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            third.address
        );

        expect(await storage.referrers(owner.address)).to.equal(other.address);
    });

    it("One address can't be invited twice in different programs", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            other.address
        );
        await programMock.join(third.address);

        expect(await storage.referrers(owner.address)).to.equal(other.address);
    });

    it("Can have multiple invitees", async function () {
        await programMock.join(third.address);
        await programMock.connect(other).join(third.address);

        expect(await storage.getInviteesCount(third.address)).to.equal(2);
        expect(
            await storage.getInvitees(third.address)
        ).to.have.ordered.members([owner.address, other.address]);
    });

    it("Can't refer in forbidden program", async function () {
        await storage.setProgram(programMock.address, false);

        await expect(programMock.join(third.address)).to.be.revertedWith(
            "This referral program is not enabled"
        );
    });

    it("Can't collect reward without required invitees", async function () {
        await expect(storage.claimReward(0)).to.be.revertedWith(
            "Not enough invitees for reward"
        );
    });

    it("Can collect reward with enough invitees", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            other.address
        );

        await expect(storage.connect(other).claimReward(0))
            .to.emit(storage, "RewardClaimed")
            .withArgs(other.address, 0);

        expect(await scrap.balanceOf(other.address)).to.equal(10);
    });

    it("Can't collect reward twice", async function () {
        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            other.address
        );

        await storage.connect(other).claimReward(0);
        await expect(storage.connect(other).claimReward(0)).to.be.revertedWith(
            "Already claimed"
        );
    });

    it("Owner and only owner can set levels", async function () {
        await expect(
            storage.connect(other).setLevels(
                [
                    {
                        tokenType: 0,
                        token: scrap.address,
                        typeId: 0,
                        amount: 100,
                    },
                ],
                [10]
            )
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await storage.setLevels(
            [
                {
                    tokenType: 0,
                    token: grvx.address,
                    typeId: 0,
                    amount: 100,
                },
            ],
            [10]
        );

        const reward = await storage.rewards(0);
        expect(reward.tokenType).to.equal(0);
        expect(reward.token).to.equal(grvx.address);
        expect(reward.amount).to.equal(100);

        await expect(storage.rewards(1)).to.be.reverted;

        expect(await storage.levelInvitees(0)).to.equal(10);
        await expect(storage.levelInvitees(1)).to.be.reverted;
    });
});
