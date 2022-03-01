const { ethers, upgrades } = require("hardhat");
const { AddressZero } = ethers.constants;
const { expect } = require("chai");
const { both, mineBlock, stopMining, startMining } = require("./Utils");

describe("Test Mining", function () {
    beforeEach(async function () {
        [owner, other, ...accounts] = await hre.ethers.getSigners();

        // Deploy contracts
        NFT = await ethers.getContractFactory("MintableTypedNFT");
        ships = await NFT.deploy(5);
        captains = await NFT.deploy(3);
        veterans = await NFT.deploy(2);
        vouchers = await NFT.deploy(3);
        equipment = await NFT.deploy(6);
        skins = await NFT.deploy(2);

        ERC20 = await ethers.getContractFactory("MintableToken");
        grvx = await ERC20.deploy("GRVX", "GRVX");
        scrap = await ERC20.deploy("Scrap", "SCRAP");

        ReferralStorage = await ethers.getContractFactory("ReferralStorage");
        storage = await upgrades.deployProxy(ReferralStorage, [1, []]);

        MiningV1 = await ethers.getContractFactory("MiningV1");
        mining = await upgrades.deployProxy(MiningV1, [
            grvx.address,
            vouchers.address,
            scrap.address,
            veterans.address,
            equipment.address,
            skins.address,
            storage.address,
            2,
        ]);

        await storage.setProgram(mining.address, true);

        // Configure contracts
        ship1 = (await both(ships, "mint", [owner.address, 1, 1])).reply.sub(1);
        ship2 = (await both(ships, "mint", [owner.address, 2, 1])).reply.sub(1);
        ship3 = (await both(ships, "mint", [owner.address, 3, 1])).reply.sub(1);
        captain1 = (
            await both(captains, "mint", [owner.address, 1, 1])
        ).reply.sub(1);
        captain2 = (
            await both(captains, "mint", [owner.address, 2, 1])
        ).reply.sub(1);

        await grvx.grantRole(await grvx.MINTER_ROLE(), mining.address);
        await scrap.grantRole(await scrap.MINTER_ROLE(), mining.address);

        await mining.setShipContract(ships.address, true);
        await mining.setShipType(
            ships.address,
            1,
            ethers.utils.parseUnits("10"),
            50,
            1,
            2
        );
        await mining.setShipType(
            ships.address,
            2,
            ethers.utils.parseUnits("20"),
            100,
            3,
            4
        );

        await mining.setCaptainContract(captains.address, true);
        await mining.setCaptainType(captains.address, 1, true, 1);
        await mining.setCaptainContract(veterans.address, true);
        await mining.setCaptainType(veterans.address, 1, true, 2);

        await mining.setEquipmentType(1, true, 0, 1, 2, 1, 2);
        await mining.setEquipmentType(2, true, 0, 5, 10, 3, 4);
        await mining.setEquipmentType(3, true, 1, 100, 100, 5, 6);
        await mining.setEquipmentType(4, true, 1, 900, 900, 10, 11);

        await veterans.transferOwnership(mining.address);
        await vouchers.transferOwnership(mining.address);
    });

    it("Claiming old stakes works correct", async function () {
        await ships.approve(mining.address, ship1);
        let { reply: stakeId } = await both(mining, "stakeShip", [ship1]);

        const MiningV1Limited = await ethers.getContractFactory(
            "MiningV1Limited"
        );
        mining = await upgrades.upgradeProxy(mining.address, MiningV1Limited);

        const MiningV2 = await ethers.getContractFactory("MiningV2");
        const miningV2 = await upgrades.deployProxy(MiningV2, [
            grvx.address,
            vouchers.address,
            scrap.address,
            veterans.address,
            skins.address,
            storage.address,
            mining.address,
        ]);

        await mining.setMiningV2(miningV2.address);

        await mineBlock(50);

        await expect(miningV2.connect(other).claim(stakeId)).to.be.revertedWith(
            "Sender isn't stake owner"
        );
        await miningV2.claim(stakeId);

        expect(await grvx.balanceOf(owner.address)).to.equal(
            ethers.utils.parseUnits("10")
        );
        expect(await vouchers.balanceOf(owner.address)).to.equal(0);

        expect(await veterans.balanceOf(owner.address)).to.equal(0);
        expect((await scrap.balanceOf(owner.address)).toString()).to.be.oneOf([
            ethers.utils.parseUnits("1").toString(),
            ethers.utils.parseUnits("2").toString(),
        ]);

        expect(
            (await mining.stakesExtra(stakeId)).scrapQuantity.toNumber()
        ).to.be.oneOf([1, 2]);
    });
});
