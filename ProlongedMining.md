# Mining

## Compile

Copy `example.env` to a new file called `.env` and fill the values in it.

```
npx hardhat compile
```

## Test

```
npx hardhat test
```

## Deploy Mining

Open file scripts/deploy-prolonged.js and replace empty address variables with correct values. Then run:

```
npx hardhat run scripts/deploy-prolonged.js --network [Your Network]
```

## Upgrade Mining

Open file scripts/upgrade-prolonged.js and replace proxy address with your proxy address. Then run:

```
npx hardhat run scripts/upgrade-prolonged.js --network [Your Network]
```

## Configuration

Чтобы подключиться к контракту через hardhat console, выполните следующие команды из командной строки в репозитории:

```
npx hardhat --network [Your network] console
```

```
mining = await ethers.getContractAt("ProlongedMiningV2", "[Mining proxy address]");
```

Для настройки контракта затем вызовите нужную функцию в соответствии с документацией ниже, например:

```
await mining.setCaptainContract("[Captain contract address]", true)
```

## Prolonged Mining Functions Docs

Контракт в целом по интерфейсу соответствует обычному майнингу версии 2 (см. README). Здесь описаны дополнительные или отличающиеся методы

### Constructor

```jsx
initialize(
    address grvx_,
    address vouchers_,
    address scrap_,
    address veterans_,
    address skins_,
    address referralStorage_,
)
```

**Parameters**

-   address grvx\_ - адрес контракта GRVX (ERC20)
-   address vouchers\_ - адрес контракта ваучеров (ERC721)
-   address scrap\_ - адрес контракта металла (ERC20)
-   address veterans\_ - адрес контракта ветеранов (ERC721)
-   address skins\_ - адрес контракта скинов (ERC721)
-   address referralStorage\_ - адрес контракта реферального хранилища

### Stake Prolonged

Функция стейка для продленного майнинга. Позволяет застейкать любой разрешенный набор токенов (корабль или корабль с капитаном, плюс по желанию скин и/или снаряжение).
Должно быть выдано разрешение контракту майнинга на передаваемые токены.

```jsx
function stake(
    address shipContract,
    uint256 shipId,
    address captainContract,
    uint256 captainId,
    uint256 skinId,
    uint256 prolongedType,
    address[] calldata equipmentContracts,
    uint256[] calldata equipmentIds,
    address referrer
) external returns (uint256)
```

**Parameters**

-   address shipContract - адрес контракта кораблей, с которого стейкается корабль
-   uint256 shipId - ID токена корабля
-   address captainContract - адрес контракта капитанов, с которого стейкается капитан (нулевой адрес, если стейк без капитана)
-   uint256 captainId - ID токена капитана (если капитана нет, то любое число)
-   uint256 skinId - ID токена скина (если скина нет, MAX_UINT_256)
-   uint256 prolongedType - ID типа продленного майнинга (тип должен быть разрешен)
-   address[] equipmentContracts - массив адресов контрактов снаряжения (пустой, если снаряжения нет; без дубликатов)
-   uint256[] equipmentIds - массив ID токенов снаряжения (должен совпадать по длине с equipmentContracts)
-   address referrer - адрес реферала, если он есть (нулевой адрес, если нет)

**Return value**

ID стейка

### Set Ship Type Prolonged

Функция позволяет установить параметры продленного стейкинга типа корабля. Может быть вызвана только владельцем контракта.

```jsx
function setShipTypeProlonged(
    address shipContract,
    uint256 typeId,
    uint256 prolongedType,
    uint256 reward,
    uint256 stakingDuration,
    uint256 minScrap,
    uint256 maxScrap
)
```

**Parameters**

-   address shipContract - адрес контракта кораблей, на котором настраивается тип
-   uint256 typeId - ID типа корабля, который меняется
-   uint256 prolongedType - ID типа продленного стейкинга
-   uint256 reward - общая награда за продленный стейкинг этого типа токена
-   uint256 stakingDuration - длительность продленного стейкинга токена в блоках

### Set Equipment Type Prolonged

Функция позволяет установить параметры продленного стейкинга типа снаряжения. Может быть вызвана только владельцем контракта.

```jsx
function setEquipmentType(
    address equipmentContract,
    uint256 typeId,
    bool allowed,
    uint256 minDurationBonus,
    uint256 maxDurationBonus,
    uint256 minRewardBonus,
    uint256 maxRewardBonus
)
```

**Parameters**

-   address equipmentContract - адрес контракта снаряжения, на котором настраивается тип
-   uint256 typeId - ID настраиваемого типа
-   bool allowed - разрешен ли продленный стейкинг этого типа
-   uint256 minDurationBonus - минимальный бонус длительности в процентах
-   uint256 maxDurationBonus - максимальной бонус длительности в процентах
-   uint256 minRewardBonus - минимальный бонус награды в ether
-   uint256 maxRewardBonus - максимальный бонус награды в ether

### Stakes

Возвращает по ID стейка основную информацию о нем

```jsx
stakes(uint256 stakeId) returns (Stake)
```

**Parameters**

-   uint256 stakeId - ID стейка

**Return**

-   uint256 id - ID стейка
-   address owner - владелец стейка
-   uint256 startBlock - блок начала стейка
-   uint256 endBlock - блок конца стейка
-   uint256 grvxReward - общая награда за стейк в GRVX (wei)
-   uint256 minScrap - минимально возможное количество металла
-   uint256 maxScrap - максимально возможное количество металла
-   uint256 veteranTypeId - тип выдаваемого ветерана
-   bool both - true если в стейке есть капитан, false иначе
-   bool claimed - true если награда уже забрана, false иначе
-   uint256 prolongedType - тип продленного стейкинга (MAX_UINT_256 в случае обычного стейкинга)
