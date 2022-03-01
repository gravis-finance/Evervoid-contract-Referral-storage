const { ethers, upgrades } = require("hardhat");
const { AddressZero } = ethers.constants;
const { expect } = require("chai");
const { both, mineBlock, stopMining, startMining } = require("./Utils");

describe("Test Prolonged Mining", function () {
    beforeEach(async function () {
        [owner, other, ...accounts] = await hre.ethers.getSigners();

        // Deploy contracts
        NFT = await ethers.getContractFactory("MintableTypedNFT");
        ships = await NFT.deploy(5);
        captains = await NFT.deploy(3);
        veterans = await NFT.deploy(2);
        vouchers = await NFT.deploy(3);
        equipment1 = await NFT.deploy(3);
        equipment2 = await NFT.deploy(3);
        skins = await NFT.deploy(2);

        ERC20 = await ethers.getContractFactory("MintableToken");
        grvx = await ERC20.deploy("GRVX", "GRVX");
        scrap = await ERC20.deploy("Scrap", "SCRAP");

        ReferralStorage = await ethers.getContractFactory("ReferralStorage");
        storage = await upgrades.deployProxy(ReferralStorage, [1, []]);

        Mining = await ethers.getContractFactory("ProlongedMiningV2");
        mining = await upgrades.deployProxy(Mining, [
            grvx.address,
            vouchers.address,
            scrap.address,
            veterans.address,
            skins.address,
            storage.address,
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
        await mining.setShipTypeProlonged(
            ships.address,
            1,
            1,
            ethers.utils.parseUnits("1"),
            50
        );
        await mining.setShipTypeProlonged(
            ships.address,
            2,
            1,
            ethers.utils.parseUnits("2"),
            50
        );

        await mining.setCaptainType(captains.address, 1, true, 1);
        await mining.setCaptainType(veterans.address, 1, true, 2);

        await mining.setEquipmentType(equipment1.address, 1, true, 1, 2, 1, 2);
        await mining.setEquipmentType(equipment1.address, 2, true, 5, 10, 3, 4);
        await mining.setEquipmentType(
            equipment2.address,
            1,
            true,
            100,
            100,
            5,
            6
        );
        await mining.setEquipmentType(
            equipment2.address,
            2,
            true,
            900,
            900,
            10,
            11
        );

        await mining.setEquipmentTypeProlonged(
            equipment1.address,
            1,
            true,
            100,
            100,
            1,
            1
        );

        eq0lev1 = (
            await both(equipment1, "mint", [owner.address, 1, 1])
        ).reply.sub(1);
        eq0lev2 = (
            await both(equipment1, "mint", [owner.address, 2, 1])
        ).reply.sub(1);
        eq1lev1 = (
            await both(equipment2, "mint", [owner.address, 1, 1])
        ).reply.sub(1);
        eq1lev2 = (
            await both(equipment2, "mint", [owner.address, 2, 1])
        ).reply.sub(1);

        badEq = (
            await both(equipment1, "mint", [owner.address, 3, 1])
        ).reply.sub(1);

        skin = (await both(skins, "mint", [owner.address, 1, 1])).reply.sub(1);

        await veterans.transferOwnership(mining.address);
        await vouchers.transferOwnership(mining.address);
    });

    it("Can't stake ship without approval", async function () {
        await expect(
            mining.stake(
                ships.address,
                ship1,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero
            )
        ).to.be.revertedWith(
            "ERC721: transfer caller is not owner nor approved"
        );
    });

    it("Can't stake captain without approvals", async function () {
        await ships.approve(mining.address, ship1);
        await expect(
            mining.stake(
                ships.address,
                ship1,
                captains.address,
                captain1,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero
            )
        ).to.be.revertedWith(
            "ERC721: transfer caller is not owner nor approved"
        );
    });

    it("Can't stake ship with not allowed type", async function () {
        await ships.approve(mining.address, ship3);
        await expect(
            mining.stake(
                ships.address,
                ship3,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero
            )
        ).to.be.revertedWith("No staking available for this ship type");
    });

    it("Can't stake captain with not allowed type", async function () {
        await ships.approve(mining.address, ship1);
        await captains.approve(mining.address, captain2);
        await expect(
            mining.stake(
                ships.address,
                ship1,
                captains.address,
                captain2,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero
            )
        ).to.be.revertedWith("No staking available for this captain type");
    });

    it("Ship staking works correct", async function () {
        await ships.approve(mining.address, ship1);
        let { reply: stakeId, receipt } = await both(mining, "stake", [
            ships.address,
            ship1,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            AddressZero,
        ]);
        receipt = await receipt.wait();

        await expect(ships.ownerOf(ship1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        const stake = await mining.stakes(stakeId);
        expect(stake.id).to.equal(stakeId);
        expect(stake.owner).to.equal(owner.address);
        expect(stake.grvxReward).to.equal(ethers.utils.parseUnits("10.0"));
        expect(stake.both).to.be.false;
        expect(stake.endBlock).to.equal(receipt.blockNumber + 50);
        expect(stake.minScrap).to.equal(1);
        expect(stake.maxScrap).to.equal(2);
        expect(stake.veteranTypeId).to.equal(0);

        const stakeExtra = await mining.stakesExtra(stakeId);
        expect(stakeExtra.shipTypeId).to.equal(1);
        expect(stakeExtra.captainTypeId).to.equal(0);
    });

    it("Ship and captain staking works correct", async function () {
        await ships.approve(mining.address, ship1);
        await captains.approve(mining.address, captain1);
        let { reply: stakeId, receipt } = await both(mining, "stake", [
            ships.address,
            ship1,
            captains.address,
            captain1,
            ethers.constants.MaxUint256,
            [],
            [],
            AddressZero,
        ]);
        receipt = await receipt.wait();

        await expect(ships.ownerOf(ship1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        await expect(captains.ownerOf(captain1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        const stake = await mining.stakes(stakeId);
        expect(stake.id).to.equal(stakeId);
        expect(stake.owner).to.equal(owner.address);
        expect(stake.grvxReward).to.equal(ethers.utils.parseUnits("10.0"));
        expect(stake.both).to.be.true;
        expect(stake.endBlock).to.equal(receipt.blockNumber + 50);
        expect(stake.minScrap).to.equal(1);
        expect(stake.maxScrap).to.equal(2);
        expect(stake.veteranTypeId).to.equal(1);

        const stakeExtra = await mining.stakesExtra(stakeId);
        expect(stakeExtra.shipTypeId).to.equal(1);
        expect(stakeExtra.captainContract).to.equal(captains.address);
        expect(stakeExtra.captainTypeId).to.equal(1);
    });

    it("Prolonged staking works correct", async function () {
        await ships.approve(mining.address, ship1);
        await captains.approve(mining.address, captain1);
        await equipment1.approve(mining.address, eq0lev1);
        let { reply: stakeId, receipt } = await both(mining, "stakeProlonged", [
            ships.address,
            ship1,
            captains.address,
            captain1,
            ethers.constants.MaxUint256,
            1,
            [equipment1.address],
            [eq0lev1],
            AddressZero,
        ]);
        receipt = await receipt.wait();

        expect(await ships.ownerOf(ship1)).to.equal(mining.address);
        expect(await equipment1.ownerOf(eq0lev1)).to.equal(mining.address);
        await expect(captains.ownerOf(captain1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );

        const stake = await mining.stakes(stakeId);
        expect(stake.id).to.equal(stakeId);
        expect(stake.owner).to.equal(owner.address);
        expect(stake.grvxReward).to.equal(ethers.utils.parseUnits("2"));
        expect(stake.both).to.be.true;
        expect(stake.endBlock).to.equal(receipt.blockNumber + 45);
        expect(stake.minScrap).to.equal(0);
        expect(stake.maxScrap).to.equal(0);
        expect(stake.veteranTypeId).to.equal(1);
        expect(stake.prolongedType).to.equal(1);

        const stakeExtra = await mining.stakesExtra(stakeId);
        expect(stakeExtra.shipTypeId).to.equal(1);
        expect(stakeExtra.captainContract).to.equal(captains.address);
        expect(stakeExtra.captainTypeId).to.equal(1);
    });

    it("Can't stake not allowed equipment type", async function () {
        await ships.approve(mining.address, ship1);
        await equipment1.approve(mining.address, badEq);
        await expect(
            mining.stake(
                ships.address,
                ship1,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [equipment1.address],
                [badEq],
                AddressZero
            )
        ).to.be.revertedWith("This equipment type is not allowed");
    });

    it("Can't stake equipment with duplicating slots", async function () {
        await ships.approve(mining.address, ship1);
        await equipment1.approve(mining.address, eq0lev1);
        await equipment1.approve(mining.address, eq0lev2);
        await expect(
            mining.stake(
                ships.address,
                ship1,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [equipment1.address, equipment1.address],
                [eq0lev1, eq0lev2],
                AddressZero
            )
        ).to.be.revertedWith("Equipment slot already occupied");
    });

    it("Staking with correct equipment works", async function () {
        await mining.setShipType(
            ships.address,
            2,
            ethers.utils.parseUnits("20"),
            1000,
            1,
            2
        );
        await ships.approve(mining.address, ship2);
        await equipment1.approve(mining.address, eq0lev1);
        await mining.stake(
            ships.address,
            ship2,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [equipment1.address],
            [eq0lev1],
            AddressZero
        );

        await expect(equipment1.ownerOf(eq0lev1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        const stake = await mining.stakes(1);
        expect(
            stake.grvxReward
                .sub(ethers.utils.parseUnits("20"))
                .div(ethers.utils.parseUnits("1"))
                .toNumber()
        ).to.be.oneOf([1, 2]);
        expect(stake.endBlock - stake.startBlock).to.be.oneOf([998, 999]);

        const [contracts, typeIds] = await mining.stakedEquipment(1);
        expect(typeIds.length).to.equal(1);
        expect(typeIds[0]).to.equal(1);
        expect(contracts.length).to.equal(1);
        expect(contracts[0]).to.equal(equipment1.address);
    });

    it("Can stake multiple equipment slots", async function () {
        await mining.setShipType(
            ships.address,
            2,
            ethers.utils.parseUnits("20"),
            1000,
            1,
            2
        );
        await ships.setApprovalForAll(mining.address, true);
        await equipment1.setApprovalForAll(mining.address, true);
        await equipment2.setApprovalForAll(mining.address, true);

        await mining.stake(
            ships.address,
            ship2,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [equipment1.address, equipment2.address],
            [eq0lev1, eq1lev1],
            AddressZero
        );

        await expect(equipment1.ownerOf(eq0lev1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        await expect(equipment1.ownerOf(eq1lev1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
        );
        const stake = await mining.stakes(1);
        expect(
            stake.grvxReward
                .sub(ethers.utils.parseUnits("20"))
                .div(ethers.utils.parseUnits("1"))
                .toNumber()
        ).to.be.oneOf([6, 7, 8]);
        expect(stake.endBlock - stake.startBlock).to.be.oneOf([898, 899]);

        const [contracts, typeIds] = await mining.stakedEquipment(1);
        expect(typeIds.length).to.equal(2);
        expect(typeIds[0]).to.equal(1);
        expect(typeIds[1]).to.equal(1);
        expect(contracts.length).to.equal(2);
        expect(contracts[0]).to.equal(equipment1.address);
        expect(contracts[1]).to.equal(equipment2.address);
    });

    it("Duration bonus can't be greater than 90%", async function () {
        await mining.setShipType(
            ships.address,
            2,
            ethers.utils.parseUnits("20"),
            1000,
            1,
            2
        );
        await ships.setApprovalForAll(mining.address, true);
        await equipment1.setApprovalForAll(mining.address, true);
        await equipment2.setApprovalForAll(mining.address, true);

        await mining.stake(
            ships.address,
            ship2,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [equipment1.address, equipment2.address],
            [eq0lev2, eq1lev2],
            AddressZero
        );

        const stake = await mining.stakes(1);
        expect(stake.endBlock - stake.startBlock).to.equal(100);
    });

    it("Equipment bonus should be statistically correct", async function () {
        await mining.setShipType(
            ships.address,
            2,
            ethers.utils.parseUnits("20"),
            1000,
            1,
            2
        );
        await ships.setApprovalForAll(mining.address, true);
        await equipment1.setApprovalForAll(mining.address, true);

        let oneDuration = 0,
            twoDuration = 0,
            oneReward = 0,
            twoReward = 0;

        console.log("Staking 100 ships...");
        for (let i = 0; i < 100; i++) {
            process.stdout.write("*");

            const newShip = (
                await both(ships, "mint", [owner.address, 2, 1])
            ).reply.sub(1);
            const newEquipment = (
                await both(equipment1, "mint", [owner.address, 1, 1])
            ).reply.sub(1);
            const { reply } = await both(mining, "stake", [
                ships.address,
                newShip,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [equipment1.address],
                [newEquipment],
                AddressZero,
            ]);

            const stake = await mining.stakes(reply);
            if (stake.grvxReward.eq(ethers.utils.parseUnits("21"))) {
                oneReward++;
            } else {
                twoReward++;
            }
            if (stake.endBlock - stake.startBlock == 999) {
                oneDuration++;
            } else {
                twoDuration++;
            }
        }
        console.log("\nDuration:", oneDuration, "/", twoDuration);
        console.log("Reward:", oneReward, "/", twoReward);

        expect(Math.abs(oneDuration - twoDuration)).to.be.lessThanOrEqual(25);
        expect(Math.abs(oneReward - twoReward)).to.be.lessThanOrEqual(25);
    });

    it("Can't stake skin without approval", async function () {
        await ships.setApprovalForAll(mining.address, true);
        await expect(
            mining.stake(
                ships.address,
                ship1,
                AddressZero,
                0,
                skin,
                [],
                [],
                AddressZero
            )
        ).to.be.revertedWith(
            "ERC721: transfer caller is not owner nor approved"
        );
    });

    it("Staking skin works correct", async function () {
        await ships.setApprovalForAll(mining.address, true);
        await skins.setApprovalForAll(mining.address, true);

        await mining.stake(
            ships.address,
            ship1,
            AddressZero,
            0,
            skin,
            [],
            [],
            AddressZero
        );

        const stakeExtra = await mining.stakesExtra(1);
        expect(stakeExtra.skinId).to.equal(skin);

        expect(await skins.ownerOf(skin)).to.equal(mining.address);

        await mineBlock(50);
        await mining.claim(1);

        expect(await skins.ownerOf(skin)).to.equal(owner.address);
    });

    it("Stakes getter is correct", async function () {
        await ships.approve(mining.address, ship1);
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

        await ships.approve(mining.address, ship2);
        await mining.stake(
            ships.address,
            ship2,
            AddressZero,
            0,
            ethers.constants.MaxUint256,
            [],
            [],
            AddressZero
        );

        [stakes, stakesExtra] = await mining.stakesOf(owner.address);

        expect(stakes.length).to.equal(2);
        expect(stakes[0].id).to.equal(1);
        expect(stakes[0].owner).to.equal(owner.address);
        expect(stakes[0].grvxReward).to.equal(ethers.utils.parseUnits("10"));
        expect(stakes[1].id).to.equal(2);
        expect(stakes[1].owner).to.equal(owner.address);
        expect(stakes[1].grvxReward).to.equal(ethers.utils.parseUnits("20"));

        expect(stakesExtra.length).to.equal(2);
        expect(stakesExtra[0].shipTypeId).to.equal(1);
        expect(stakesExtra[0].captainContract).to.equal(
            ethers.constants.AddressZero
        );
        expect(stakesExtra[0].captainTypeId).to.equal(0);
        expect(stakesExtra[1].shipTypeId).to.equal(2);
        expect(stakesExtra[1].captainContract).to.equal(
            ethers.constants.AddressZero
        );
        expect(stakesExtra[1].captainTypeId).to.equal(0);

        await mineBlock(101);
        await mining.claim(1);

        [stakes, stakesExtra] = await mining.stakesOf(owner.address);

        expect(stakes.length).to.equal(1);
        expect(stakes[0].id).to.equal(2);
        expect(stakes[0].owner).to.equal(owner.address);
        expect(stakes[0].grvxReward).to.equal(ethers.utils.parseUnits("20"));

        expect(stakesExtra.length).to.equal(1);
        expect(stakesExtra[0].shipTypeId).to.equal(2);
        expect(stakesExtra[0].captainContract).to.equal(
            ethers.constants.AddressZero
        );
        expect(stakesExtra[0].captainTypeId).to.equal(0);
    });

    describe("Reward Claiming", function () {
        beforeEach(async function () {
            await ships.approve(mining.address, ship1);
            const { reply, receipt } = await both(mining, "stake", [
                ships.address,
                ship1,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero,
            ]);
            stakeId = reply;
            blockNumber = (await receipt.wait()).blockNumber;
        });

        it("Can't claim others stake", async function () {
            await mineBlock(50);
            await expect(
                mining.connect(other).claim(stakeId)
            ).to.be.revertedWith("Sender isn't stake owner");
        });

        it("Can't claim before staking end", async function () {
            await expect(mining.claim(stakeId)).to.be.revertedWith(
                "Can't claim yet"
            );
        });

        it("Can't claim twice", async function () {
            await mineBlock(50);
            await mining.claim(stakeId);
            await expect(mining.claim(stakeId)).to.be.revertedWith(
                "Stake is already claimed"
            );
        });

        it("Can't double claim using claiming twice in one tx", async function () {
            await mineBlock(50);
            await stopMining();

            let receipt = await mining.claim(stakeId);
            let receipt2 = await mining.claim(stakeId);

            await startMining();
            await mineBlock();
            receipt = await receipt.wait();
            await expect(receipt2.wait()).to.be.reverted;

            expect(await grvx.balanceOf(owner.address)).to.equal(
                ethers.utils.parseUnits("10.0")
            );
        });

        it("Claiming rewards from single ship staking works correct", async function () {
            await mineBlock(50);
            await mining.claim(stakeId);

            expect(await grvx.balanceOf(owner.address)).to.equal(
                ethers.utils.parseUnits("10")
            );
            expect(await vouchers.balanceOf(owner.address)).to.equal(0);

            expect(await veterans.balanceOf(owner.address)).to.equal(0);
            expect(
                (await scrap.balanceOf(owner.address)).toString()
            ).to.be.oneOf([
                ethers.utils.parseUnits("1").toString(),
                ethers.utils.parseUnits("2").toString(),
            ]);

            expect(
                (await mining.stakesExtra(stakeId)).scrapQuantity.toNumber()
            ).to.be.oneOf([1, 2]);
        });

        it("Claiming rewards from ship with captain works correct", async function () {
            await ships.approve(mining.address, ship2);
            await captains.approve(mining.address, captain1);
            const { reply, receipt } = await both(mining, "stake", [
                ships.address,
                ship2,
                captains.address,
                captain1,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero,
            ]);
            stakeId = reply;
            blockNumber = (await receipt.wait()).blockNumber;

            await mineBlock(100);
            await mining.claim(stakeId);

            expect(await grvx.balanceOf(owner.address)).to.equal(
                ethers.utils.parseUnits("20")
            );
            expect(await vouchers.balanceOf(owner.address)).to.equal(1);

            expect(await veterans.balanceOf(owner.address)).to.equal(1);
            expect(
                (await scrap.balanceOf(owner.address)).toString()
            ).to.be.oneOf([
                ethers.utils.parseUnits("3").toString(),
                ethers.utils.parseUnits("4").toString(),
            ]);

            expect(
                (await mining.stakesExtra(stakeId)).scrapQuantity.toNumber()
            ).to.be.oneOf([3, 4]);

            expect((await mining.stakesExtra(stakeId)).veteranId).to.equal(1);
            expect((await mining.stakesExtra(stakeId)).voucherId).to.equal(1);
        });

        it("Claiming rewards from prolonged mining works correct", async function () {
            await ships.approve(mining.address, ship2);
            await captains.approve(mining.address, captain1);
            await equipment1.approve(mining.address, eq0lev1);
            const { reply, receipt } = await both(mining, "stakeProlonged", [
                ships.address,
                ship2,
                captains.address,
                captain1,
                ethers.constants.MaxUint256,
                1,
                [equipment1.address],
                [eq0lev1],
                AddressZero,
            ]);
            stakeId = reply;
            blockNumber = (await receipt.wait()).blockNumber;

            await mineBlock(100);
            await mining.claim(stakeId);

            expect(await grvx.balanceOf(owner.address)).to.equal(
                ethers.utils.parseUnits("3")
            );
            expect(await vouchers.balanceOf(owner.address)).to.equal(1);

            expect(await veterans.balanceOf(owner.address)).to.equal(1);
            expect(await scrap.balanceOf(owner.address)).to.equal(0);

            expect((await mining.stakesExtra(stakeId)).veteranId).to.equal(1);
            expect((await mining.stakesExtra(stakeId)).voucherId).to.equal(1);

            expect(await ships.ownerOf(ship2)).to.equal(owner.address);
            expect(await equipment1.ownerOf(eq0lev1)).to.equal(owner.address);
        });

        it("Scrap amount should be statistically correct", async function () {
            let lastScrap = 0;
            let oneChange = 0;
            let twoChange = 0;

            await ships.setApprovalForAll(mining.address, true);
            await mining.setShipType(ships.address, 1, 1, 5, 1, 2);

            console.log("Staking 100 ships...");
            for (let i = 0; i < 100; i++) {
                process.stdout.write("*");

                const newShip = (
                    await both(ships, "mint", [owner.address, 1, 1])
                ).reply.sub(1);
                const { reply, receipt } = await both(mining, "stake", [
                    ships.address,
                    newShip,
                    AddressZero,
                    0,
                    ethers.constants.MaxUint256,
                    [],
                    [],
                    AddressZero,
                ]);
                stakeId = reply;
                blockNumber = (await receipt.wait()).blockNumber;

                await mineBlock(5);
                await mining.claim(stakeId);

                const newScrap = await scrap.balanceOf(owner.address);
                if (newScrap.sub(lastScrap).eq(ethers.utils.parseUnits("1"))) {
                    oneChange++;
                } else {
                    twoChange++;
                }
                lastScrap = newScrap;
            }
            console.log("", oneChange, "/", twoChange);
            expect(Math.abs(oneChange - twoChange)).to.be.lessThanOrEqual(25);
        });

        it("Should not mint zero scrap", async function () {
            await mining.setShipType(ships.address, 2, 1, 5, 0, 0);

            await ships.approve(mining.address, ship2);
            const { reply } = await both(mining, "stake", [
                ships.address,
                ship2,
                AddressZero,
                0,
                ethers.constants.MaxUint256,
                [],
                [],
                AddressZero,
            ]);
            stakeId = reply;

            await mineBlock(5);
            await mining.claim(stakeId);

            expect(await scrap.balanceOf(owner.address)).to.equal(0);
        });

        it("Can't claim banned stake", async function () {
            await mining.blockStake(stakeId);

            const [stakes] = await mining.stakesOf(owner.address);
            expect(stakes.length).to.equal(0);

            await mineBlock(50);
            await expect(mining.claim(stakeId)).to.be.revertedWith(
                "Stake is already claimed"
            );
        });

        it("Banned stake can be unbanned", async function () {
            await mining.blockStake(stakeId);

            await mining.unblockStake(stakeId);

            const [stakes] = await mining.stakesOf(owner.address);
            expect(stakes.length).to.equal(1);

            await mineBlock(50);
            await mining.claim(stakeId);
        });
    });

    describe("Owner Functions", function () {
        it("Only owner can set ship type", async function () {
            await expect(
                mining.connect(other).setShipType(ships.address, 3, 1, 10, 1, 2)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Setting ship type works correct", async function () {
            await mining.setShipType(ships.address, 3, 1, 10, 1, 2);
            const type = await mining.shipTypeInfo(ships.address, 3);
            expect(type.reward).to.equal(1);
            expect(type.stakingDuration).to.equal(10);
            expect(type.minScrap).to.equal(1);
            expect(type.maxScrap).to.equal(2);
        });

        it("Only owner can set ship type prolonged", async function () {
            await expect(
                mining
                    .connect(other)
                    .setShipTypeProlonged(ships.address, 3, 1, 10, 10)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Setting ship type prolonged works correct", async function () {
            await mining.setShipTypeProlonged(ships.address, 3, 1, 10, 10);
            const type = await mining.shipTypeProlongedInfo(
                ships.address,
                3,
                1
            );
            expect(type.reward).to.equal(10);
            expect(type.stakingDuration).to.equal(10);
            expect(type.minScrap).to.equal(0);
            expect(type.maxScrap).to.equal(0);
        });

        it("Only owner can set captain type", async function () {
            await expect(
                mining
                    .connect(other)
                    .setCaptainType(captains.address, 2, true, 1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Setting captain type works correct", async function () {
            await mining.setCaptainType(captains.address, 2, true, 3);
            const type = await mining.captainTypeInfo(captains.address, 2);
            expect(type.allowed).to.be.true;
            expect(type.veteranTypeId).to.equal(3);
        });

        it("Only owner can set equipment type", async function () {
            await expect(
                mining
                    .connect(other)
                    .setEquipmentType(equipment1.address, 1, true, 2, 3, 2, 3)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Setting equipment type works correct", async function () {
            await mining.setEquipmentType(
                equipment1.address,
                3,
                true,
                2,
                3,
                2,
                3
            );
            const type = await mining.equipmentTypeInfo(equipment1.address, 3);
            expect(type.allowed).to.be.true;
            expect(type.minDurationBonus).to.equal(2);
            expect(type.maxDurationBonus).to.equal(3);
            expect(type.minRewardBonus).to.equal(2);
            expect(type.maxRewardBonus).to.equal(3);
        });

        it("Only owner can set equipment type prolonged", async function () {
            await expect(
                mining
                    .connect(other)
                    .setEquipmentTypeProlonged(
                        equipment1.address,
                        1,
                        true,
                        2,
                        3,
                        2,
                        3
                    )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Setting equipment type works correct", async function () {
            await mining.setEquipmentTypeProlonged(
                equipment1.address,
                3,
                true,
                2,
                3,
                2,
                3
            );
            const type = await mining.equipmentTypeProlongedInfo(
                equipment1.address,
                3
            );
            expect(type.allowed).to.be.true;
            expect(type.minDurationBonus).to.equal(2);
            expect(type.maxDurationBonus).to.equal(3);
            expect(type.minRewardBonus).to.equal(2);
            expect(type.maxRewardBonus).to.equal(3);
        });

        it("Setting vouchers contracts works correct", async function () {
            await expect(
                mining.connect(other).setVouchersContract(other.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await mining.setVouchersContract(other.address);
            expect(await mining.vouchers()).to.equal(other.address);
        });

        it("Setting scrap contracts works correct", async function () {
            await expect(
                mining.connect(other).setScrapContract(other.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await mining.setScrapContract(other.address);
            expect(await mining.scrap()).to.equal(other.address);
        });

        it("Setting vouchers contracts works correct", async function () {
            await expect(
                mining.connect(other).setSkinsContract(other.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await mining.setSkinsContract(other.address);
            expect(await mining.skins()).to.equal(other.address);
        });

        it("Setting referral storage works correct", async function () {
            await expect(
                mining.connect(other).setReferralStorage(other.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await mining.setReferralStorage(other.address);
            expect(await mining.referralStorage()).to.equal(other.address);
        });
    });
});
