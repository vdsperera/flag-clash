// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract FlagClash is Ownable, ReentrancyGuard, Pausable {
    IERC20 public usdt;

    uint256 public constant POINT_COST = 100_000; // 0.1 USDT (6 decimals)
    uint256 public constant PLATFORM_FEE_PCT = 5;

    enum MatchState { OPEN, RESOLVED }

    struct Match {
        MatchState state;
        uint8 winningTeam; // 0 for India, 1 for Sri Lanka (valid only if RESOLVED)
        uint256 scoreIndia;
        uint256 scoreSL;
        uint256 totalPoolIndia;
        uint256 totalPoolSL;
    }

    uint256 public currentMatchId;
    mapping(uint256 => Match) public matches;

    // Track user backings: mapping(matchId => mapping(user => mapping(team => amount)))
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public userBacking;
    
    // Track if a user has claimed their prize: mapping(matchId => mapping(user => bool))
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event MatchStarted(uint256 indexed matchId);
    event TeamBacked(uint256 indexed matchId, address indexed user, uint8 team, uint256 amount, uint256 pointsScored);
    event WinnerDeclared(uint256 indexed matchId, uint8 winningTeam, uint256 totalPool, uint256 netPrizePool);
    event PrizeClaimed(uint256 indexed matchId, address indexed user, uint256 amount);

    constructor(address _usdtAddress) Ownable(msg.sender) {
        usdt = IERC20(_usdtAddress);
        startNewMatch();
    }

    function startNewMatch() public onlyOwner {
        if (currentMatchId > 0) {
            require(matches[currentMatchId].state == MatchState.RESOLVED, "Current match must be resolved to start a new one");
        }
        currentMatchId++;
        matches[currentMatchId] = Match({
            state: MatchState.OPEN,
            winningTeam: 0,
            scoreIndia: 0,
            scoreSL: 0,
            totalPoolIndia: 0,
            totalPoolSL: 0
        });
        emit MatchStarted(currentMatchId);
    }

    function backTeam(uint256 matchId, uint8 team, uint256 amount) external nonReentrant whenNotPaused {
        require(matchId == currentMatchId, "Can only back the current match");
        Match storage currentMatch = matches[matchId];
        require(currentMatch.state == MatchState.OPEN, "Match is not open");
        require(team == 0 || team == 1, "Invalid team. 0 = India, 1 = Sri Lanka");
        require(amount >= POINT_COST, "Minimum backing is 0.1 USDT");
        require(amount % POINT_COST == 0, "Amount must be multiple of 0.1 USDT");

        // Transfer USDT from user to contract
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 points = amount / POINT_COST;

        if (team == 0) {
            currentMatch.scoreIndia += points;
            currentMatch.totalPoolIndia += amount;
        } else {
            currentMatch.scoreSL += points;
            currentMatch.totalPoolSL += amount;
        }

        userBacking[matchId][msg.sender][team] += amount;

        emit TeamBacked(matchId, msg.sender, team, amount, points);
    }

    function declareWinner(uint256 matchId, uint8 team) external onlyOwner {
        Match storage currentMatch = matches[matchId];
        require(currentMatch.state == MatchState.OPEN, "Match is already resolved");
        require(team == 0 || team == 1, "Invalid team");

        currentMatch.winningTeam = team;
        currentMatch.state = MatchState.RESOLVED;

        uint256 totalPool = currentMatch.totalPoolIndia + currentMatch.totalPoolSL;
        uint256 platformFee = (totalPool * PLATFORM_FEE_PCT) / 100;
        uint256 netPrizePool = totalPool - platformFee;

        // Transfer platform fee to owner
        if (platformFee > 0) {
            require(usdt.transfer(owner(), platformFee), "Fee transfer failed");
        }

        emit WinnerDeclared(matchId, currentMatch.winningTeam, totalPool, netPrizePool);
    }

    function claimPrize(uint256 matchId) external nonReentrant whenNotPaused {
        Match storage targetMatch = matches[matchId];
        require(targetMatch.state == MatchState.RESOLVED, "Match not yet resolved");
        require(!hasClaimed[matchId][msg.sender], "Prize already claimed");

        uint256 userSpend = userBacking[matchId][msg.sender][targetMatch.winningTeam];
        require(userSpend > 0, "No winning backing");

        uint256 winningPool = (targetMatch.winningTeam == 0) ? targetMatch.totalPoolIndia : targetMatch.totalPoolSL;
        
        uint256 totalPool = targetMatch.totalPoolIndia + targetMatch.totalPoolSL;
        uint256 netPrizePool = totalPool - ((totalPool * PLATFORM_FEE_PCT) / 100);

        // Calculate proportional share
        uint256 userShare = (userSpend * netPrizePool) / winningPool;

        hasClaimed[matchId][msg.sender] = true;

        require(usdt.transfer(msg.sender, userShare), "Payout transfer failed");

        emit PrizeClaimed(matchId, msg.sender, userShare);
    }

    function getMatchState(uint256 matchId) external view returns (
        MatchState state,
        uint8 winner,
        uint256 sIndia,
        uint256 sSL,
        uint256 poolIndia,
        uint256 poolSL,
        bool claimed
    ) {
        Match memory m = matches[matchId];
        return (
            m.state,
            m.winningTeam,
            m.scoreIndia,
            m.scoreSL,
            m.totalPoolIndia,
            m.totalPoolSL,
            hasClaimed[matchId][msg.sender]
        );
    }

    function getUserBacking(uint256 matchId, address user) external view returns (uint256 indiaBacking, uint256 slBacking) {
        return (userBacking[matchId][user][0], userBacking[matchId][user][1]);
    }

    // Pausable controls
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
