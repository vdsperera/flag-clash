// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlagClash is Ownable, ReentrancyGuard {
    IERC20 public usdt;

    uint256 public constant POINT_COST = 100_000; // 0.1 USDT (6 decimals)
    uint256 public constant PLATFORM_FEE_PCT = 5;

    enum MatchState { OPEN, RESOLVED }
    MatchState public currentState;
    uint8 public winningTeam; // 0 for India, 1 for Sri Lanka (valid only if RESOLVED)

    uint256 public scoreIndia;
    uint256 public scoreSL;

    uint256 public totalPoolIndia;
    uint256 public totalPoolSL;

    // Track user backings: mapping(user => mapping(team => amount))
    mapping(address => mapping(uint8 => uint256)) public userBacking;
    
    // Track if a user has claimed their prize
    mapping(address => bool) public hasClaimed;

    event TeamBacked(address indexed user, uint8 team, uint256 amount, uint256 pointsScored);
    event WinnerDeclared(uint8 winningTeam, uint256 totalPool, uint256 netPrizePool);
    event PrizeClaimed(address indexed user, uint256 amount);
    event MatchReset();

    constructor(address _usdtAddress) Ownable(msg.sender) {
        usdt = IERC20(_usdtAddress);
        currentState = MatchState.OPEN;
    }

    function backTeam(uint8 team, uint256 amount) external nonReentrant {
        require(currentState == MatchState.OPEN, "Match is not open");
        require(team == 0 || team == 1, "Invalid team. 0 = India, 1 = Sri Lanka");
        require(amount >= POINT_COST, "Minimum backing is 0.1 USDT");
        require(amount % POINT_COST == 0, "Amount must be multiple of 0.1 USDT");

        // Transfer USDT from user to contract
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 points = amount / POINT_COST;

        if (team == 0) {
            scoreIndia += points;
            totalPoolIndia += amount;
        } else {
            scoreSL += points;
            totalPoolSL += amount;
        }

        userBacking[msg.sender][team] += amount;

        emit TeamBacked(msg.sender, team, amount, points);
    }

    function declareWinner(uint8 team) external onlyOwner {
        require(currentState == MatchState.OPEN, "Match is already resolved");
        require(team == 0 || team == 1, "Invalid team");

        winningTeam = team;
        currentState = MatchState.RESOLVED;

        uint256 totalPool = totalPoolIndia + totalPoolSL;
        uint256 platformFee = (totalPool * PLATFORM_FEE_PCT) / 100;
        uint256 netPrizePool = totalPool - platformFee;

        // Transfer platform fee to owner
        if (platformFee > 0) {
            require(usdt.transfer(owner(), platformFee), "Fee transfer failed");
        }

        emit WinnerDeclared(winningTeam, totalPool, netPrizePool);
    }

    function claimPrize() external nonReentrant {
        require(currentState == MatchState.RESOLVED, "Match not yet resolved");
        require(!hasClaimed[msg.sender], "Prize already claimed");

        uint256 userSpend = userBacking[msg.sender][winningTeam];
        require(userSpend > 0, "No winning backing");

        uint256 winningPool = (winningTeam == 0) ? totalPoolIndia : totalPoolSL;
        
        uint256 totalPool = totalPoolIndia + totalPoolSL;
        uint256 netPrizePool = totalPool - ((totalPool * PLATFORM_FEE_PCT) / 100);

        // Calculate proportional share
        uint256 userShare = (userSpend * netPrizePool) / winningPool;

        hasClaimed[msg.sender] = true;

        require(usdt.transfer(msg.sender, userShare), "Payout transfer failed");

        emit PrizeClaimed(msg.sender, userShare);
    }

    function resetMatch() external onlyOwner {
        require(currentState == MatchState.RESOLVED, "Match must be resolved to reset");
        
        currentState = MatchState.OPEN;
        scoreIndia = 0;
        scoreSL = 0;
        totalPoolIndia = 0;
        totalPoolSL = 0;
        // Note: we don't clear the mappings. In a real production app, it's better to 
        // use an active match ID, so users can still claim from past matches.
        // For simplicity in this demo, resetMatch should really only be called after claims.

        emit MatchReset();
    }

    function getMatchState() external view returns (
        MatchState state,
        uint8 winner,
        uint256 sIndia,
        uint256 sSL,
        uint256 poolIndia,
        uint256 poolSL,
        bool claimed
    ) {
        return (
            currentState,
            winningTeam,
            scoreIndia,
            scoreSL,
            totalPoolIndia,
            totalPoolSL,
            hasClaimed[msg.sender]
        );
    }

    function getUserBacking(address user) external view returns (uint256 indiaBacking, uint256 slBacking) {
        return (userBacking[user][0], userBacking[user][1]);
    }
}
