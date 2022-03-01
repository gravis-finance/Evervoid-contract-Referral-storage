//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITypedNFT {
    function mint(address _to, uint256 _type, uint256 _amount) external returns (uint256);
    function getTypeInfo(uint256 _typeId) external view returns (
        uint256 nominalPrice,
        uint256 capSupply,
        uint256 maxSupply,
        string memory info,
        address minterOnly,
        string memory uri
    );
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function burn(uint256 tokenId) external;
    function getTokenType(uint256 _tokenId) external view returns (uint256);
}