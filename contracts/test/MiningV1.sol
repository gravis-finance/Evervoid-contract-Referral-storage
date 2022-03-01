//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITypedNFT.sol";
import "../interfaces/IMintableToken.sol";
import "../interfaces/IReferralStorage.sol";

contract MiningV1 is OwnableUpgradeable {

    uint256 constant DECIMAL_PRECISION = 1;
    uint256 constant MAX_DURATION_BONUS = 90 * 10**DECIMAL_PRECISION;

    mapping(address => bool) public shipContractAllowed;
    address[] public shipContracts;

    mapping(address => bool) public captainContractAllowed;
    address[] public captainContracts;

    uint256 public totalEquipmentSlots;

    ITypedNFT public equipment;
    ITypedNFT public skins;

    IMintableToken public scrap;
    ITypedNFT public veterans;
    IMintableToken public grvx;
    ITypedNFT public vouchers;

    IReferralStorage public referralStorage;

    struct ShipTypeInfo {
        uint256 reward;
        uint256 stakingDuration;
        uint256 minScrap;
        uint256 maxScrap;
    }

    mapping(address => mapping(uint256 => ShipTypeInfo)) public shipTypeInfo;

    struct CaptainTypeInfo {
        bool allowed;
        uint256 veteranTypeId;
    }

    mapping(address => mapping(uint256 => CaptainTypeInfo)) public captainTypeInfo;

    struct EquipmentTypeInfo {
        bool allowed;
        uint256 slot;
        uint256 minDurationBonus;
        uint256 maxDurationBonus;
        uint256 minRewardBonus;
        uint256 maxRewardBonus;
    }

    mapping(uint256 => EquipmentTypeInfo) public equipmentTypeInfo;

    struct Stake {
        uint256 id;
        address owner;
        uint256 startBlock;
        uint256 endBlock;
        uint256 grvxReward;
        uint256 minScrap;
        uint256 maxScrap;
        uint256 veteranTypeId;
        bool both;
        bool claimed;
    }

    mapping(uint256 => Stake) public stakes;

    struct StakeExtra {
        address shipContract;
        uint256 shipTypeId;
        address captainContract;
        uint256 captainTypeId;
        uint256 scrapQuantity;
        uint256 veteranId;
        uint256 voucherId;
        uint256 skinId;
        bool hasSkin;
        uint256[] equipmentTypeIds;
    }

    mapping(uint256 => StakeExtra) public stakesExtra;

    mapping(address => uint256[]) public stakeIds;

    bool public stakeDisabled;

    uint256 private _lastStakeId;

    uint256 private _randomNonce;

    // CONSTRUCTOR

    constructor() {}

    function initialize(
        address grvx_,
        address vouchers_,
        address scrap_,
        address veterans_,
        address equipment_,
        address skins_,
        address referralStorage_,
        uint256 totalEquipmentSlots_
    ) public initializer {
        __Ownable_init();

        grvx = IMintableToken(grvx_);
        vouchers = ITypedNFT(vouchers_);
        scrap = IMintableToken(scrap_);
        veterans = ITypedNFT(veterans_);
        equipment = ITypedNFT(equipment_);
        skins = ITypedNFT(skins_);
        referralStorage = IReferralStorage(referralStorage_);

        totalEquipmentSlots = totalEquipmentSlots_;
    }

    // PUBLIC FUNCTIONS

    function stakeShip(uint256 shipId) external returns (uint256) {
        uint256[] memory emptyEquipment;
        return _stake(shipContracts[0], shipId, address(0), 0, false, 0, emptyEquipment, address(0));
    }

    function stakeBoth(uint256 shipId, address captainContract, uint256 captainId) external returns (uint256) {
        uint256[] memory emptyEquipment;
        return _stake(shipContracts[0], shipId, captainContract, captainId, false, 0, emptyEquipment, address(0));
    }

    function stake(
        address shipContract,
        uint256 shipId,
        address captainContract,
        uint256 captainId,
        bool hasSkin,
        uint256 skinId,
        uint256[] calldata equipmentIds,
        address referrer
    ) external returns (uint256) {
        return _stake(shipContract, shipId, captainContract, captainId, hasSkin, skinId, equipmentIds, referrer);
    }

    function claim(uint256 stakeId) external {
        require(msg.sender == stakes[stakeId].owner, "Sender isn't stake owner");
        require(block.number >= stakes[stakeId].endBlock, "Can't claim yet");
        require(!stakes[stakeId].claimed, "Stake is already claimed");

        stakes[stakeId].claimed = true;
        for (uint256 i = 0; i < stakeIds[msg.sender].length; i++) {
            if (stakeIds[msg.sender][i] == stakeId) {
                stakeIds[msg.sender][i] = stakeIds[msg.sender][stakeIds[msg.sender].length - 1];
                stakeIds[msg.sender].pop();
                break;
            }
        }

        // Transfer rewards

        grvx.mint(msg.sender, stakes[stakeId].grvxReward);

        if (stakes[stakeId].both) {
            stakesExtra[stakeId].voucherId = vouchers.mint(
                msg.sender,
                stakesExtra[stakeId].captainTypeId,
                1
            ) - 1;
        }

        if (stakesExtra[stakeId].hasSkin) {
            skins.transferFrom(address(this), msg.sender, stakesExtra[stakeId].skinId);
        }

        uint256 scrapQuantity = _random(
            stakes[stakeId].minScrap,
            stakes[stakeId].maxScrap
        );
        stakesExtra[stakeId].scrapQuantity = scrapQuantity;
        if (scrapQuantity > 0) {
            scrap.mint(msg.sender, scrapQuantity * 10**18);
        }
        
        if (stakes[stakeId].both) {
            stakesExtra[stakeId].veteranId = veterans.mint(
                msg.sender,
                stakes[stakeId].veteranTypeId,
                1
            ) - 1;
        }
    }

    // OWNER FUNCTIONS

    function setShipContract(address shipContract, bool allowed) external onlyOwner {
        require(shipContractAllowed[shipContract] != allowed, "Contract already in this status");
        shipContractAllowed[shipContract] = allowed;

        if (allowed) {
            shipContracts.push(shipContract);
        } else {
            for (uint8 i = 0; i < shipContracts.length; i++) {
                if (shipContracts[i] == shipContract) {
                    shipContracts[i] = shipContracts[shipContracts.length - 1];
                    shipContracts.pop();
                    return;
                }
            }
        }
    }

    function setCaptainContract(address captainContract, bool allowed) external onlyOwner {
        require(captainContractAllowed[captainContract] != allowed, "Contract already in this status");
        captainContractAllowed[captainContract] = allowed;

        if (allowed) {
            captainContracts.push(captainContract);
        } else {
            for (uint8 i = 0; i < captainContracts.length; i++) {
                if (captainContracts[i] == captainContract) {
                    captainContracts[i] = captainContracts[captainContracts.length - 1];
                    captainContracts.pop();
                    return;
                }
            }
        }
    }

    function setShipType(
        address shipContract,
        uint256 typeId,
        uint256 reward,
        uint256 stakingDuration,
        uint256 minScrap,
        uint256 maxScrap
    ) external onlyOwner {
        shipTypeInfo[shipContract][typeId] = ShipTypeInfo({
            reward: reward, 
            stakingDuration: stakingDuration,
            minScrap: minScrap,
            maxScrap: maxScrap
        });
    }

    function setCaptainType(
        address captainContract,
        uint256 typeId,
        bool allowed,
        uint256 veteranTypeId
    ) external onlyOwner {
        captainTypeInfo[captainContract][typeId] = CaptainTypeInfo({
            allowed: allowed,
            veteranTypeId: veteranTypeId
        });
    }

    function setEquipmentType(
        uint256 typeId,
        bool allowed,
        uint256 slot,
        uint256 minDurationBonus,
        uint256 maxDurationBonus,
        uint256 minRewardBonus,
        uint256 maxRewardBonus
    ) external onlyOwner {
        require(slot < totalEquipmentSlots, "Invalid slot value");
        require(maxDurationBonus <= MAX_DURATION_BONUS, "Duration bonus can not be greater than 90%");
        require(maxDurationBonus >= minDurationBonus, "Max duration bonus should be not less than min duration bonus");
        require(maxRewardBonus >= minRewardBonus, "Max reward bonus should be not less than min reward bonus");
        equipmentTypeInfo[typeId] = EquipmentTypeInfo({
            allowed: allowed,
            slot: slot,
            minDurationBonus: minDurationBonus,
            maxDurationBonus: maxDurationBonus,
            minRewardBonus: minRewardBonus,
            maxRewardBonus: maxRewardBonus
        });
    }

    function setStakeDisabled(bool disabled) external onlyOwner {
        stakeDisabled = disabled;
    }

    function setVouchersContract(address vouchers_) external onlyOwner {
        vouchers = ITypedNFT(vouchers_);
    }

    function setScrapContract(address scrap_) external onlyOwner {
        scrap = IMintableToken(scrap_);
    }

    function setEquipmentContract(address equipment_) external onlyOwner {
        equipment = ITypedNFT(equipment_);
    }

    function setSkinsContract(address skins_) external onlyOwner {
        skins = ITypedNFT(skins_);
    }

    function blockStake(uint256 stakeId) external onlyOwner {
        require(stakes[stakeId].owner != address(0), "Stake does not exist");
        require(!stakes[stakeId].claimed, "Already claimed");
        stakes[stakeId].claimed = true;
        address account = stakes[stakeId].owner;
        for (uint256 i = 0; i < stakeIds[account].length; i++) {
            if (stakeIds[account][i] == stakeId) {
                stakeIds[account][i] = stakeIds[account][stakeIds[account].length - 1];
                stakeIds[account].pop();
                break;
            }
        }
    }

    function unblockStake(uint256 stakeId) external onlyOwner {
        require(stakes[stakeId].owner != address(0), "Stake does not exist");
        require(stakes[stakeId].claimed, "Not blocked");
        stakes[stakeId].claimed = false;
        stakeIds[stakes[stakeId].owner].push(stakeId);
    }

    function setReferralStorage(address referralStorage_) external onlyOwner {
        referralStorage = IReferralStorage(referralStorage_);
    }

    // VIEW FUNCTIONS

    function stakesOf(
        address account
    ) external view returns (
        Stake[] memory accountStakes, StakeExtra[] memory accountStakesExtra
    ) {
        accountStakes = new Stake[](stakeIds[account].length);
        for (uint256 i = 0; i < stakeIds[account].length; i++) {
            accountStakes[i] = stakes[stakeIds[account][i]];
        }
        accountStakesExtra = new StakeExtra[](stakeIds[account].length);
        for (uint256 i = 0; i < stakeIds[account].length; i++) {
            accountStakesExtra[i] = stakesExtra[stakeIds[account][i]];
        }
    }

    function stakedEquipmentTypeIds(uint256 stakeId) external view returns (uint256[] memory) {
        return stakesExtra[stakeId].equipmentTypeIds;
    }

    // PRIVATE FUNCTIONS 

    function _stakeShip(
        address shipContract,
        uint256 shipId,
        bool hasSkin,
        uint256 skinId,
        uint256[] memory equipmentIds
    ) private returns (Stake memory newStake, StakeExtra memory newStakeExtra) {
        require(shipContractAllowed[shipContract], "This ship contract is not allowed");
        ITypedNFT ships = ITypedNFT(shipContract);
        uint256 shipTypeId = ships.getTokenType(shipId);
        ShipTypeInfo storage shipInfo = shipTypeInfo[shipContract][shipTypeId];
        require(shipInfo.reward != 0, "No staking available for this ship type");

        ships.transferFrom(msg.sender, address(this), shipId);
        ships.burn(shipId);

        (uint256 rewardBonus, uint256 durationBonus, uint256[] memory equipmentTypeIds) = _checkEquipment(equipmentIds);
        uint256 duration = shipInfo.stakingDuration - shipInfo.stakingDuration * durationBonus / (100 * 10**DECIMAL_PRECISION);

        if (hasSkin) {
            skins.transferFrom(msg.sender, address(this), skinId);
        }

        _lastStakeId++;
        newStake = Stake({
            id: _lastStakeId,
            owner: msg.sender,
            startBlock: block.number,
            endBlock: block.number + duration,
            grvxReward: shipInfo.reward + rewardBonus * 10**18,
            minScrap: shipInfo.minScrap,
            maxScrap: shipInfo.maxScrap,
            veteranTypeId: 0,
            both: false,
            claimed: false
        });
        newStakeExtra = StakeExtra({
            shipContract: shipContract,
            shipTypeId: shipTypeId,
            captainContract: address(0),
            captainTypeId: 0,
            scrapQuantity: 0,
            veteranId: 0,
            voucherId: 0,
            hasSkin: hasSkin,
            skinId: skinId,
            equipmentTypeIds: equipmentTypeIds
        });
    }

    function _stake(
        address shipContract,
        uint256 shipId,
        address captainContract,
        uint256 captainId,
        bool hasSkin,
        uint256 skinId,
        uint256[] memory equipmentIds,
        address referrer
    ) private returns (uint256) {
        require(!stakeDisabled, "Staking is disabled");

        (Stake memory newStake, StakeExtra memory newStakeExtra) = _stakeShip(
            shipContract,
            shipId,
            hasSkin,
            skinId,
            equipmentIds
        );

        if (captainContract != address(0)) {
            ITypedNFT captains = ITypedNFT(captainContract);

            require(captainContractAllowed[captainContract], "This captain contract is not allowed");
            uint256 captainTypeId = captains.getTokenType(captainId);
            CaptainTypeInfo storage captainInfo = captainTypeInfo[captainContract][captainTypeId];
            require(captainInfo.allowed, "No staking available for this captain type");
            captains.transferFrom(msg.sender, address(this), captainId);
            captains.burn(captainId);

            newStake.both = true;
            newStake.veteranTypeId = captainInfo.veteranTypeId;
            newStakeExtra.captainContract = captainContract;
            newStakeExtra.captainTypeId = captainTypeId;
        }

        stakes[_lastStakeId] = newStake;
        stakesExtra[_lastStakeId] = newStakeExtra;
        stakeIds[msg.sender].push(_lastStakeId);

        if (referrer != address(0)) {
            referralStorage.refer(msg.sender, referrer);
        }

        return _lastStakeId;
    }

    function _checkEquipment(
        uint256[] memory equipmentIds
    ) private returns (
        uint256 rewardBonus,
        uint256 durationBonus,
        uint256[] memory equipmentTypeIds
    ) {
        bool[] memory slotOccupied = new bool[](totalEquipmentSlots);
        equipmentTypeIds = new uint256[](equipmentIds.length);

        for (uint8 i = 0; i < equipmentIds.length; i++) {
            uint256 typeId = equipment.getTokenType(equipmentIds[i]);
            EquipmentTypeInfo memory equipmentInfo = equipmentTypeInfo[typeId];

            require(equipmentInfo.allowed, "This equipment type is not allowed");
            require(!slotOccupied[equipmentInfo.slot], "Equipment slot already occupied");

            equipment.transferFrom(msg.sender, address(this), equipmentIds[i]);
            equipment.burn(equipmentIds[i]);

            slotOccupied[equipmentInfo.slot] = true;
            equipmentTypeIds[i] = typeId;

            rewardBonus += _random(equipmentInfo.minRewardBonus, equipmentInfo.maxRewardBonus);
            durationBonus += _random(equipmentInfo.minDurationBonus, equipmentInfo.maxDurationBonus);
        }

        if (durationBonus > MAX_DURATION_BONUS) {
            durationBonus = MAX_DURATION_BONUS;
        }
    }

    function _random(uint256 from, uint256 to) private returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            _randomNonce
        )));
        _randomNonce++;
        return from + (random % (to - from + 1));
    }
}
