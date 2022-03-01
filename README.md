# Evervoid Referral Storage

This contract serves to collect and provide rewards for users who have invited users through the referral program.

The page of the site where the referral program is located: https://evervo.id/referral-program?network=56

## Compile

Copy `example.env` to a new file called `.env` and fill the values in it.

```
npx hardhat compile
```

## Test

```
npx hardhat test
```

## Deploy Referral Storage

Open file scripts/deploy-storage.js and replace empty address variables with correct values. Then run:

```
npx hardhat run scripts/deploy-storage.js --network [Your Network]
```

## Upgrade Referral Storage

Open file scripts/upgrade-storage.js and replace proxy address with your proxy address. Then run:

```
npx hardhat run scripts/upgrade-storage.js --network [Your Network]
```

## Configuration.

To connect to the contract via hardhat console, run the following commands from the command line in the repository:

```
npx hardhat --network [Your network] console
```

```
referral = await ethers.getContractAt("ReferralStorage", "[Referral proxy address]");
```

## Referral Storage Functions Docs

### Constructor

``jsx
initialize(Reward[] memory rewards_, uint256[] memory levelInvitees_)
```

**Parameters**

- Reward[] memory rewards\_ - array with the list of rewards by level
- uint256[] memory levelInvitees\_ - array with the list of invitees by levels

**Reward** - object which includes the following fields:

- tokenType - 0 if ERC20, 1 if ERC721
- token - the contract address of the issued token
- typeId - token type for ERC721 (any number for ERC20)
- amount - number of issued tokens

### Claim Reward

This method is used to get a reward once you have enough invitees

``jsx
function claimReward(uint256 level)
```

**Parameters**

- uint256 level - level at which the reward is given

### Set Program

This method allows the owner of the contract to activate or deactivate another referral program (contract)

``jsx
function setProgram(address program, bool enabled)
```

**Parameters**

- address program - address of the contract program
- bool enabled - true to allow the program, false to prohibit

### Set Levels

This method allows the owner of the contract to set a new list of levels and awards

``jsx
function setLevels(Reward[] memory rewards_, uint256[] memory levelInvitees_)
```

**Parameters**

- Reward[] memory rewards\_ - array with the list of rewards by levels
- uint256[] memory levelInvitees\_ - array with the list of invitees by levels

**Reward** - object which includes the following fields:

- tokenType - 0 if ERC20, 1 if ERC721
- token - the contract address of the issued token
- typeId - token type for ERC721 (any number for ERC20)
- amount - number of issued tokens

### Get Invitees Count

This method allows to get the number of invites by address

```
function getInviteesCount(address referrer) external view returns (uint256)
```

**Parameters**

- address referrer - address of the inviter

**Return**

Number of invited addresses

### Get Invitees

This method allows you to get a list of the addresses invited by the address

```
function getInvitees(address referrer) external view returns (address[] memory)
```

**Parameters**

- address referrer - address of the inviter

**Return**.

List of invited addresses
