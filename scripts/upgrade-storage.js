const hre = require("hardhat");
const { upgrades } = hre;

async function main() {
    const proxyAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    const ReferralStorage = await hre.ethers.getContractFactory(
        "ReferralStorage"
    );
    const storage = await upgrades.upgradeProxy(proxyAddress, ReferralStorage);

    const proxyAdmin = await upgrades.admin.getInstance();
    const storageImpl = await proxyAdmin.getProxyImplementation(
        storage.address
    );
    console.log("Proxy upgraded, implementation at:", storageImpl);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
