//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IMintableToken.sol";
import "./interfaces/ITypedNFT.sol";

contract ReferralStorage is OwnableUpgradeable {

    mapping(address => bool) public programEnabled;

    mapping(address => address) public referrers;

    mapping(address => address) public referredProgram;

    mapping(address => address[]) public invitees;

    // Not used in V2
    mapping(address => bool) public rewardClaimed;

    // Not used in V2
    uint256 public rewardInvitees;

    enum TokenType {
        ERC20,
        ERC721
    }

    struct Reward {
        TokenType tokenType;
        address token;
        uint256 typeId;
        uint256 amount;
    }

    Reward[] public rewards;

    uint256[] public levelInvitees;

    mapping(address => mapping(uint256 => bool)) public levelClaimed;

    // EVENTS

    event Reference(address indexed inviteee, address indexed referrer, address indexed program);

    event RewardClaimed(address indexed claimer, uint256 indexed level);

    // CONSTRUCTOR

    function initialize(Reward[] memory rewards_, uint256[] memory levelInvitees_) external initializer {
        __Ownable_init();

        require(rewards_.length == levelInvitees_.length, "Length mismatch");
        for (uint256 i = 0; i < rewards_.length; i++) {
            rewards.push(rewards_[i]);
        }
        for (uint256 i = 0; i < levelInvitees_.length; i++) {
            levelInvitees.push(levelInvitees_[i]);
        }
    }

    // PUBLIC FUNCTIONS

    function refer(address invitee, address referrer) external {
        require(programEnabled[msg.sender], "This referral program is not enabled");

        if (referrers[invitee] == address(0)) {
            referrers[invitee] = referrer;
            referredProgram[invitee] = msg.sender;
            invitees[referrer].push(invitee);
            emit Reference(invitee, referrer, msg.sender);
        }
    }

    function claimReward(uint256 level) external {
        require(invitees[msg.sender].length >= levelInvitees[level], "Not enough invitees for reward");
        require(!levelClaimed[msg.sender][level], "Already claimed");

        levelClaimed[msg.sender][level] = true;
        if (rewards[level].tokenType == TokenType.ERC20) {
            IMintableToken(rewards[level].token).mint(msg.sender, rewards[level].amount);
        } else {
            ITypedNFT(rewards[level].token).mint(msg.sender, rewards[level].typeId, rewards[level].amount);
        }

        emit RewardClaimed(msg.sender, level);
    }

    // CONFIGURATION

    function setProgram(address program, bool enabled) external onlyOwner {
        programEnabled[program] = enabled;
    }

    function setLevels(Reward[] memory rewards_, uint256[] memory levelInvitees_) external onlyOwner {
        require(rewards_.length == levelInvitees_.length, "Length mismatch");

        for (uint256 i = 0; i < rewards_.length; i++) {
            if (i < rewards.length) {
                rewards[i] = rewards_[i];
                levelInvitees[i] = levelInvitees_[i];
            } else {
                rewards.push(rewards_[i]);
                levelInvitees.push(levelInvitees_[i]);
            }
        }
        while (rewards.length > rewards_.length) {
            rewards.pop();
            levelInvitees.pop();
        }
    }

    // VIEW FUNCTIONS

    function getInviteesCount(address referrer) external view returns (uint256) {
        return invitees[referrer].length;
    }

    function getInvitees(address referrer) external view returns (address[] memory) {
        return invitees[referrer];
    }
}