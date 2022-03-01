const hre = require("hardhat");
const { upgrades } = hre;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const rewardInvitees = 10; // amount of invitees to get reward
    const rewards = [
        {
            tokenType: 0,
            token: "0xA3871bdaD50db91e44Bc991E55872aa01147B54b",
            typeId: 1,
            amount: 10,
        },
    ]; // description of referal rewards

    const ReferralStorage = await hre.ethers.getContractFactory(
        "ReferralStorage"
    );
    const storage = await upgrades.deployProxy(ReferralStorage, [
        rewardInvitees,
        rewards,
    ]);
    await storage.deployed();
    console.log("Referral storage deployed to:", storage.address);

    await sleep(30000);

    const proxyAdmin = await upgrades.admin.getInstance();
    const storageImpl = await proxyAdmin.getProxyImplementation(
        storage.address
    );
    await hre.run("verify:verify", {
        address: storageImpl,
        constructorArguments: [],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
