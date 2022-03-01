const hre = require("hardhat");
const { upgrades } = hre;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const grvx = "0xb87caf94eca257938b5ef984786d4423dc507843"; // grvx token address
    const vouchers = "0x3E6aA28b4EE55a5a0cfaf615D4f142fd32aa472d"; // vouchers token address
    const scrap = "0x32Ea8336D278692C79cCC39d331c6D55dc1Af77A"; // scrap NFT address
    const veterans = "0xA3871bdaD50db91e44Bc991E55872aa01147B54b"; // veterans NFT address
    const skins = "0xA3871bdaD50db91e44Bc991E55872aa01147B54b"; // skins NFT address
    const referralStorage = "0xA3871bdaD50db91e44Bc991E55872aa01147B54b"; // referral storage address
    const miningV1 = "0xA3871bdaD50db91e44Bc991E55872aa01147B54b"; // mining V1 address

    const Mining = await hre.ethers.getContractFactory("MiningV2");
    const mining = await upgrades.deployProxy(Mining, [
        grvx,
        vouchers,
        scrap,
        veterans,
        skins,
        referralStorage,
        miningV1,
    ]);
    await mining.deployed();
    console.log("Mining proxy deployed to:", mining.address);

    await storage.setProgram(mining.address, true);

    await sleep(30000);

    const proxyAdmin = await upgrades.admin.getInstance();
    const miningImpl = await proxyAdmin.getProxyImplementation(mining.address);
    await hre.run("verify:verify", {
        address: miningImpl,
        constructorArguments: [],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
