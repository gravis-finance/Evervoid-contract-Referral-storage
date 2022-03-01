const hre = require("hardhat");
const { upgrades } = hre;

async function main() {
    const proxyAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    const Mining = await hre.ethers.getContractFactory("MiningV1Limited");
    const mining = await upgrades.upgradeProxy(proxyAddress, Mining);

    const proxyAdmin = await upgrades.admin.getInstance();
    const miningImpl = await proxyAdmin.getProxyImplementation(mining.address);
    console.log("Proxy upgraded, implementation at:", miningImpl);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
